const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const store = require('../data/store');

// @desc    Create a new Municipal Page
// @route   POST /api/municipal/create
// @access  Private/Admin
router.post('/create', protect, admin, (req, res) => {
    try {
        const { name, handle, department, region, pageType, contactEmail, description, avatar, coverImage } = req.body;

        const pageExists = store.municipalPages.find(p => p.handle === handle);
        if (pageExists) {
            return res.status(400).json({ message: 'Handle already taken' });
        }

        const page = {
            _id: store.generateId('page'),
            name, handle, department, region, pageType, contactEmail, description,
            avatar: avatar || null, coverImage: coverImage || null,
            verified: true, followersCount: 0,
            createdByAdminId: req.user._id,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        store.municipalPages.push(page);
        res.status(201).json(page);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all pages (Search)
// @route   GET /api/municipal/search
// @access  Private
router.get('/search', protect, (req, res) => {
    const q = req.query.q ? req.query.q.toLowerCase() : '';
    let pages = store.municipalPages.filter(p =>
        p.isActive &&
        (p.name.toLowerCase().includes(q) ||
            p.handle.toLowerCase().includes(q) ||
            p.department.toLowerCase().includes(q))
    );
    res.json(pages);
});

// @desc    Get suggested pages for user
// @route   GET /api/municipal/suggested
// @access  Private
router.get('/suggested', protect, (req, res) => {
    const { city, ward } = req.user;

    // Simple suggestion logic: same city or same ward
    let pages = store.municipalPages.filter(p =>
        p.isActive &&
        ((p.region.city && p.region.city === city) || (p.region.ward && p.region.ward === ward))
    );

    // If no specific match, return top pages or all department pages
    if (pages.length === 0) {
        pages = store.municipalPages.filter(p => p.isActive).slice(0, 5);
    }

    res.json(pages.slice(0, 10));
});

// @desc    Get page details
// @route   GET /api/municipal/:id
// @access  Private
router.get('/:id', protect, (req, res) => {
    const page = store.municipalPages.find(p => p._id === req.params.id);
    if (page) {
        const isFollowing = store.follows.some(f => f.followerId === req.user._id && f.followingId === page._id);
        res.json({ ...page, isFollowing });
    } else {
        res.status(404).json({ message: 'Page not found' });
    }
});

// @desc    Get page followers
// @route   GET /api/municipal/:id/followers
// @access  Private
router.get('/:id/followers', protect, (req, res) => {
    const page = store.municipalPages.find(p => p._id === req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found' });

    const followerIds = store.follows
        .filter(f => f.followingId === page._id)
        .map(f => f.followerId);

    const followers = store.users
        .filter(u => followerIds.includes(u._id))
        .map(u => ({ _id: u._id, name: u.name, avatar: u.avatar }));

    res.json(followers);
});

// @desc    Follow a page
// @route   POST /api/municipal/:id/follow
// @access  Private
router.post('/:id/follow', protect, (req, res) => {
    const page = store.municipalPages.find(p => p._id === req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found' });

    const exists = store.follows.find(f => f.followerId === req.user._id && f.followingId === page._id);
    if (exists) {
        return res.status(400).json({ message: 'Already following' });
    }

    const follow = {
        _id: store.generateId('follow'),
        followerId: req.user._id,
        followingId: page._id,
        timestamp: new Date().toISOString()
    };
    store.follows.push(follow);

    page.followersCount = (page.followersCount || 0) + 1;
    res.json({ message: 'Followed successfully' });
});

// @desc    Unfollow a page
// @route   POST /api/municipal/:id/unfollow
// @access  Private
router.post('/:id/unfollow', protect, (req, res) => {
    const page = store.municipalPages.find(p => p._id === req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found' });

    const idx = store.follows.findIndex(f => f.followerId === req.user._id && f.followingId === page._id);
    if (idx > -1) {
        store.follows.splice(idx, 1);
        page.followersCount = Math.max(0, (page.followersCount || 1) - 1);
        res.json({ message: 'Unfollowed successfully' });
    } else {
        res.status(400).json({ message: 'Not following' });
    }
});

// @desc    Post an official update
// @route   POST /api/municipal/:id/post
// @access  Private/Admin
router.post('/:id/post', protect, admin, (req, res) => {
    const { title, description, image, officialUpdateType, location } = req.body;
    const page = store.municipalPages.find(p => p._id === req.params.id);

    if (!page) return res.status(404).json({ message: 'Page not found' });

    // Ensure user is admin (checked by middleware) or linked to page (future scope)

    const issue = {
        _id: store.generateId('issue'),
        authorType: 'MunicipalPage',
        municipalPage: page._id,
        user: null, // No individual user author
        officialUpdateType: officialUpdateType || 'Announcement',
        title,
        description: description || '',
        image: image || null,
        location: location || { type: 'Point', coordinates: [0, 0], address: page.region.city },
        status: 'Resolved', // Official updates are informational
        priorityScore: 0,
        aiSeverity: 'Low',
        aiTags: ['official-update'],
        upvotes: [], downvotes: [], followers: [], commentCount: 0,
        statusTimeline: [
            { status: 'Published', timestamp: new Date().toISOString(), comment: 'Official Update Published' }
        ],
        createdAt: new Date().toISOString()
    };

    store.issues.unshift(issue);
    res.status(201).json(issue);
});

// @desc    Update page info
// @route   PATCH /api/municipal/:id
// @access  Private/Admin
router.patch('/:id', protect, admin, (req, res) => {
    const page = store.municipalPages.find(p => p._id === req.params.id);
    if (page) {
        if (req.body.name) page.name = req.body.name;
        if (req.body.avatar) page.avatar = req.body.avatar;
        if (req.body.coverImage) page.coverImage = req.body.coverImage;
        if (req.body.description) page.description = req.body.description;
        if (req.body.contactEmail) page.contactEmail = req.body.contactEmail;

        res.json(page);
    } else {
        res.status(404).json({ message: 'Page not found' });
    }
});

module.exports = router;
