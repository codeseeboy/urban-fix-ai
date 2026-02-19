const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');

// GET /api/notifications — Get user's notifications
router.get('/', protect, async (req, res) => {
    try {
        const notifs = await store.getNotifications(req.user._id);
        const unreadCount = notifs.filter(n => !n.read).length;
        // Map to frontend-expected shape
        const mapped = notifs.map(n => ({
            _id: n.id,
            userId: n.user_id,
            type: n.type,
            title: n.title,
            desc: n.description,
            read: n.read,
            actionUrl: n.action_url,
            createdAt: n.created_at,
        }));
        res.json({ notifications: mapped, unreadCount });
    } catch (error) {
        console.error('Get notifications error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/notifications/read-all — Mark all as read
router.put('/read-all', protect, async (req, res) => {
    try {
        await store.markNotificationsRead(req.user._id);
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all read error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/notifications/:id/read — Mark single as read
router.put('/:id/read', protect, async (req, res) => {
    try {
        const notif = await store.markNotificationRead(req.params.id, req.user._id);
        if (notif) {
            res.json({
                _id: notif.id, userId: notif.user_id, type: notif.type,
                title: notif.title, desc: notif.description, read: notif.read,
                createdAt: notif.created_at,
            });
        } else {
            res.status(404).json({ message: 'Notification not found' });
        }
    } catch (error) {
        console.error('Mark read error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// DELETE /api/notifications/:id — Delete a single notification
router.delete('/:id', protect, async (req, res) => {
    try {
        await store.deleteNotification(req.params.id, req.user._id);
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// DELETE /api/notifications — Delete all notifications for user
router.delete('/', protect, async (req, res) => {
    try {
        await store.deleteAllNotifications(req.user._id);
        res.json({ message: 'All notifications cleared' });
    } catch (error) {
        console.error('Clear all notifications error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
