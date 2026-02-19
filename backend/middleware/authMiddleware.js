const jwt = require('jsonwebtoken');
const store = require('../data/store');

// Simple in-memory cache for decoded user lookups (reduces DB hits)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedUser(id) {
    const entry = userCache.get(id);
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.user;
    return null;
}

function cacheUser(user) {
    userCache.set(user.id, { user, ts: Date.now() });
}

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

    try {
        const decoded = jwt.verify(token, store.JWT_SECRET);

        // Try cache first
        let user = getCachedUser(decoded.id);
        if (!user) {
            user = await store.getUserById(decoded.id);
            if (user) cacheUser(user);
        }

        if (!user) return res.status(401).json({ message: 'User not found' });
        // Map DB fields to the shape routes expect
        req.user = {
            _id: user.id,
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            points: user.points,
            badges: user.badges || [],
            reports_count: user.reports_count,
            reports_resolved: user.reports_resolved,
            impact_score: user.impact_score,
            region: user.region,
            avatar: user.avatar,
            department: user.department,
        };
        next();
    } catch (error) {
        res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

const admin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as admin' });
    }
};

const fieldWorker = (req, res, next) => {
    if (req.user && (req.user.role === 'field_worker' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as field worker' });
    }
};

module.exports = { protect, admin, fieldWorker };
