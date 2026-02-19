const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let firebaseApp = null;

const initFirebase = () => {
    if (firebaseApp) return firebaseApp;

    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

    if (!fs.existsSync(serviceAccountPath)) {
        console.warn('⚠️  Firebase serviceAccountKey.json not found in config/');
        console.warn('⚠️  Push notifications will NOT work until this file is added.');
        return null;
    }

    try {
        const serviceAccount = require(serviceAccountPath);
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
