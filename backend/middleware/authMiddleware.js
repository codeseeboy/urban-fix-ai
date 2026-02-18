const jwt = require('jsonwebtoken');
const { users, JWT_SECRET } = require('../data/store');

const protect = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = users.find(u => u._id === decoded.id);
        if (!req.user) return res.status(401).json({ message: 'User not found' });
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
