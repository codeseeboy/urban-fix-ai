require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTokens() {
    console.log('Checking tokens in Supabase...');
    const { data, error } = await supabase.from('push_tokens').select('*');
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} tokens.`);
        console.log(JSON.stringify(data, null, 2));
    }
}

checkTokens();
