const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');

// GET /api/users/profile — Get own profile
router.get('/profile', protect, (req, res) => {
    const user = store.getUserById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userIssues = store.issues.filter(i => i.user === user._id);
    const resolvedCount = userIssues.filter(i => i.status === 'Resolved').length;

    res.json({
        _id: user._id, name: user.name, email: user.email, role: user.role,
        points: user.points, badges: user.badges,
        reportsCount: userIssues.length,
        reportsResolved: resolvedCount,
        levelInfo: store.getLevelInfo(user.points),
        impactScore: user.impactScore || Math.min(100, Math.floor((user.points / 50))),
        region: user.region, avatar: user.avatar,
    });
});

// PUT /api/users/profile — Update own profile
router.put('/profile', protect, (req, res) => {
    const user = store.getUserById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, region, avatar } = req.body;
    if (name) user.name = name;
    if (region) user.region = region;
    if (avatar) user.avatar = avatar;

    res.json({
        _id: user._id, name: user.name, email: user.email, role: user.role,
        points: user.points, region: user.region, avatar: user.avatar,
    });
});

module.exports = router;
