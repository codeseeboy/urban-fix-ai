const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');

// Helper: enrich issue with user data
function enrichIssue(issue) {
    const user = store.getUserById(issue.user);
    const timeAgo = getTimeAgo(issue.createdAt);
    const comments = store.comments.filter(c => c.issueId === issue._id);
    return {
        ...issue,
        user: user ? { _id: user._id, name: user.name, avatar: user.avatar } : { name: 'Anonymous' },
        timeAgo,
        commentCount: comments.length,
    };
}

function getTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// GET /api/issues — Feed with filters
router.get('/', (req, res) => {
    const { filter, userId } = req.query;
    let result = [...store.issues];

    if (filter === 'high_priority') {
        result = result.filter(i => i.aiSeverity === 'Critical' || i.aiSeverity === 'High');
    } else if (filter === 'resolved') {
        result = result.filter(i => i.status === 'Resolved');
    } else if (filter === 'trending') {
        result.sort((a, b) => b.upvotes.length - a.upvotes.length);
    } else if (filter === 'my_posts' && userId) {
        result = result.filter(i => i.user === userId);
    }

    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(result.map(enrichIssue));
});

// GET /api/issues/:id — Single issue
router.get('/:id', (req, res) => {
    const issue = store.issues.find(i => i._id === req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const comments = store.comments
        .filter(c => c.issueId === issue._id)
        .map(c => {
            const u = store.getUserById(c.user);
            return { ...c, user: u ? { _id: u._id, name: u.name, role: u.role } : { name: 'Unknown' }, timeAgo: getTimeAgo(c.createdAt) };
        });

    res.json({ ...enrichIssue(issue), comments });
});

// POST /api/issues — Create new issue
router.post('/', protect, (req, res) => {
    const { title, description, image, video, location, category, anonymous, emergency } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    // Mock AI processing
    const severities = ['Low', 'Medium', 'High', 'Critical'];
    const aiSeverity = emergency ? 'Critical' : severities[Math.floor(Math.random() * 3) + 1]; // Emergency = Critical
    const deptMap = { roads: 'Roads', lighting: 'Electricity', trash: 'Sanitation', water: 'Water', parks: 'Parks' };

    const issue = {
        _id: store.generateId('issue'),
        user: anonymous ? 'anonymous' : req.user._id,
        title, description: description || '',
        image: image || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600',
        video: video || null,
        location: location || { type: 'Point', coordinates: [77.209, 28.614], address: 'Unknown' },
        departmentTag: deptMap[category] || 'General',
        status: 'Submitted', category: category || 'other',
        priorityScore: Math.floor(Math.random() * 40) + 20,
        aiSeverity,
        aiTags: [category || 'general', 'civic-issue'],
        upvotes: [], downvotes: [], followers: [], commentCount: 0,
        statusTimeline: [
            { status: 'Submitted', timestamp: new Date().toISOString(), comment: emergency ? 'EMERGENCY issue reported by citizen' : 'Issue reported by citizen' }
        ],
        assignedTo: null, resolvedBy: null, resolutionProof: null,
        anonymous: !!anonymous,
        emergency: !!emergency,
        createdAt: new Date().toISOString(),
    };

    store.issues.unshift(issue);

    // Award points
    if (!anonymous) {
        const user = store.getUserById(req.user._id);
        if (user) {
            user.points += 10;
            user.reportsCount = (user.reportsCount || 0) + 1;
            // Badge check
            if (user.reportsCount === 1 && !user.badges.includes('first_report')) {
                user.badges.push('first_report');
                store.notifications.push({
                    _id: store.generateId('notif'), userId: user._id, type: 'badge',
                    title: 'Badge Earned: First Report 🏅', desc: 'You submitted your first civic report!',
                    read: false, createdAt: new Date().toISOString(),
                });
            }
        }
        // Notification
        store.notifications.push({
            _id: store.generateId('notif'), userId: req.user._id, type: 'status',
            title: 'Report Submitted ✅', desc: `"${title}" — AI classified as ${aiSeverity} severity.`,
            read: false, createdAt: new Date().toISOString(),
        });
    }

    res.status(201).json(enrichIssue(issue));
});

// PUT /api/issues/:id/upvote — Toggle upvote
router.put('/:id/upvote', protect, (req, res) => {
    const issue = store.issues.find(i => i._id === req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const idx = issue.upvotes.indexOf(req.user._id);
    if (idx > -1) {
        issue.upvotes.splice(idx, 1);
        issue.priorityScore = Math.max(0, issue.priorityScore - 1);
    } else {
        issue.upvotes.push(req.user._id);
        issue.priorityScore += 1;
        // Notify issue owner
        if (issue.user !== req.user._id && issue.user !== 'anonymous') {
            store.notifications.push({
                _id: store.generateId('notif'), userId: issue.user, type: 'upvote',
                title: `${req.user.name} upvoted your report`,
                desc: `"${issue.title}" now has ${issue.upvotes.length} upvotes.`,
                read: false, createdAt: new Date().toISOString(),
            });
        }
    }

    res.json({ upvotes: issue.upvotes, upvoted: idx === -1, priorityScore: issue.priorityScore });
});

// PUT /api/issues/:id/downvote — Toggle downvote
router.put('/:id/downvote', protect, (req, res) => {
    const issue = store.issues.find(i => i._id === req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    if (!issue.downvotes) issue.downvotes = [];
    const idx = issue.downvotes.indexOf(req.user._id);
    if (idx > -1) {
        issue.downvotes.splice(idx, 1);
        issue.priorityScore = Math.min(100, issue.priorityScore + 1);
    } else {
        issue.downvotes.push(req.user._id);
        issue.priorityScore = Math.max(0, issue.priorityScore - 1);
        // Also remove upvote if exists
        const upIdx = issue.upvotes.indexOf(req.user._id);
        if (upIdx > -1) issue.upvotes.splice(upIdx, 1);
    }

    res.json({ downvotes: issue.downvotes, downvoted: idx === -1, priorityScore: issue.priorityScore });
});

// PUT /api/issues/:id/follow — Toggle follow
router.put('/:id/follow', protect, (req, res) => {
    const issue = store.issues.find(i => i._id === req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    if (!issue.followers) issue.followers = [];
    const idx = issue.followers.indexOf(req.user._id);
    if (idx > -1) {
        issue.followers.splice(idx, 1);
    } else {
        issue.followers.push(req.user._id);
    }

    res.json({ followers: issue.followers, following: idx === -1 });
});

// POST /api/issues/:id/comments — Add comment
router.post('/:id/comments', protect, (req, res) => {
    const issue = store.issues.find(i => i._id === req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const comment = {
        _id: store.generateId('cmt'),
        issueId: issue._id,
        user: req.user._id,
        text: req.body.text,
        likes: 0,
        createdAt: new Date().toISOString(),
    };
    store.comments.push(comment);

    // Points for commenting
    const user = store.getUserById(req.user._id);
    if (user) user.points += 2;

    // Notify issue owner
    if (issue.user !== req.user._id && issue.user !== 'anonymous') {
        store.notifications.push({
            _id: store.generateId('notif'), userId: issue.user, type: 'comment',
            title: `${req.user.name} commented on your report`,
            desc: `"${req.body.text.substring(0, 50)}..."`,
            read: false, createdAt: new Date().toISOString(),
        });
    }

    const u = store.getUserById(comment.user);
    res.status(201).json({
        ...comment,
        user: u ? { _id: u._id, name: u.name, role: u.role } : { name: 'Unknown' },
        timeAgo: 'Just now',
    });
});

// GET /api/issues/:id/comments
router.get('/:id/comments', (req, res) => {
    const comments = store.comments
        .filter(c => c.issueId === req.params.id)
        .map(c => {
            const u = store.getUserById(c.user);
            return { ...c, user: u ? { _id: u._id, name: u.name, role: u.role } : { name: 'Unknown' }, timeAgo: getTimeAgo(c.createdAt) };
        });
    res.json(comments);
});

module.exports = router;
