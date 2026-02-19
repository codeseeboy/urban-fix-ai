const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const store = require('../data/store');
const supabase = require('../config/supabase');

const SALT_ROUNDS = 10;

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, username } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        // Check if email already exists
        const existingEmail = await store.getUserByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ 
                message: 'This email is already registered. Please sign in instead, or use a different email address.',
                field: 'email'
            });
        }

        // Check if username already exists (if provided)
        if (username) {
            const existingUsername = await store.getUserByUsername(username);
            if (existingUsername) {
                return res.status(400).json({ 
                    message: `The username "${username}" is already taken. Please choose a different one.`,
                    field: 'username'
                });
            }
        }

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await store.createUser({
            name, email, password_hash,
            username: username ? username.toLowerCase() : null,
            role: role || 'citizen',
            points: 0, badges: [], reports_count: 0, reports_resolved: 0,
            impact_score: 0, region: 'General',
        });

        // Welcome notification
        await store.createNotification({
            user_id: user.id, type: 'badge',
            title: 'Welcome to UrbanFix AI! 🎉',
            description: 'Start reporting civic issues to earn points and badges.',
        });

        res.status(201).json({
            _id: user.id, name: user.name, email: user.email, role: user.role,
            points: user.points, token: store.generateToken(user.id),
        });
    } catch (error) {
        console.error('Register error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await store.getUserByEmail(email);
        if (!user) return res.status(401).json({ message: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

        // Update last login
        await store.updateUser(user.id, { last_login_at: new Date().toISOString() });

        res.json({
            _id: user.id, name: user.name, email: user.email, role: user.role,
            points: user.points, reportsCount: user.reports_count,
            reportsResolved: user.reports_resolved, impactScore: user.impact_score,
            region: user.region, badges: user.badges || [],
            token: store.generateToken(user.id),
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/auth/supabase-login
// Exchanges a valid Supabase access_token for an App JWT
router.post('/supabase-login', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token required' });

        // 1. Verify token with Supabase Auth
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

        if (error || !supabaseUser) {
            console.error('Supabase Auth Verify Failed:', error?.message);
            return res.status(401).json({ message: 'Invalid Supabase token' });
        }

        // 2. Check if user exists in our local DB (via Supabase query)
        // store.getUserByEmail checks the 'users' table
        const email = supabaseUser.email;
        let user = await store.getUserByEmail(email);

        if (!user) {
            // 3. Create new user
            console.log(`Creating new user for ${email} from Supabase Login`);

            const name = supabaseUser.user_metadata?.full_name || email.split('@')[0];
            const avatar = supabaseUser.user_metadata?.avatar_url;

            // Use a dummy hash that bcrypt will never match (starts with $2a$ but invalid checksum or just random string)
            // But to be safe against bcrypt errors, we use a valid hash of a random long string
            // cost factor 10, valid hash structure. 
            // We use a fixed string "oauth_user_placeholder_password" hashed
            const placeholderHash = '$2a$10$X7.X7.X7.X7.X7.X7.X7.X7.X7.X7.X7.X7.X7.X7.X7.X7.X7.X7';
            // Actually, best to just use a random valid hash.
            // Let's use a pre-calculated one: $2a$10$abcdefghijklmnopqrsthu (invalid salt/hash but valid structure)
            // Or just 'auth_provider_managed' and handle the error in login route as discussed.
            // Let's stick to 'auth_provider_managed' and update login route to be safe.

            user = await store.createUser({
                name,
                email,
                password_hash: 'auth_provider_managed',
                role: 'citizen', // STRICTLY DEFAULT TO CITIZEN
                points: 0,
                badges: [],
                reports_count: 0,
                reports_resolved: 0,
                impact_score: 0,
                region: 'General',
                avatar,
                account_status: 'active',
                department: null,
            });

            // Welcome notification
            await store.createNotification({
                user_id: user.id,
                type: 'badge',
                title: 'Welcome to UrbanFix AI! 🎉',
                description: 'You\'re signed in! Start reporting civic issues.',
                action_url: null
            });
        } else {
            console.log(`User ${email} logged in via Supabase`);
            // Link/Sync metadata if needed
            if (!user.avatar && supabaseUser.user_metadata?.avatar_url) {
                await store.updateUser(user.id, { avatar: supabaseUser.user_metadata.avatar_url });
                user.avatar = supabaseUser.user_metadata.avatar_url;
            }
            await store.updateUser(user.id, { last_login_at: new Date().toISOString() });
        }

        // 4. Return app session
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            points: user.points,
            reportsCount: user.reports_count,
            reportsResolved: user.reports_resolved,
            impactScore: user.impact_score,
            region: user.region,
            badges: user.badges || [],
            token: store.generateToken(user.id),
        });

    } catch (error) {
        console.error('Supabase Login Error:', error.message);
        res.status(500).json({ message: 'Login processing failed' });
    }
});

module.exports = router;
