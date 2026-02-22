const { getMessaging } = require('../config/firebase');
const supabase = require('../config/supabase'); // Assuming this exists or using direct DB access via store
// Actually, I should check how the app interacts with Supabase. 
// It seems to use `data/store.js` or direct Supabase client.
// Let's implement it using `data/store.js` pattern if possible, or just direct supabase-js.

// Check if supabase client is exported somewhere.
// In `server.js`, it doesn't show connection. 
// `routes/notificationRoutes.js` uses `../data/store`.
// Let's assume we can use `data/store.js` or create a new supabase client instance if needed.

// But wait, `data/store.js` probably has the DB logic.
// I should check `data/store.js` first. 
// For now, I will create the service to use `getMessaging` and placeholders for DB.

const admin = require('firebase-admin');
const store = require('../data/store'); // We'll need to add methods here or use direct client

class NotificationService {
    /**
     * Send a notification to a user
     * @param {string} userId - The UUID of the user
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     * @param {object} data - Additional data (type, issueId, etc.)
     */
    static async sendToUser(userId, title, body, data = {}) {
        try {
            // 1. Store in Supabase
            // We need to implement this in store.js or here
            const notification = await store.createNotification({
                user_id: userId,
                type: data.type || 'general',
                title,
                description: body,
                action_url: data.navigationTarget || null,
                read: false
            });

            // 2. Get User's Push Tokens
            const tokens = await store.getPushTokens(userId);

            if (!tokens || tokens.length === 0) {
                console.log(`ℹ️  No push tokens for user ${userId}`);
                return notification;
            }

            const validTokenRows = [];
            for (const tokenRow of tokens) {
                const value = tokenRow?.token;
                const isExpoToken = typeof value === 'string' && (
                    value.startsWith('ExponentPushToken[') ||
                    value.startsWith('ExpoPushToken[')
                );

                if (!value || isExpoToken) {
                    if (value) {
                        console.warn(`⚠️  Removing non-FCM token for user ${userId}: ${value.slice(0, 24)}...`);
                        store.deletePushToken(value).catch(() => {});
                    }
                    continue;
                }

                validTokenRows.push(tokenRow);
            }

            if (validTokenRows.length === 0) {
                console.log(`ℹ️  No valid FCM tokens for user ${userId}`);
                return notification;
            }

            // 3. Send via FCM
            const messaging = getMessaging();
            if (!messaging) return notification;



            // Use sendEachForMulticast for v13+
            // Note: message object structure is compatible
            const message = {
                notification: {
                    title,
                    body
                },
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'default', // MUST match the channel ID created on frontend
                        sound: 'default',
                        priority: 'high',
                        defaultSound: true,
                        defaultVibrateTimings: true,
                        notificationCount: 1,
                    }
                },
                // FCM data values MUST be strings
                data: Object.fromEntries(
                    Object.entries(data).map(([k, v]) => [k, String(v)])
                ),
                tokens: validTokenRows.map(t => t.token)
            };

            const response = await messaging.sendEachForMulticast(message);

            if (response.failureCount > 0) {
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(validTokenRows[idx].token);
                        console.error(`❌ FCM Error for token ${idx}:`, resp.error); // Log the full error

                        // v13 error codes might differ slightly, but checking code is standard
                        if (resp.error && (
                            resp.error.code === 'messaging/registration-token-not-registered' ||
                            resp.error.code === 'messaging/invalid-registration-token' ||
                            resp.error.code === 'messaging/invalid-argument'
                        )) {
                            store.deletePushToken(validTokenRows[idx].token);
                        }
                    }
                });
                console.log(`⚠️  ${response.failureCount} messages failed. Cleanup scheduled.`);
            }

            return notification;

        } catch (error) {
            console.error('❌ NotificationService Error:', error.message);
            // Don't throw, just log. We don't want to break the main flow.
            return null;
        }
    }

    /**
     * Broadcast a notification to all users except the poster
     * Used when a new issue is created
     */
    static async broadcastNewIssue(excludeUserId, issueTitle, issueId, category) {
        try {
            const tokenRows = await store.getAllPushTokensExcept(excludeUserId);

            if (!tokenRows || tokenRows.length === 0) {
                console.log('ℹ️  No push tokens for broadcast');
                return;
            }

            // Filter out Expo tokens
            const validTokens = tokenRows.filter(row => {
                const token = row?.token;
                if (!token) return false;
                const isExpoToken = token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
                return !isExpoToken;
            });

            if (validTokens.length === 0) {
                console.log('ℹ️  No valid FCM tokens for broadcast');
                return;
            }

            const messaging = getMessaging();
            if (!messaging) return;

            const title = '🆕 New Issue Reported';
            const body = `${issueTitle} — Check it out and upvote if you're affected!`;

            // FCM has a limit of 500 tokens per multicast
            const BATCH_SIZE = 500;
            for (let i = 0; i < validTokens.length; i += BATCH_SIZE) {
                const batch = validTokens.slice(i, i + BATCH_SIZE);

                const message = {
                    notification: { title, body },
                    android: {
                        priority: 'high',
                        notification: {
                            channelId: 'default',
                            sound: 'default',
                            priority: 'high',
                        }
                    },
                    data: {
                        type: 'new_issue',
                        issueId: String(issueId),
                        category: String(category || 'general'),
                        navigationTarget: 'IssueDetail',
                    },
                    tokens: batch.map(t => t.token)
                };

                const response = await messaging.sendEachForMulticast(message);
                console.log(`📢 Broadcast batch ${Math.floor(i / BATCH_SIZE) + 1}: ${response.successCount} sent, ${response.failureCount} failed`);

                // Clean up invalid tokens
                if (response.failureCount > 0) {
                    response.responses.forEach((resp, idx) => {
                        if (!resp.success && resp.error && (
                            resp.error.code === 'messaging/registration-token-not-registered' ||
                            resp.error.code === 'messaging/invalid-registration-token'
                        )) {
                            store.deletePushToken(batch[idx].token).catch(() => {});
                        }
                    });
                }
            }
        } catch (error) {
            console.error('❌ Broadcast Error:', error.message);
        }
    }

    /**
     * Send promotional/engagement notification to a user
     */
    static async sendPromoNotification(userId, title, body) {
        try {
            await this.sendToUser(userId, title, body, {
                type: 'promo',
                navigationTarget: 'HomeFeed'
            });
        } catch (error) {
            console.error('❌ Promo notification error:', error.message);
        }
    }
}

module.exports = NotificationService;
