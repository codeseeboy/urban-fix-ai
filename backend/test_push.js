require('dotenv').config();
const NotificationService = require('./services/notificationService');
const store = require('./data/store');

// User ID from your logs: 51334dd4-5781-41cc-80ca-4867b72e8c6b
const USER_ID = '51334dd4-5781-41cc-80ca-4867b72e8c6b';

async function testPush() {
    console.log('🚀 Sending Test Push Notification...');

    try {
        const result = await NotificationService.sendToUser(
            USER_ID,
            '🔔 Test Notification',
            'If you see this, Push Notifications are working! 🎉',
            { type: 'test', navigationTarget: 'Profile' }
        );

        console.log('✅ Notification sent result:', result);
    } catch (error) {
        console.error('❌ Failed to send:', error);
    }

    // Check what happened in store
    // process.exit() might cut off async work if not careful, 
    // but NotificationService awaits the firebase send.
}

testPush();
