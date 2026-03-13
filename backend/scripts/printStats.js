// UrbanFix AI — Admin Stats Script
// Prints users, their issue counts, map issue count, and leaderboard to the server terminal.

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (Supabase keys, etc.)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const store = require('../data/store');

async function main() {
  try {
    console.log('────────────────────────────────────────────');
    console.log(' UrbanFix AI — Admin Stats Snapshot');
    console.log('────────────────────────────────────────────\n');

    // 1. Users + issue counts
    const { supabase, getUserIssueCount } = store;

    const usersResult = await supabase
      .from('users')
      .select('id, email, name, role')
      .order('created_at', { ascending: true });

    if (usersResult.error) {
      throw new Error(`Failed to fetch users: ${usersResult.error.message}`);
    }

    const users = usersResult.data || [];
    console.log(`Total users: ${users.length}\n`);
    console.log('Users (email, role, total_issues):');

    const userIssueCounts = await Promise.all(
      users.map(async (u) => {
        const count = await getUserIssueCount(u.id);
        return { ...u, issueCount: count };
      })
    );

    userIssueCounts.forEach((u) => {
      console.log(
        ` - ${u.email || '(no email)'} | ${u.role || 'unknown'} | issues: ${u.issueCount}`
      );
    });

    console.log('\n');

    // 2. Map / issues stats
    const stats = await store.getIssueStats();
    console.log('Issue / Map Stats:');
    console.log(` - Total issues (map pins): ${stats.totalIssues}`);
    console.log(` - Resolved: ${stats.resolved}`);
    console.log(` - In Progress: ${stats.inProgress}`);
    console.log(` - Critical: ${stats.critical}`);
    console.log(` - Pending (Submitted/Acknowledged): ${stats.pending}\n`);

    // 3. Leaderboard data
    const leaderboard = await store.getCitizensLeaderboard();
    console.log('Leaderboard (citizen users, sorted by points):');
    leaderboard.forEach((u, idx) => {
      console.log(
        ` #${idx + 1}  ${u.name}  | points: ${u.points} | reports: ${
          u.reports_count || 0
        }`
      );
    });

    console.log('\n✅ Stats print complete.\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Stats script error:', err.message);
    process.exit(1);
  }
}

main();

