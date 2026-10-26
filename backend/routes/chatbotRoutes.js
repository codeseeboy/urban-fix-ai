const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const assistant = require('../services/assistant');

function sanitize(input, maxLen = 500) {
    if (typeof input !== 'string') return '';
    return input
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
}

// POST /api/chatbot/message
// body: { message, history?: [{ role: 'user'|'assistant', text }], location?: { latitude, longitude } }
router.post('/message', protect, async (req, res) => {
    const message = sanitize(req.body?.message);
    if (!message) return res.status(400).json({ message: 'Message is required' });

    const history = Array.isArray(req.body?.history)
        ? req.body.history.map((t) => ({ role: t?.role === 'assistant' ? 'assistant' : 'user', text: sanitize(t?.text, 600) }))
        : [];

    try {
        const started = Date.now();
        const result = await assistant.answer({
            message,
            history,
            location: req.body?.location || null,
            userId: req.user._id,
        });
        res.json({ ...result, latencyMs: Date.now() - started, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('[assistant] failed:', error.message);
        res.status(503).json({ message: 'The assistant is unavailable right now. Please try again in a moment.' });
    }
});

// GET /api/chatbot/quick-actions — starter prompts shown on an empty chat
router.get('/quick-actions', protect, (req, res) => {
    res.json({
        actions: [
            { id: 'nearby', label: 'Issues near me', prompt: 'What issues are reported near me?', icon: 'navigate' },
            { id: 'mine', label: 'My reports', prompt: 'What is the status of my reports?', icon: 'document-text' },
            { id: 'city', label: 'City this week', prompt: 'Give me a city overview for this week.', icon: 'stats-chart' },
            { id: 'critical', label: 'Critical now', prompt: 'Which critical issues are still open?', icon: 'warning' },
            { id: 'rank', label: 'My rank', prompt: 'Where do I stand on the leaderboard?', icon: 'trophy' },
            { id: 'howto', label: 'How to report', prompt: 'How do I report an issue?', icon: 'help-circle' },
        ],
    });
});

module.exports = router;
