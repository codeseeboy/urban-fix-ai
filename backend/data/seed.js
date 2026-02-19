// ============================================================================
// UrbanFix AI — Seed Script for Supabase PostgreSQL
// Run: node data/seed.js
// Idempotent: checks for existing records before inserting
// ============================================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

const SALT_ROUNDS = 10;

async function seed() {
    console.log('🌱 Starting database seed...\n');

    // ── 1. SEED USERS ──
    console.log('👤 Seeding users...');
    const usersData = [
        { name: 'Shashi Rajput', email: 'shashi@test.com', password: 'pass123', role: 'citizen', points: 3420, badges: ['first_report', 'civic_hero', 'night_watch'], reports_count: 58, reports_resolved: 42, impact_score: 88, region: 'Central Ward' },
        { name: 'Raj Kumar', email: 'raj@test.com', password: 'pass123', role: 'citizen', points: 2900, badges: ['first_report', 'civic_hero'], reports_count: 45, reports_resolved: 33, impact_score: 76, region: 'North Ward' },
        { name: 'Anita Singh', email: 'anita@test.com', password: 'pass123', role: 'citizen', points: 2650, badges: ['first_report'], reports_count: 41, reports_resolved: 28, impact_score: 70, region: 'South Ward' },
        { name: 'Municipal Admin', email: 'admin@urbanfix.com', password: 'admin123', role: 'admin', points: 0, badges: [], reports_count: 0, reports_resolved: 120, impact_score: 0, region: 'All' },
        { name: 'Shashikant', email: 'shashikant@urbanfix.com', password: 'worker123', role: 'field_worker', points: 0, badges: [], reports_count: 0, reports_resolved: 85, impact_score: 0, region: 'Central Ward', department: 'Roads' },
        { name: 'Meena Devi', email: 'meena@urbanfix.com', password: 'worker123', role: 'field_worker', points: 0, badges: [], reports_count: 0, reports_resolved: 62, impact_score: 0, region: 'South Ward', department: 'Sanitation' },
    ];

    const userIdMap = {}; // email -> uuid
    for (const u of usersData) {
        // Idempotency: skip if user already exists
        const { data: existing } = await supabase.from('users').select('id').eq('email', u.email).single();
        if (existing) {
            userIdMap[u.email] = existing.id;
            console.log(`   ⏭️  ${u.email} already exists`);
            continue;
        }

        const password_hash = await bcrypt.hash(u.password, SALT_ROUNDS);
        const { data, error } = await supabase.from('users').insert({
            name: u.name, email: u.email, password_hash,
            role: u.role, points: u.points, badges: u.badges,
            reports_count: u.reports_count, reports_resolved: u.reports_resolved,
            impact_score: u.impact_score, region: u.region, department: u.department || null,
        }).select('id').single();

        if (error) { console.error(`   ❌ ${u.email}:`, error.message); continue; }
        userIdMap[u.email] = data.id;
        console.log(`   ✅ ${u.email} → ${data.id}`);
    }

    // ── 2. SEED BADGES ──
    console.log('\n🏅 Seeding badges...');
    const badgesData = [
        { id: 'first_report', name: 'First Report', icon: '🏅', description: 'Submit your first civic report', points_required: 0 },
        { id: 'civic_hero', name: 'Civic Hero', icon: '🦸', description: 'Submit 10 verified reports', points_required: 500 },
        { id: 'night_watch', name: 'Night Watch', icon: '🌙', description: 'Report 5 issues after 8pm', points_required: 300 },
        { id: 'top_10', name: 'Top 10', icon: '🏆', description: 'Reach top 10 in your ward', points_required: 2000 },
        { id: 'fifty_reports', name: '50 Reports', icon: '📸', description: 'Submit 50 reports', points_required: 1500 },
        { id: 'leader', name: 'Leader', icon: '⭐', description: 'Highest points in a month', points_required: 3000 },
        { id: 'road_guardian', name: 'Road Guardian', icon: '🛣️', description: 'Report 20 road issues', points_required: 800 },
        { id: 'drain_defender', name: 'Drain Defender', icon: '💧', description: 'Report 10 water/drain issues', points_required: 600 },
    ];

    for (const b of badgesData) {
        const { error } = await supabase.from('badges').upsert(b, { onConflict: 'id' });
        if (error) console.error(`   ❌ Badge ${b.id}:`, error.message);
        else console.log(`   ✅ ${b.id}`);
    }

    // ── 3. SEED MUNICIPAL PAGES ──
    console.log('\n🏛️  Seeding municipal pages...');
    const adminId = userIdMap['admin@urbanfix.com'];
    const pagesData = [
        {
            name: 'Roads Department', handle: 'RoadsDept', department: 'Roads',
            region: { city: 'New Delhi', ward: 'Central' }, verified: true,
            followers_count: 45, description: 'Official updates from Roads Dept.',
            created_by_admin_id: adminId, contact_email: 'roads@delhi.gov.in',
            is_active: true, page_type: 'Department',
        },
    ];

    const pageIdMap = {}; // handle -> uuid
    for (const p of pagesData) {
        const { data: existing } = await supabase.from('municipal_pages').select('id').eq('handle', p.handle).single();
        if (existing) {
            pageIdMap[p.handle] = existing.id;
            console.log(`   ⏭️  ${p.handle} already exists`);
            continue;
        }

        const { data, error } = await supabase.from('municipal_pages').insert(p).select('id').single();
        if (error) { console.error(`   ❌ ${p.handle}:`, error.message); continue; }
        pageIdMap[p.handle] = data.id;
        console.log(`   ✅ ${p.handle} → ${data.id}`);
    }

    // ── 4. SEED ISSUES ──
    console.log('\n📋 Seeding issues...');
    const user1 = userIdMap['shashi@test.com'];
    const user2 = userIdMap['raj@test.com'];
    const user3 = userIdMap['anita@test.com'];
    const worker1 = userIdMap['shashikant@urbanfix.com'];
    const worker2 = userIdMap['meena@urbanfix.com'];

    const issuesData = [
        {
            user_id: user1, title: 'Large Pothole on Main Street — Risk of Accident',
            description: 'A massive pothole has developed on Main Street near the bus stop. Multiple vehicles have been damaged.',
            image: '/public/images/pothole.jpg',
            location_address: '101 Main St, Downtown', location_longitude: 77.209, location_latitude: 28.6139,
            department_tag: 'Roads', status: 'Acknowledged', category: 'roads',
            priority_score: 56, ai_severity: 'High', ai_tags: ['pothole', 'road-damage', 'safety-hazard'],
            anonymous: false, emergency: false, created_at: '2025-12-15T08:00:00Z',
        },
        {
            user_id: user2, title: 'Street Light Out Near Park — Unsafe at Night',
            description: 'The street light at the corner of Park Avenue and 5th Street has been out for 2 weeks.',
            image: '/public/images/streetlight.webp',
            location_address: '45 Park Avenue', location_longitude: 77.219, location_latitude: 28.6229,
            department_tag: 'Electricity', status: 'Submitted', category: 'lighting',
            priority_score: 32, ai_severity: 'Medium', ai_tags: ['street-light', 'safety', 'electrical'],
            anonymous: false, emergency: false, created_at: '2025-12-16T14:00:00Z',
        },
        {
            user_id: user3, title: 'Garbage Pileup Near School — Health Hazard',
            description: 'Garbage has been accumulating for over a week near Central Public School.',
            image: '/public/images/garbage.avif',
            location_address: 'Central Public School', location_longitude: 77.225, location_latitude: 28.6100,
            department_tag: 'Sanitation', status: 'InProgress', category: 'trash',
            priority_score: 96, ai_severity: 'Critical', ai_tags: ['garbage', 'health-hazard', 'school-zone'],
            assigned_to: worker2, anonymous: false, emergency: true, created_at: '2025-12-10T09:00:00Z',
        },
        {
            user_id: user1, title: 'Broken Footpath — Senior Citizens Struggling',
            description: 'The footpath along River Walk has several broken tiles causing difficulty for senior citizens.',
            image: '/public/images/brokenfootpath.jpg',
            location_address: '32 River Walk', location_longitude: 77.200, location_latitude: 28.6180,
            department_tag: 'Public Works', status: 'Resolved', category: 'roads',
            priority_score: 20, ai_severity: 'Low', ai_tags: ['footpath', 'accessibility'],
            assigned_to: worker1, resolved_by: worker1,
            anonymous: false, emergency: false, created_at: '2025-11-20T10:00:00Z',
        },
        {
            user_id: user2, title: 'Water Pipe Burst on MG Road',
            description: 'A major water pipe has burst on MG Road causing water logging and traffic disruption.',
            image: '/public/images/burst-pipe.jpg',
            location_address: 'MG Road, Sector 5', location_longitude: 77.215, location_latitude: 28.620,
            department_tag: 'Water', status: 'Submitted', category: 'water',
            priority_score: 78, ai_severity: 'Critical', ai_tags: ['water-pipe', 'waterlogging', 'infrastructure'],
            anonymous: false, emergency: true, created_at: '2025-12-17T07:00:00Z',
        },
    ];

    const issueIdMap = {}; // title prefix -> uuid
    for (const iss of issuesData) {
        // Idempotency: check by title
        const { data: existing } = await supabase.from('issues').select('id').eq('title', iss.title).single();
        if (existing) {
            issueIdMap[iss.title.substring(0, 20)] = existing.id;
            console.log(`   ⏭️  "${iss.title.substring(0, 40)}..." already exists`);
            continue;
        }

        // Build location_coords from longitude/latitude for PostGIS
        const insertData = { ...iss };
        if (iss.location_longitude != null && iss.location_latitude != null) {
            insertData.location_coords = `POINT(${iss.location_longitude} ${iss.location_latitude})`;
        }

        const { data, error } = await supabase.from('issues').insert(insertData).select('id').single();
        if (error) { console.error(`   ❌ ${iss.title.substring(0, 40)}:`, error.message); continue; }
        issueIdMap[iss.title.substring(0, 20)] = data.id;
        console.log(`   ✅ "${iss.title.substring(0, 40)}..." → ${data.id}`);
    }

    // ── 5. SEED UPVOTES ──
    console.log('\n👍 Seeding upvotes...');
    const upvotesData = [
        // Issue 1 (Pothole) upvoted by user2, user3, user1
        { issueKey: 'Large Pothole on Main', users: [user2, user3, user1] },
        // Issue 2 (Streetlight) upvoted by user1, user3
        { issueKey: 'Street Light Out Near', users: [user1, user3] },
        // Issue 3 (Garbage) upvoted by user1, user2, user3
        { issueKey: 'Garbage Pileup Near S', users: [user1, user2, user3] },
        // Issue 4 (Footpath) upvoted by user2
        { issueKey: 'Broken Footpath — Sen', users: [user2] },
        // Issue 5 (Water) upvoted by user1, user3
        { issueKey: 'Water Pipe Burst on M', users: [user1, user3] },
    ];

    for (const uv of upvotesData) {
        const issueId = issueIdMap[uv.issueKey];
        if (!issueId) continue;
        for (const userId of uv.users) {
            if (!userId) continue;
            const { error } = await supabase.from('issue_upvotes').upsert(
                { issue_id: issueId, user_id: userId },
                { onConflict: 'issue_id,user_id' }
            );
            if (error && !error.message.includes('duplicate')) console.error(`   ❌ upvote:`, error.message);
        }
    }
    console.log('   ✅ Upvotes seeded');

    // ── 6. SEED STATUS TIMELINE ──
    console.log('\n📊 Seeding status timeline...');
    const timelineData = [
        {
            issueKey: 'Large Pothole on Main', entries: [
                { status: 'Submitted', comment: 'Issue reported by citizen', created_at: '2025-12-15T08:00:00Z' },
                { status: 'Acknowledged', comment: 'Acknowledged by Municipal Admin. Road safety team notified.', updated_by: adminId, dept: 'Roads Dept', created_at: '2025-12-15T10:30:00Z' },
            ]
        },
        {
            issueKey: 'Street Light Out Near', entries: [
                { status: 'Submitted', comment: 'Issue reported by citizen', created_at: '2025-12-16T14:00:00Z' },
            ]
        },
        {
            issueKey: 'Garbage Pileup Near S', entries: [
                { status: 'Submitted', comment: 'Issue reported by citizen', created_at: '2025-12-10T09:00:00Z' },
                { status: 'Acknowledged', comment: 'Critical health hazard acknowledged. Emergency sanitation crew assigned.', updated_by: adminId, dept: 'Sanitation Dept', created_at: '2025-12-10T11:00:00Z' },
                { status: 'InProgress', comment: 'Sanitation team arrived on site. Clearing operations started.', updated_by: worker2, dept: 'Sanitation Dept', created_at: '2025-12-12T08:00:00Z' },
            ]
        },
        {
            issueKey: 'Broken Footpath — Sen', entries: [
                { status: 'Submitted', comment: 'Broken footpath reported.', created_at: '2025-11-20T10:00:00Z' },
                { status: 'Acknowledged', comment: 'Audit team verified damage.', updated_by: adminId, dept: 'Public Works', created_at: '2025-11-21T09:00:00Z' },
                { status: 'InProgress', comment: 'Materials arrived. Repair work started.', updated_by: worker1, dept: 'Public Works', created_at: '2025-11-25T08:00:00Z' },
                { status: 'Resolved', comment: 'All tiles replaced. Area cleared.', updated_by: worker1, dept: 'Public Works', created_at: '2025-12-01T16:00:00Z' },
            ]
        },
        {
            issueKey: 'Water Pipe Burst on M', entries: [
                { status: 'Submitted', comment: 'EMERGENCY issue reported by citizen', created_at: '2025-12-17T07:00:00Z' },
            ]
        },
    ];

    for (const tl of timelineData) {
        const issueId = issueIdMap[tl.issueKey];
        if (!issueId) continue;
        for (const entry of tl.entries) {
            const { error } = await supabase.from('status_timeline').insert({
                issue_id: issueId, status: entry.status, comment: entry.comment,
                updated_by: entry.updated_by || null, dept: entry.dept || null,
                created_at: entry.created_at,
            });
            if (error) console.error(`   ❌ timeline:`, error.message);
        }
    }
    console.log('   ✅ Status timeline seeded');

    // ── 7. SEED RESOLUTION PROOF ──
    console.log('\n🔍 Seeding resolution proofs...');
    const footpathId = issueIdMap['Broken Footpath — Sen'];
    if (footpathId) {
        const { error } = await supabase.from('resolution_proofs').upsert({
            issue_id: footpathId,
            after_image: '/public/images/brokenfootpath.jpg',
            worker_remarks: 'Broken tiles replaced. Footpath leveled and verified for elderly access.',
            resolved_at: '2025-12-01T16:00:00Z',
            resolved_by: worker1,
        }, { onConflict: 'issue_id' });
        if (error) console.error('   ❌', error.message);
        else console.log('   ✅ Resolution proof for footpath issue');
    }

    // ── 8. SEED COMMENTS ──
    console.log('\n💬 Seeding comments...');
    const potholeId = issueIdMap['Large Pothole on Main'];
    const garbageId = issueIdMap['Garbage Pileup Near S'];

    const commentsData = [
        { issue_id: potholeId, user_id: user2, text: 'This has been like this for 3 months!', likes: 5, created_at: '2025-12-15T09:00:00Z' },
        { issue_id: potholeId, user_id: user3, text: 'I almost had an accident here last week.', likes: 12, created_at: '2025-12-15T09:30:00Z' },
        { issue_id: potholeId, user_id: adminId, text: 'Acknowledged. Team dispatched for inspection.', likes: 24, created_at: '2025-12-15T10:30:00Z' },
        { issue_id: garbageId, user_id: user1, text: 'The smell is terrible. Kids are getting sick.', likes: 18, created_at: '2025-12-10T12:00:00Z' },
        { issue_id: garbageId, user_id: adminId, text: 'Sanitation team dispatched. ETA 2 hours.', likes: 30, created_at: '2025-12-12T08:30:00Z' },
    ];

    for (const c of commentsData) {
        if (!c.issue_id || !c.user_id) continue;
        const { error } = await supabase.from('comments').insert(c);
        if (error) console.error(`   ❌ comment:`, error.message);
    }
    console.log('   ✅ Comments seeded');

    // ── 9. SEED NOTIFICATIONS ──
    console.log('\n🔔 Seeding notifications...');
    const notifsData = [
        { user_id: user1, type: 'resolved', title: 'Your footpath report was resolved!', description: 'River Walk footpath fixed by Public Works.', read: false, created_at: '2025-12-17T16:00:00Z' },
        { user_id: user1, type: 'upvote', title: '3 people upvoted your report', description: 'Large Pothole on Main Street is gaining traction.', read: false, created_at: '2025-12-17T14:00:00Z' },
        { user_id: user1, type: 'comment', title: 'Municipal Admin replied', description: '"Acknowledged. Team dispatched..."', read: false, created_at: '2025-12-15T10:30:00Z' },
        { user_id: user1, type: 'badge', title: 'New Badge Earned! 🏅', description: '"Civic Hero" for 10 reports submitted.', read: true, created_at: '2025-12-14T12:00:00Z' },
        { user_id: user1, type: 'points', title: '+25 Civic Points', description: 'Bonus for verified report resolution.', read: true, created_at: '2025-12-13T08:00:00Z' },
        { user_id: adminId, type: 'status', title: 'Critical Issue Posted', description: 'Garbage Pileup Near School — 28 comments', read: false, created_at: '2025-12-10T09:00:00Z' },
        { user_id: adminId, type: 'upvote', title: 'High Vote Spike!', description: 'Water Pipe Burst gaining 50+ upvotes/hr', read: false, created_at: '2025-12-17T08:00:00Z' },
    ];

    for (const n of notifsData) {
        if (!n.user_id) continue;
        const { error } = await supabase.from('notifications').insert(n);
        if (error) console.error(`   ❌ notification:`, error.message);
    }
    console.log('   ✅ Notifications seeded');

    // ── 10. SEED ISSUE FOLLOWERS ──
    console.log('\n👥 Seeding issue followers...');
    const followerData = [
        { issueKey: 'Large Pothole on Main', users: [user1] },
        { issueKey: 'Garbage Pileup Near S', users: [user1, user3] },
        { issueKey: 'Water Pipe Burst on M', users: [user2] },
    ];
    for (const fl of followerData) {
        const issueId = issueIdMap[fl.issueKey];
        if (!issueId) continue;
        for (const userId of fl.users) {
            if (!userId) continue;
            const { error } = await supabase.from('issue_followers').upsert(
                { issue_id: issueId, user_id: userId },
                { onConflict: 'issue_id,user_id' }
            );
            if (error && !error.message.includes('duplicate')) console.error(`   ❌ follower:`, error.message);
        }
    }
    console.log('   ✅ Issue followers seeded');

    console.log('\n══════════════════════════════════════════');
    console.log('✅ DATABASE SEED COMPLETE');
    console.log('══════════════════════════════════════════\n');
    console.log('Test credentials:');
    console.log('  Citizen: shashi@test.com / pass123');
    console.log('  Admin:   admin@urbanfix.com / admin123');
    console.log('  Worker:  shashikant@urbanfix.com / worker123');
}

seed().catch(err => {
    console.error('💀 Seed failed:', err);
    process.exit(1);
});
