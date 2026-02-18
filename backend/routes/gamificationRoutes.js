const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');

// GET /api/gamification/leaderboard
router.get('/leaderboard', (req, res) => {
    const citizens = store.users
        .filter(u => u.role === 'citizen')
        .sort((a, b) => b.points - a.points)
        .map((u, i) => ({
            rank: i + 1, _id: u._id, name: u.name,
            points: u.points, reportsCount: u.reportsCount || 0,
            avatar: u.avatar,
        }));
    res.json(citizens);
});

// GET /api/gamification/badges
router.get('/badges', protect, (req, res) => {
    const user = store.getUserById(req.user._id);
    const allBadges = store.badges.map(b => ({
        ...b,
        earned: user ? user.badges.includes(b.id) : false,
    }));
    res.json(allBadges);
});

// GET /api/gamification/stats — Overall platform stats
router.get('/stats', (req, res) => {
    const total = store.issues.length;
    const resolved = store.issues.filter(i => i.status === 'Resolved').length;
    const critical = store.issues.filter(i => i.aiSeverity === 'Critical').length;
    const inProgress = store.issues.filter(i => i.status === 'InProgress').length;
    res.json({ totalIssues: total, resolved, critical, inProgress, pending: total - resolved });
});

module.exports = router;
