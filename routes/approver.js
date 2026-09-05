const express = require('express');
const router = express.Router();
const db = require('../config/firebase');
const { Telegraf } = require('telegraf');

// ১. পেন্ডিং জয়েন রিকুয়েস্ট অ্যাপ্রুভ করার এপিআই (POST)
router.post('/approve-all', async (req, res) => {
    try {
        const { channelId } = req.body;

        if (!channelId) {
            return res.status(400).json({ success: false, message: 'Target Channel ID is required' });
        }

        // ফায়ারবেস থেকে মেইন বটের টোকেন আনা
        const botConfigSnap = await db.ref('settings/bot_config').once('value');
        const botConfig = botConfigSnap.val();

        if (!botConfig || !botConfig.botToken) {
            return res.status(400).json({ success: false, message: 'Main Bot Token not found in settings!' });
        }

        // ওই চ্যানেলের সেভ হয়ে থাকা পেন্ডিং রিকুয়েস্ট নেওয়া
        const requestsSnap = await db.ref(`pending_requests/${channelId}`).once('value');
        const requests = requestsSnap.val() || {};

        const userIds = Object.keys(requests);

        if (userIds.length === 0) {
            return res.status(200).json({ success: true, message: 'No pending requests found for this channel.' });
        }

        const bot = new Telegraf(botConfig.botToken);
        let approvedCount = 0;

        // একের পর এক ইউজারকে অ্যাপ্রুভ করা
        for (const userId of userIds) {
            try {
                await bot.telegram.approveChatJoinRequest(channelId, parseInt(userId));
                approvedCount++;
                // ডাটাবেস থেকে রিমুভ করা
                await db.ref(`pending_requests/${channelId}/${userId}`).remove();
            } catch (err) {
                console.error(`Failed to approve user ${userId}:`, err.message);
            }
        }

        res.status(200).json({
            success: true,
            message: `Successfully approved ${approvedCount} user(s) out of ${userIds.length}!`
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
