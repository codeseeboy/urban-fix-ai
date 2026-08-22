/**
 * Reset a user's password_hash in Supabase (service role; bypasses RLS).
 * Use when seed skipped an existing admin or the password is unknown.
 *
 *   node scripts/resetAdminPassword.js
 *   node scripts/resetAdminPassword.js admin@urbanfix.com MyNewPass
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

const SALT_ROUNDS = 10;

async function main() {
    const email = (process.argv[2] || 'admin@urbanfix.com').trim().toLowerCase();
    const plain = process.argv[3] || 'admin123';

    const { data: user, error: findErr } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('email', email)
        .maybeSingle();

    if (findErr) {
        console.error('Lookup error:', findErr.message);
        process.exit(1);
    }
    if (!user) {
        console.error(`No user with email: ${email}`);
        console.error('Create one with: node data/seed.js');
        process.exit(1);
    }

    const password_hash = await bcrypt.hash(plain, SALT_ROUNDS);
    const { error: updErr } = await supabase
        .from('users')
        .update({ password_hash })
        .eq('id', user.id);

    if (updErr) {
        console.error('Update error:', updErr.message);
        process.exit(1);
    }

    console.log(`Password updated for ${user.email} (role: ${user.role})`);
    console.log(`   You can sign in with that email and the new password.`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
