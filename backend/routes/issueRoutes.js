const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');

// Helper: resolve image path to full URL
const PORT = process.env.PORT || 5000;
function resolveImageUrl(path, req) {
    if (!path) return null;
    if (path.startsWith('http')) return path; // already absolute
    // Build full URL from request host or fallback
    const host = req ? `${req.protocol}://${req.get('host')}` : `http://localhost:${PORT}`;
    return `${host}${path}`;
}

// Helper: enrich issue with user data
function enrichIssue(issue, req) {
    let author;
    if (issue.authorType === 'MunicipalPage') {
        const page = store.municipalPages.find(p => p._id === issue.municipalPage);
        author = page ? { _id: page._id, name: page.name, avatar: page.avatar, handle: page.handle, isPage: true, verified: page.verified } : { name: 'Unknown Page' };
    } else {
        const user = store.getUserById(issue.user);
        author = user ? { _id: user._id, name: user.name, avatar: user.avatar, role: user.role } : { name: 'Anonymous' };
    }

    const timeAgo = getTimeAgo(issue.createdAt);
    const comments = store.comments.filter(c => c.issueId === issue._id);
    return {
        ...issue,
        image: resolveImageUrl(issue.image, req),
        user: author,
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
    } else if (filter === 'following' && userId) {
        // Get list of pages user follows
        const followingIds = store.follows
            .filter(f => f.followerId === userId)
            .map(f => f.followingId);

        // Filter issues from those pages
        result = result.filter(i =>
            (i.authorType === 'MunicipalPage' && followingIds.includes(i.municipalPage)) ||
            (i.followers && i.followers.includes(userId)) // Also include issues the user explicitly follows
        );
    }

    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(result.map(i => enrichIssue(i, req)));
});

// POST /api/issues/seed-nearby — Generate demo issues near user location
const seededLocations = new Set(); // track seeded areas
router.post('/seed-nearby', (req, res) => {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ message: 'latitude & longitude required' });

    // Prevent duplicate seeding for same rough area (round to 2 decimals)
    const areaKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    if (seededLocations.has(areaKey)) {
        return res.json({ message: 'Area already seeded', count: 0 });
    }
    seededLocations.add(areaKey);

    const NEARBY_ISSUES = [
        { title: 'Pothole on nearby road — Risk of accident', desc: 'A deep pothole has formed on the main road causing vehicles to swerve dangerously. Multiple commuters have reported near-misses.', cat: 'roads', sev: 'High', dept: 'Roads', img: '/public/images/pothole.jpg' },
        { title: 'Streetlight not working — Dark zone at night', desc: 'The streetlight near the junction has been non-functional for over a week. Residents feel unsafe walking after dark.', cat: 'lighting', sev: 'Medium', dept: 'Electricity', img: '/public/images/streetlight.webp' },
        { title: 'Garbage dump overflowing — Stench & flies', desc: 'The community garbage bin has not been cleared for 5 days. Overflowing waste is attracting stray animals and creating a health hazard.', cat: 'trash', sev: 'Critical', dept: 'Sanitation', img: '/public/images/garbage.avif' },
        { title: 'Water pipe leaking — Wastage on street', desc: 'A major water pipe is leaking continuously near the residential block. Significant water wastage and road damage.', cat: 'water', sev: 'High', dept: 'Water', img: '/public/images/burst-pipe.jpg' },
        { title: 'Broken park bench — Unsafe for elderly', desc: 'The wooden bench in the park has broken slats exposing nails. Senior citizens frequently use this area and it poses injury risk.', cat: 'parks', sev: 'Low', dept: 'Public Works', img: '/public/images/brokenfootpath.jpg' },
        { title: 'Open manhole — Extreme danger to pedestrians', desc: 'An uncovered manhole on the footpath is an extreme hazard, especially at night when visibility is poor. Immediate action needed.', cat: 'roads', sev: 'Critical', dept: 'Roads', emergency: true, img: '/public/images/pothole.jpg' },
    ];

    const statuses = ['Submitted', 'Acknowledged', 'InProgress', 'Submitted', 'Submitted', 'Submitted'];
    const created = [];

    NEARBY_ISSUES.forEach((tmpl, i) => {
        // Scatter within ~2km radius
        const offLat = (Math.random() - 0.5) * 0.02;
        const offLng = (Math.random() - 0.5) * 0.02;
        const issue = {
            _id: store.generateId('issue'),
            user: 'user_001',
            title: tmpl.title,
            description: tmpl.desc,
            image: tmpl.img,
            video: null,
            location: {
                type: 'Point',
                coordinates: [longitude + offLng, latitude + offLat],
                address: `Near your location (${(latitude + offLat).toFixed(4)}, ${(longitude + offLng).toFixed(4)})`,
            },
            departmentTag: tmpl.dept,
            status: statuses[i],
            category: tmpl.cat,
            priorityScore: Math.floor(Math.random() * 80) + 20,
            aiSeverity: tmpl.sev,
            aiTags: [tmpl.cat, 'nearby'],
            upvotes: ['user_001'], downvotes: [], followers: [], commentCount: Math.floor(Math.random() * 15),
            statusTimeline: [{ status: 'Submitted', timestamp: new Date().toISOString(), comment: 'Issue reported by citizen' }],
            assignedTo: null, resolvedBy: null, resolutionProof: null,
            anonymous: false, emergency: tmpl.emergency || false,
            createdAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
        };
        store.issues.push(issue);
        created.push(issue._id);
    });

    res.json({ message: `Seeded ${created.length} issues near your location`, count: created.length, ids: created });
});

// GET /api/issues/geojson — GeoJSON FeatureCollection for map
router.get('/geojson', (req, res) => {
    const features = store.issues
        .filter(i => i.location?.coordinates)
        .map(i => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: i.location.coordinates },
            properties: {
                id: i._id, title: i.title, severity: i.aiSeverity,
                status: i.status, category: i.category,
                upvotes: i.upvotes?.length || 0, emergency: i.emergency || false,
                address: i.location.address, image: i.image,
            },
        }));
    res.json({ type: 'FeatureCollection', features });
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

    res.json({ ...enrichIssue(issue, req), comments });
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
        image: image || '/public/images/pothole.jpg',
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

    res.status(201).json(enrichIssue(issue, req));
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
