const express = require('express');
const router = express.Router();
const db = require('../config/firebase');
const { Telegraf } = require('telegraf');

// চ্যানেলে পোস্ট পাঠানোর এপিআই (POST)
router.post('/publish', async (req, res) => {
    try {
        const { channelId, caption, mediaUrl, mediaType, buttonText, buttonUrl } = req.body;

        if (!channelId) {
            return res.status(400).json({ success: false, message: 'Target Channel ID is required' });
        }

        // ফায়ারবেস থেকে মেইন বটের টোকেন নেওয়া
        const botConfigSnap = await db.ref('settings/bot_config').once('value');
        const botConfig = botConfigSnap.val();

        if (!botConfig || !botConfig.botToken) {
            return res.status(400).json({ success: false, message: 'Main Bot Token is missing in settings!' });
        }

        const bot = new Telegraf(botConfig.botToken);

        // বাটন কনফিগারেশন
        let extra = {};
        if (buttonText && buttonUrl) {
            extra.reply_markup = {
                inline_keyboard: [
                    [{ text: buttonText, url: buttonUrl }]
                ]
            };
        }

        if (caption) {
            extra.caption = caption;
        }

        // মিডিয়া টাইপ অনুযায়ী পোস্ট সেন্ড করা
        if (mediaUrl) {
            if (mediaType === 'Video') {
                await bot.telegram.sendVideo(channelId, mediaUrl, extra);
            } else if (mediaType === 'Document') {
                await bot.telegram.sendDocument(channelId, mediaUrl, extra);
            } else {
                // Default: Photo
                await bot.telegram.sendPhoto(channelId, mediaUrl, extra);
            }
        } else if (caption) {
            await bot.telegram.sendMessage(channelId, caption, extra);
        } else {
            return res.status(400).json({ success: false, message: 'Please provide either media or caption.' });
        }

        res.status(200).json({ success: true, message: 'Post published successfully to channel!' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
