const express = require('express');
const router = express.Router();
const db = require('../config/firebase'); // Firebase Admin SDK Connection

// ১. কনফিগারেশন ডাটা নিয়ে আসার এপিআই (GET)
router.get('/get', async (req, res) => {
    try {
        const ref = db.ref('settings/bot_config');
        const snapshot = await ref.once('value');
        res.status(200).json({ success: true, data: snapshot.val() || {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ২. কনফিগারেশন সেভ করার এপিআই (POST)
router.post('/save', async (req, res) => {
    try {
        const {
            botToken,
            webhookUrl,
            videosPerLevel,
            welcomeMessage,
            channelLockText,
            referralTarget,
            deleteTime,
            botUsername,
            welcomeMediaId,
            mediaType
        } = req.body;

        const configData = {
            botToken,
            webhookUrl,
            videosPerLevel: parseInt(videosPerLevel) || 3,
            welcomeMessage,
            channelLockText,
            referralTarget: parseInt(referralTarget) || 5,
            deleteTime: parseInt(deleteTime) || 10,
            botUsername: botUsername ? botUsername.replace('@', '') : '',
            welcomeMediaId,
            mediaType,
            updatedAt: Date.now()
        };

        await db.ref('settings/bot_config').set(configData);
        res.status(200).json({ success: true, message: 'Main Bot Settings Updated Successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
