const express = require('express');
const router = express.Router();
const db = require('../config/firebase');
const { Telegraf } = require('telegraf');

// ফায়ারবেস থেকে বট টোকেন নিয়ে Telegraf ইনস্ট্যান্স তৈরি
async function getBotInstance() {
    const configSnap = await db.ref('settings/bot_config').once('value');
    const config = configSnap.val() || {};
    if (!config.webAppBotToken) {
        throw new Error('Bot Token is not configured in settings');
    }
    return new Telegraf(config.webAppBotToken);
}

// ১. চ্যানেল যুক্ত করার API
router.post('/add', async (req, res) => {
    try {
        const { channelId } = req.body;

        if (!channelId) {
            return res.status(400).json({ success: false, message: 'Channel ID is required' });
        }

        const bot = await getBotInstance();

        // টেলিগ্রাম এপিআই দিয়ে চ্যানেলের নাম ফেচ করা
        let chatInfo;
        try {
            chatInfo = await bot.telegram.getChat(channelId);
        } catch (err) {
            return res.status(400).json({ success: false, message: 'Bot must be an Admin in the channel or Invalid Channel ID.' });
        }

        const newChannel = {
            id: channelId,
            title: chatInfo.title || 'Unknown Channel',
            addedAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
            timestamp: Date.now()
        };

        // ফায়ারবেসে সেভ
        await db.ref(`settings/post_channels/${channelId}`).set(newChannel);

        res.json({ success: true, message: 'Channel added successfully', data: newChannel });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ২. সব অ্যাক্টিভ চ্যানেল লিস্ট পাওয়ার API
router.get('/list', async (req, res) => {
    try {
        const snapshot = await db.ref('settings/post_channels').once('value');
        const channelsObj = snapshot.val() || {};
        const channels = Object.values(channelsObj);

        // কমা সেপারেটেড আইডি স্ট্রিং জেনারেট
        const configChannelsString = channels.map(ch => ch.id).join(', ');

        res.json({
            success: true,
            count: channels.length,
            channels: channels,
            configChannelsString: configChannelsString
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ৩. চ্যানেল ডিলিট বা রিমুভ করার API
router.delete('/remove/:channelId', async (req, res) => {
    try {
        const { channelId } = req.params;
        await db.ref(`settings/post_channels/${channelId}`).remove();
        res.json({ success: true, message: 'Channel removed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ৪. চ্যানেলের নাম রিফ্রেশ করার API
router.post('/refresh/:channelId', async (req, res) => {
    try {
        const { channelId } = req.params;
        const bot = await getBotInstance();

        const chatInfo = await bot.telegram.getChat(channelId);
        const updatedTitle = chatInfo.title || 'Unknown Channel';

        await db.ref(`settings/post_channels/${channelId}`).update({ title: updatedTitle });

        res.json({ success: true, title: updatedTitle });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not fetch updated title from Telegram' });
    }
});

module.exports = router;
