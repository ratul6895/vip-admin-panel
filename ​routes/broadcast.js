const express = require('express');
const router = express.Router();
const db = require('../config/firebase');
const { Telegraf } = require('telegraf');

// একটি ছোট হেলপার ফাংশন (Rate Limit এড়াতে Delay তৈরি করার জন্য)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ১. ইউজারের মোট সংখ্যা এবং ব্রডকাস্ট হিস্ট্রি পাওয়ার এপিআই (GET)
router.get('/info', async (req, res) => {
    try {
        // মোট ইউজার সংখ্যা
        const usersSnap = await db.ref('users').once('value');
        const usersData = usersSnap.val() || {};
        const totalUsers = Object.keys(usersData).length;

        // আগের পাঠানো ব্রডকাস্ট হিস্ট্রি
        const historySnap = await db.ref('broadcasts').once('value');
        const historyData = historySnap.val() || {};

        const broadcasts = Object.keys(historyData).map(key => ({
            id: key,
            ...historyData[key]
        })).reverse(); // সর্বশেষ ব্রডকাস্ট আগে দেখাবে

        res.status(200).json({ success: true, totalUsers, broadcasts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ২. ব্রডকাস্ট মেসেজ পাঠানোর এপিআই (POST)
router.post('/send', async (req, res) => {
    try {
        const { message, mediaUrl, mediaType, buttonText, buttonUrl } = req.body;

        const botConfigSnap = await db.ref('settings/bot_config').once('value');
        const botConfig = botConfigSnap.val();

        if (!botConfig || !botConfig.botToken) {
            return res.status(400).json({ success: false, message: 'Bot Token not found!' });
        }

        const bot = new Telegraf(botConfig.botToken);

        const usersSnap = await db.ref('users').once('value');
        const usersData = usersSnap.val() || {};
        const userIds = Object.keys(usersData);

        if (userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No users found in database!' });
        }

        // বাটন সেটআপ
        let extra = {};
        if (buttonText && buttonUrl) {
            extra.reply_markup = {
                inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
            };
        }
        if (message) extra.caption = message;

        const sentRecords = {};
        let successCount = 0;

        // রেসপন্স আগে পাঠিয়ে ব্যাকগ্রাউন্ডে ব্রডকাস্ট চলবে
        res.status(200).json({ 
            success: true, 
            message: `Broadcast initiated for ${userIds.length} users!` 
        });

        // ব্রডকাস্ট লুপ (Flood Wait এড়ানোর জন্য)
        for (const chatId of userIds) {
            try {
                let msgResult;
                if (mediaUrl) {
                    if (mediaType === 'Video') {
                        msgResult = await bot.telegram.sendVideo(chatId, mediaUrl, extra);
                    } else if (mediaType === 'Document') {
                        msgResult = await bot.telegram.sendDocument(chatId, mediaUrl, extra);
                    } else {
                        msgResult = await bot.telegram.sendPhoto(chatId, mediaUrl, extra);
                    }
                } else if (message) {
                    msgResult = await bot.telegram.sendMessage(chatId, message, extra);
                }

                if (msgResult) {
                    sentRecords[chatId] = msgResult.message_id;
                    successCount++;
                }

                // ৩-৩৫ মিলি-সেকেন্ড বিরতি (Telegram API Limits Safe Keep)
                await sleep(35);

            } catch (err) {
                // ইউজারের কাছে না পৌঁছালে (যেমন বট ব্লক করলে) এড়িয়ে যাবে
                console.log(`Failed to send broadcast to ${chatId}: ${err.message}`);
            }
        }

        // ডাটাবেসে হিস্ট্রি সেভ করা (Revoke এর জন্য)
        const broadcastRef = db.ref('broadcasts').push();
        await broadcastRef.set({
            title: message ? (message.substring(0, 20) + '...') : 'Media Message',
            sentCount: successCount,
            records: sentRecords,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('Broadcast Error:', error.message);
    }
});

// ৩. ব্রডকাস্ট রিভোক / ডিলিট করার এপিআই (POST)
router.post('/revoke', async (req, res) => {
    try {
        const { broadcastId } = req.body;

        const broadcastSnap = await db.ref(`broadcasts/${broadcastId}`).once('value');
        const broadcastData = broadcastSnap.val();

        if (!broadcastData) {
            return res.status(404).json({ success: false, message: 'Broadcast record not found!' });
        }

        const botConfigSnap = await db.ref('settings/bot_config').once('value');
        const botConfig = botConfigSnap.val();

        const bot = new Telegraf(botConfig.botToken);
        const records = broadcastData.records || {};

        let revokedCount = 0;

        res.status(200).json({ success: true, message: 'Revoking broadcast in progress...' });

        // সব ইউজারের চ্যাট থেকে মেসেজ ডিলিট করা
        for (const [chatId, messageId] of Object.entries(records)) {
            try {
                await bot.telegram.deleteMessage(chatId, messageId);
                revokedCount++;
                await sleep(30);
            } catch (err) {
                console.log(`Could not delete message for ${chatId}`);
            }
        }

        // ডাটাবেস থেকে সেভ করা হিস্ট্রি রিমুভ
        await db.ref(`broadcasts/${broadcastId}`).remove();

    } catch (error) {
        console.error('Revoke Error:', error.message);
    }
});

module.exports = router;
