/**
 * Promo Scheduler — Sends random promotional/engagement notifications
 * throughout the day to keep users engaged
 */
const NotificationService = require('./notificationService');
const store = require('../data/store');

// Engagement reminders. Every message must describe something the app really
// does — no invented challenges, bonuses or badges.
const PROMO_MESSAGES = [
    {
        title: '📸 Snap & Report',
        body: 'Spotted a pothole or broken streetlight? One photo is enough — AI fills in the details.'
    },
    {
        title: '📍 Check Issues Near You',
        body: 'Open the map to see reported issues in your area and upvote the ones affecting you.'
    },
    {
        title: '🏆 Earn Points',
        body: 'Every report earns 10 points, and you get a bonus when it is resolved.'
    },
    {
        title: '🤖 Ask UrbanFix AI',
        body: 'Ask the assistant what is broken near you or how your reports are doing.'
    },
];

// Time windows for sending promos (in hours, 24h format)
// Avoids early morning and late night
const PROMO_HOURS = [9, 10, 11, 13, 14, 15, 17, 18, 19, 20];

let scheduledTimeouts = [];

function getRandomPromo() {
    return PROMO_MESSAGES[Math.floor(Math.random() * PROMO_MESSAGES.length)];
}

function getRandomDelayForHour(hour) {
    // Random minute within the hour (0-59)
    const randomMinute = Math.floor(Math.random() * 60);
    const now = new Date();
    const target = new Date();
    target.setHours(hour, randomMinute, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (target <= now) {
        target.setDate(target.getDate() + 1);
    }

    return target.getTime() - now.getTime();
}

async function sendDailyPromoToRandomUsers() {
    try {
        console.log('📣 Starting promo notification batch...');

        const activeUserIds = await store.getAllActiveUserIds();

        if (!activeUserIds || activeUserIds.length === 0) {
            console.log('ℹ️  No active users for promo notifications');
            return;
        }

        // Send to a random subset (max 20% of users per batch to avoid overwhelming)
        const maxToNotify = Math.max(1, Math.floor(activeUserIds.length * 0.2));
        const shuffled = [...activeUserIds].sort(() => Math.random() - 0.5);
        const selectedUsers = shuffled.slice(0, maxToNotify);

        const promo = getRandomPromo();

        let successCount = 0;
        for (const userId of selectedUsers) {
            try {
                await NotificationService.sendPromoNotification(userId, promo.title, promo.body);
                successCount++;
            } catch (e) {
                // Continue with next user
            }
        }

        console.log(`📣 Promo sent to ${successCount}/${selectedUsers.length} users`);
    } catch (error) {
        console.error('❌ Promo scheduler error:', error.message);
    }
}

function scheduleNextPromo() {
    // Clear any existing timeouts
    scheduledTimeouts.forEach(t => clearTimeout(t));
    scheduledTimeouts = [];

    // Pick 2-3 random hours from the available hours for today's promos
    const numPromos = 2 + Math.floor(Math.random() * 2); // 2-3 promos per day
    const shuffledHours = [...PROMO_HOURS].sort(() => Math.random() - 0.5);
    const selectedHours = shuffledHours.slice(0, numPromos);

    selectedHours.forEach(hour => {
        const delay = getRandomDelayForHour(hour);
        const timeout = setTimeout(async () => {
            await sendDailyPromoToRandomUsers();
        }, delay);

        scheduledTimeouts.push(timeout);

        const scheduledTime = new Date(Date.now() + delay);
        console.log(`📅 Promo scheduled for ${scheduledTime.toLocaleTimeString()}`);
    });

    // Schedule the next day's promos at midnight
    const now = new Date();
    const midnight = new Date();
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 5, 0, 0); // 12:05 AM next day

    const midnightDelay = midnight.getTime() - now.getTime();
    const midnightTimeout = setTimeout(() => {
        scheduleNextPromo();
    }, midnightDelay);

    scheduledTimeouts.push(midnightTimeout);
}

function startPromoScheduler() {
    console.log('🎯 Starting promo notification scheduler...');
    scheduleNextPromo();
}

function stopPromoScheduler() {
    console.log('🛑 Stopping promo scheduler...');
    scheduledTimeouts.forEach(t => clearTimeout(t));
    scheduledTimeouts = [];
}

module.exports = {
    startPromoScheduler,
    stopPromoScheduler,
    sendDailyPromoToRandomUsers, // For manual triggering if needed
};
