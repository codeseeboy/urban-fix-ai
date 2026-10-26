/**
 * Civic-issue photo analysis with Gemini Flash-Lite on Vertex AI.
 *
 * Replaces the old self-hosted CV stack (YOLO + SigLIP + flood classifier). One call
 * returns everything the report flow needs: is this a real civic problem, which
 * category, how severe, a factual title/description, and routing metadata.
 *
 * Cost: the photo is downscaled to 768px and sent at low media resolution, so an
 * analysis is roughly 1k input tokens and ~200 output tokens on a Flash-Lite model.
 *
 * Results are cached by image hash, so the app can call /analyze-image to preview
 * the verdict and then submit the same photo without paying for a second analysis.
 */

const crypto = require('crypto');
const sharp = require('sharp');
const { generate } = require('../llm/providers');

const CATEGORIES = ['roads', 'trash', 'water', 'drainage', 'lighting', 'electricity', 'parks', 'safety', 'other'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

// Canonical department per category. Matches the BDA layer's normalisation so
// analytics and routing agree on one vocabulary.
const DEPARTMENTS = {
    roads: 'PWD',
    trash: 'Sanitation',
    water: 'Water Supply',
    drainage: 'Drainage',
    lighting: 'Electrical',
    electricity: 'Electrical',
    parks: 'Horticulture',
    safety: 'Safety',
    other: 'General',
};

const CATEGORY_TAGS = {
    roads: 'road-damage',
    trash: 'sanitation',
    water: 'water-supply',
    drainage: 'drainage',
    lighting: 'lighting',
    electricity: 'electrical-hazard',
    parks: 'horticulture',
    safety: 'public-safety',
    other: 'civic',
};

const SYSTEM_PROMPT = `You are UrbanFix's civic-issue vision analyst for Indian cities.
A citizen photographed something to report to the municipality. Decide whether the
photo shows a genuine, actionable PUBLIC civic problem, and if so classify it.

Categories:
- roads: potholes, cracked/broken road or footpath, damaged speed breaker, road debris
- trash: garbage dump, overflowing bin, littering, construction waste on public land
- water: leaking/burst pipe, water wastage, contaminated public water
- drainage: blocked or overflowing drain, sewage overflow, waterlogging, open/broken manhole
- lighting: broken or non-working streetlight, dark unlit stretch
- electricity: fallen or exposed wires, damaged pole, transformer hazard
- parks: fallen tree, overgrown vegetation, broken park equipment or bench
- safety: dangerous structure, broken traffic signal, encroachment blocking public way
- other: genuine public civic problem that fits none of the above

Severity:
- Critical: immediate danger to life (live wires, open manhole in a road, collapsing structure, deep crater on a main road, severe flooding)
- High: serious hazard or disruption to many people
- Medium: clear problem with moderate impact
- Low: minor or cosmetic

Reject (is_civic_issue=false) selfies, people as the subject, indoor/private spaces,
screenshots, documents, food, memes, cartoons, drawings, random objects, and photos
too dark or blurry to judge. Be honest: if unsure, lower the confidence rather than
inventing details. Write title (max 60 characters) and description (1-2 sentences)
in plain English, factual, no emojis. Describe only what is visible. observations:
up to 4 short factual points about what is visible.`;

// Gemini responseSchema (OpenAPI subset) — forces well-formed JSON.
const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        is_civic_issue: { type: 'BOOLEAN' },
        rejection_reason: { type: 'STRING' },
        category: { type: 'STRING', enum: CATEGORIES },
        confidence: { type: 'NUMBER' },
        severity: { type: 'STRING', enum: SEVERITIES },
        title: { type: 'STRING' },
        description: { type: 'STRING' },
        observations: { type: 'ARRAY', items: { type: 'STRING' } },
        is_emergency: { type: 'BOOLEAN' },
    },
    required: ['is_civic_issue', 'category', 'confidence', 'severity', 'title', 'description', 'observations', 'is_emergency'],
    propertyOrdering: ['is_civic_issue', 'rejection_reason', 'category', 'confidence', 'severity', 'title', 'description', 'observations', 'is_emergency'],
};

// ─── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map(); // hash -> { at, result }

function hashImage(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function cacheGet(hash) {
    const hit = cache.get(hash);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) {
        cache.delete(hash);
        return null;
    }
    return hit.result;
}

function cacheSet(hash, result) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(hash, { at: Date.now(), result });
}

// ─── Normalisation ──────────────────────────────────────────────────────────

function clamp01(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0.5;
    return Math.min(1, Math.max(0, x > 1 ? x / 100 : x));
}

function priorityFor({ severity, confidence, isEmergency }) {
    const base = { Critical: 85, High: 65, Medium: 45, Low: 25 }[severity] ?? 40;
    let score = base + Math.round((confidence - 0.5) * 20);
    if (isEmergency) score += 10;
    return Math.max(0, Math.min(100, score));
}

function normalise(raw, meta) {
    const category = CATEGORIES.includes(raw?.category) ? raw.category : 'other';
    const severity = SEVERITIES.includes(raw?.severity) ? raw.severity : 'Medium';
    const confidence = clamp01(raw?.confidence);
    const isValid = raw?.is_civic_issue !== false;
    const isEmergency = Boolean(raw?.is_emergency) && isValid;
    const observations = Array.isArray(raw?.observations)
        ? raw.observations.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 4)
        : [];

    const tags = [category, CATEGORY_TAGS[category]];
    if (severity === 'High' || severity === 'Critical') tags.push('urgent');
    if (isEmergency) tags.push('emergency');

    return {
        isValid,
        rejectionReason: isValid ? null : String(raw?.rejection_reason || 'This photo does not look like a public civic issue.'),
        category,
        confidence: Number(confidence.toFixed(2)),
        severity,
        title: String(raw?.title || '').trim().slice(0, 80),
        description: String(raw?.description || '').trim().slice(0, 500),
        observations,
        isEmergency,
        departmentTag: DEPARTMENTS[category],
        priorityScore: isValid ? priorityFor({ severity, confidence, isEmergency }) : 0,
        tags: [...new Set(tags)],
        provider: meta.provider,
        model: meta.model,
        latencyMs: meta.latencyMs,
    };
}

// ─── Vertex call ────────────────────────────────────────────────────────────

function userHint(note) {
    const trimmed = String(note || '').trim().slice(0, 400);
    return trimmed ? `Citizen's note (may be inaccurate, trust the photo): "${trimmed}"` : 'No note from the citizen.';
}

/** Downscale to fit 768x768 JPEG — the model gains nothing above this, and tokens/latency drop. */
async function prepareImage(buffer) {
    return sharp(buffer, { failOn: 'none' })
        .rotate() // respect EXIF orientation from phone cameras
        .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
}

/**
 * Analyse a civic-issue photo.
 * @param {object} opts
 * @param {Buffer} opts.buffer
 * @param {string} [opts.note]  optional citizen description, used as a hint only
 * @returns {Promise<object>} normalised analysis (see normalise())
 * @throws {Error} code AI_UNAVAILABLE | BAD_IMAGE
 */
async function analyzeImage({ buffer, note }) {
    if (!buffer || !buffer.length) {
        const err = new Error('Image is empty.');
        err.code = 'BAD_IMAGE';
        throw err;
    }
    const hash = hashImage(buffer);
    const cached = cacheGet(hash);
    if (cached) return { ...cached, cached: true };

    let image;
    try {
        image = await prepareImage(buffer);
    } catch {
        const err = new Error('Could not read this image. Please retake the photo.');
        err.code = 'BAD_IMAGE';
        throw err;
    }

    const started = Date.now();
    try {
        const { json, model, usage } = await generate({
            kind: 'vision',
            system: SYSTEM_PROMPT,
            schema: RESPONSE_SCHEMA,
            temperature: 0.2,
            maxOutputTokens: 600,
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } },
                    { text: `Analyse this report photo. ${userHint(note)}` },
                ],
            }],
        });
        if (!json) throw new Error('model returned unparseable JSON');
        const result = normalise(json, { provider: 'vertex-ai', model, latencyMs: Date.now() - started });
        if (usage) result.tokens = { input: usage.promptTokenCount ?? null, output: usage.candidatesTokenCount ?? null };
        cacheSet(hash, result);
        return { ...result, cached: false };
    } catch (err) {
        console.warn(`[vision] analysis failed — ${err.message}`);
        const wrapped = new Error('AI analysis is unavailable right now. You can still submit the report.');
        wrapped.code = 'AI_UNAVAILABLE';
        wrapped.cause = err;
        throw wrapped;
    }
}

module.exports = { analyzeImage, hashImage, CATEGORIES, SEVERITIES, DEPARTMENTS, CATEGORY_TAGS };
