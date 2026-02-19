const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');

// GET /api/users/check-username/:username — Check if username is available
router.get('/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;

        if (!username || username.length < 3) {
            return res.status(400).json({
                available: false,
                message: 'Username must be at least 3 characters long.'
            });
        }

        // Check for valid characters (alphanumeric, underscores, dots)
        if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
            return res.status(400).json({
                available: false,
                message: 'Username can only contain letters, numbers, underscores, and dots.'
            });
        }

        const isAvailable = await store.isUsernameAvailable(username);

        if (isAvailable) {
            res.json({ available: true, message: 'Username is available!' });
        } else {
            res.json({
                available: false,
                message: `"${username}" is already taken. Try adding numbers or underscores.`
            });
        }
    } catch (error) {
        console.error('Check username error:', error.message);
        res.status(500).json({ available: false, message: 'Error checking username availability.' });
    }
});

// GET /api/users/profile — Get own profile
router.get('/profile', protect, async (req, res) => {
    try {
        const user = await store.getUserById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const reportsCount = await store.getUserIssueCount(user.id);
        const resolvedCount = await store.getUserResolvedCount(user.id);
        const followingCount = await store.getFollowingCount(user.id);

        res.json({
            _id: user.id, name: user.name, email: user.email, role: user.role,
            points: user.points, badges: user.badges || [],
            reportsCount,
            reportsResolved: resolvedCount,
            levelInfo: store.getLevelInfo(user.points),
            impactScore: user.impact_score || Math.min(100, Math.floor((user.points / 50))),
            region: user.region, avatar: user.avatar,
            followingCount,
            followersCount: 0,
        });
    } catch (error) {
        console.error('Get profile error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/users/profile — Update own profile
router.put('/profile', protect, async (req, res) => {
    try {
        const user = await store.getUserById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const updates = {};
        const { name, region, avatar, username, city, ward, interests } = req.body;

        if (name) updates.name = name;
        if (region) updates.region = region;
        if (avatar) updates.avatar = avatar;
        if (city) updates.city = city;
        if (ward) updates.ward = ward;
        if (interests) updates.interests = interests;

        // Handle username update with uniqueness check
        if (username) {
            const normalizedUsername = username.toLowerCase().trim();

            // Validate username format
            if (normalizedUsername.length < 3) {
                return res.status(400).json({
                    message: 'Username must be at least 3 characters long.',
                    field: 'username'
                });
            }

            if (!/^[a-zA-Z0-9_.]+$/.test(normalizedUsername)) {
                return res.status(400).json({
                    message: 'Username can only contain letters, numbers, underscores, and dots.',
                    field: 'username'
                });
            }

            // Check if username is already taken by another user
            if (user.username !== normalizedUsername) {
                const existingUser = await store.getUserByUsername(normalizedUsername);
                if (existingUser && existingUser.id !== user.id) {
                    return res.status(400).json({
                        message: `The username "${username}" is already taken. Please choose a different one.`,
                        field: 'username'
                    });
                }
            }

            updates.username = normalizedUsername;
        }

        const updated = await store.updateUser(user.id, updates);

        res.json({
            _id: updated.id, name: updated.name, email: updated.email, role: updated.role,
            points: updated.points, region: updated.region, avatar: updated.avatar,
            username: updated.username, city: updated.city, ward: updated.ward,
            interests: updated.interests,
        });
    } catch (error) {
        console.error('Update profile error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/users/push-token — Register FCM token
router.post('/push-token', protect, async (req, res) => {
    try {
        const { token, deviceType } = req.body;
        if (!token) return res.status(400).json({ message: 'Token is required' });

        const saved = await store.addPushToken(req.user._id, token, deviceType || 'unknown');
        res.json({ message: 'Token registered', token: saved });
    } catch (error) {
        console.error('Push token registration error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
