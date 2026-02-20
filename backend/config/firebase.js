const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let firebaseApp = null;

const initFirebase = () => {
    if (firebaseApp) return firebaseApp;

    let serviceAccount = null;

    // Option 1: Load from FIREBASE_SERVICE_ACCOUNT env var (for production / Render)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            console.log('✅ Firebase credentials loaded from environment variable');
        } catch (e) {
            console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e.message);
            return null;
        }
    } else {
        // Option 2: Load from local file (for development)
        const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            serviceAccount = require(serviceAccountPath);
            console.log('✅ Firebase credentials loaded from serviceAccountKey.json');
        }
    }

    if (!serviceAccount) {
        console.warn('⚠️  No Firebase credentials found.');
        console.warn('⚠️  Set FIREBASE_SERVICE_ACCOUNT env var or add serviceAccountKey.json to config/');
        console.warn('⚠️  Push notifications will NOT work.');
        return null;
    }

    try {
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized');
        return firebaseApp;
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin:', error.message);
        return null;
    }
};

const getMessaging = () => {
    const app = initFirebase();
    if (!app) return null;
    return admin.messaging(app);
};

module.exports = {
    initFirebase,
    getMessaging
};
