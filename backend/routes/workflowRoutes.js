const express = require('express');
const router = express.Router();
const { protect, admin, fieldWorker } = require('../middleware/authMiddleware');
const store = require('../data/store');
const NotificationService = require('../services/notificationService');

// PUT /api/workflows/:id/status — Admin: Change issue status
router.put('/:id/status', protect, admin, async (req, res) => {
    try {
        const { status, comment } = req.body;
        const issue = await store.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ message: 'Issue not found' });

        // Update issue status
        const updates = { status };
        if (status === 'Resolved') {
            updates.resolved_by = req.user._id;
        }
        const updatedIssue = await store.updateIssue(issue.id, updates);

        // Add timeline entry
        await store.addStatusTimeline({
            issue_id: issue.id,
            status,
            comment: comment || `Status changed to ${status}`,
            updated_by: req.user._id,
            dept: req.user.department || 'Admin',
        });

        // If resolved, reward citizen
        if (status === 'Resolved' && issue.user_id) {
            const owner = await store.getUserById(issue.user_id);
            if (owner) {
                await store.updateUser(owner.id, {
                    reports_resolved: (owner.reports_resolved || 0) + 1,
                    points: owner.points + 25,
                });
            }
        }

        // Notify issue owner
        if (issue.user_id) {
            await NotificationService.sendToUser(
                issue.user_id,
                `Status Update: ${issue.title.substring(0, 30)}...`,
                `Changed to ${status}${comment ? ': ' + comment : ''}`,
                { type: 'status', issueId: issue.id, navigationTarget: 'IssueDetails' }
            );
        }

        // Return enriched response
        const timeline = await store.getStatusTimeline(issue.id);
        res.json({
            ...updatedIssue,
            _id: updatedIssue.id,
            statusTimeline: timeline.map(t => ({
                status: t.status, timestamp: t.created_at,
                updatedBy: t.updated_by, comment: t.comment, dept: t.dept,
            })),
        });
    } catch (error) {
        console.error('Workflow status error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/workflows/:id/assign — Admin: Assign to dept/worker
router.put('/:id/assign', protect, admin, async (req, res) => {
    try {
        const { departmentTag, assignedTo, deadline } = req.body;
        const issue = await store.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ message: 'Issue not found' });

        const updates = {};
        if (departmentTag) updates.department_tag = departmentTag;
        if (assignedTo) updates.assigned_to = assignedTo;
        if (deadline) updates.deadline = deadline;

        // Auto-set status to Acknowledged if still Submitted
        if (issue.status === 'Submitted') {
            updates.status = 'Acknowledged';
            await store.addStatusTimeline({
                issue_id: issue.id,
                status: 'Acknowledged',
                comment: `Assigned to ${departmentTag || 'department'}`,
                updated_by: req.user._id,
                dept: departmentTag || 'Municipal Admin',
            });
        }

        const updatedIssue = await store.updateIssue(issue.id, updates);

        // Notify field worker
        if (assignedTo) {
            // Check if assignedTo is a valid user before sending
            await NotificationService.sendToUser(
                assignedTo,
                'New Task Assigned',
                `"${issue.title}" — ${issue.location_address || 'Unknown location'}`,
                { type: 'assignment', issueId: issue.id, navigationTarget: 'IssueDetails' }
            );
        }

        res.json({ ...updatedIssue, _id: updatedIssue.id });
    } catch (error) {
        console.error('Workflow assign error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/workflows/:id/worker-update — Field worker: Update progress + proof
router.put('/:id/worker-update', protect, fieldWorker, async (req, res) => {
    try {
        const { status, proofImage, comment } = req.body;
        const issue = await store.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ message: 'Issue not found' });

        const updates = {};
        if (status) {
            updates.status = status;
            await store.addStatusTimeline({
                issue_id: issue.id,
                status,
                comment: comment || 'Updated by field worker',
                updated_by: req.user._id,
                dept: req.user.department || 'Field Operations',
            });
        }

        if (status === 'Resolved') {
            updates.resolved_by = req.user._id;

            // Store resolution proof
            await store.setResolutionProof({
                issue_id: issue.id,
                after_image: proofImage || '/public/images/brokenfootpath.jpg',
                worker_remarks: comment || 'Work completed and verified by site visit.',
                resolved_at: new Date().toISOString(),
                resolved_by: req.user._id,
            });

            // Update worker stats
            const worker = await store.getUserById(req.user._id);
            if (worker) {
                await store.updateUser(worker.id, {
                    reports_resolved: (worker.reports_resolved || 0) + 1,
                });
            }

            // Reward citizen
            if (issue.user_id) {
                const owner = await store.getUserById(issue.user_id);
                if (owner) {
                    await store.updateUser(owner.id, {
                        points: owner.points + 50,
                        reports_resolved: (owner.reports_resolved || 0) + 1,
                    });
                }
            }
        }

        const updatedIssue = await store.updateIssue(issue.id, updates);
        res.json({ ...updatedIssue, _id: updatedIssue.id });
    } catch (error) {
        console.error('Worker update error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/workflows/assigned/:workerId — Field worker: Get assigned issues
router.get('/assigned/:workerId', protect, async (req, res) => {
    try {
        const { data, error } = await store.supabase
            .from('issues')
            .select('*')
            .eq('assigned_to', req.params.workerId);
        if (error) throw new Error(error.message);
        res.json((data || []).map(i => ({ ...i, _id: i.id })));
    } catch (error) {
        console.error('Get assigned error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
