const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { generateJSON, sanitizeText } = require('../services/llm/polishReply');
const {
    REFINE_SYSTEM,
    getRefineUserPrompt,
    EXPLAIN_SYSTEM,
    getExplainUserPrompt,
} = require('../services/llm/prompts');

const router = express.Router();

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function toBool(v, fallback = false) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === 'true') return true;
        if (s === 'false') return false;
    }
    return fallback;
}

function toNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function cleanText(v, fallback, maxLen) {
    const s = sanitizeText(typeof v === 'string' ? v : fallback, maxLen);
    return s || fallback;
}

function validateRefineOutput(raw, input) {
    const titleFallback = cleanText(input.user_title, 'Civic issue report', 120);
    const descFallback = cleanText(input.user_description, 'Issue requires municipal attention.', 320);

    const confidence = clamp(toNumber(raw?.confidence_alignment, 0.6), 0, 1);
    const matched = typeof raw?.matched === 'boolean' ? raw.matched : confidence >= 0.65;

    return {
        title: cleanText(raw?.title, titleFallback, 120),
        description: cleanText(raw?.description, descFallback, 320),
        matched,
        confidence_alignment: Number(confidence.toFixed(3)),
        severity_reason: cleanText(raw?.severity_reason, 'Issue can affect public safety and daily movement.', 200),
    };
}

function validateExplainOutput(raw, input) {
    const severityReasonFallback = `${input.label || 'This issue'} at ${input.location || 'the reported location'} needs attention due to ${input.severity || 'its impact'}.`;

    return {
        explanation: cleanText(raw?.explanation, 'This civic issue should be addressed to avoid further public inconvenience and safety risk.', 360),
        next_step: cleanText(raw?.next_step, 'Please monitor updates and escalate with local authorities if unresolved.', 200),
        severity_reason: cleanText(raw?.severity_reason, severityReasonFallback, 220),
        confidence_alignment: Number(clamp(toNumber(raw?.confidence_alignment, 0.7), 0, 1).toFixed(3)),
        matched: toBool(raw?.matched, true),
    };
}

router.post('/refine', protect, async (req, res) => {
    try {
        const payload = {
            detected_issue: sanitizeText(req.body?.detected_issue, 120) || 'civic issue',
            category: sanitizeText(req.body?.category, 60) || 'other',
            user_title: sanitizeText(req.body?.user_title, 120) || 'Issue reported',
            user_description: sanitizeText(req.body?.user_description, 320) || 'Citizen reported a civic issue requiring action.',
        };

        const userPrompt = getRefineUserPrompt(payload);
        const startedAt = Date.now();
        const raw = await generateJSON(REFINE_SYSTEM, userPrompt);
        const llmLatencyMs = Date.now() - startedAt;

        const data = validateRefineOutput(raw || {}, payload);

        return res.json({
            ok: true,
            data,
            llmLatencyMs,
        });
    } catch (error) {
        console.error('[AI refine] error:', error);
        return res.status(500).json({
            ok: false,
            error: 'Failed to refine issue description',
        });
    }
});

router.post('/explain', protect, async (req, res) => {
    try {
        const payload = {
            category: sanitizeText(req.body?.category, 60) || 'other',
            label: sanitizeText(req.body?.label, 120) || 'civic issue',
            severity: sanitizeText(req.body?.severity, 40) || 'Medium',
            location: sanitizeText(req.body?.location, 160) || 'reported location',
            status: sanitizeText(req.body?.status, 60) || 'Submitted',
        };

        const basePrompt = getExplainUserPrompt(payload);
        const userPrompt = `${basePrompt}\n\nReturn JSON:\n{\n  "explanation": "Short educational explanation",\n  "next_step": "One clear practical next step",\n  "severity_reason": "Why severity level is justified",\n  "matched": true,\n  "confidence_alignment": 0.88\n}`;

        const startedAt = Date.now();
        const raw = await generateJSON(EXPLAIN_SYSTEM, userPrompt);
        const llmLatencyMs = Date.now() - startedAt;

        const data = validateExplainOutput(raw || {}, payload);

        return res.json({
            ok: true,
            data,
            llmLatencyMs,
        });
    } catch (error) {
        console.error('[AI explain] error:', error);
        return res.status(500).json({
            ok: false,
            error: 'Failed to generate issue explanation',
        });
    }
});

module.exports = router;
