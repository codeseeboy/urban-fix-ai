const dotenv = require('dotenv');
dotenv.config();
const store = require('./data/store');
const { getMessaging } = require('./config/firebase');

async function check() {
    console.log('--- Checking Push Configuration ---');

    // 1. Check Firebase Init
    console.log('1. Checking Firebase Admin...');
    const messaging = getMessaging();
    if (messaging) {
        console.log('✅ Firebase Admin initialized successfully.');
    } else {
        console.error('❌ Firebase Admin FAILED to initialize.');
    }

    // 2. Check Tokens in DB
    console.log('\n2. Checking Database for Tokens...');
    // We don't have a direct "getAll" method in store for tokens, 
    // but the `push_tokens` table exists.
    // Let's use supabase client directly if store doesn't expose it, 
    // but store.js imports supabase.
    // Actually store.js doesn't export supabase directly.
    // I'll make a direct query using the supabase config.

    const supabase = require('./config/supabase');
    const { data, error } = await supabase
        .from('push_tokens')
        .select('*');

    if (error) {
        console.error('❌ Error fetching tokens:', error.message);
    } else {
        console.log(`✅ Found ${data.length} tokens in database.`);
        data.forEach(t => {
            console.log(`   - User: ${t.user_id} | Type: ${t.device_type} | Token: ${t.token.substring(0, 20)}...`);
        });
    }

    process.exit();
}

check();
