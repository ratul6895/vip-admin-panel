const express = require('express');
const router = express.Router();
const db = require('../config/firebase');

// ১. সব অ্যাক্টিভ লক চ্যানেলের তালিকা পান (GET)
router.get('/list', async (req, res) => {
    try {
        const ref = db.ref('settings/lock_channels');
        const snapshot = await ref.once('value');
        const data = snapshot.val() || {};
        
        // অবজেক্টকে এরেতে কনভার্ট করা
        const channelList = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

        res.status(200).json({ success: true, channels: channelList });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ২. নতুন লক চ্যানেল যুক্ত করুন (POST)
router.post('/add', async (req, res) => {
    try {
        const { channelId, inviteLink, buttonText } = req.body;

        if (!channelId || !inviteLink) {
            return res.status(400).json({ success: false, message: 'Channel ID and Invite Link are required' });
        }

        const newChannel = {
            channelId: channelId.trim(),
            inviteLink: inviteLink.trim(),
            buttonText: buttonText ? buttonText.trim() : 'Join Channel',
            createdAt: Date.now()
        };

        const newRef = db.ref('settings/lock_channels').push();
        await newRef.set(newChannel);

        res.status(200).json({ success: true, message: 'Lock Channel Added Successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ৩. কোনো লক চ্যানেল মুছে ফেলুন (DELETE)
router.delete('/delete/:id', async (req, res) => {
    try {
        const channelKey = req.params.id;
        await db.ref(`settings/lock_channels/${channelKey}`).remove();
        res.status(200).json({ success: true, message: 'Channel Removed Successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
