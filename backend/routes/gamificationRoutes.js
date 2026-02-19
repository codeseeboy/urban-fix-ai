const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');

// GET /api/gamification/leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const citizens = await store.getCitizensLeaderboard();
        const ranked = citizens.map((u, i) => ({
            rank: i + 1,
            _id: u.id,
            name: u.name,
            points: u.points,
            reportsCount: u.reports_count || 0,
            avatar: u.avatar,
        }));
        res.json(ranked);
    } catch (error) {
        console.error('Leaderboard error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/gamification/badges
router.get('/badges', protect, async (req, res) => {
    try {
        const user = await store.getUserById(req.user._id);
        const allBadges = await store.getAllBadges();
        const result = allBadges.map(b => ({
            ...b,
            earned: user ? (user.badges || []).includes(b.id) : false,
        }));
        res.json(result);
    } catch (error) {
        console.error('Badges error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/gamification/stats — Overall platform stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await store.getIssueStats();
        res.json(stats);
    } catch (error) {
        console.error('Stats error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
