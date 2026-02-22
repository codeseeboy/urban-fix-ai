/**
 * Promo Scheduler — Sends random promotional/engagement notifications
 * throughout the day to keep users engaged
 */
const NotificationService = require('./notificationService');
const store = require('../data/store');

// Promotional messages for engagement
const PROMO_MESSAGES = [
    {
        title: '🏆 Earn More Points!',
        body: 'Report a civic issue today and earn 10 points. Top reporters get badges!'
    },
    {
        title: '🔥 Your City Needs You!',
        body: 'Spotted a pothole or broken streetlight? Report it now and help improve your neighborhood.'
    },
    {
        title: '📍 Check Issues Near You',
        body: 'Open the map to see reported issues in your area. Upvote the ones affecting you!'
    },
    {
        title: '💪 Be a Civic Champion',
        body: 'Every report counts! Top 10 reporters this week win special recognition.'
    },
    {
        title: '🌟 Quick Win Available!',
        body: 'Complete your profile for 50 bonus points. Takes just 2 minutes!'
    },
    {
        title: '🎯 Daily Challenge',
        body: 'Upvote 5 issues today to earn the "Active Citizen" badge!'
    },
    {
        title: '🏅 Leaderboard Update',
        body: 'Check where you stand! Top citizens get featured on the community board.'
    },
    {
        title: '📸 Snap & Report',
        body: 'See something broken? Take a photo and report it in under 30 seconds!'
    },
    {
        title: '🤝 Community Power',
        body: 'Issues with 10+ upvotes get priority attention. Make your voice heard!'
    },
    {
        title: '✨ New Features Available',
        body: 'Check out the latest updates! Municipal pages now have stories and updates.'
    },
    {
        title: '🎉 Weekend Challenge',
        body: 'Report 3 issues this weekend to unlock a special weekend warrior badge!'
    },
    {
        title: '⚡ Quick Tip',
        body: 'Double-tap any issue to upvote instantly. Try it now!'
    }
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
