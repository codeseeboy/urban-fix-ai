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
        category: 'water',
        status: 'Resolved',
        ai_severity: 'High',
        department_tag: 'Water Dept',
        image: '/public/uploads/burst-pipe-mulund-440nw-1160193h.jpg'
    },
    {
        title: 'Pothole repair completed — Palghar-Boisar Road',
        description: 'The potholes reported by citizens on Palghar-Boisar main road have been repaired. Thank you for your patience and reports!',
        author_type: 'MunicipalPage',
        municipal_page_id: '881b5d1a-2345-6789-01bc-def012345679', // Palghar
        official_update_type: 'WorkCompletion',
        location_address: 'Palghar-Boisar Road',
        category: 'roads',
        status: 'Resolved',
        ai_severity: 'Low',
        department_tag: 'Roads Dept',
        image: '/public/uploads/pothole.jpg'
    },
    {
        title: 'Streetlight restoration drive starts tonight',
        description: 'Faulty streetlights across Wards 1, 2 and 3 will be repaired during tonight\'s maintenance drive.',
        author_type: 'MunicipalPage',
        municipal_page_id: '881b5d1a-2345-6789-01bc-def012345679',
        official_update_type: 'Announcement',
        location_address: 'Palghar Central Zone',
        category: 'lighting',
        status: 'Resolved',
        ai_severity: 'Medium',
        department_tag: 'Electricity Dept',
        image: '/public/uploads/streetlight\'.webp'
    },
    {
        title: 'Ward sanitation special cleanup completed',
        description: 'Special sanitation drive completed in Market Road and bus stand area. Daily pickups resumed.',
        author_type: 'MunicipalPage',
        municipal_page_id: '992a6c0b-1234-5678-90ab-cdef12345678',
        official_update_type: 'WorkCompletion',
        location_address: 'Boisar Market Area',
        category: 'trash',
        status: 'Resolved',
        ai_severity: 'Low',
        department_tag: 'Sanitation',
        image: '/public/uploads/mcd-garbage_d06a446e-cb25-11e8-a159-d4219452a912.avif'
    },
    {
        title: 'Emergency water tanker schedule published',
        description: 'Emergency tanker routes for low-pressure zones are now active for the next 48 hours.',
        author_type: 'MunicipalPage',
        municipal_page_id: '669d3f3c-4567-8901-23de-f01234567881',
        official_update_type: 'Emergency',
        location_address: 'All Low-Pressure Wards',
        category: 'water',
        status: 'Resolved',
        ai_severity: 'High',
        department_tag: 'Water Supply',
        image: '/public/uploads/burst-pipe-mulund-440nw-1160193h.jpg'
    },
    {
        title: 'Road resurfacing project phase-1 update',
        description: 'Phase-1 resurfacing work reached 60% completion on main city connectors.',
        author_type: 'MunicipalPage',
        municipal_page_id: '770c4e2b-3456-7890-12cd-ef0123456780',
        official_update_type: 'ProjectUpdate',
        location_address: 'NH Link Roads',
        category: 'roads',
        status: 'Resolved',
        ai_severity: 'Medium',
        department_tag: 'PWD',
        image: '/public/uploads/pothole.jpg'
    },
    {
        title: 'Public notice: monsoon drain desilting plan',
        description: 'Pre-monsoon drain desilting schedule announced. Works begin this weekend ward-wise.',
        author_type: 'MunicipalPage',
        municipal_page_id: '992a6c0b-1234-5678-90ab-cdef12345678',
        official_update_type: 'PublicNotice',
        location_address: 'Boisar Wards 4-10',
        category: 'parks',
        status: 'Resolved',
        ai_severity: 'Medium',
        department_tag: 'Drainage Dept',
        image: '/public/uploads/brokenfootpath.jpg'
    },
    {
        title: 'Health camp traffic advisory for weekend',
        description: 'Temporary traffic diversion near civic ground due to municipal health camp setup.',
        author_type: 'MunicipalPage',
        municipal_page_id: '881b5d1a-2345-6789-01bc-def012345679',
        official_update_type: 'Announcement',
        location_address: 'Civic Ground Junction',
        category: 'roads',
        status: 'Resolved',
        ai_severity: 'Low',
        department_tag: 'Traffic Coordination',
        image: '/public/uploads/logo.png'
    },
    {
        title: 'LED streetlight expansion completed in east zone',
        description: 'New LED fixtures installed across 12 streets; complaint response window reduced to 24h.',
        author_type: 'MunicipalPage',
        municipal_page_id: '881b5d1a-2345-6789-01bc-def012345679',
        official_update_type: 'WorkCompletion',
        location_address: 'Palghar East Zone',
        category: 'lighting',
        status: 'Resolved',
        ai_severity: 'Low',
        department_tag: 'Electricity Dept',
        image: '/public/uploads/streetlight\'.webp'
    },
    {
        title: 'Citizen grievance window extended this month',
        description: 'Municipal grievance submission counters will remain open till 8 PM for faster disposal.',
        author_type: 'MunicipalPage',
        municipal_page_id: '992a6c0b-1234-5678-90ab-cdef12345678',
        official_update_type: 'Announcement',
        location_address: 'Main Municipal Office',
        category: 'other',
        status: 'Resolved',
        ai_severity: 'Low',
        department_tag: 'Administration',
        image: '/public/uploads/logo.png'
    },
    {
        title: 'Notice: Main road closed for construction tonight',
        description: 'From 10:00 PM to 5:00 AM, the main market road will remain closed due to resurfacing and drainage work. Please use Ring Road diversion.',
        author_type: 'MunicipalPage',
        municipal_page_id: '770c4e2b-3456-7890-12cd-ef0123456780',
        official_update_type: 'PublicNotice',
        location_address: 'Main Market Road',
        category: 'roads',
        status: 'Resolved',
        ai_severity: 'Medium',
        department_tag: 'PWD',
        image: null
    },
    {
        title: 'Notice: Water supply delay in Ward 6',
        description: 'Morning supply in Ward 6 may be delayed by 90 minutes due to valve replacement. Tanker support is on standby.',
        author_type: 'MunicipalPage',
        municipal_page_id: '669d3f3c-4567-8901-23de-f01234567881',
        official_update_type: 'PublicNotice',
        location_address: 'Ward 6',
        category: 'water',
        status: 'Resolved',
        ai_severity: 'Medium',
        department_tag: 'Water Supply',
        image: null
    },
    {
        title: 'Notice: Weekend traffic diversion at civic square',
        description: 'Temporary one-way route active near Civic Square from Saturday 7 AM to Sunday 11 PM for public works activity.',
        author_type: 'MunicipalPage',
        municipal_page_id: '881b5d1a-2345-6789-01bc-def012345679',
        official_update_type: 'Announcement',
        location_address: 'Civic Square',
        category: 'roads',
        status: 'Resolved',
        ai_severity: 'Low',
        department_tag: 'Traffic Coordination',
        image: null
    },
    {
        title: 'Notice: Night streetlight maintenance block',
        description: 'Streetlight maintenance is scheduled in East Zone tonight. Brief outages are expected between 1 AM and 3 AM.',
        author_type: 'MunicipalPage',
        municipal_page_id: '881b5d1a-2345-6789-01bc-def012345679',
        official_update_type: 'PublicNotice',
        location_address: 'East Zone',
        category: 'lighting',
        status: 'Resolved',
        ai_severity: 'Low',
        department_tag: 'Electricity Dept',
        image: null
    },
    {
        title: 'Notice: Garbage pickup timing revised this week',
        description: 'Morning pickup window changed to 6:30 AM–9:30 AM for this week due to route optimization. Please keep dry/wet waste segregated.',
        author_type: 'MunicipalPage',
        municipal_page_id: '992a6c0b-1234-5678-90ab-cdef12345678',
        official_update_type: 'PublicNotice',
        location_address: 'Boisar All Wards',
        category: 'trash',
        status: 'Resolved',
        ai_severity: 'Low',
        department_tag: 'Sanitation',
        image: null
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
