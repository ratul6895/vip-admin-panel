const admin = require('firebase-admin');

if (!admin.apps.length) {
    // Render-এর Environment Variable থেকে JSON পার্স করা
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();
module.exports = db;
