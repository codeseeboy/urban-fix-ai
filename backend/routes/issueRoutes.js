const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const store = require('../data/store');
const NotificationService = require('../services/notificationService');
const upload = require('../config/multer');
const { uploadFile } = require('../config/storage');

// Helper: resolve image path to full URL
function resolveImageUrl(imgPath) {
    if (!imgPath) return null;
    if (imgPath.startsWith('http')) return imgPath;
    return null;
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

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    // Great-circle distance for small radii (meters).
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function inferIssueTypeForMatching({ category, title, description, aiTags }) {
    const tags = Array.isArray(aiTags) ? aiTags : [];
    const text = `${title || ''} ${description || ''}`.toLowerCase();
    const cat = (category || 'other').toLowerCase();

    // Category is already user-selected in the app. Use it as the primary source
    // to avoid AI/tag keyword brittleness (production trust requirement).
    if (cat === 'trash') return 'garbage';
    if (cat === 'water') return 'water';
    if (cat === 'lighting') return 'lighting';
    if (cat === 'parks') return 'parks';

    // Drainage (manholes/flood/drain)
    if (tags.includes('drainage') || /flood|drain|manhole|overflow|sewer/.test(text)) return 'drainage';

    // Water (leaks)
    if (tags.includes('water-supply') || /leak|water|pipe|wastage|sewage/.test(text)) return 'water';

    // Garbage (sanitation)
    if (tags.includes('sanitation') || /garbage|dump|trash|stench|flies|overflow/.test(text)) return 'garbage';

    // Lighting
    if (tags.includes('lighting') || /streetlight|dark zone|light|bulb/.test(text)) return 'lighting';

    // Parks (horticulture)
    if (tags.includes('horticulture') || category === 'parks' || /tree|bench|park/.test(text)) return 'parks';

    // Pothole / road damage
    if (tags.includes('road-damage') || tags.includes('infrastructure') || /pothole|pit|broken road|road damage/.test(text)) return 'pothole';

    // If category is a road-related type but keywords are missing, stay conservative.
    if (cat === 'roads') return 'pothole';

    return 'other';
}

function radiusMetersForType(issueType) {
    // Dynamic radius per user expectations.
    switch (issueType) {
        case 'pothole':
            return 20;
        case 'drainage':
            return 30;
        case 'garbage':
            return 45;
        case 'water':
            return 30;
        case 'lighting':
            return 20;
        case 'parks':
            return 30;
        default:
            return 25;
    }
}

// Helper: enrich issue with user data + interaction counts
async function enrichIssue(issue, req, options = {}) {
    const { includeTimelineProof = true } = options;

    const authorPromise = issue.author_type === 'MunicipalPage'
        ? store.getMunicipalPageById(issue.municipal_page_id)
        : (issue.user_id ? store.getUserById(issue.user_id) : Promise.resolve(null));

    const timelinePromise = includeTimelineProof
        ? store.getStatusTimeline(issue.id)
        : Promise.resolve([]);

    const proofPromise = includeTimelineProof
        ? store.getResolutionProof(issue.id)
        : Promise.resolve(null);

    const [authorRaw, upvotes, downvotes, followers, commentCount, timeline, proof] = await Promise.all([
        authorPromise,
        store.getIssueUpvotes(issue.id),
        store.getIssueDownvotes(issue.id),
        store.getIssueFollowers(issue.id),
        store.getCommentCountByIssue(issue.id),
        timelinePromise,
        proofPromise,
    ]);

    const author = issue.author_type === 'MunicipalPage'
        ? (authorRaw
            ? { _id: authorRaw.id, name: authorRaw.name, avatar: authorRaw.avatar, handle: authorRaw.handle, isPage: true, verified: authorRaw.verified }
            : { name: 'Unknown Page' })
        : (authorRaw
            ? { _id: authorRaw.id, name: authorRaw.name, avatar: authorRaw.avatar, role: authorRaw.role }
            : { name: 'Anonymous' });

    const timeAgo = getTimeAgo(issue.created_at);

    // Resolve user info for assigned/resolved and timeline "updated_by" so the UI
    // can show who is working/assigned (without extra client calls).
    const userIdsToFetch = new Set();
    if (issue.assigned_to) userIdsToFetch.add(issue.assigned_to);
    if (issue.resolved_by) userIdsToFetch.add(issue.resolved_by);
    (Array.isArray(timeline) ? timeline : []).forEach((t) => {
        if (t?.updated_by) userIdsToFetch.add(t.updated_by);
    });

    const usersToFetch = Array.from(userIdsToFetch);
    let userRows = [];
    if (usersToFetch.length) {
        const { data } = await store.supabase
            .from('users')
            .select('id, name, role, points, impact_score')
            .in('id', usersToFetch);
        userRows = data || [];
    }
    const userById = new Map(userRows.map((u) => [u.id, u]));

    const mapUser = (id) => {
        if (!id) return null;
        const u = userById.get(id);
        if (!u) return null;
        return {
            _id: u.id,
            name: u.name,
            role: u.role,
            points: u.points,
            impactScore: u.impact_score,
        };
    };

    return {
        _id: issue.id,
        user: author,
        title: issue.title,
        description: issue.description,
        image: resolveImageUrl(issue.image),
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
        statusTimeline: (timeline || []).map(t => ({
            status: t.status,
            timestamp: t.created_at,
            updatedBy: t.updated_by,
            updatedByUser: mapUser(t.updated_by),
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
        assignedToUser: mapUser(issue.assigned_to),
        resolvedBy: issue.resolved_by,
        resolvedByUser: mapUser(issue.resolved_by),
        deadline: issue.deadline,
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
        const { filter, userId, municipalPageId, authorType } = req.query;
        const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10) || 50, 100) : null;
        const offset = req.query.offset ? Math.max(parseInt(req.query.offset, 10) || 0, 0) : 0;
        const issues = await store.getIssues(filter, userId, municipalPageId, authorType, limit, offset);
        const enriched = await Promise.all(
            issues.map(i => enrichIssue(i, req, { includeTimelineProof: false }))
        );
        res.json(enriched);
    } catch (error) {
        console.error('GET /issues error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/issues/municipal-feed — Personalized municipal feed
router.get('/municipal-feed', protect, async (req, res) => {
    try {
        const { filter } = req.query;
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        const issues = await store.getIssues(filter, req.user._id, null, 'MunicipalPage');
        const issueIds = issues.map((i) => i.id);

        const [followingPageIds, seenIssueIds] = await Promise.all([
            store.getFollowingPageIds(req.user._id),
            store.getSeenMunicipalPostIds(req.user._id, issueIds),
        ]);

        const followingSet = new Set(followingPageIds || []);
        const seenSet = new Set(seenIssueIds || []);

        const prioritized = issues
            .map((issue) => {
                const isFollowingPage = followingSet.has(issue.municipal_page_id);
                const isSeen = seenSet.has(issue.id);

                let bucket = 3;
                if (isFollowingPage && !isSeen) bucket = 0;
                else if (isFollowingPage && isSeen) bucket = 1;
                else if (!isFollowingPage && !isSeen) bucket = 2;

                return {
                    issue,
                    isFollowingPage,
                    isSeen,
                    bucket,
                    createdAtMs: new Date(issue.created_at).getTime(),
                };
            })
            .sort((a, b) => {
                if (a.bucket !== b.bucket) return a.bucket - b.bucket;
                if (a.createdAtMs !== b.createdAtMs) return b.createdAtMs - a.createdAtMs;
                return (b.issue.id || '').localeCompare(a.issue.id || '');
            });

        const feedRows = prioritized.slice(offset, offset + limit);
        const enriched = await Promise.all(
            feedRows.map(async (row) => {
                const payload = await enrichIssue(row.issue, req, { includeTimelineProof: false });
                return {
                    ...payload,
                    isSeen: row.isSeen,
                    isFollowingPage: row.isFollowingPage,
                    feedBucket: row.bucket,
                };
            })
        );

        res.json(enriched);
    } catch (error) {
        console.error('GET /issues/municipal-feed error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/issues/:id/seen — Mark municipal post as seen
router.post('/:id/seen', protect, async (req, res) => {
    try {
        const issue = await store.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ message: 'Issue not found' });
        if (issue.author_type !== 'MunicipalPage') {
            return res.status(400).json({ message: 'Seen tracking is only supported for municipal posts' });
        }

        await store.markMunicipalPostSeen(req.user._id, issue.id);
        res.json({ seen: true });
    } catch (error) {
        console.error('POST /issues/:id/seen error:', error.message);
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
            { title: 'Pothole on nearby road — Risk of accident', desc: 'A deep pothole has formed on the main road causing vehicles to swerve dangerously.', cat: 'roads', sev: 'High', dept: 'Roads', img: null },
            { title: 'Streetlight not working — Dark zone at night', desc: 'The streetlight near the junction has been non-functional for over a week.', cat: 'lighting', sev: 'Medium', dept: 'Electricity', img: null },
            { title: 'Garbage dump overflowing — Stench & flies', desc: 'The community garbage bin has not been cleared for 5 days.', cat: 'trash', sev: 'Critical', dept: 'Sanitation', img: null },
            { title: 'Water pipe leaking — Wastage on street', desc: 'A major water pipe is leaking continuously near the residential block.', cat: 'water', sev: 'High', dept: 'Water', img: null },
            { title: 'Broken park bench — Unsafe for elderly', desc: 'The wooden bench in the park has broken slats exposing nails.', cat: 'parks', sev: 'Low', dept: 'Public Works', img: null },
            { title: 'Open manhole — Extreme danger to pedestrians', desc: 'An uncovered manhole on the footpath is an extreme hazard.', cat: 'roads', sev: 'Critical', dept: 'Roads', img: null, emergency: true },
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
                author_type: 'User',
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

// GET /api/issues/:id/upvoters — usernames who upvoted this issue
router.get('/:id/upvoters', protect, async (req, res) => {
    try {
        const usernames = await store.getIssueUpvoterUsernames(req.params.id);
        res.json({ usernames });
    } catch (error) {
        console.error('Upvoters error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/issues/:id/downvoters — usernames who downvoted this issue
router.get('/:id/downvoters', protect, async (req, res) => {
    try {
        const usernames = await store.getIssueDownvoterUsernames(req.params.id);
        res.json({ usernames });
    } catch (error) {
        console.error('Downvoters error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/issues/duplicate-check — detect existing same-type unresolved issue (User-only)
router.post('/duplicate-check', protect, async (req, res) => {
    try {
        let { title, description, category, emergency, anonymous, location } = req.body;

        if (typeof location === 'string') {
            try { location = JSON.parse(location); } catch { location = {}; }
        }

        if (!location?.coordinates || !Array.isArray(location.coordinates)) {
            return res.status(400).json({ message: 'Location coordinates are required' });
        }

        const lon = location?.coordinates?.[0];
        const lat = location?.coordinates?.[1];
        const accuracyMeters = location?.accuracy_meters ?? location?.accuracyMeters ?? null;

        if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lon !== 'number' || !Number.isFinite(lon)) {
            return res.status(400).json({ message: 'Valid latitude/longitude are required' });
        }
        if (accuracyMeters === null || accuracyMeters === undefined) {
            return res.status(400).json({ message: 'Location accuracy is required' });
        }
        const acc = Number(accuracyMeters);
        if (!Number.isFinite(acc) || acc > 15) {
            return res.status(400).json({ message: 'Location accuracy is too low (need <= 15m)' });
        }

        const aiService = require('../services/ai');
        const tags = await aiService.generateTags({ category: category || 'other', description: description || '', title: title || '' });
        const newIssueType = inferIssueTypeForMatching({ category: category || 'other', title, description, aiTags: tags });

        const baseRadiusUsed = radiusMetersForType(newIssueType);
        // Accuracy-based trust: if GPS was measured with some error (<=15m),
        // expand the merge radius proportionally but keep it bounded.
        const effectiveRadiusUsed = Math.min(70, baseRadiusUsed + acc * 1.5);
        const radiusUsed = effectiveRadiusUsed;
        const radiusSoft = radiusUsed * 1.5;
        const timeWindowDays = 14;
        const now = Date.now();

        // Candidate bounding-box search (fast pre-filter; final uses haversine)
        const latDelta = radiusSoft / 111000;
        const lonDelta = radiusSoft / (111000 * Math.cos((lat * Math.PI) / 180) || 1);

        const { data: candidates } = await store.supabase
            .from('issues')
            .select('id, title, description, category, status, created_at, image, location_address, location_latitude, location_longitude, ai_tags')
            .eq('author_type', 'User')
            .neq('status', 'Resolved')
            .gte('created_at', new Date(now - timeWindowDays * 24 * 60 * 60 * 1000).toISOString())
            .gte('location_latitude', lat - latDelta)
            .lte('location_latitude', lat + latDelta)
            .gte('location_longitude', lon - lonDelta)
            .lte('location_longitude', lon + lonDelta)
            .limit(50);

        const list = candidates || [];

        let best = null;
        for (const c of list) {
            const cLat = c.location_latitude;
            const cLon = c.location_longitude;
            if (typeof cLat !== 'number' || typeof cLon !== 'number') continue;

            const candidateType = inferIssueTypeForMatching({
                category: c.category,
                title: c.title,
                description: c.description,
                aiTags: c.ai_tags || [],
            });

            if (candidateType !== newIssueType) continue; // Different types never merge/group

            const distanceMeters = haversineDistanceMeters(lat, lon, cLat, cLon);
            if (distanceMeters > radiusSoft) continue;

            const ageDays = (now - new Date(c.created_at).getTime()) / (24 * 60 * 60 * 1000);
            if (ageDays < 0 || ageDays > timeWindowDays) continue;

            // Confidence score (distance + recency + strict type)
            const distanceConfidence = distanceMeters <= radiusUsed
                ? 1 - distanceMeters / (radiusUsed * 3)
                : 0.55 * (1 - (distanceMeters - radiusUsed) / (radiusSoft - radiusUsed + 1e-9));
            const recencyConfidence = 1 - Math.min(ageDays, timeWindowDays) / timeWindowDays;
            const confidence = Math.max(0, Math.min(1, distanceConfidence * 0.55 + recencyConfidence * 0.25 + 0.2));

            if (!best || confidence > best.confidence) {
                best = {
                    issueId: c.id,
                    title: c.title,
                    image: c.image,
                    address: c.location_address,
                    distanceMeters,
                    confidence,
                    createdAt: c.created_at,
                };
            }
        }

        const threshold = 0.75; // if score is high enough, treat as duplicate suggestion
        const exists = best && best.confidence >= threshold;

        res.json({
            exists: !!exists,
            threshold,
            radiusUsed,
            radiusSoft,
            newIssueType,
            match: exists ? best : null,
        });
    } catch (error) {
        console.error('duplicate-check error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/issues/:id/reports — list group reports for community gallery
router.get('/:id/reports', async (req, res) => {
    try {
        const reports = await store.getIssueReports(req.params.id);
        res.json({ reports });
    } catch (error) {
        console.error('reports error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/issues/:id/add-report — Join an existing group issue (User-only)
router.post('/:id/add-report', protect, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        let { title, description, category, emergency, anonymous, location } = req.body;

        if (typeof location === 'string') {
            try { location = JSON.parse(location); } catch { location = {}; }
        }

        const groupIssueId = req.params.id;
        const groupIssue = await store.getIssueById(groupIssueId);
        if (!groupIssue) return res.status(404).json({ message: 'Issue not found' });
        if (groupIssue.author_type !== 'User') return res.status(400).json({ message: 'Cannot join non-user issue groups' });
        if (groupIssue.status === 'Resolved') return res.status(400).json({ message: 'Issue is already resolved' });

        if (!title) return res.status(400).json({ message: 'Title is required' });
        if (!location?.coordinates || !Array.isArray(location.coordinates)) {
            return res.status(400).json({ message: 'Location coordinates are required' });
        }

        const lon = location?.coordinates?.[0];
        const lat = location?.coordinates?.[1];
        const accuracyMeters = location?.accuracy_meters ?? location?.accuracyMeters ?? null;
        if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lon !== 'number' || !Number.isFinite(lon)) {
            return res.status(400).json({ message: 'Valid latitude/longitude are required' });
        }
        if (accuracyMeters === null || accuracyMeters === undefined) {
            return res.status(400).json({ message: 'Location accuracy is required' });
        }
        const acc = Number(accuracyMeters);
        if (!Number.isFinite(acc) || acc > 15) {
            return res.status(400).json({ message: 'Location accuracy is too low (need <= 15m)' });
        }

        // Enforce merge join evidence quality: require at least an image for joining duplicates.
        const hasImage = !!(req.files && req.files.image && req.files.image[0]);
        if (!hasImage) {
            return res.status(400).json({ message: 'Image is required to join this report group' });
        }

        let imagePath = req.body.image || null;
        if (req.files && req.files.image && req.files.image[0]) {
            const uploaded = await uploadFile(req.files.image[0]);
            if (uploaded) imagePath = uploaded;
        }

        let videoPath = req.body.video || null;
        if (req.files && req.files.video && req.files.video[0]) {
            const uploaded = await uploadFile(req.files.video[0]);
            if (uploaded) videoPath = uploaded;
        }

        const aiService = require('../services/ai');
        const isEmergency = emergency === 'true' || emergency === true;
        const anonymousBool = anonymous === 'true' || anonymous === true;
        const tags = await aiService.generateTags({ category: category || 'other', description: description || '', title: title || '' });

        // Enforce "same type only" on the server as well (never rely only on frontend).
        const incomingType = inferIssueTypeForMatching({
            category: category || 'other',
            title,
            description: description || '',
            aiTags: tags,
        });
        const groupType = inferIssueTypeForMatching({
            category: groupIssue.category || 'other',
            title: groupIssue.title,
            description: groupIssue.description,
            aiTags: groupIssue.ai_tags || [],
        });
        if (incomingType !== groupType) {
            return res.status(400).json({ message: 'Report type does not match this group' });
        }

        // Keep merge window (spec: within recent window).
        const timeWindowDays = 14;
        const ageDays = (Date.now() - new Date(groupIssue.created_at).getTime()) / (24 * 60 * 60 * 1000);
        if (!Number.isFinite(ageDays) || ageDays > timeWindowDays) {
            return res.status(400).json({ message: 'This group is too old to merge' });
        }

        const user = await store.getUserById(req.user._id);
        const reporterUsername = anonymousBool ? 'anonymous' : (user?.username || user?.name || 'user');

        const report = await store.createIssueReport({
            group_issue_id: groupIssueId,
            reporter_user_id: req.user?._id || null,
            reporter_username: reporterUsername,
            reporter_anonymous: anonymousBool,

            title,
            description: description || '',
            image: imagePath,
            video: videoPath || null,

            location_address: location?.address || 'Unknown',
            location_longitude: lon,
            location_latitude: lat,
            location_accuracy_meters: acc,
            location_source: location?.location_source || null,

            ai_tags: tags,
        });

        // Reward joining: increase points + reports_count (unless anonymous)
        if (!anonymousBool) {
            const freshUser = await store.getUserById(req.user._id);
            if (freshUser) {
                const newPoints = (freshUser.points || 0) + 10;
                const newReportsCount = (freshUser.reports_count || 0) + 1;
                await store.updateUser(freshUser.id, { points: newPoints, reports_count: newReportsCount });
            }
        }

        // Bump group priority as more reports come in.
        const currentReportsCount = await store.getIssueReportsCount(groupIssueId);
        const severityBump = groupIssue.ai_severity === 'Critical' ? 3 : groupIssue.ai_severity === 'High' ? 2 : 1;
        const bump = 2 + Math.min(6, currentReportsCount); // gently increases with report volume
        const newPriority = Math.min(100, (groupIssue.priority_score || 0) + bump + severityBump);
        await store.updateIssue(groupIssueId, { priority_score: newPriority });

        // Add timeline entry for traceability
        await store.addStatusTimeline({
            issue_id: groupIssueId,
            status: 'Submitted',
            comment: anonymousBool ? 'Another citizen joined the report (anonymous)' : `Joined by ${reporterUsername}`,
        });

        // Notifications: inform original reporter + followers that a new member joined
        // (so users can see community merging happening in real time).
        try {
            const ownerId = groupIssue.user_id;
            const followerIds = await store.getIssueFollowers(groupIssueId);

            const recipients = new Set();
            if (ownerId) recipients.add(ownerId);
            (followerIds || []).forEach((id) => recipients.add(id));
            // Don't notify self twice
            if (req.user?._id) recipients.delete(req.user._id);

            const recipientList = Array.from(recipients).slice(0, 20);
            await Promise.all(
                recipientList.map((recipientId) =>
                    NotificationService.sendToUser(
                        recipientId,
                        'Community report updated',
                        anonymousBool
                            ? 'Someone joined your reported issue.'
                            : `${reporterUsername} joined your reported issue.`,
                        { type: 'status', issueId: groupIssueId, navigationTarget: 'IssueDetails' }
                    )
                )
            );
        } catch (e) {
            console.warn('add-report notifications failed:', e?.message || e);
        }

        res.json({ ...groupIssue, report });
    } catch (error) {
        console.error('add-report error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/issues/:id — Single issue
router.get('/:id', async (req, res) => {
    try {
        const issue = await store.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ message: 'Issue not found' });

        const enriched = await enrichIssue(issue, req, { includeTimelineProof: true });

        // Attach full comments
        const comments = await store.getCommentsByIssue(issue.id);
        const uniqueUserIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
        const users = await Promise.all(uniqueUserIds.map((id) => store.getUserById(id)));
        const userMap = new Map(users.filter(Boolean).map((u) => [u.id, u]));

        const enrichedComments = comments.map((c) => {
            const u = userMap.get(c.user_id);
            return {
                _id: c.id,
                issueId: c.issue_id,
                user: u ? { _id: u.id, name: u.name, role: u.role } : { name: 'Unknown' },
                text: c.text,
                likes: c.likes,
                timeAgo: getTimeAgo(c.created_at),
                createdAt: c.created_at,
            };
        });

        res.json({ ...enriched, comments: enrichedComments });
    } catch (error) {
        console.error('GET /issues/:id error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/issues — Create new issue
router.post('/', protect, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        let { title, description, category, anonymous, emergency, location } = req.body;

        // Parse location if it comes as a string (common in multipart/form-data)
        if (typeof location === 'string') {
            try {
                location = JSON.parse(location);
            } catch (e) {
                console.error('Location parse error:', e);
                location = {};
            }
        }

        if (!title) return res.status(400).json({ message: 'Title is required' });

        // Upload files to Supabase Storage (no local disk)
        let imagePath = req.body.image || null;
        if (req.files && req.files.image && req.files.image[0]) {
            const uploaded = await uploadFile(req.files.image[0]);
            if (uploaded) imagePath = uploaded;
        }

        let videoPath = req.body.video || null;
        if (req.files && req.files.video && req.files.video[0]) {
            const uploaded = await uploadFile(req.files.video[0]);
            if (uploaded) videoPath = uploaded;
        }

        // AI analysis (uses rule-based logic now; swap to ML models via services/ai/index.js)
        const aiService = require('../services/ai');
        const isEmergency = emergency === 'true' || emergency === true;

        const lat = location?.coordinates?.[1];
        const lon = location?.coordinates?.[0];
        const accuracyMeters = location?.accuracy_meters ?? location?.accuracyMeters ?? null;

        if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lon !== 'number' || !Number.isFinite(lon)) {
            return res.status(400).json({ message: 'Valid latitude/longitude are required' });
        }

        // Production trust rule: community reports must have accurate location (<= 15m).
        // Municipal posts are created via /api/municipal/:id/post and use a different flow.
        if (req.user?._id && (accuracyMeters !== null && accuracyMeters !== undefined)) {
            const acc = Number(accuracyMeters);
            if (!Number.isFinite(acc) || acc > 15) {
                return res.status(400).json({ message: 'Location accuracy is too low (need <= 15m)' });
            }
        }

        // If accuracy is missing for a non-anonymous user, block (trust + trust score readiness).
        if (req.user?._id && (accuracyMeters === null || accuracyMeters === undefined)) {
            return res.status(400).json({ message: 'Location accuracy is required for reliable reports' });
        }

        const aiResult = await aiService.analyzeIssue({
            category: category || 'other',
            description: description || '',
            title,
            emergency: isEmergency,
            imageUrl: imagePath,
            latitude: lat,
            longitude: lon,
        });

        const anonymousBool = anonymous === 'true' || anonymous === true;
        const reporterUser = anonymousBool ? null : await store.getUserById(req.user._id);
        const reporterUsername = anonymousBool ? 'anonymous' : (reporterUser?.username || reporterUser?.name || 'user');

        const issue = await store.createIssue({
            user_id: (anonymous === 'true' || anonymous === true) ? null : req.user._id,
            author_type: 'User',
            title,
            description: description || '',
            image: imagePath,
            video: videoPath || null,
            location_address: location?.address || 'Unknown',
            location_longitude: lon,
            location_latitude: lat,
            location_accuracy_meters: accuracyMeters,
            location_source: location?.location_source || null,
            department_tag: aiResult.departmentTag,
            status: 'Submitted',
            category: category || 'other',
            priority_score: aiResult.priorityScore,
            ai_severity: aiResult.aiSeverity,
            ai_tags: aiResult.aiTags,
            anonymous: (anonymous === 'true' || anonymous === true),
            emergency: isEmergency,
        });

        // Create the first report row so Community gallery shows "creator" too.
        await store.createIssueReport({
            group_issue_id: issue.id,
            reporter_user_id: req.user._id || null,
            reporter_username: reporterUsername,
            reporter_anonymous: anonymousBool,

            title,
            description: description || '',
            image: imagePath,
            video: videoPath || null,

            location_address: location?.address || 'Unknown',
            location_longitude: lon,
            location_latitude: lat,
            location_accuracy_meters: accuracyMeters,
            location_source: location?.location_source || null,

            ai_tags: aiResult.aiTags,
        });

        const aiSeverity = aiResult.aiSeverity;

        // Add initial status timeline entry
        await store.addStatusTimeline({
            issue_id: issue.id,
            status: 'Submitted',
            comment: (emergency === 'true' || emergency === true) ? 'EMERGENCY issue reported by citizen' : 'Issue reported by citizen',
        });

        // Award points
        if (anonymous !== 'true' && anonymous !== true) {
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

        // Broadcast to all other users that a new issue was posted
        // Fire-and-forget to not slow down the response
        setImmediate(() => {
            NotificationService.broadcastNewIssue(
                req.user._id,
                title,
                issue.id,
                category
            ).catch(e => console.error('Broadcast error:', e.message));
        });

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
