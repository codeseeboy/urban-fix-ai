/**
 * End-to-End Test: Backend → AI Service
 * 
 * Simulates what the mobile app does:
 * 1. Login as test user
 * 2. POST /api/issues with an image
 * 3. Backend calls AI service internally
 * 4. Prints the full response with AI fields
 * 
 * Usage: node scripts/test_ai_pipeline.js
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BACKEND_URL = 'http://localhost:5000';
const AI_SERVICE_URL = 'http://localhost:8000';

// Test image — pick one from ai-service/assetss/
const TEST_IMAGE = path.resolve(__dirname, '../../ai-service/assetss/pothole-image-2.webp');

async function main() {
    console.log('═'.repeat(60));
    console.log('  URBANFIX — END-TO-END AI PIPELINE TEST');
    console.log('═'.repeat(60));

    // Step 0: Check both services are running
    console.log('\n[0] Checking services...');
    try {
        const backendRes = await fetch(`${BACKEND_URL}/`);
        const backendData = await backendRes.json();
        console.log(`  ✅ Backend: ${backendData.status}`);
    } catch (e) {
        console.log(`  ❌ Backend not running on ${BACKEND_URL}`);
        process.exit(1);
    }

    try {
        const aiRes = await fetch(`${AI_SERVICE_URL}/health`);
        const aiData = await aiRes.json();
        console.log(`  ✅ AI Service: ${aiData.status} (device: ${aiData.device})`);
        console.log(`     Models: ${JSON.stringify(aiData.models_loaded)}`);
    } catch (e) {
        console.log(`  ❌ AI Service not running on ${AI_SERVICE_URL}`);
        process.exit(1);
    }

    // Step 1: Login / get token
    console.log('\n[1] Logging in as test user...');
    let token;

    // Try multiple test accounts
    const accounts = [
        { email: 'shashi@test.com', password: 'test123' },
        { email: 'aitest@test.com', password: 'test123' },
        { email: 'testai@test.com', password: 'test123' },
    ];

    for (const acc of accounts) {
        try {
            const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(acc),
            });
            const loginData = await loginRes.json();
            if (loginData.token) {
                token = loginData.token;
                console.log(`  ✅ Logged in as: ${loginData.name || loginData.user?.name || acc.email}`);
                break;
            }
        } catch (e) { /* try next */ }
    }

    if (!token) {
        console.log('  ⚠️  No existing account worked, creating new...');
        try {
            const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'AI Pipeline Test', email: `aitest${Date.now()}@test.com`, password: 'test123' }),
            });
            const regData = await regRes.json();
            token = regData.token;
            console.log(`  ✅ Created account: ${regData.name || 'AI Pipeline Test'}`);
        } catch (e) {
            console.log(`  ❌ Auth failed: ${e.message}`);
            process.exit(1);
        }
    }

    if (!token) {
        console.log('  ❌ No token obtained, cannot proceed');
        process.exit(1);
    }

    // Step 2: Create issue with image
    console.log('\n[2] Creating issue with image...');
    console.log(`  Image: ${path.basename(TEST_IMAGE)}`);

    if (!fs.existsSync(TEST_IMAGE)) {
        console.log(`  ❌ Test image not found: ${TEST_IMAGE}`);
        process.exit(1);
    }

    const form = new FormData();
    form.append('title', 'Test: Road damage detected by AI');
    form.append('description', 'Testing AI pipeline - pothole on main road');
    form.append('category', 'roads');
    form.append('emergency', 'false');
    form.append('anonymous', 'false');
    form.append('location', JSON.stringify({
        type: 'Point',
        coordinates: [72.8777, 19.0760],  // Mumbai coords
        address: 'Test Location, Mumbai',
        accuracy_meters: 5,
    }));
    form.append('image', fs.readFileSync(TEST_IMAGE), {
        filename: path.basename(TEST_IMAGE),
        contentType: 'image/webp',
    });

    const startTime = Date.now();

    try {
        const formBuffer = form.getBuffer();
        const issueRes = await fetch(`${BACKEND_URL}/api/issues`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                ...form.getHeaders(),
                'Content-Length': formBuffer.length,
            },
            body: formBuffer,
        });

        const elapsed = Date.now() - startTime;
        const issueData = await issueRes.json();

        if (issueRes.ok) {
            console.log(`  ✅ Issue created! (${elapsed}ms)`);
            console.log('\n' + '─'.repeat(60));
            console.log('  AI ANALYSIS RESULTS (from backend response)');
            console.log('─'.repeat(60));
            console.log(`  Issue ID     : ${issueData._id}`);
            console.log(`  Category     : ${issueData.category}`);
            console.log(`  AI Severity  : ${issueData.aiSeverity}`);
            console.log(`  Priority     : ${issueData.priorityScore}/100`);
            console.log(`  Department   : ${issueData.departmentTag}`);
            console.log(`  AI Tags      : ${JSON.stringify(issueData.aiTags)}`);
            console.log(`  Status       : ${issueData.status}`);
            console.log(`  Image URL    : ${issueData.image || 'N/A'}`);
            console.log('─'.repeat(60));
            console.log('\n  ✅ FULL E2E TEST PASSED! App → Backend → AI Service → DB → Response');
        } else {
            console.log(`  ❌ Issue creation failed (${issueRes.status}): ${JSON.stringify(issueData)}`);
        }
    } catch (e) {
        console.log(`  ❌ Request failed: ${e.message}`);
    }

    console.log('\n' + '═'.repeat(60));
}

main().catch(console.error);
