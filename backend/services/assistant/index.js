/**
 * UrbanFix civic assistant — Gemini Flash-Lite on Vertex AI with function calling.
 *
 * The model never answers data questions from memory. It calls tools that query
 * the live Supabase database (nearby issues, the citizen's own reports, city
 * stats, leaderboard), and writes its reply from what those tools return. Issues
 * the tools surface are passed back to the app so it can render tappable cards.
 */

const supabase = require('../../config/supabase');
const store = require('../../data/store');
const { chat } = require('../llm/providers');

const MAX_TOOL_ROUNDS = 3;
const HISTORY_LIMIT = 10;
const ISSUE_FIELDS = 'id, title, category, status, ai_severity, location_address, location_latitude, location_longitude, image, created_at, updated_at, department_tag';

const CATEGORIES = ['roads', 'trash', 'water', 'drainage', 'lighting', 'electricity', 'parks', 'safety', 'other'];
const STATUSES = ['Submitted', 'Acknowledged', 'InProgress', 'Resolved', 'Rejected'];
const OPEN_STATUSES = ['Submitted', 'Acknowledged', 'InProgress'];

const SYSTEM_PROMPT = `You are the UrbanFix assistant, a civic helper inside the UrbanFix app, used by
citizens of Indian cities to report and track public problems (potholes, garbage,
broken streetlights, drainage, water leaks, fallen trees, electrical hazards).

Rules:
- For ANY question about issues, statuses, counts, places, rankings or the user's own
  reports, call a tool. Never invent issues, numbers, names, dates or statuses.
- If a tool returns nothing, say so plainly and suggest a next step.
- Reply in the user's language (English, Hindi or Hinglish), friendly and concise:
  at most ~100 words, short sentences, no markdown tables, no emojis overload.
- Refer to issues by title and place. Do not paste raw IDs.
- You cannot change data. To report an issue, guide the user to the + button.

How UrbanFix works (use for how-to questions, no tool needed):
- Report: tap +, take a photo, the AI identifies the problem, its category and
  severity, location is attached automatically, review and submit.
- Status flow: Submitted -> Acknowledged -> InProgress -> Resolved (or Rejected).
- Points: +10 for each report, +2 per comment, and a bonus when your report is
  resolved. Badges unlock at milestones; see Profile and Leaderboard.
- Upvote an issue to raise its priority; follow it to get status alerts.`;

// ─── Helpers ────────────────────────────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Compact issue shape used both in tool results (for the model) and in cards (for the app). */
function compact(issue, distanceKm) {
    const out = {
        id: issue.id,
        title: issue.title,
        category: issue.category,
        status: issue.status,
        severity: issue.ai_severity,
        address: issue.location_address,
        image: issue.image || null,
        createdAt: issue.created_at,
    };
    if (distanceKm !== undefined) out.distanceKm = Number(distanceKm.toFixed(2));
    return out;
}

function forModel(issue) {
    // The model only needs a few fields; keeping tool results small keeps tokens low.
    const { image, id, ...rest } = issue;
    return rest;
}

const pick = (v, allowed) => (allowed.includes(v) ? v : undefined);

// ─── Tools ──────────────────────────────────────────────────────────────────

const TOOL_DECLARATIONS = [
    {
        name: 'find_nearby_issues',
        description: "Civic issues reported near the user's current location, nearest first.",
        parameters: {
            type: 'OBJECT',
            properties: {
                radius_km: { type: 'NUMBER', description: 'Search radius in km (default 3, max 25).' },
                category: { type: 'STRING', enum: CATEGORIES },
                only_open: { type: 'BOOLEAN', description: 'Exclude resolved/rejected issues (default true).' },
            },
        },
    },
    {
        name: 'get_my_reports',
        description: 'Issues reported by the current user, newest first, with their status.',
        parameters: {
            type: 'OBJECT',
            properties: { status: { type: 'STRING', enum: STATUSES } },
        },
    },
    {
        name: 'search_issues',
        description: 'Search issues city-wide by text, category, severity and/or status.',
        parameters: {
            type: 'OBJECT',
            properties: {
                text: { type: 'STRING', description: 'Words to match in the title or address.' },
                category: { type: 'STRING', enum: CATEGORIES },
                severity: { type: 'STRING', enum: ['Low', 'Medium', 'High', 'Critical'] },
                status: { type: 'STRING', enum: STATUSES },
                limit: { type: 'NUMBER', description: 'Max results (default 5, max 10).' },
            },
        },
    },
    {
        name: 'get_issue_status',
        description: 'Full status history (timeline) of one issue, found by matching its title.',
        parameters: {
            type: 'OBJECT',
            properties: { title_query: { type: 'STRING', description: 'Words from the issue title.' } },
            required: ['title_query'],
        },
    },
    {
        name: 'get_city_overview',
        description: 'City-wide numbers: totals, open vs resolved, resolution rate, critical open issues, and category breakdown for recent days.',
        parameters: {
            type: 'OBJECT',
            properties: { days: { type: 'NUMBER', description: 'Window for "recent" figures (default 7).' } },
        },
    },
    {
        name: 'get_leaderboard',
        description: "Top citizens by points, plus the current user's rank and points.",
        parameters: { type: 'OBJECT', properties: { limit: { type: 'NUMBER' } } },
    },
];

const tools = {
    async find_nearby_issues(args, ctx) {
        if (!ctx.location) {
            return { error: 'location_unavailable', message: 'The app did not share the user location. Ask them to allow location access.' };
        }
        const { latitude: lat, longitude: lon } = ctx.location;
        const radius = Math.min(Math.max(Number(args.radius_km) || 3, 0.5), 25);
        const dLat = radius / 111;
        const dLon = radius / (111 * Math.cos((lat * Math.PI) / 180));

        let q = supabase
            .from('issues')
            .select(ISSUE_FIELDS)
            .eq('author_type', 'User')
            .gte('location_latitude', lat - dLat)
            .lte('location_latitude', lat + dLat)
            .gte('location_longitude', lon - dLon)
            .lte('location_longitude', lon + dLon)
            .limit(300);
        const category = pick(args.category, CATEGORIES);
        if (category) q = q.eq('category', category);
        if (args.only_open !== false) q = q.in('status', OPEN_STATUSES);

        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const issues = (data || [])
            .map((i) => ({ i, d: haversineKm(lat, lon, i.location_latitude, i.location_longitude) }))
            .filter(({ d }) => d <= radius)
            .sort((a, b) => a.d - b.d)
            .slice(0, 6)
            .map(({ i, d }) => compact(i, d));
        return { radius_km: radius, count: issues.length, issues };
    },

    async get_my_reports(args, ctx) {
        let q = supabase.from('issues').select(ISSUE_FIELDS).eq('user_id', ctx.userId).order('created_at', { ascending: false }).limit(8);
        const status = pick(args.status, STATUSES);
        if (status) q = q.eq('status', status);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const issues = (data || []).map((i) => compact(i));
        return { count: issues.length, issues };
    },

    async search_issues(args) {
        const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);
        let q = supabase.from('issues').select(ISSUE_FIELDS).eq('author_type', 'User').order('created_at', { ascending: false }).limit(limit);
        const category = pick(args.category, CATEGORIES);
        const severity = pick(args.severity, ['Low', 'Medium', 'High', 'Critical']);
        const status = pick(args.status, STATUSES);
        if (category) q = q.eq('category', category);
        if (severity) q = q.eq('ai_severity', severity);
        if (status) q = q.eq('status', status);
        const text = String(args.text || '').replace(/[%,()]/g, ' ').trim().slice(0, 60);
        if (text) q = q.or(`title.ilike.%${text}%,location_address.ilike.%${text}%`);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const issues = (data || []).map((i) => compact(i));
        return { count: issues.length, issues };
    },

    async get_issue_status(args, ctx) {
        const text = String(args.title_query || '').replace(/[%,()]/g, ' ').trim().slice(0, 60);
        if (!text) return { error: 'missing_query' };
        // Prefer the user's own issue when titles collide.
        const { data, error } = await supabase
            .from('issues')
            .select(`${ISSUE_FIELDS}, user_id`)
            .ilike('title', `%${text}%`)
            .order('created_at', { ascending: false })
            .limit(5);
        if (error) throw new Error(error.message);
        if (!data?.length) return { found: false };
        const issue = data.find((i) => i.user_id === ctx.userId) || data[0];
        const timeline = await store.getStatusTimeline(issue.id).catch(() => []);
        return {
            found: true,
            issue: compact(issue),
            department: issue.department_tag,
            timeline: (timeline || []).map((t) => ({ status: t.status, comment: t.comment, at: t.created_at })),
        };
    },

    async get_city_overview(args) {
        const days = Math.min(Math.max(Number(args.days) || 7, 1), 90);
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const base = () => supabase.from('issues').select('id', { count: 'exact', head: true }).eq('author_type', 'User');
        const [total, resolved, criticalOpen, recent] = await Promise.all([
            base(),
            base().eq('status', 'Resolved'),
            base().eq('ai_severity', 'Critical').in('status', OPEN_STATUSES),
            supabase.from('issues').select('category, status').eq('author_type', 'User').gte('created_at', since),
        ]);
        for (const r of [total, resolved, criticalOpen, recent]) if (r.error) throw new Error(r.error.message);
        const byCategory = {};
        for (const i of recent.data || []) byCategory[i.category] = (byCategory[i.category] || 0) + 1;
        const t = total.count || 0;
        const res = resolved.count || 0;
        return {
            total_issues: t,
            resolved: res,
            open: t - res,
            resolution_rate_percent: t ? Math.round((res / t) * 100) : 0,
            critical_open: criticalOpen.count || 0,
            window_days: days,
            new_in_window: (recent.data || []).length,
            resolved_in_window: (recent.data || []).filter((i) => i.status === 'Resolved').length,
            new_by_category: byCategory,
        };
    },

    async get_leaderboard(args, ctx) {
        const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);
        const board = await store.getCitizensLeaderboard();
        const rows = (board || []).map((u, idx) => ({ rank: idx + 1, id: u.id, name: u.name, points: u.points, reports: u.reports_count }));
        const me = rows.find((r) => r.id === ctx.userId);
        return {
            top: rows.slice(0, limit).map(({ id, ...r }) => r),
            you: me ? { rank: me.rank, points: me.points, reports: me.reports } : null,
        };
    },
};

// ─── Conversation loop ──────────────────────────────────────────────────────

function toContents(history, message) {
    const contents = [];
    for (const turn of (Array.isArray(history) ? history : []).slice(-HISTORY_LIMIT)) {
        const text = String(turn?.text || '').trim().slice(0, 600);
        if (!text) continue;
        contents.push({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text }] });
    }
    // Gemini requires the conversation to start with a user turn.
    while (contents.length && contents[0].role !== 'user') contents.shift();
    contents.push({ role: 'user', parts: [{ text: message }] });
    return contents;
}

const SUGGESTIONS = {
    find_nearby_issues: ['Which of these are critical?', 'Show resolved issues near me', 'How do I report one?'],
    get_my_reports: ['What is the status of my latest report?', 'How many points do I have?', 'Issues near me'],
    search_issues: ['Issues near me', 'City overview this week', 'How do I report an issue?'],
    get_issue_status: ['Show my other reports', 'Issues near me', 'How long do repairs take?'],
    get_city_overview: ['Critical issues right now', 'Issues near me', 'Top citizens this month'],
    get_leaderboard: ['How do I earn more points?', 'My reports', 'Issues near me'],
    default: ['Issues near me', 'My reports', 'City overview this week'],
};

/**
 * Answer one user message.
 * @param {object} opts
 * @param {string} opts.message
 * @param {Array<{role:'user'|'assistant', text:string}>} [opts.history]
 * @param {{latitude:number, longitude:number}|null} [opts.location]
 * @param {string} opts.userId
 * @returns {Promise<{ reply: string, issues: object[], suggestions: string[], toolsUsed: string[], model: string }>}
 */
async function answer({ message, history, location, userId }) {
    const ctx = {
        userId,
        location: location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))
            ? { latitude: Number(location.latitude), longitude: Number(location.longitude) }
            : null,
    };
    const contents = toContents(history, message);
    const cards = new Map();
    const toolsUsed = [];
    let model;

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const turn = await chat({
            contents,
            system: SYSTEM_PROMPT,
            tools: round < MAX_TOOL_ROUNDS ? TOOL_DECLARATIONS : undefined,
            model,
            temperature: 0.4,
            maxOutputTokens: 450,
        });
        model = turn.model;

        if (!turn.functionCalls.length) {
            const last = toolsUsed[toolsUsed.length - 1];
            return {
                reply: turn.text,
                issues: [...cards.values()].slice(0, 5),
                suggestions: SUGGESTIONS[last] || SUGGESTIONS.default,
                toolsUsed,
                model,
            };
        }

        contents.push(turn.content); // unchanged — keeps Gemini 3 thought signatures
        const responses = [];
        for (const call of turn.functionCalls) {
            toolsUsed.push(call.name);
            let result;
            try {
                const fn = tools[call.name];
                result = fn ? await fn(call.args, ctx) : { error: 'unknown_tool' };
            } catch (err) {
                console.warn(`[assistant] tool ${call.name} failed: ${err.message}`);
                result = { error: 'tool_failed', message: 'The data source is temporarily unavailable.' };
            }
            for (const issue of result.issues || []) cards.set(issue.id, issue);
            if (result.issue) cards.set(result.issue.id, result.issue);
            const modelView = result.issues ? { ...result, issues: result.issues.map(forModel) } : result;
            responses.push({ functionResponse: { name: call.name, response: modelView } });
        }
        contents.push({ role: 'user', parts: responses });
    }

    return {
        reply: 'I could not finish that request. Please try asking in a simpler way.',
        issues: [...cards.values()].slice(0, 5),
        suggestions: SUGGESTIONS.default,
        toolsUsed,
        model,
    };
}

module.exports = { answer, TOOL_DECLARATIONS };
