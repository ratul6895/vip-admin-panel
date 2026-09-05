const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "vip-admin-panel-4e786",
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://vip-admin-panel-4e786-default-rtdb.firebaseio.com"
    });
}

const db = admin.database();
module.exports = db;
