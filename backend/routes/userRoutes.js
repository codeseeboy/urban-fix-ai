const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const store = require('../data/store');
const upload = require('../config/multer');
const { uploadFile } = require('../config/storage');

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
            username: user.username || null,
            city: user.city || null,
            ward: user.ward || null,
            interests: user.interests || [],
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

        if (
            typeof token === 'string' &&
            (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
        ) {
            return res.status(400).json({
                message: 'Invalid token type: backend expects native FCM/APNs device token, not Expo push token.',
            });
        }

        const saved = await store.addPushToken(req.user._id, token, deviceType || 'unknown');
        res.json({ message: 'Token registered', token: saved });
    } catch (error) {
        console.error('Push token registration error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// DELETE /api/users/push-token — Remove FCM token (logout / user disabled alerts)
router.delete('/push-token', protect, async (req, res) => {
    try {
        const { token } = req.body || {};
        if (token) {
            await store.deletePushToken(token);
        } else {
            const tokens = await store.getPushTokens(req.user._id);
            for (const row of tokens || []) {
                if (row?.token) await store.deletePushToken(row.token);
            }
        }
        res.json({ message: 'Token removed' });
    } catch (error) {
        console.error('Push token removal error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/users/avatar — Upload profile photo
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Image is required' });
        const url = await uploadFile(req.file);
        if (!url) return res.status(500).json({ message: 'Could not upload photo' });
        const updated = await store.updateUser(req.user._id, { avatar: url });
        res.json({
            avatar: url,
            _id: updated.id,
            name: updated.name,
            email: updated.email,
        });
    } catch (error) {
        console.error('Avatar upload error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// ── Staff management (municipal admins only) ────────────────────────────────

const STAFF_ROLES = ['field_worker', 'department_admin', 'admin', 'citizen'];

// GET /api/users/staff/workers — Field workers with their live workload
router.get('/staff/workers', protect, admin, async (req, res) => {
    try {
        const { data: workers, error } = await store.supabase
            .from('users')
            .select('id, name, email, avatar, department, account_status, last_login_at, created_at')
            .eq('role', 'field_worker')
            .order('name');
        if (error) throw new Error(error.message);

        const ids = (workers || []).map((w) => w.id);
        const { data: tasks } = ids.length
            ? await store.supabase.from('issues').select('assigned_to, status, deadline').in('assigned_to', ids)
            : { data: [] };

        const now = Date.now();
        res.json((workers || []).map((w) => {
            const mine = (tasks || []).filter((t) => t.assigned_to === w.id);
            const open = mine.filter((t) => t.status !== 'Resolved' && t.status !== 'Rejected');
            return {
                _id: w.id,
                name: w.name,
                email: w.email,
                avatar: w.avatar,
                department: w.department,
                status: w.account_status || 'active',
                lastLoginAt: w.last_login_at,
                createdAt: w.created_at,
                activeTasks: open.length,
                inProgress: open.filter((t) => t.status === 'InProgress').length,
                overdue: open.filter((t) => t.deadline && new Date(t.deadline).getTime() < now).length,
                resolved: mine.filter((t) => t.status === 'Resolved').length,
            };
        }));
    } catch (error) {
        console.error('List workers error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/users/staff — Admin creates a field worker / staff account
router.post('/staff', protect, admin, async (req, res) => {
    try {
        const { name, email, password, department, role = 'field_worker' } = req.body || {};
        if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
        if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
        if (!STAFF_ROLES.includes(role) || role === 'citizen') return res.status(400).json({ message: 'Invalid staff role' });
        if (role === 'admin' && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Only admins can create admin accounts' });
        }
        const normalizedEmail = String(email).trim().toLowerCase();
        if (await store.getUserByEmail(normalizedEmail)) return res.status(400).json({ message: 'This email is already registered' });

        const bcrypt = require('bcryptjs');
        const user = await store.createUser({
            name: String(name).trim(),
            email: normalizedEmail,
            password_hash: await bcrypt.hash(String(password), 10),
            role,
            department: department || null,
            points: 0, badges: [], reports_count: 0, reports_resolved: 0, impact_score: 0, region: 'General',
        });
        res.status(201).json({ _id: user.id, name: user.name, email: user.email, role: user.role, department: user.department });
    } catch (error) {
        console.error('Create staff error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/users/:id/role — Admin changes a user's role / department
router.put('/:id/role', protect, admin, async (req, res) => {
    try {
        const { role, department } = req.body || {};
        if (role && !STAFF_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });
        if (req.params.id === req.user._id) return res.status(400).json({ message: 'You cannot change your own role' });
        if (role === 'admin' && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Only admins can grant admin access' });
        }
        const updates = {};
        if (role) updates.role = role;
        if (department !== undefined) updates.department = department || null;
        const u = await store.updateUser(req.params.id, updates);
        res.json({ _id: u.id, name: u.name, email: u.email, role: u.role, department: u.department });
    } catch (error) {
        console.error('Update role error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
