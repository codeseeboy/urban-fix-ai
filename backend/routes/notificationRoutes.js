const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');

// GET /api/notifications — Get user's notifications
router.get('/', protect, (req, res) => {
    const notifs = store.notifications
        .filter(n => n.userId === req.user._id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unreadCount = notifs.filter(n => !n.read).length;
    res.json({ notifications: notifs, unreadCount });
});

// PUT /api/notifications/read-all — Mark all as read
router.put('/read-all', protect, (req, res) => {
    store.notifications.forEach(n => {
        if (n.userId === req.user._id) n.read = true;
    });
    res.json({ message: 'All notifications marked as read' });
});

// PUT /api/notifications/:id/read — Mark single as read
router.put('/:id/read', protect, (req, res) => {
    const notif = store.notifications.find(n => n._id === req.params.id && n.userId === req.user._id);
    if (notif) { notif.read = true; res.json(notif); }
    else res.status(404).json({ message: 'Notification not found' });
});

module.exports = router;
