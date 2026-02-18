// In-memory data store with seed data
// No database required — everything lives in memory

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_123';

// ── USERS ──
const users = [
    {
        _id: 'user_001', name: 'Priya Sharma', email: 'priya@test.com', password: 'pass123',
        role: 'citizen', points: 3420, badges: ['first_report', 'civic_hero', 'night_watch'],
        reportsCount: 58, reportsResolved: 42, impactScore: 88, region: 'Central Ward',
        avatar: null, createdAt: '2025-06-01T10:00:00Z',
    },
    {
        _id: 'user_002', name: 'Raj Kumar', email: 'raj@test.com', password: 'pass123',
        role: 'citizen', points: 2900, badges: ['first_report', 'civic_hero'],
        reportsCount: 45, reportsResolved: 33, impactScore: 76, region: 'North Ward',
        avatar: null, createdAt: '2025-07-15T10:00:00Z',
    },
    {
        _id: 'user_003', name: 'Anita Singh', email: 'anita@test.com', password: 'pass123',
        role: 'citizen', points: 2650, badges: ['first_report'],
        reportsCount: 41, reportsResolved: 28, impactScore: 70, region: 'South Ward',
        avatar: null, createdAt: '2025-08-01T10:00:00Z',
    },
    {
        _id: 'admin_001', name: 'Municipal Admin', email: 'admin@urbanfix.com', password: 'admin123',
        role: 'admin', points: 0, badges: [],
        reportsCount: 0, reportsResolved: 120, impactScore: 0, region: 'All',
        avatar: null, createdAt: '2025-01-01T10:00:00Z',
    },
    {
        _id: 'worker_001', name: 'Suresh Patel', email: 'suresh@urbanfix.com', password: 'worker123',
        role: 'field_worker', points: 0, badges: [],
        reportsCount: 0, reportsResolved: 85, impactScore: 0, region: 'Central Ward',
        avatar: null, department: 'Roads', createdAt: '2025-03-01T10:00:00Z',
    },
    {
        _id: 'worker_002', name: 'Meena Devi', email: 'meena@urbanfix.com', password: 'worker123',
        role: 'field_worker', points: 0, badges: [],
        reportsCount: 0, reportsResolved: 62, impactScore: 0, region: 'South Ward',
        avatar: null, department: 'Sanitation', createdAt: '2025-04-01T10:00:00Z',
    },
];

// ── LEVELS ──
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

// ── ISSUES ──
const issues = [
    {
        _id: 'issue_001', user: 'user_001', title: 'Large Pothole on Main Street — Risk of Accident',
        description: 'A massive pothole has developed on Main Street near the bus stop. Multiple vehicles have been damaged. This is causing major traffic issues and is a serious safety hazard.',
        image: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600',
        video: null,
        location: { type: 'Point', coordinates: [77.209, 28.6139], address: '101 Main St, Downtown' },
        departmentTag: 'Roads', status: 'Acknowledged', category: 'roads',
        priorityScore: 56, aiSeverity: 'High', aiTags: ['pothole', 'road-damage', 'safety-hazard'],
        upvotes: ['user_002', 'user_003', 'user_001'], downvotes: [], followers: ['user_001'], commentCount: 12,
        statusTimeline: [
            { status: 'Submitted', timestamp: '2025-12-15T08:00:00Z', comment: 'Issue reported by citizen' },
            { status: 'Acknowledged', timestamp: '2025-12-15T10:30:00Z', updatedBy: 'admin_001', comment: 'Acknowledged by Municipal Admin. Road safety team notified.', dept: 'Roads Dept' },
        ],
        assignedTo: null, resolvedBy: null, resolutionProof: null,
        anonymous: false, emergency: false, createdAt: '2025-12-15T08:00:00Z',
    },
    {
        _id: 'issue_002', user: 'user_002', title: 'Street Light Out Near Park — Unsafe at Night',
        description: 'The street light at the corner of Park Avenue and 5th Street has been out for 2 weeks. The area becomes very dark and unsafe after 7pm. Several residents have complained.',
        image: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=600',
        location: { type: 'Point', coordinates: [77.219, 28.6229], address: '45 Park Avenue' },
        departmentTag: 'Electricity', status: 'Submitted', category: 'lighting',
        priorityScore: 32, aiSeverity: 'Medium', aiTags: ['street-light', 'safety', 'electrical'],
        upvotes: ['user_001', 'user_003'], downvotes: [], followers: [], commentCount: 4,
        statusTimeline: [
            { status: 'Submitted', timestamp: '2025-12-16T14:00:00Z', comment: 'Issue reported by citizen' },
        ],
        assignedTo: null, resolvedBy: null, resolutionProof: null,
        anonymous: false, emergency: false, createdAt: '2025-12-16T14:00:00Z',
    },
    {
        _id: 'issue_003', user: 'user_003', title: 'Garbage Pileup Near School — Health Hazard',
        description: 'Garbage has been accumulating for over a week near Central Public School. The stench is unbearable and it poses a health risk to school children. rats and stray dogs are seen regularly.',
        image: 'https://images.unsplash.com/photo-1530587198077-5e1fd509533b?w=600',
        location: { type: 'Point', coordinates: [77.225, 28.6100], address: 'Central Public School' },
        departmentTag: 'Sanitation', status: 'InProgress', category: 'trash',
        priorityScore: 96, aiSeverity: 'Critical', aiTags: ['garbage', 'health-hazard', 'school-zone'],
        upvotes: ['user_001', 'user_002', 'user_003'], downvotes: [], followers: ['user_001', 'user_003'], commentCount: 28,
        assignedTo: 'worker_002', resolvedBy: null, resolutionProof: null,
        statusTimeline: [
            { status: 'Submitted', timestamp: '2025-12-10T09:00:00Z', comment: 'Issue reported by citizen' },
            { status: 'Acknowledged', timestamp: '2025-12-10T11:00:00Z', updatedBy: 'admin_001', comment: 'Critical health hazard acknowledged. Emergency sanitation crew assigned.', dept: 'Sanitation Dept' },
            { status: 'InProgress', timestamp: '2025-12-12T08:00:00Z', updatedBy: 'worker_002', comment: 'Sanitation team arrived on site. Clearing operations started.', dept: 'Sanitation Dept' },
        ],
        anonymous: false, emergency: true, createdAt: '2025-12-10T09:00:00Z',
    },
    {
        _id: 'issue_004', user: 'user_001', title: 'Broken Footpath — Senior Citizens Struggling',
        description: 'The footpath along River Walk has several broken tiles causing difficulty for senior citizens and wheelchair users.',
        image: 'https://images.unsplash.com/photo-1567789884554-0b844b597180?w=600',
        location: { type: 'Point', coordinates: [77.200, 28.6180], address: '32 River Walk' },
        departmentTag: 'Public Works', status: 'Resolved', category: 'roads',
        priorityScore: 20, aiSeverity: 'Low', aiTags: ['footpath', 'accessibility'],
        upvotes: ['user_002'], downvotes: [], followers: [], commentCount: 2,
        assignedTo: 'worker_001', resolvedBy: 'worker_001',
        resolutionProof: {
            afterImage: 'https://images.unsplash.com/photo-1567789884554-0b844b597180?w=600',
            workerRemarks: 'Broken tiles replaced. Footpath leveled and verified for elderly access.',
            resolvedAt: '2025-12-01T16:00:00Z',
            resolvedBy: 'worker_001'
        },
        statusTimeline: [
            { status: 'Submitted', timestamp: '2025-11-20T10:00:00Z', comment: 'Broken footpath reported.' },
            { status: 'Acknowledged', timestamp: '2025-11-21T09:00:00Z', updatedBy: 'admin_001', comment: 'Audit team verified damage.', dept: 'Public Works' },
            { status: 'InProgress', timestamp: '2025-11-25T08:00:00Z', updatedBy: 'worker_001', comment: 'Materials arrived. Repair work started.', dept: 'Public Works' },
            { status: 'Resolved', timestamp: '2025-12-01T16:00:00Z', updatedBy: 'worker_001', comment: 'All tiles replaced. Area cleared.', dept: 'Public Works' },
        ],
        anonymous: false, emergency: false, createdAt: '2025-11-20T10:00:00Z',
    },
    {
        _id: 'issue_005', user: 'user_002', title: 'Water Pipe Burst on MG Road',
        description: 'A major water pipe has burst on MG Road causing water logging and traffic disruption. Water is being wasted at an alarming rate.',
        image: 'https://images.unsplash.com/photo-1504297050568-910d24c426d3?w=600',
        location: { type: 'Point', coordinates: [77.215, 28.620], address: 'MG Road, Sector 5' },
        departmentTag: 'Water', status: 'Submitted', category: 'water',
        priorityScore: 78, aiSeverity: 'Critical', aiTags: ['water-pipe', 'waterlogging', 'infrastructure'],
        upvotes: ['user_001', 'user_003'], downvotes: [], followers: ['user_002'], commentCount: 6,
        statusTimeline: [
            { status: 'Submitted', timestamp: '2025-12-17T07:00:00Z', comment: 'EMERGENCY issue reported by citizen' },
        ],
        assignedTo: null, resolvedBy: null, resolutionProof: null,
        anonymous: false, emergency: true, createdAt: '2025-12-17T07:00:00Z',
    },
];

// ── COMMENTS ──
const comments = [
    { _id: 'cmt_001', issueId: 'issue_001', user: 'user_002', text: 'This has been like this for 3 months!', likes: 5, createdAt: '2025-12-15T09:00:00Z' },
    { _id: 'cmt_002', issueId: 'issue_001', user: 'user_003', text: 'I almost had an accident here last week.', likes: 12, createdAt: '2025-12-15T09:30:00Z' },
    { _id: 'cmt_003', issueId: 'issue_001', user: 'admin_001', text: 'Acknowledged. Team dispatched for inspection.', likes: 24, createdAt: '2025-12-15T10:30:00Z' },
    { _id: 'cmt_004', issueId: 'issue_003', user: 'user_001', text: 'The smell is terrible. Kids are getting sick.', likes: 18, createdAt: '2025-12-10T12:00:00Z' },
    { _id: 'cmt_005', issueId: 'issue_003', user: 'admin_001', text: 'Sanitation team dispatched. ETA 2 hours.', likes: 30, createdAt: '2025-12-12T08:30:00Z' },
];

// ── NOTIFICATIONS ──
const notifications = [
    { _id: 'notif_001', userId: 'user_001', type: 'resolved', title: 'Your footpath report was resolved!', desc: 'River Walk footpath fixed by Public Works.', read: false, createdAt: '2025-12-17T16:00:00Z' },
    { _id: 'notif_002', userId: 'user_001', type: 'upvote', title: '3 people upvoted your report', desc: 'Large Pothole on Main Street is gaining traction.', read: false, createdAt: '2025-12-17T14:00:00Z' },
    { _id: 'notif_003', userId: 'user_001', type: 'comment', title: 'Municipal Admin replied', desc: '"Acknowledged. Team dispatched..."', read: false, createdAt: '2025-12-15T10:30:00Z' },
    { _id: 'notif_004', userId: 'user_001', type: 'badge', title: 'New Badge Earned! 🏅', desc: '"Civic Hero" for 10 reports submitted.', read: true, createdAt: '2025-12-14T12:00:00Z' },
    { _id: 'notif_005', userId: 'user_001', type: 'points', title: '+25 Civic Points', desc: 'Bonus for verified report resolution.', read: true, createdAt: '2025-12-13T08:00:00Z' },
    { _id: 'notif_006', userId: 'admin_001', type: 'status', title: 'Critical Issue Posted', desc: 'Garbage Pileup Near School — 28 comments', read: false, createdAt: '2025-12-10T09:00:00Z' },
    { _id: 'notif_007', userId: 'admin_001', type: 'upvote', title: 'High Vote Spike!', desc: 'Water Pipe Burst gaining 50+ upvotes/hr', read: false, createdAt: '2025-12-17T08:00:00Z' },
];

// ── BADGES ──
const badges = [
    { id: 'first_report', name: 'First Report', icon: '🏅', description: 'Submit your first civic report', pointsRequired: 0 },
    { id: 'civic_hero', name: 'Civic Hero', icon: '🦸', description: 'Submit 10 verified reports', pointsRequired: 500 },
    { id: 'night_watch', name: 'Night Watch', icon: '🌙', description: 'Report 5 issues after 8pm', pointsRequired: 300 },
    { id: 'top_10', name: 'Top 10', icon: '🏆', description: 'Reach top 10 in your ward', pointsRequired: 2000 },
    { id: 'fifty_reports', name: '50 Reports', icon: '📸', description: 'Submit 50 reports', pointsRequired: 1500 },
    { id: 'leader', name: 'Leader', icon: '⭐', description: 'Highest points in a month', pointsRequired: 3000 },
    { id: 'road_guardian', name: 'Road Guardian', icon: '🛣️', description: 'Report 20 road issues', pointsRequired: 800 },
    { id: 'drain_defender', name: 'Drain Defender', icon: '💧', description: 'Report 10 water/drain issues', pointsRequired: 600 },
];

// ── HELPER: Generate Token ──
function generateToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });
}

// ── HELPER: Find user by ID ──
function getUserById(id) {
    return users.find(u => u._id === id);
}

// ── HELPER: Generate unique ID ──
let idCounter = 100;
function generateId(prefix) {
    idCounter++;
    return `${prefix}_${Date.now()}_${idCounter}`;
}

module.exports = {
    users, issues, comments, notifications, badges,
    generateToken, getUserById, generateId, getLevelInfo, JWT_SECRET,
};
