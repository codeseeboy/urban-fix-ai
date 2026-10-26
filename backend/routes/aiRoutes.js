/**
 * Small text-generation helpers for the report and issue screens.
 *
 *   POST /api/ai/refine   rewrite a citizen's rough title/description into a clear report
 *   POST /api/ai/explain  plain-language "why this matters / what happens next" for an issue
 *
 * Both run on Gemini Flash-Lite (Vertex AI) with a response schema. If the model is
 * unavailable they return 503 — never canned text dressed up as an AI answer.
 */

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { generate } = require('../services/llm/providers');

const router = express.Router();

function clean(v, maxLen) {
    if (typeof v !== 'string') return '';
    return v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

const REFINE_SYSTEM = `You rewrite citizen reports for a municipal civic-issue system in India.
Make them clear, specific and factual. Keep every fact the citizen gave; never invent
places, sizes, dates or injuries. No emojis, no exaggeration. Title max 60 characters,
description 1-3 sentences. If the text is in Hindi or Hinglish, write the result in
clear English.`;

const REFINE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        title: { type: 'STRING' },
        description: { type: 'STRING' },
    },
    required: ['title', 'description'],
};

router.post('/refine', protect, async (req, res) => {
    const title = clean(req.body?.title ?? req.body?.user_title, 120);
    const description = clean(req.body?.description ?? req.body?.user_description, 600);
    const category = clean(req.body?.category, 40) || 'other';
    if (!title && !description) return res.status(400).json({ message: 'Write a title or description first.' });

    try {
        const { json, model } = await generate({
            system: REFINE_SYSTEM,
            schema: REFINE_SCHEMA,
            temperature: 0.3,
            maxOutputTokens: 250,
            contents: [{
                role: 'user',
                parts: [{ text: `Category: ${category}\nTitle: ${title || '(none)'}\nDescription: ${description || '(none)'}` }],
            }],
        });
        if (!json?.title) throw new Error('empty result');
        res.json({ title: clean(json.title, 80), description: clean(json.description, 600), model });
    } catch (error) {
        console.warn('[ai/refine]', error.message);
        res.status(503).json({ message: 'AI writing help is unavailable right now.' });
    }
});

const EXPLAIN_SYSTEM = `You explain a reported civic issue to a citizen of an Indian city in plain,
calm language. Be specific to the issue's category, severity and status. Do not invent
facts about this particular case (no dates, names or promises). Keep each field short.`;

const EXPLAIN_SCHEMA = {
    type: 'OBJECT',
    properties: {
        why_it_matters: { type: 'STRING', description: 'One or two sentences on the risk or impact.' },
        what_happens_next: { type: 'STRING', description: 'What the municipality typically does at this status.' },
        stay_safe: { type: 'STRING', description: 'One practical safety tip for people nearby.' },
    },
    required: ['why_it_matters', 'what_happens_next', 'stay_safe'],
};

router.post('/explain', protect, async (req, res) => {
    const facts = {
        title: clean(req.body?.title ?? req.body?.label, 120) || 'civic issue',
        category: clean(req.body?.category, 40) || 'other',
        severity: clean(req.body?.severity, 20) || 'Medium',
        status: clean(req.body?.status, 30) || 'Submitted',
        department: clean(req.body?.department, 60) || 'the municipality',
    };
    try {
        const { json, model } = await generate({
            system: EXPLAIN_SYSTEM,
            schema: EXPLAIN_SCHEMA,
            temperature: 0.4,
            maxOutputTokens: 300,
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(facts) }] }],
        });
        if (!json?.why_it_matters) throw new Error('empty result');
        res.json({
            whyItMatters: clean(json.why_it_matters, 400),
            whatHappensNext: clean(json.what_happens_next, 400),
            staySafe: clean(json.stay_safe, 300),
            model,
        });
    } catch (error) {
        console.warn('[ai/explain]', error.message);
        res.status(503).json({ message: 'AI insight is unavailable right now.' });
    }
});

module.exports = router;
