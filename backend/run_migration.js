// ============================================================================
// Run the migration SQL against Supabase — no dashboard needed!
// Usage:  node run_migration.js
// ============================================================================
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const fs = require('fs');
const path = require('path');

async function runMigration() {
    const sqlPath = path.join(__dirname, 'supabase_migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('🚀 Running migration SQL against Supabase...');
    console.log(`📡 Project: ${SUPABASE_URL}`);

    // Use the Supabase REST endpoint to run raw SQL via the pg_query RPC
    // The service_role key has full postgres access
    const url = `${SUPABASE_URL}/rest/v1/rpc/`;

    // Supabase doesn't expose a generic SQL endpoint via REST, 
    // so we use the PostgREST-compatible approach with direct fetch to the SQL API
    const sqlApiUrl = `${SUPABASE_URL}/pg`;

    // Try the /pg endpoint first (available on newer Supabase instances)
    // If not, fall back to the management API
    try {
        // Use the Supabase SQL API endpoint (pg-meta)
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'GET',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            },
        });
        console.log('✅ Connection to Supabase verified (status:', response.status, ')');
    } catch (err) {
        console.error('❌ Cannot reach Supabase:', err.message);
        process.exit(1);
    }

    // Since Supabase REST doesn't support raw SQL execution, 
    // we'll use the @supabase/supabase-js client with rpc or direct operations.
    // However, for DDL (CREATE TABLE), we need the SQL API.
    // The best approach is to use the Supabase Management API or a direct pg connection.

    // Let's use a direct HTTP request to the Supabase SQL endpoint
    // POST to /pg/query with the SQL body
    const endpoints = [
        `${SUPABASE_URL.replace('.supabase.co', '.supabase.co')}/pg/query`,
    ];

    // Since direct SQL execution requires the pg-meta API which may not be 
    // accessible via the public API, let's split the SQL into manageable 
    // statements and use the Supabase client for what we can.

    // Actually, the simplest approach: use the Supabase client's built-in RPC
    // We first create a helper function via SQL, then call it.
    // But we need to get the SQL executed somehow...

    // The most reliable approach for Supabase is to use their Database REST API
    // at the /sql endpoint with the service role key

    const sqlEndpoint = `${SUPABASE_URL}/sql`;

    console.log('\n📋 Attempting to run SQL via Supabase SQL endpoint...');

    try {
        const response = await fetch(sqlEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ query: sql }),
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Migration completed successfully!');
            console.log('📊 Result:', JSON.stringify(result).substring(0, 200));
            return true;
        } else {
            const text = await response.text();
            console.log(`⚠️  SQL endpoint returned ${response.status}: ${text.substring(0, 200)}`);
            console.log('\n📝 The SQL endpoint may not be available via REST.');
            console.log('   Please run the migration manually (see instructions below).');
            return false;
        }
    } catch (err) {
        console.log(`⚠️  SQL endpoint not reachable: ${err.message}`);
        console.log('\n📝 Please run the migration manually (see instructions below).');
        return false;
    }
}

async function main() {
    const success = await runMigration();

    if (!success) {
        console.log('\n' + '='.repeat(60));
        console.log('📋 MANUAL MIGRATION STEPS:');
        console.log('='.repeat(60));
        console.log('');
        console.log('1. Open your browser and go to:');
        console.log('   https://supabase.com/dashboard/project/xwuijkusykpszobxnkmh/sql/new');
        console.log('');
        console.log('2. Copy ALL content from: backend/supabase_migration.sql');
        console.log('3. Paste it into the SQL Editor');
        console.log('4. Click the green "Run" button');
        console.log('5. You should see "Success. No rows returned"');
        console.log('');
        console.log('After that, run:  node data/seed.js');
        console.log('='.repeat(60));
    }
}

main();
