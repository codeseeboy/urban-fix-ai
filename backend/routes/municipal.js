const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const store = require('../data/store');

// @desc    Create a new Municipal Page
// @route   POST /api/municipal/create
// @access  Private/Admin
router.post('/create', protect, admin, async (req, res) => {
    try {
        const { name, handle, department, region, pageType, contactEmail, description, avatar, coverImage } = req.body;

        const pageExists = await store.getMunicipalPageByHandle(handle);
        if (pageExists) {
            return res.status(400).json({ message: 'Handle already taken' });
        }

        const page = await store.createMunicipalPage({
            name, handle, department,
            region: region || {},
            page_type: pageType,
            contact_email: contactEmail,
            description,
            avatar: avatar || null,
            cover_image: coverImage || null,
            verified: true,
            followers_count: 0,
            created_by_admin_id: req.user._id,
            is_active: true,
        });

        res.status(201).json({
            _id: page.id, ...page,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all pages (Search)
// @route   GET /api/municipal/search
// @access  Private
router.get('/search', protect, async (req, res) => {
    try {
        const q = req.query.q || '';
        const pages = await store.searchMunicipalPages(q);
        res.json(pages.map(p => ({ ...p, _id: p.id })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get suggested pages for user
// @route   GET /api/municipal/suggested
// @access  Private
router.get('/suggested', protect, async (req, res) => {
    try {
        const pages = await store.getSuggestedPages(10);
        res.json(pages.map(p => ({ ...p, _id: p.id })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get page details
// @route   GET /api/municipal/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const page = await store.getMunicipalPageById(req.params.id);
        if (!page) return res.status(404).json({ message: 'Page not found' });

        const isFollowing = await store.isFollowing(req.user._id, page.id);
        res.json({ ...page, _id: page.id, isFollowing });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get page followers
// @route   GET /api/municipal/:id/followers
// @access  Private
router.get('/:id/followers', protect, async (req, res) => {
    try {
        const page = await store.getMunicipalPageById(req.params.id);
        if (!page) return res.status(404).json({ message: 'Page not found' });

        const followerIds = await store.getFollowerIds(page.id);
        const followers = await Promise.all(followerIds.map(async (id) => {
            const u = await store.getUserById(id);
            return u ? { _id: u.id, name: u.name, avatar: u.avatar } : null;
        }));

        res.json(followers.filter(Boolean));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Follow a page
// @route   POST /api/municipal/:id/follow
// @access  Private
router.post('/:id/follow', protect, async (req, res) => {
    try {
        const page = await store.getMunicipalPageById(req.params.id);
        if (!page) return res.status(404).json({ message: 'Page not found' });

        const alreadyFollowing = await store.isFollowing(req.user._id, page.id);
        if (alreadyFollowing) {
            return res.status(400).json({ message: 'Already following' });
        }

        await store.addFollow(req.user._id, page.id);
        await store.updateMunicipalPage(page.id, {
            followers_count: (page.followers_count || 0) + 1,
        });

        res.json({ message: 'Followed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Unfollow a page
// @route   POST /api/municipal/:id/unfollow
// @access  Private
router.post('/:id/unfollow', protect, async (req, res) => {
    try {
        const page = await store.getMunicipalPageById(req.params.id);
        if (!page) return res.status(404).json({ message: 'Page not found' });

        const removed = await store.removeFollow(req.user._id, page.id);
        if (removed) {
            await store.updateMunicipalPage(page.id, {
                followers_count: Math.max(0, (page.followers_count || 1) - 1),
            });
            res.json({ message: 'Unfollowed successfully' });
        } else {
            res.status(400).json({ message: 'Not following' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Post an official update
// @route   POST /api/municipal/:id/post
// @access  Private/Admin
router.post('/:id/post', protect, admin, async (req, res) => {
    try {
        const { title, description, image, officialUpdateType, location } = req.body;
        const page = await store.getMunicipalPageById(req.params.id);
        if (!page) return res.status(404).json({ message: 'Page not found' });

        const issue = await store.createIssue({
            author_type: 'MunicipalPage',
            municipal_page_id: page.id,
            user_id: null,
            official_update_type: officialUpdateType || 'Announcement',
            title,
            description: description || '',
            image: image || null,
            location_address: location?.address || page.region?.city || '',
            location_longitude: location?.coordinates?.[0] || 0,
            location_latitude: location?.coordinates?.[1] || 0,
            status: 'Resolved',
            priority_score: 0,
            ai_severity: 'Low',
            ai_tags: ['official-update'],
        });

        await store.addStatusTimeline({
            issue_id: issue.id,
            status: 'Published',
            comment: 'Official Update Published',
        });

        res.status(201).json({ ...issue, _id: issue.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update page info
// @route   PATCH /api/municipal/:id
// @access  Private/Admin
router.patch('/:id', protect, admin, async (req, res) => {
    try {
        const page = await store.getMunicipalPageById(req.params.id);
        if (!page) return res.status(404).json({ message: 'Page not found' });

        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.avatar) updates.avatar = req.body.avatar;
        if (req.body.coverImage) updates.cover_image = req.body.coverImage;
        if (req.body.description) updates.description = req.body.description;
        if (req.body.contactEmail) updates.contact_email = req.body.contactEmail;

        const updated = await store.updateMunicipalPage(page.id, updates);
        res.json({ ...updated, _id: updated.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
