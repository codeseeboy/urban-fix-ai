/**
 * AI service facade used by the issue routes.
 *
 * Image understanding is done by Gemini Flash-Lite on Vertex AI (see ./vision).
 * When there is no photo, or the model is unreachable, a small rule-based path
 * still produces a sensible department, severity and priority so a citizen's
 * report is never lost because the AI was down.
 */

const { analyzeImage, DEPARTMENTS, CATEGORY_TAGS, CATEGORIES } = require('./vision');

// ─── Rule-based fallbacks ───────────────────────────────────────────────────

const BASE_SEVERITY = {
    roads: 'Medium',
    lighting: 'Medium',
    trash: 'Low',
    water: 'Medium',
    parks: 'Low',
    drainage: 'Medium',
    electricity: 'High',
    safety: 'High',
    other: 'Low',
};

function normaliseCategory(category) {
    const c = String(category || '').toLowerCase().trim();
    if (c === 'garbage') return 'trash';
    return CATEGORIES.includes(c) ? c : 'other';
}

function routeToDepartment(category) {
    return DEPARTMENTS[normaliseCategory(category)] || 'General';
}

function ruleSeverity(category, emergency) {
    if (emergency) return 'Critical';
    return BASE_SEVERITY[normaliseCategory(category)] || 'Low';
}

/**
 * Priority 0-100 used to order municipal work queues. Recomputed as an issue
 * gathers support, so it is a function of current state, not a stored guess.
 */
function calculatePriority({ severity, upvoteCount = 0, createdAt = new Date(), emergency = false }) {
    const severityScores = { Critical: 40, High: 30, Medium: 20, Low: 10 };
    let score = severityScores[severity] || 15;
    score += Math.min(upvoteCount * 3, 30);
    if (emergency) score += 20;
    const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
    if (ageHours > 168) score += 10; // unresolved for over a week
    return Math.min(Math.round(score), 100);
}

const KEYWORD_TAGS = {
    pothole: 'road-damage',
    crack: 'road-damage',
    garbage: 'sanitation',
    trash: 'sanitation',
    flood: 'drainage',
    drain: 'drainage',
    sewage: 'drainage',
    dark: 'lighting',
    streetlight: 'lighting',
    leak: 'water-supply',
    wire: 'electrical-hazard',
    tree: 'horticulture',
    danger: 'public-safety',
};

function generateTags({ category, description, title }) {
    const cat = normaliseCategory(category);
    const tags = [cat, CATEGORY_TAGS[cat]];
    const text = `${title || ''} ${description || ''}`.toLowerCase();
    for (const [keyword, tag] of Object.entries(KEYWORD_TAGS)) {
        if (text.includes(keyword)) tags.push(tag);
    }
    return [...new Set(tags.filter(Boolean))].slice(0, 5);
}

// ─── Unified analysis for issue creation ────────────────────────────────────

/**
 * Decide severity, department, tags and priority for a new report.
 *
 * @returns {Promise<{
 *   aiSeverity: string, departmentTag: string, aiTags: string[], priorityScore: number,
 *   category: string, isValid: boolean, rejectionReason: string|null,
 *   analysis: object|null, provider: string
 * }>}
 */
async function analyzeIssue({ category, description, title, emergency, imageBuffer }) {
    const userCategory = normaliseCategory(category);

    if (imageBuffer) {
        try {
            const a = await analyzeImage({ buffer: imageBuffer, note: [title, description].filter(Boolean).join(' — ') });
            // The citizen picked a category; when the model is confident it disagrees,
            // trust the model — it is what routes the report to the right department.
            const finalCategory = a.isValid && a.confidence >= 0.7 ? a.category : userCategory;
            const severity = emergency && a.severity !== 'Critical' ? 'Critical' : a.severity;
            return {
                aiSeverity: severity,
                departmentTag: DEPARTMENTS[finalCategory] || 'General',
                aiTags: [...new Set([...a.tags, ...generateTags({ category: finalCategory, description, title })])].slice(0, 6),
                priorityScore: Math.max(a.priorityScore, calculatePriority({ severity, emergency })),
                category: finalCategory,
                isValid: a.isValid,
                rejectionReason: a.rejectionReason,
                analysis: a,
                provider: a.provider,
            };
        } catch (err) {
            console.warn(`[ai] image analysis unavailable, using rules: ${err.message}`);
        }
    }

    const severity = ruleSeverity(userCategory, emergency);
    return {
        aiSeverity: severity,
        departmentTag: routeToDepartment(userCategory),
        aiTags: generateTags({ category: userCategory, description, title }),
        priorityScore: calculatePriority({ severity, emergency }),
        category: userCategory,
        isValid: true,
        rejectionReason: null,
        analysis: null,
        provider: 'rules',
    };
}

module.exports = {
    analyzeImage,
    analyzeIssue,
    calculatePriority,
    routeToDepartment,
    generateTags,
    normaliseCategory,
};
