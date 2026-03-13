const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const supabase = require('../config/supabase');
const store = require('../data/store');

// ─── Intent Detection (rule-based, swap with NLP model later) ───────────────

function detectIntent(message) {
    const msg = message.toLowerCase().trim();

    if (/my area|my location|nearby|around me|near me|close to me|my neighborhood/i.test(msg)) {
        return 'NEARBY_ISSUES';
    }
    if (/status|update|progress|what.?s happening|track/i.test(msg)) {
        if (/my|i reported|i filed/i.test(msg)) return 'MY_ISSUE_STATUS';
        return 'ISSUE_STATUS';
    }
    if (/weekly|report|summary|this week|last week|overview|digest/i.test(msg)) {
        return 'WEEKLY_REPORT';
    }
    if (/how many|count|total|statistics|stats/i.test(msg)) {
        return 'STATS';
    }
    if (/critical|urgent|emergency|danger/i.test(msg)) {
        return 'CRITICAL_ISSUES';
    }
    if (/resolved|fixed|done|completed/i.test(msg)) {
        return 'RESOLVED_ISSUES';
    }
    if (/leaderboard|top|rank|points|leader/i.test(msg)) {
        return 'LEADERBOARD';
    }
    if (/help|what can you|how to|guide|tutorial/i.test(msg)) {
        return 'HELP';
    }
    if (/hello|hi|hey|good morning|good evening/i.test(msg)) {
        return 'GREETING';
    }
    if (/report|file|submit|new issue|raise/i.test(msg)) {
        return 'HOW_TO_REPORT';
    }
    if (/road|pothole|street/i.test(msg)) return 'CATEGORY_QUERY';
    if (/water|leak|pipe|supply/i.test(msg)) return 'CATEGORY_QUERY';
    if (/light|lamp|dark|electricity/i.test(msg)) return 'CATEGORY_QUERY';
    if (/trash|garbage|waste|dump/i.test(msg)) return 'CATEGORY_QUERY';
    if (/park|garden|tree/i.test(msg)) return 'CATEGORY_QUERY';
    if (/drain|flood|sewer/i.test(msg)) return 'CATEGORY_QUERY';

    return 'GENERAL';
}

function extractCategory(message) {
    const msg = message.toLowerCase();
    if (/road|pothole|street/i.test(msg)) return 'roads';
    if (/water|leak|pipe|supply/i.test(msg)) return 'water';
    if (/light|lamp|dark|electricity/i.test(msg)) return 'lighting';
    if (/trash|garbage|waste|dump/i.test(msg)) return 'trash';
    if (/park|garden|tree/i.test(msg)) return 'parks';
    if (/drain|flood|sewer/i.test(msg)) return 'drainage';
    return null;
}

// ─── Data Fetching Helpers ──────────────────────────────────────────────────

async function getNearbyIssues(latitude, longitude, radiusKm = 10, limit = 10) {
    const { data: issues } = await supabase
        .from('issues')
        .select('id, title, category, status, ai_severity, location_address, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

    if (!issues || issues.length === 0) return [];

    if (!latitude || !longitude) return issues.slice(0, limit);

    const toRad = (deg) => deg * Math.PI / 180;
    const haversine = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return issues
        .filter(i => {
            if (!i.location_address) return true;
            return true;
        })
        .slice(0, limit);
}

async function getIssuesByCategory(category, limit = 10) {
    const { data } = await supabase
        .from('issues')
        .select('id, title, category, status, ai_severity, location_address, created_at')
        .eq('category', category)
        .order('created_at', { ascending: false })
        .limit(limit);
    return data || [];
}

async function getCriticalIssues(limit = 10) {
    const { data } = await supabase
        .from('issues')
        .select('id, title, category, status, ai_severity, location_address, created_at')
        .eq('ai_severity', 'Critical')
        .neq('status', 'Resolved')
        .order('created_at', { ascending: false })
        .limit(limit);
    return data || [];
}

async function getResolvedIssues(limit = 10) {
    const { data } = await supabase
        .from('issues')
        .select('id, title, category, status, ai_severity, location_address, created_at, updated_at')
        .eq('status', 'Resolved')
        .order('updated_at', { ascending: false })
        .limit(limit);
    return data || [];
}

async function getUserIssues(userId, limit = 10) {
    const { data } = await supabase
        .from('issues')
        .select('id, title, category, status, ai_severity, location_address, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    return data || [];
}

async function getWeeklyStats() {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: newIssues } = await supabase
        .from('issues')
        .select('id, title, category, status, ai_severity')
        .gte('created_at', oneWeekAgo);

    const { data: allIssues } = await supabase
        .from('issues')
        .select('id, status, ai_severity');

    const weeklyNew = newIssues?.length || 0;
    const weeklyResolved = newIssues?.filter(i => i.status === 'Resolved').length || 0;
    const weeklyCritical = newIssues?.filter(i => i.ai_severity === 'Critical').length || 0;
    const total = allIssues?.length || 0;
    const totalResolved = allIssues?.filter(i => i.status === 'Resolved').length || 0;
    const totalPending = total - totalResolved;

    const categoryBreakdown = {};
    (newIssues || []).forEach(i => {
        categoryBreakdown[i.category] = (categoryBreakdown[i.category] || 0) + 1;
    });

    return {
        weeklyNew,
        weeklyResolved,
        weeklyCritical,
        total,
        totalResolved,
        totalPending,
        categoryBreakdown,
        resolveRate: total > 0 ? Math.round((totalResolved / total) * 100) : 0,
    };
}

// ─── Response Formatters ────────────────────────────────────────────────────

function formatTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function formatIssueList(issues, prefix = '') {
    if (!issues.length) return `${prefix}No issues found.`;

    return prefix + issues.map((i, idx) =>
        `${idx + 1}. ${i.title}\n   Status: ${i.status} | Severity: ${i.ai_severity || 'N/A'}\n   ${i.location_address || 'Location N/A'} • ${formatTimeAgo(i.created_at)}`
    ).join('\n\n');
}

const SEVERITY_EMOJI = { Critical: '🔴', High: '🟠', Medium: '🟡', Low: '🟢' };
const STATUS_EMOJI = { Submitted: '📋', InProgress: '🔧', Resolved: '✅' };

// ─── Response Generator ─────────────────────────────────────────────────────

async function generateResponse(intent, message, userId, userLocation) {
    try {
        switch (intent) {
            case 'GREETING': {
                const stats = await store.getIssueStats();
                return {
                    text: `Hello! I'm the UrbanFix AI assistant. I can help you with:\n\n• Check issues in your area\n• Get status updates on your reports\n• View weekly civic reports\n• Find critical or resolved issues\n• Check the leaderboard\n\nThere are currently ${stats.totalIssues} issues tracked, with ${stats.resolved} resolved.\n\nWhat would you like to know?`,
                    actions: ['Show nearby issues', 'Weekly report', 'My issue status'],
                };
            }

            case 'HELP': {
                return {
                    text: `Here's what I can do:\n\n📍 "Check my area" — Issues near your location\n📊 "Weekly report" — This week's summary\n📋 "My issue status" — Track your reports\n🔴 "Critical issues" — Urgent problems\n✅ "Resolved issues" — Recently fixed\n🏆 "Leaderboard" — Top civic contributors\n🛣️ "Road issues" — Category-specific search\n\nJust type naturally and I'll understand!`,
                    actions: ['Check my area', 'Weekly report', 'Critical issues'],
                };
            }

            case 'NEARBY_ISSUES': {
                const lat = userLocation?.latitude;
                const lon = userLocation?.longitude;
                const issues = await getNearbyIssues(lat, lon, 10, 8);

                if (!issues.length) {
                    return {
                        text: `Great news! There are no reported issues near your area right now. Your neighborhood looks good!\n\nIf you spot something, tap the + button to report it.`,
                        actions: ['Report an issue', 'Check other areas'],
                    };
                }

                const critical = issues.filter(i => i.ai_severity === 'Critical').length;
                const inProgress = issues.filter(i => i.status === 'InProgress').length;

                let summary = `Found ${issues.length} issues in your area:\n`;
                if (critical > 0) summary += `🔴 ${critical} critical\n`;
                if (inProgress > 0) summary += `🔧 ${inProgress} being worked on\n`;
                summary += '\n' + formatIssueList(issues);

                return {
                    text: summary,
                    issues: issues.map(i => ({ id: i.id, title: i.title, status: i.status, severity: i.ai_severity })),
                    actions: ['Show critical only', 'Weekly report'],
                };
            }

            case 'MY_ISSUE_STATUS': {
                if (!userId) {
                    return { text: 'Please log in to check your issue status.', actions: [] };
                }
                const myIssues = await getUserIssues(userId, 5);
                if (!myIssues.length) {
                    return {
                        text: `You haven't reported any issues yet. Tap the + button to file your first civic report and earn points!`,
                        actions: ['Report an issue', 'How to report'],
                    };
                }

                let text = `Here are your recent reports:\n\n`;
                myIssues.forEach((i, idx) => {
                    const sevEmoji = SEVERITY_EMOJI[i.ai_severity] || '⚪';
                    const statEmoji = STATUS_EMOJI[i.status] || '📋';
                    text += `${idx + 1}. ${i.title}\n   ${statEmoji} ${i.status} | ${sevEmoji} ${i.ai_severity || 'N/A'}\n   ${formatTimeAgo(i.created_at)}\n\n`;
                });

                return {
                    text,
                    issues: myIssues.map(i => ({ id: i.id, title: i.title, status: i.status })),
                    actions: ['Show nearby issues', 'Weekly report'],
                };
            }

            case 'WEEKLY_REPORT': {
                const stats = await getWeeklyStats();
                let text = `📊 Weekly Civic Report\n\n`;
                text += `New issues this week: ${stats.weeklyNew}\n`;
                text += `Resolved this week: ${stats.weeklyResolved}\n`;
                text += `Critical alerts: ${stats.weeklyCritical}\n\n`;
                text += `📈 Overall Stats\n`;
                text += `Total tracked: ${stats.total}\n`;
                text += `Total resolved: ${stats.totalResolved} (${stats.resolveRate}%)\n`;
                text += `Pending: ${stats.totalPending}\n`;

                if (Object.keys(stats.categoryBreakdown).length > 0) {
                    text += `\n📂 This Week by Category:\n`;
                    for (const [cat, count] of Object.entries(stats.categoryBreakdown)) {
                        text += `  • ${cat}: ${count} issues\n`;
                    }
                }

                return {
                    text,
                    stats,
                    actions: ['Show critical issues', 'Check my area'],
                };
            }

            case 'STATS': {
                const stats = await store.getIssueStats();
                return {
                    text: `📊 Current Statistics\n\nTotal Issues: ${stats.totalIssues}\n✅ Resolved: ${stats.resolved}\n🔧 In Progress: ${stats.inProgress}\n📋 Pending: ${stats.pending}\n🔴 Critical: ${stats.critical}\n\nResolution Rate: ${stats.totalIssues > 0 ? Math.round((stats.resolved / stats.totalIssues) * 100) : 0}%`,
                    stats,
                    actions: ['Weekly report', 'Critical issues'],
                };
            }

            case 'CRITICAL_ISSUES': {
                const issues = await getCriticalIssues(8);
                if (!issues.length) {
                    return {
                        text: `No critical issues at the moment. The city is in good shape!`,
                        actions: ['Check my area', 'Weekly report'],
                    };
                }
                return {
                    text: `🔴 ${issues.length} Critical Issues Requiring Attention:\n\n` + formatIssueList(issues),
                    issues: issues.map(i => ({ id: i.id, title: i.title, status: i.status })),
                    actions: ['Show nearby issues', 'Weekly report'],
                };
            }

            case 'RESOLVED_ISSUES': {
                const issues = await getResolvedIssues(8);
                if (!issues.length) {
                    return {
                        text: `No resolved issues to show yet. Issues are being worked on!`,
                        actions: ['Check my area', 'Critical issues'],
                    };
                }
                return {
                    text: `✅ Recently Resolved Issues:\n\n` + formatIssueList(issues),
                    issues: issues.map(i => ({ id: i.id, title: i.title })),
                    actions: ['Weekly report', 'Check my area'],
                };
            }

            case 'LEADERBOARD': {
                try {
                    const leaders = await store.getCitizensLeaderboard();
                    const top5 = (leaders || []).slice(0, 5);
                    if (!top5.length) {
                        return { text: `No leaderboard data yet. Start reporting issues to earn points!`, actions: ['How to report'] };
                    }
                    let text = `🏆 Top Civic Contributors:\n\n`;
                    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                    top5.forEach((u, i) => {
                        text += `${medals[i]} ${u.name || 'Citizen'} — ${u.points || 0} pts\n`;
                    });
                    return { text, actions: ['My issue status', 'Weekly report'] };
                } catch {
                    return { text: 'Could not load leaderboard right now.', actions: [] };
                }
            }

            case 'HOW_TO_REPORT': {
                return {
                    text: `📝 How to Report an Issue:\n\n1. Tap the + button on the tab bar\n2. Select a category (Roads, Water, Lights, etc.)\n3. Add a title and description\n4. Take a photo or pick from gallery\n5. GPS location is auto-detected\n6. Hit Submit!\n\nOur AI will automatically:\n• Score the severity\n• Route it to the right department\n• Track it until resolution\n\nYou earn points for every report!`,
                    actions: ['Check my area', 'Weekly report'],
                };
            }

            case 'CATEGORY_QUERY': {
                const category = extractCategory(message);
                if (!category) {
                    return { text: `What type of issue are you looking for? Try: roads, water, lighting, trash, parks, or drainage.`, actions: [] };
                }
                const issues = await getIssuesByCategory(category, 8);
                if (!issues.length) {
                    return {
                        text: `No ${category} issues reported currently. If you see one, report it!`,
                        actions: ['Report an issue', 'Check my area'],
                    };
                }
                return {
                    text: `${category.charAt(0).toUpperCase() + category.slice(1)} Issues (${issues.length}):\n\n` + formatIssueList(issues),
                    issues: issues.map(i => ({ id: i.id, title: i.title, status: i.status })),
                    actions: ['Show critical', 'Weekly report'],
                };
            }

            case 'ISSUE_STATUS':
            case 'GENERAL':
            default: {
                return {
                    text: `I'm not sure what you're asking. Here's what I can help with:\n\n• "Check my area" — nearby issues\n• "Weekly report" — this week's summary\n• "My issue status" — your reports\n• "Critical issues" — urgent alerts\n• "Road/water/trash issues" — by category\n• "Leaderboard" — top contributors\n\nTry one of these!`,
                    actions: ['Check my area', 'Weekly report', 'Help'],
                };
            }
        }
    } catch (error) {
        console.error('[Chatbot] Error generating response:', error);
        return {
            text: `Sorry, I ran into an issue processing your request. Please try again.`,
            actions: ['Help'],
        };
    }
}

// ─── POST /api/chatbot/message ──────────────────────────────────────────────

router.post('/message', protect, async (req, res) => {
    try {
        const { message, location } = req.body;
        const userId = req.user?._id || req.user?.id;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const intent = detectIntent(message);
        const response = await generateResponse(intent, message, userId, location);

        res.json({
            intent,
            ...response,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Chatbot] Route error:', error);
        res.status(500).json({ error: 'Chatbot service error' });
    }
});

// ─── GET /api/chatbot/quick-actions ─────────────────────────────────────────

router.get('/quick-actions', protect, async (req, res) => {
    res.json({
        actions: [
            { id: 'nearby', label: 'Issues near me', icon: 'location-outline' },
            { id: 'weekly', label: 'Weekly report', icon: 'bar-chart-outline' },
            { id: 'my_status', label: 'My reports', icon: 'person-outline' },
            { id: 'critical', label: 'Critical alerts', icon: 'alert-circle-outline' },
            { id: 'resolved', label: 'Resolved', icon: 'checkmark-circle-outline' },
            { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy-outline' },
        ],
    });
});

module.exports = router;
