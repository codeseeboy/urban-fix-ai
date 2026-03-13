// UrbanFix AI — Hard Reset Script
// WARNING: This deletes ALL user-related data (users, issues, comments, notifications, follows, etc.)
// from your Supabase database for this project.

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const store = require('../data/store');

async function main() {
  try {
    console.log('⚠️  UrbanFix AI — HARD RESET STARTING');
    console.log('This will delete:');
    console.log(' - all issues');
    console.log(' - all comments');
    console.log(' - all notifications');
    console.log(' - all follows / follow relations');
    console.log(' - all issue upvotes / downvotes / followers');
    console.log(' - all status timeline + resolution proofs');
    console.log(' - all municipal post seen records');
    console.log(' - all push tokens');
    console.log(' - all users\n');

    const confirmEnv =
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!confirmEnv) {
      throw new Error('Missing Supabase env vars in backend/.env');
    }

    const { supabase } = store;

    // Delete in dependency order (children first)
    const tablesInOrder = [
      // issue_followers & municipal_post_seen handled separately above
      'issue_upvotes',
      'issue_downvotes',
      'comments',
      'notifications',
      'resolution_proofs',
      'status_timeline',
      'follows',
      'push_tokens',
      'issues',
      'users',
    ];

    console.log('🗑  Deleting from municipal_post_seen...');
    await supabase.from('municipal_post_seen').delete().not('issue_id', 'is', null);

    console.log('🗑  Deleting from issue_followers...');
    await supabase.from('issue_followers').delete().not('issue_id', 'is', null);

    for (const table of tablesInOrder) {
      console.log(`🗑  Deleting from ${table}...`);
      const { error } = await supabase.from(table).delete().not('id', 'is', null);
      if (error && error.code !== 'PGRST100') {
        // PGRST100: relation does not exist / table missing
        throw new Error(`Failed to delete from ${table}: ${error.message}`);
      }
    }

    console.log('\n✅ Hard reset complete. All user-related data has been deleted.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Reset script error:', err.message);
    process.exit(1);
  }
}

main();

