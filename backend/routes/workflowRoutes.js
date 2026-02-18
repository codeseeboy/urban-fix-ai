const express = require('express');
const router = express.Router();
const { protect, admin, fieldWorker } = require('../middleware/authMiddleware');
const store = require('../data/store');

// PUT /api/workflows/:id/status — Admin: Change issue status
router.put('/:id/status', protect, admin, (req, res) => {
    const { status, comment } = req.body;
    const issue = store.issues.find(i => i._id === req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    issue.status = status;
    issue.statusTimeline.push({
        status, timestamp: new Date().toISOString(),
        updatedBy: req.user._id, comment: comment || `Status changed to ${status}`,
        dept: req.user.department || 'Admin'
    });

    if (status === 'Resolved') {
        issue.resolvedBy = req.user._id;
        const owner = store.getUserById(issue.user);
        if (owner) {
            owner.reportsResolved = (owner.reportsResolved || 0) + 1;
            owner.points += 25;
        }
    }

    // Notify issue owner
    if (issue.user !== 'anonymous') {
        store.notifications.push({
            _id: store.generateId('notif'), userId: issue.user, type: 'status',
            title: `Status Update: ${issue.title.substring(0, 30)}...`,
            desc: `Changed to ${status}${comment ? ': ' + comment : ''}`,
            read: false, createdAt: new Date().toISOString(),
        });
    }

    res.json(issue);
});

// PUT /api/workflows/:id/assign — Admin: Assign to dept/worker
router.put('/:id/assign', protect, admin, (req, res) => {
    const { departmentTag, assignedTo, deadline } = req.body;
    const issue = store.issues.find(i => i._id === req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    if (departmentTag) issue.departmentTag = departmentTag;
    if (assignedTo) issue.assignedTo = assignedTo;
    if (deadline) issue.deadline = deadline;

    // Auto-set status to Acknowledged if still Submitted
    if (issue.status === 'Submitted') {
        issue.status = 'Acknowledged';
        issue.statusTimeline.push({
            status: 'Acknowledged', timestamp: new Date().toISOString(),
            updatedBy: req.user._id, comment: `Assigned to ${departmentTag || 'department'}`,
            dept: departmentTag || 'Municipal Admin'
        });
    }

    // Notify field worker
    if (assignedTo) {
        store.notifications.push({
            _id: store.generateId('notif'), userId: assignedTo, type: 'status',
            title: 'New Task Assigned',
            desc: `"${issue.title}" — ${issue.location?.address || 'Unknown location'}`,
            read: false, createdAt: new Date().toISOString(),
        });
    }

    res.json(issue);
});

// PUT /api/workflows/:id/worker-update — Field worker: Update progress + proof
router.put('/:id/worker-update', protect, fieldWorker, (req, res) => {
    const { status, proofImage, comment } = req.body;
    const issue = store.issues.find(i => i._id === req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    if (status) {
        issue.status = status;
        issue.statusTimeline.push({
            status, timestamp: new Date().toISOString(),
            updatedBy: req.user._id, comment: comment || `Updated by field worker`,
            dept: req.user.department || 'Field Operations'
        });
    }

    if (status === 'Resolved') {
        issue.resolvedBy = req.user._id;
        issue.resolutionProof = {
            afterImage: proofImage || '/public/images/brokenfootpath.jpg',
            workerRemarks: comment || 'Work completed and verified by site visit.',
            resolvedAt: new Date().toISOString(),
            resolvedBy: req.user._id
        };

        // Update worker stats
        const worker = store.getUserById(req.user._id);
        if (worker) worker.reportsResolved = (worker.reportsResolved || 0) + 1;

        // Reward citizen
        const owner = store.getUserById(issue.user);
        if (owner && issue.user !== 'anonymous') {
            owner.points += 50; // Resolution bonus
            owner.reportsResolved = (owner.reportsResolved || 0) + 1;
        }
    }

    res.json(issue);
});

// GET /api/workflows/assigned — Field worker: Get assigned issues
router.get('/assigned/:workerId', protect, (req, res) => {
    const assigned = store.issues.filter(i => i.assignedTo === req.params.workerId);
    res.json(assigned);
});

module.exports = router;
