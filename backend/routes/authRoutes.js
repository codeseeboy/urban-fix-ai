const express = require('express');
const router = express.Router();
const store = require('../data/store');

// POST /api/auth/register
router.post('/register', (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    const exists = store.users.find(u => u.email === email);
    if (exists) return res.status(400).json({ message: 'User already exists' });

    const user = {
        _id: store.generateId('user'),
        name, email, password,
        role: role || 'citizen',
        points: 0, badges: [], reportsCount: 0, reportsResolved: 0,
        impactScore: 0, region: 'General', avatar: null,
        createdAt: new Date().toISOString(),
    };
    store.users.push(user);

    // Welcome notification
    store.notifications.push({
        _id: store.generateId('notif'),
        userId: user._id, type: 'badge',
        title: 'Welcome to UrbanFix AI! 🎉',
        desc: 'Start reporting civic issues to earn points and badges.',
        read: false, createdAt: new Date().toISOString(),
    });

    res.status(201).json({
        _id: user._id, name: user.name, email: user.email, role: user.role,
        points: user.points, token: store.generateToken(user._id),
    });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    const user = store.users.find(u => u.email === email);
    if (user && user.password === password) {
        res.json({
            _id: user._id, name: user.name, email: user.email, role: user.role,
            points: user.points, reportsCount: user.reportsCount,
            reportsResolved: user.reportsResolved, impactScore: user.impactScore,
            region: user.region, badges: user.badges,
            token: store.generateToken(user._id),
        });
    } else {
        res.status(401).json({ message: 'Invalid email or password' });
    }
});

module.exports = router;
