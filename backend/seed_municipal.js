require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MUNICIPAL_PAGES = [
    {
        id: '992a6c0b-1234-5678-90ab-cdef12345678', // Fixed UUID for consistency
        name: 'Boisar Municipal Council',
        handle: 'BoisarMC',
        department: 'General',
        page_type: 'City',
        region: { city: 'Boisar', ward: 'All', district: 'Palghar' },
        description: 'Official page of Boisar Municipal Council. Updates on water, sanitation, and civic issues.',
        verified: true,
        contact_email: 'contact@boisar.gov.in',
        followers_count: 1250,
        is_active: true
    },
    {
        id: '881b5d1a-2345-6789-01bc-def012345679',
        name: 'Palghar Zilla Parishad',
        handle: 'PalgharZP',
        department: 'Administration',
        page_type: 'City',
        region: { city: 'Palghar', ward: 'All', district: 'Palghar' },
        description: 'Palghar District Council updates and civic information.',
        verified: true,
        contact_email: 'ceo@palgharzp.gov.in',
        followers_count: 3400,
        is_active: true
    },
    {
        id: '770c4e2b-3456-7890-12cd-ef0123456780',
        name: 'Roads Department',
        handle: 'RoadsDept',
        department: 'PWD',
        page_type: 'Department',
        region: { city: 'All', ward: 'All', district: 'All' },
        description: 'Updates on road maintenance, potholes, and infrastructure.',
        verified: true,
        contact_email: 'roads@pwd.gov.in',
        followers_count: 850,
        is_active: true
    },
    {
        id: '669d3f3c-4567-8901-23de-f01234567881',
        name: 'Water Department',
        handle: 'WaterDept',
        department: 'Water Supply',
        page_type: 'Department',
        region: { city: 'All', ward: 'All', district: 'All' },
        description: 'Alerts on water cuts, supply timings, and pipeline maintenance.',
        verified: false,
        contact_email: 'water@supply.gov.in',
        followers_count: 500,
        is_active: true
    }
];

const MUNICIPAL_POSTS = [
    {
        title: 'Water supply disruption — Maintenance scheduled',
        description: 'Due to pipeline maintenance, water supply in Ward 5 & 6 will be disrupted on 20th Feb from 10:00 AM to 4:00 PM. Please store water in advance.',
        author_type: 'MunicipalPage',
        municipal_page_id: '992a6c0b-1234-5678-90ab-cdef12345678', // Boisar
        official_update_type: 'PublicNotice',
        location_address: 'Boisar, Palghar District',
        status: 'Resolved',
        ai_severity: 'High',
        department_tag: 'Water Dept',
        image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2070&auto=format&fit=crop'
    },
    {
        title: 'Pothole repair completed — Palghar-Boisar Road',
        description: 'The potholes reported by citizens on Palghar-Boisar main road have been repaired. Thank you for your patience and reports!',
        author_type: 'MunicipalPage',
        municipal_page_id: '881b5d1a-2345-6789-01bc-def012345679', // Palghar
        official_update_type: 'WorkCompletion',
        location_address: 'Palghar-Boisar Road',
        status: 'Resolved',
        ai_severity: 'Low',
        department_tag: 'Roads Dept',
        image: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=2070&auto=format&fit=crop'
    }
];

async function seed() {
    console.log('🌱 Seeding Municipal Pages...');

    // First, delete existing pages by handle to avoid unique constraint errors
    const handles = MUNICIPAL_PAGES.map(p => p.handle);
    const { error: deleteError } = await supabase.from('municipal_pages').delete().in('handle', handles);

    if (deleteError) {
        console.warn('⚠️  Could not delete existing pages (might be referential integrity issues):', deleteError.message);
        // If we can't delete, we might still be able to upsert if IDs match, but handles might conflict.
        // Let's rely on manual cleanup if this fails hard.
    } else {
        console.log('🗑️  Cleaned up existing pages with matching handles.');
    }

    // Seed Pages
    for (const page of MUNICIPAL_PAGES) {
        const { error } = await supabase
            .from('municipal_pages')
            .upsert(page, { onConflict: 'id' });

        if (error) {
            console.error(`❌ Failed to seed page ${page.name}:`, error.message);
        } else {
            console.log(`✅ Seeded Page: ${page.name}`);
        }
    }

    console.log('🌱 Seeding Municipal Posts...');

    // Seed Posts
    for (const post of MUNICIPAL_POSTS) {
        // Check if post exists to avoid dupes (simple check by title)
        const { data: existing } = await supabase.from('issues').select('id').eq('title', post.title).single();

        if (!existing) {
            const { error } = await supabase.from('issues').insert(post);
            if (error) {
                console.error(`❌ Failed to seed post "${post.title}":`, error.message);
            } else {
                console.log(`✅ Seeded Post: "${post.title}"`);
            }
        } else {
            console.log(`ℹ️  Post already exists: "${post.title}"`);
        }
    }
}

seed();
