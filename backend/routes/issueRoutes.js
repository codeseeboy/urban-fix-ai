const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');
const NotificationService = require('../services/notificationService');

// Helper: resolve image path to full URL
const PORT = process.env.PORT || 5000;
function resolveImageUrl(path, req) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    let protocol = req ? req.protocol : 'http';
    if (req && req.get('x-forwarded-proto') === 'https') protocol = 'https';
    const host = req ? `${protocol}://${req.get('host')}` : `http://localhost:${PORT}`;
    return `${host}${path}`;
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

// Helper: enrich issue with user data + upvote counts
async function enrichIssue(issue, req) {
    let author;
    if (issue.author_type === 'MunicipalPage') {
        const page = await store.getMunicipalPageById(issue.municipal_page_id);
        author = page
            ? { _id: page.id, name: page.name, avatar: page.avatar, handle: page.handle, isPage: true, verified: page.verified }
            : { name: 'Unknown Page' };
    } else {
        const user = issue.user_id ? await store.getUserById(issue.user_id) : null;
        author = user
            ? { _id: user.id, name: user.name, avatar: user.avatar, role: user.role }
            : { name: 'Anonymous' };
    }

    const upvotes = await store.getIssueUpvotes(issue.id);
    const downvotes = await store.getIssueDownvotes(issue.id);
    const followers = await store.getIssueFollowers(issue.id);
    const commentCount = await store.getCommentCountByIssue(issue.id);
    const timeline = await store.getStatusTimeline(issue.id);
    const proof = await store.getResolutionProof(issue.id);
    const timeAgo = getTimeAgo(issue.created_at);

    return {
        _id: issue.id,
        user: author,
        title: issue.title,
        description: issue.description,
        image: resolveImageUrl(issue.image, req),
        video: issue.video,
        location: {
            type: 'Point',
            coordinates: [issue.location_longitude || 0, issue.location_latitude || 0],
            address: issue.location_address || '',
        },
        departmentTag: issue.department_tag,
        status: issue.status,
        category: issue.category,
        priorityScore: issue.priority_score,
        aiSeverity: issue.ai_severity,
        aiTags: issue.ai_tags || [],
        upvotes,
        downvotes,
        followers,
        commentCount,
        statusTimeline: timeline.map(t => ({
            status: t.status,
            timestamp: t.created_at,
            updatedBy: t.updated_by,
            comment: t.comment,
            dept: t.dept,
        })),
        resolutionProof: proof ? {
            afterImage: proof.after_image,
            workerRemarks: proof.worker_remarks,
            resolvedAt: proof.resolved_at,
            resolvedBy: proof.resolved_by,
        } : null,
        assignedTo: issue.assigned_to,
        resolvedBy: issue.resolved_by,
        anonymous: issue.anonymous,
        emergency: issue.emergency,
        authorType: issue.author_type,
        municipalPage: issue.municipal_page_id,
        officialUpdateType: issue.official_update_type,
        timeAgo,
        createdAt: issue.created_at,
    };
}

// GET /api/issues — Feed with filters
router.get('/', async (req, res) => {
    try {
        const { filter, userId } = req.query;
        const issues = await store.getIssues(filter, userId);
        const enriched = await Promise.all(issues.map(i => enrichIssue(i, req)));
        res.json(enriched);
    } catch (error) {
        console.error('GET /issues error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/issues/seed-nearby — Generate demo issues near user location
const seededLocations = new Set();
router.post('/seed-nearby', async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        if (!latitude || !longitude) return res.status(400).json({ message: 'latitude & longitude required' });

        const areaKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
        if (seededLocations.has(areaKey)) {
            return res.json({ message: 'Area already seeded', count: 0 });
        }
        seededLocations.add(areaKey);

        const NEARBY_ISSUES = [
            { title: 'Pothole on nearby road — Risk of accident', desc: 'A deep pothole has formed on the main road causing vehicles to swerve dangerously.', cat: 'roads', sev: 'High', dept: 'Roads', img: '/public/images/pothole.jpg' },
            { title: 'Streetlight not working — Dark zone at night', desc: 'The streetlight near the junction has been non-functional for over a week.', cat: 'lighting', sev: 'Medium', dept: 'Electricity', img: '/public/images/streetlight.webp' },
            { title: 'Garbage dump overflowing — Stench & flies', desc: 'The community garbage bin has not been cleared for 5 days.', cat: 'trash', sev: 'Critical', dept: 'Sanitation', img: '/public/images/garbage.avif' },
            { title: 'Water pipe leaking — Wastage on street', desc: 'A major water pipe is leaking continuously near the residential block.', cat: 'water', sev: 'High', dept: 'Water', img: '/public/images/burst-pipe.jpg' },
            { title: 'Broken park bench — Unsafe for elderly', desc: 'The wooden bench in the park has broken slats exposing nails.', cat: 'parks', sev: 'Low', dept: 'Public Works', img: '/public/images/brokenfootpath.jpg' },
            { title: 'Open manhole — Extreme danger to pedestrians', desc: 'An uncovered manhole on the footpath is an extreme hazard.', cat: 'roads', sev: 'Critical', dept: 'Roads', img: '/public/images/pothole.jpg', emergency: true },
        ];

        const statuses = ['Submitted', 'Acknowledged', 'InProgress', 'Submitted', 'Submitted', 'Submitted'];
        const created = [];

        // Get a default user for seed issues
        const defaultUser = await store.getUserByEmail('shashi@test.com');
        const defaultUserId = defaultUser ? defaultUser.id : null;

        for (let i = 0; i < NEARBY_ISSUES.length; i++) {
            const tmpl = NEARBY_ISSUES[i];
            const offLat = (Math.random() - 0.5) * 0.02;
            const offLng = (Math.random() - 0.5) * 0.02;

            const issue = await store.createIssue({
                user_id: defaultUserId,
                title: tmpl.title,
                description: tmpl.desc,
                image: tmpl.img,
                location_address: `Near your location (${(latitude + offLat).toFixed(4)}, ${(longitude + offLng).toFixed(4)})`,
                location_longitude: longitude + offLng,
                location_latitude: latitude + offLat,
                department_tag: tmpl.dept,
                status: statuses[i],
                category: tmpl.cat,
                priority_score: Math.floor(Math.random() * 80) + 20,
                ai_severity: tmpl.sev,
                ai_tags: [tmpl.cat, 'nearby'],
                anonymous: false,
                emergency: tmpl.emergency || false,
            });

            // Add initial status timeline entry
            await store.addStatusTimeline({
                issue_id: issue.id,
                status: 'Submitted',
                comment: 'Issue reported by citizen',
            });

            created.push(issue.id);
        }

        res.json({ message: `Seeded ${created.length} issues near your location`, count: created.length, ids: created });
    } catch (error) {
        console.error('Seed nearby error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/issues/geojson — GeoJSON FeatureCollection for map
router.get('/geojson', async (req, res) => {
    try {
        const geojson = await store.getIssuesGeoJSON();
        res.json(geojson);
    } catch (error) {
        console.error('GeoJSON error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/issues/:id — Single issue
router.get('/:id', async (req, res) => {
    try {
        const issue = await store.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ message: 'Issue not found' });

        const enriched = await enrichIssue(issue, req);

        // Attach full comments
        const comments = await store.getCommentsByIssue(issue.id);
        const enrichedComments = await Promise.all(comments.map(async (c) => {
            const u = await store.getUserById(c.user_id);
            return {
                _id: c.id,
                issueId: c.issue_id,
                user: u ? { _id: u.id, name: u.name, role: u.role } : { name: 'Unknown' },
                text: c.text,
                likes: c.likes,
                timeAgo: getTimeAgo(c.created_at),
                createdAt: c.created_at,
            };
        }));

        res.json({ ...enriched, comments: enrichedComments });
    } catch (error) {
        console.error('GET /issues/:id error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/issues — Create new issue
router.post('/', protect, async (req, res) => {
    try {
        const { title, description, image, video, location, category, anonymous, emergency } = req.body;
        if (!title) return res.status(400).json({ message: 'Title is required' });

        // Mock AI processing
        const severities = ['Low', 'Medium', 'High', 'Critical'];
        const aiSeverity = emergency ? 'Critical' : severities[Math.floor(Math.random() * 3) + 1];
        const deptMap = { roads: 'Roads', lighting: 'Electricity', trash: 'Sanitation', water: 'Water', parks: 'Parks' };

        const issue = await store.createIssue({
            user_id: anonymous ? null : req.user._id,
            title,
            description: description || '',
            image: image || '/public/images/pothole.jpg',
            video: video || null,
            location_address: location?.address || 'Unknown',
            location_longitude: location?.coordinates?.[0] || 77.209,
            location_latitude: location?.coordinates?.[1] || 28.614,
            department_tag: deptMap[category] || 'General',
            status: 'Submitted',
            category: category || 'other',
            priority_score: Math.floor(Math.random() * 40) + 20,
            ai_severity: aiSeverity,
            ai_tags: [category || 'general', 'civic-issue'],
            anonymous: !!anonymous,
            emergency: !!emergency,
        });

        // Add initial status timeline entry
        await store.addStatusTimeline({
            issue_id: issue.id,
            status: 'Submitted',
            comment: emergency ? 'EMERGENCY issue reported by citizen' : 'Issue reported by citizen',
        });

        // Award points
        if (!anonymous) {
            const user = await store.getUserById(req.user._id);
            if (user) {
                const newPoints = user.points + 10;
                const newReportsCount = (user.reports_count || 0) + 1;
                const updates = { points: newPoints, reports_count: newReportsCount };

                // Badge check
                if (newReportsCount === 1 && !(user.badges || []).includes('first_report')) {
                    updates.badges = [...(user.badges || []), 'first_report'];
                    await NotificationService.sendToUser(
                        user.id,
                        'Badge Earned: First Report 🏅',
                        'You submitted your first civic report!',
                        { type: 'badge', target: 'Profile' }
                    );
                }

                await store.updateUser(user.id, updates);
            }

            await NotificationService.sendToUser(
                req.user._id,
                'Report Submitted ✅',
                `"${title}" — AI classified as ${aiSeverity} severity.`,
                { type: 'status', issueId: issue.id, navigationTarget: 'IssueDetails' }
            );
        }

        const enriched = await enrichIssue(issue, req);
        res.status(201).json(enriched);
    } catch (error) {
        console.error('POST /issues error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/issues/:id/upvote — Toggle upvote
router.put('/:id/upvote', protect, async (req, res) => {
    try {
        const issue = await store.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ message: 'Issue not found' });

        const result = await store.toggleUpvote(issue.id, req.user._id);
        const upvotes = await store.getIssueUpvotes(issue.id);

        // Update priority score
        const newScore = result.added
            ? issue.priority_score + 1
            : Math.max(0, issue.priority_score - 1);
        await store.updateIssue(issue.id, { priority_score: newScore });

        // Notify issue owner
        if (result.added && issue.user_id && issue.user_id !== req.user._id) {
            await NotificationService.sendToUser(
                issue.user_id,
                `${req.user.name} upvoted your report`,
                `"${issue.title}" now has ${upvotes.length} upvotes.`,
                { type: 'upvote', issueId: issue.id, navigationTarget: 'IssueDetails' }
            );
        }

        res.json({ upvotes, upvoted: result.added, priorityScore: newScore });
    } catch (error) {
        console.error('Upvote error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/issues/:id/downvote — Toggle downvote
router.put('/:id/downvote', protect, async (req, res) => {
    try {
        const issue = await store.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ message: 'Issue not found' });

        const result = await store.toggleDownvote(issue.id, req.user._id);
        const downvotes = await store.getIssueDownvotes(issue.id);

        const newScore = result.added
            ? Math.max(0, issue.priority_score - 1)
            : Math.min(100, issue.priority_score + 1);
        await store.updateIssue(issue.id, { priority_score: newScore });

        res.json({ downvotes, downvoted: result.added, priorityScore: newScore });
    } catch (error) {
        console.error('Downvote error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/issues/:id/follow — Toggle follow
router.put('/:id/follow', protect, async (req, res) => {
    try {
        const issue = await store.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ message: 'Issue not found' });

        const result = await store.toggleIssueFollow(issue.id, req.user._id);
        const followers = await store.getIssueFollowers(issue.id);

        res.json({ followers, following: result.following });
    } catch (error) {
        console.error('Follow error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/issues/:id/comments — Add comment
router.post('/:id/comments', protect, async (req, res) => {
    try {
        const issue = await store.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ message: 'Issue not found' });

        const comment = await store.createComment({
            issue_id: issue.id,
            user_id: req.user._id,
            text: req.body.text,
        });

        // Points for commenting
        const user = await store.getUserById(req.user._id);
        if (user) {
            await store.updateUser(user.id, { points: user.points + 2 });
        }

        // Notify issue owner
        if (issue.user_id && issue.user_id !== req.user._id) {
            await NotificationService.sendToUser(
                issue.user_id,
                `${req.user.name} commented on your report`,
                `"${req.body.text.substring(0, 50)}..."`,
                { type: 'comment', issueId: issue.id, navigationTarget: 'Comments' }
            );
        }

        const u = await store.getUserById(comment.user_id);
        res.status(201).json({
            _id: comment.id,
            issueId: comment.issue_id,
            user: u ? { _id: u.id, name: u.name, role: u.role } : { name: 'Unknown' },
            text: comment.text,
            likes: comment.likes,
            timeAgo: 'Just now',
            createdAt: comment.created_at,
        });
    } catch (error) {
        console.error('Add comment error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/issues/:id/comments
router.get('/:id/comments', async (req, res) => {
    try {
        const comments = await store.getCommentsByIssue(req.params.id);
        const enriched = await Promise.all(comments.map(async (c) => {
            const u = await store.getUserById(c.user_id);
            return {
                _id: c.id,
                issueId: c.issue_id,
                user: u ? { _id: u.id, name: u.name, role: u.role } : { name: 'Unknown' },
                text: c.text,
                likes: c.likes,
                timeAgo: getTimeAgo(c.created_at),
                createdAt: c.created_at,
            };
        }));
        res.json(enriched);
    } catch (error) {
        console.error('GET comments error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
