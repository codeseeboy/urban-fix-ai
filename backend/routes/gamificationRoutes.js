const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');

// GET /api/gamification/leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const citizens = await store.getCitizensLeaderboard();
        const ranked = citizens.map((u, i) => ({
            rank: i + 1,
            _id: u.id,
            name: u.name,
            points: u.points,
            reportsCount: u.reports_count || 0,
            avatar: u.avatar,
        }));
        res.json(ranked);
    } catch (error) {
        console.error('Leaderboard error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// Achievements are derived from the user's real activity, so they are always
// in sync with what the user has actually done (no manual awarding needed).
const ACHIEVEMENTS = [
    { id: 'first-report', name: 'First Report', description: 'Reported your first civic issue', icon: 'flag', metric: 'reports', goal: 1 },
    { id: 'watchdog', name: 'Neighbourhood Watch', description: 'Reported 5 issues', icon: 'eye', metric: 'reports', goal: 5 },
    { id: 'city-guardian', name: 'City Guardian', description: 'Reported 25 issues', icon: 'shield', metric: 'reports', goal: 25 },
    { id: 'first-fix', name: 'First Fix', description: 'One of your reports was resolved', icon: 'check', metric: 'resolved', goal: 1 },
    { id: 'changemaker', name: 'Changemaker', description: '10 of your reports were resolved', icon: 'sparkles', metric: 'resolved', goal: 10 },
    { id: 'voice', name: 'Community Voice', description: 'Posted 10 comments', icon: 'message', metric: 'comments', goal: 10 },
    { id: 'rising', name: 'Rising Star', description: 'Earned 100 points', icon: 'star', metric: 'points', goal: 100 },
    { id: 'champion', name: 'Civic Champion', description: 'Earned 500 points', icon: 'trophy', metric: 'points', goal: 500 },
];

// GET /api/gamification/badges
router.get('/badges', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const [user, reports, resolved, commentsRes] = await Promise.all([
            store.getUserById(userId),
            store.getUserIssueCount(userId),
            store.getUserResolvedCount(userId),
            store.supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        ]);
        const values = { reports, resolved, comments: commentsRes.count || 0, points: user?.points || 0 };
        res.json(ACHIEVEMENTS.map(({ metric, goal, ...b }) => ({
            ...b,
            goal,
            progress: Math.min(values[metric], goal),
            earned: values[metric] >= goal,
        })));
    } catch (error) {
        console.error('Badges error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/gamification/stats — Overall platform stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await store.getIssueStats();
        res.json(stats);
    } catch (error) {
        console.error('Stats error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
