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
    const sqlPath = path.join(__dirname, 'migration_push_tokens.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('🚀 Running migration SQL against Supabase...');
    console.log(`📡 Project: ${SUPABASE_URL}`);

    // Try sending to the SQL REST endpoint (if enabled)
    // Note: This endpoint is not standard on all Supabase instances, but worth a try
    // The most reliable way programmatically without direct DB access is usually via the Management API,
    // but here we use the service role key on the REST API if extensions are enabled.

    // Attempt 1: PG-Meta query endpoint
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            // This is a guess; Supabase doesn't have a public SQL endpoint via REST usually.
            // We are relying on the user's existing pattern in run_migration.js
        });

        // Actually, let's just use the logic from the user's run_migration.js which seems to expect 
        // a /sql endpoint or similar.

        const sqlEndpoint = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`; // Hypothetical RPC if they set it up
        // OR just try the same endpoint as run_migration.js

        const userEndpoint = `${SUPABASE_URL}/sql`; // As seen in user's file

        const res = await fetch(userEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ query: sql }),
        });

        if (res.ok) {
            console.log('✅ Migration completed successfully!');
            return true;
        } else {
            const text = await res.text();
            console.log(`⚠️  Migration failed via API: ${res.status} ${text}`);
            return false;
        }

    } catch (err) {
        console.error('❌ Error running migration:', err.message);
        return false;
    }
}

runMigration();
