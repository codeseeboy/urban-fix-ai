// ============================================================================
// UrbanFix AI — Supabase Data Layer (replaces in-memory store)
// All functions are async and query Supabase PostgreSQL
// ============================================================================

const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_123';

// ── RETRY WRAPPER ───────────────────────────────────────────────────────────
async function withRetry(fn, retries = 2, delay = 500) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt === retries) throw err;
            console.warn(`⚠️ Retry ${attempt + 1}/${retries}:`, err.message);
            await new Promise(r => setTimeout(r, delay * (attempt + 1)));
        }
    }
}

// ── ERROR HANDLER ───────────────────────────────────────────────────────────
function handleError(result, context) {
    if (result.error) {
        console.error(`❌ DB Error [${context}]:`, result.error.message);
        throw new Error(`Database error: ${result.error.message}`);
    }
    return result.data;
}

// ── TOKEN ───────────────────────────────────────────────────────────────────
function generateToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });
}

// ── LEVELS ──────────────────────────────────────────────────────────────────
const LEVELS = [
    { level: 1, name: 'New Reporter', xpRequired: 0 },
    { level: 2, name: 'Active Citizen', xpRequired: 500 },
    { level: 3, name: 'Civic Watcher', xpRequired: 1200 },
    { level: 4, name: 'Problem Solver', xpRequired: 2500 },
    { level: 5, name: 'Community Guardian', xpRequired: 5000 },
    { level: 6, name: 'Street Legend', xpRequired: 10000 },
    { level: 7, name: 'City Steward', xpRequired: 20000 },
    { level: 8, name: 'Urban Architect', xpRequired: 35000 },
    { level: 9, name: 'Governor Elect', xpRequired: 50000 },
    { level: 10, name: 'Civic Hero', xpRequired: 75000 },
];

function getLevelInfo(points) {
    const sortedLevels = [...LEVELS].sort((a, b) => b.level - a.level);
    const current = sortedLevels.find(l => points >= l.xpRequired) || LEVELS[0];
    const nextIdx = LEVELS.findIndex(l => l.level === current.level) + 1;
    const next = LEVELS[nextIdx] || null;
    return {
        level: current.level,
        name: current.name,
        currentXp: points,
        nextLevelXp: next ? next.xpRequired : current.xpRequired,
        progress: next ? (points - current.xpRequired) / (next.xpRequired - current.xpRequired) : 1
    };
}

// ════════════════════════════════════════════════════════════════════════════
// USER QUERIES
// ════════════════════════════════════════════════════════════════════════════

async function getUserById(id) {
    return withRetry(async () => {
        const result = await supabase.from('users').select('*').eq('id', id).single();
        return result.data; // returns null if not found
    });
}

async function getUserByEmail(email) {
    return withRetry(async () => {
        const result = await supabase.from('users').select('*').eq('email', email).single();
        return result.data;
    });
}

async function getUserByUsername(username) {
    return withRetry(async () => {
        const result = await supabase.from('users').select('*').eq('username', username.toLowerCase()).single();
        return result.data;
    });
}

async function isUsernameAvailable(username) {
    const user = await getUserByUsername(username);
    return !user;
}

async function createUser(userData) {
    return withRetry(async () => {
        const result = await supabase.from('users').insert(userData).select('*').single();
        return handleError(result, 'createUser');
    });
}

async function updateUser(id, updates) {
    return withRetry(async () => {
        const result = await supabase.from('users').update(updates).eq('id', id).select('*').single();
        return handleError(result, 'updateUser');
    });
}

async function getCitizensLeaderboard() {
    return withRetry(async () => {
        const result = await supabase
            .from('users')
            .select('id, name, points, reports_count, avatar')
            .eq('role', 'citizen')
            .order('points', { ascending: false });
        return handleError(result, 'getCitizensLeaderboard');
    });
}

// ════════════════════════════════════════════════════════════════════════════
// ISSUE QUERIES
// ════════════════════════════════════════════════════════════════════════════

async function getIssues(filter, userId, municipalPageId = null, authorType = null) {
    return withRetry(async () => {
        let query = supabase.from('issues').select('*');

        if (municipalPageId) {
            query = query.eq('municipal_page_id', municipalPageId);
        }

        if (authorType === 'MunicipalPage' || authorType === 'User') {
            query = query.eq('author_type', authorType);
        }

        if (filter === 'high_priority') {
            query = query.in('ai_severity', ['Critical', 'High']);
        } else if (filter === 'resolved') {
            query = query.eq('status', 'Resolved');
        } else if (filter === 'my_posts' && userId) {
            query = query.eq('user_id', userId);
        }

        query = query
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });
        const result = await query;
        let issues = handleError(result, 'getIssues');

        if (filter === 'following' && userId) {
            // Get pages user follows
            const { data: followedPages } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', userId);
            const followedPageIds = (followedPages || []).map(f => f.following_id);

            // Get issues user follows
            const { data: followedIssues } = await supabase
                .from('issue_followers')
                .select('issue_id')
                .eq('user_id', userId);
            const followedIssueIds = (followedIssues || []).map(f => f.issue_id);

            issues = issues.filter(i =>
                (i.author_type === 'MunicipalPage' && followedPageIds.includes(i.municipal_page_id)) ||
                followedIssueIds.includes(i.id)
            );
        }

        if (filter === 'trending') {
            // Sort by upvote count — need counts from junction
            const issueIds = issues.map(i => i.id);
            const { data: upvoteCounts } = await supabase
                .from('issue_upvotes')
                .select('issue_id')
                .in('issue_id', issueIds);

            const countMap = {};
            (upvoteCounts || []).forEach(u => {
                countMap[u.issue_id] = (countMap[u.issue_id] || 0) + 1;
            });
            issues.sort((a, b) => (countMap[b.id] || 0) - (countMap[a.id] || 0));
        }

        return issues;
    });
}

async function getIssueById(id) {
    return withRetry(async () => {
        const result = await supabase.from('issues').select('*').eq('id', id).single();
        return result.data;
    });
}

async function createIssue(issueData) {
    return withRetry(async () => {
        // Build location_coords for PostGIS
        if (issueData.location_longitude != null && issueData.location_latitude != null) {
            issueData.location_coords = `POINT(${issueData.location_longitude} ${issueData.location_latitude})`;
        }
        const result = await supabase.from('issues').insert(issueData).select('*').single();
        return handleError(result, 'createIssue');
    });
}

async function updateIssue(id, updates) {
    return withRetry(async () => {
        const result = await supabase.from('issues').update(updates).eq('id', id).select('*').single();
        return handleError(result, 'updateIssue');
    });
}

// ── Upvotes / Downvotes / Followers (junction tables) ───────────────────────

async function getIssueUpvotes(issueId) {
    const result = await supabase.from('issue_upvotes').select('user_id').eq('issue_id', issueId);
    return (result.data || []).map(u => u.user_id);
}

async function toggleUpvote(issueId, userId) {
    // Check if already upvoted
    const { data: existing } = await supabase
        .from('issue_upvotes')
        .select('user_id')
        .eq('issue_id', issueId)
        .eq('user_id', userId)
        .single();

    if (existing) {
        await supabase.from('issue_upvotes').delete().eq('issue_id', issueId).eq('user_id', userId);
        return { added: false };
    } else {
        // Remove downvote if exists
        await supabase.from('issue_downvotes').delete().eq('issue_id', issueId).eq('user_id', userId);
        await supabase.from('issue_upvotes').insert({ issue_id: issueId, user_id: userId });
        return { added: true };
    }
}

async function getIssueDownvotes(issueId) {
    const result = await supabase.from('issue_downvotes').select('user_id').eq('issue_id', issueId);
    return (result.data || []).map(u => u.user_id);
}

async function toggleDownvote(issueId, userId) {
    const { data: existing } = await supabase
        .from('issue_downvotes')
        .select('user_id')
        .eq('issue_id', issueId)
        .eq('user_id', userId)
        .single();

    if (existing) {
        await supabase.from('issue_downvotes').delete().eq('issue_id', issueId).eq('user_id', userId);
        return { added: false };
    } else {
        await supabase.from('issue_upvotes').delete().eq('issue_id', issueId).eq('user_id', userId);
        await supabase.from('issue_downvotes').insert({ issue_id: issueId, user_id: userId });
        return { added: true };
    }
}

async function getIssueFollowers(issueId) {
    const result = await supabase.from('issue_followers').select('user_id').eq('issue_id', issueId);
    return (result.data || []).map(u => u.user_id);
}

async function toggleIssueFollow(issueId, userId) {
    const { data: existing } = await supabase
        .from('issue_followers')
        .select('user_id')
        .eq('issue_id', issueId)
        .eq('user_id', userId)
        .single();

    if (existing) {
        await supabase.from('issue_followers').delete().eq('issue_id', issueId).eq('user_id', userId);
        return { following: false };
    } else {
        await supabase.from('issue_followers').insert({ issue_id: issueId, user_id: userId });
        return { following: true };
    }
}

// ── Status Timeline ─────────────────────────────────────────────────────────

async function addStatusTimeline(entry) {
    return withRetry(async () => {
        const result = await supabase.from('status_timeline').insert(entry).select('*').single();
        return handleError(result, 'addStatusTimeline');
    });
}

async function getStatusTimeline(issueId) {
    const result = await supabase
        .from('status_timeline')
        .select('*')
        .eq('issue_id', issueId)
        .order('created_at', { ascending: true });
    return result.data || [];
}

// ── Resolution Proof ────────────────────────────────────────────────────────

async function setResolutionProof(proofData) {
    return withRetry(async () => {
        const result = await supabase.from('resolution_proofs').upsert(proofData, { onConflict: 'issue_id' }).select('*').single();
        return handleError(result, 'setResolutionProof');
    });
}

async function getResolutionProof(issueId) {
    const result = await supabase.from('resolution_proofs').select('*').eq('issue_id', issueId).single();
    return result.data;
}

// ════════════════════════════════════════════════════════════════════════════
// COMMENT QUERIES
// ════════════════════════════════════════════════════════════════════════════

async function getCommentsByIssue(issueId) {
    return withRetry(async () => {
        const result = await supabase
            .from('comments')
            .select('*')
            .eq('issue_id', issueId)
            .order('created_at', { ascending: true });
        return handleError(result, 'getCommentsByIssue');
    });
}

async function getCommentCountByIssue(issueId) {
    const result = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('issue_id', issueId);
    return result.count || 0;
}

async function createComment(commentData) {
    return withRetry(async () => {
        const result = await supabase.from('comments').insert(commentData).select('*').single();
        return handleError(result, 'createComment');
    });
}

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATION QUERIES
// ════════════════════════════════════════════════════════════════════════════

async function getNotifications(userId) {
    return withRetry(async () => {
        const result = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return handleError(result, 'getNotifications');
    });
}

async function createNotification(notifData) {
    return withRetry(async () => {
        const result = await supabase.from('notifications').insert(notifData).select('*').single();
        return handleError(result, 'createNotification');
    });
}

async function markNotificationsRead(userId) {
    return withRetry(async () => {
        const result = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);
        if (result.error) throw new Error(result.error.message);
    });
}

async function markNotificationRead(notifId, userId) {
    return withRetry(async () => {
        const result = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notifId)
            .eq('user_id', userId)
            .select('*')
            .single();
        return result.data;
    });
}

async function deleteNotification(notifId, userId) {
    return withRetry(async () => {
        const result = await supabase
            .from('notifications')
            .delete()
            .eq('id', notifId)
            .eq('user_id', userId);
        if (result.error) throw new Error(result.error.message);
        return true;
    });
}

async function deleteAllNotifications(userId) {
    return withRetry(async () => {
        const result = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', userId);
        if (result.error) throw new Error(result.error.message);
        return true;
    });
}

// ── PUSH TOKENS ─────────────────────────────────────────────────────────────

async function addPushToken(userId, token, deviceType) {
    return withRetry(async () => {
        // Upsert logic: if token exists, update user_id and timestamp
        const result = await supabase
            .from('push_tokens')
            .upsert(
                { user_id: userId, token, device_type: deviceType, updated_at: new Date() },
                { onConflict: 'token' }
            )
            .select('*')
            .single();
        return handleError(result, 'addPushToken');
    });
}

async function getPushTokens(userId) {
    return withRetry(async () => {
        const result = await supabase
            .from('push_tokens')
            .select('token, device_type')
            .eq('user_id', userId);
        return handleError(result, 'getPushTokens');
    });
}

async function deletePushToken(token) {
    return withRetry(async () => {
        const result = await supabase
            .from('push_tokens')
            .delete()
            .eq('token', token);
        return result.error ? false : true;
    });
}

// ════════════════════════════════════════════════════════════════════════════
// BADGE QUERIES
// ════════════════════════════════════════════════════════════════════════════

async function getAllBadges() {
    const result = await supabase.from('badges').select('*');
    return result.data || [];
}

// ════════════════════════════════════════════════════════════════════════════
// MUNICIPAL PAGE QUERIES
// ════════════════════════════════════════════════════════════════════════════

async function getMunicipalPageById(id) {
    const result = await supabase.from('municipal_pages').select('*').eq('id', id).single();
    return result.data;
}

async function getMunicipalPageByHandle(handle) {
    const result = await supabase.from('municipal_pages').select('*').eq('handle', handle).single();
    return result.data;
}

async function createMunicipalPage(pageData) {
    return withRetry(async () => {
        const result = await supabase.from('municipal_pages').insert(pageData).select('*').single();
        return handleError(result, 'createMunicipalPage');
    });
}

async function updateMunicipalPage(id, updates) {
    return withRetry(async () => {
        const result = await supabase.from('municipal_pages').update(updates).eq('id', id).select('*').single();
        return handleError(result, 'updateMunicipalPage');
    });
}

async function searchMunicipalPages(query) {
    let q = supabase.from('municipal_pages').select('*').eq('is_active', true);
    if (query) {
        q = q.or(`name.ilike.%${query}%,handle.ilike.%${query}%,department.ilike.%${query}%`);
    }
    const result = await q;
    return result.data || [];
}

async function getSuggestedPages(limit = 10) {
    const result = await supabase
        .from('municipal_pages')
        .select('*')
        .eq('is_active', true)
        .limit(limit);
    return result.data || [];
}

// ════════════════════════════════════════════════════════════════════════════
// FOLLOWS (User → MunicipalPage)
// ════════════════════════════════════════════════════════════════════════════

async function isFollowing(followerId, followingId) {
    const result = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .single();
    return !!result.data;
}

async function addFollow(followerId, followingId) {
    return withRetry(async () => {
        const result = await supabase.from('follows').insert({
            follower_id: followerId,
            following_id: followingId,
        }).select('*').single();
        return handleError(result, 'addFollow');
    });
}

async function removeFollow(followerId, followingId) {
    const result = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);
    return result.error ? false : true;
}

async function getFollowerIds(pageId) {
    const result = await supabase.from('follows').select('follower_id').eq('following_id', pageId);
    return (result.data || []).map(f => f.follower_id);
}

async function getFollowingCount(userId) {
    const result = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId);
    return result.count || 0;
}

async function getFollowingPageIds(userId) {
    const result = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
    return (result.data || []).map((row) => row.following_id);
}

async function getSeenMunicipalPostIds(userId, issueIds = []) {
    if (!issueIds.length) return [];
    const result = await supabase
        .from('municipal_post_seen')
        .select('issue_id')
        .eq('user_id', userId)
        .in('issue_id', issueIds);
    return (result.data || []).map((row) => row.issue_id);
}

async function markMunicipalPostSeen(userId, issueId) {
    return withRetry(async () => {
        const result = await supabase
            .from('municipal_post_seen')
            .upsert(
                {
                    user_id: userId,
                    issue_id: issueId,
                    seen_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,issue_id' }
            )
            .select('*')
            .single();
        return handleError(result, 'markMunicipalPostSeen');
    });
}

// ════════════════════════════════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════════════════════════════════

async function getIssueStats() {
    return withRetry(async () => {
        const result = await supabase.from('issues').select('status, ai_severity');
        const issues = handleError(result, 'getIssueStats');
        const total = issues.length;
        const resolved = issues.filter(i => i.status === 'Resolved').length;
        const critical = issues.filter(i => i.ai_severity === 'Critical').length;
        const inProgress = issues.filter(i => i.status === 'InProgress').length;
        return { totalIssues: total, resolved, critical, inProgress, pending: total - resolved };
    });
}

async function getUserIssueCount(userId) {
    const result = await supabase
        .from('issues')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
    return result.count || 0;
}

async function getUserResolvedCount(userId) {
    const result = await supabase
        .from('issues')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'Resolved');
    return result.count || 0;
}

// ════════════════════════════════════════════════════════════════════════════
// GEOJSON
// ════════════════════════════════════════════════════════════════════════════

async function getIssuesGeoJSON() {
    return withRetry(async () => {
        const result = await supabase
            .from('issues')
            .select('id, title, ai_severity, status, category, emergency, image, location_address, location_longitude, location_latitude');
        const issues = handleError(result, 'getIssuesGeoJSON');

        // Get upvote counts
        const issueIds = issues.map(i => i.id);
        const { data: allUpvotes } = await supabase
            .from('issue_upvotes')
            .select('issue_id')
            .in('issue_id', issueIds);
        const countMap = {};
        (allUpvotes || []).forEach(u => {
            countMap[u.issue_id] = (countMap[u.issue_id] || 0) + 1;
        });

        const features = issues
            .filter(i => i.location_longitude != null && i.location_latitude != null)
            .map(i => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [i.location_longitude, i.location_latitude],
                },
                properties: {
                    id: i.id, title: i.title, severity: i.ai_severity,
                    status: i.status, category: i.category,
                    upvotes: countMap[i.id] || 0, emergency: i.emergency || false,
                    address: i.location_address, image: i.image,
                },
            }));

        return { type: 'FeatureCollection', features };
    });
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Token
    generateToken, JWT_SECRET, getLevelInfo,

    // Users
    getUserById, getUserByEmail, getUserByUsername, isUsernameAvailable,
    createUser, updateUser, getCitizensLeaderboard,

    // Issues
    getIssues, getIssueById, createIssue, updateIssue,
    getIssueUpvotes, toggleUpvote,
    getIssueDownvotes, toggleDownvote,
    getIssueFollowers, toggleIssueFollow,
    addStatusTimeline, getStatusTimeline,
    setResolutionProof, getResolutionProof,
    getIssuesGeoJSON,

    // Comments
    getCommentsByIssue, getCommentCountByIssue, createComment,

    // Notifications
    getNotifications, createNotification, markNotificationsRead, markNotificationRead,
    deleteNotification, deleteAllNotifications,
    addPushToken, getPushTokens, deletePushToken,

    // Badges
    getAllBadges,

    // Municipal Pages
    getMunicipalPageById, getMunicipalPageByHandle,
    createMunicipalPage, updateMunicipalPage,
    searchMunicipalPages, getSuggestedPages,

    // Follows
    isFollowing, addFollow, removeFollow, getFollowerIds, getFollowingCount,
    getFollowingPageIds, getSeenMunicipalPostIds, markMunicipalPostSeen,

    // Stats
    getIssueStats, getUserIssueCount, getUserResolvedCount,

    // Supabase client (for direct access if needed)
    supabase,
};
