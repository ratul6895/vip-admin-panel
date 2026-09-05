const express = require('express');
const router = express.Router();
const db = require('../config/firebase');

// ১. সব লেভেল এবং টিজার ভিডিওর তালিকা পাওয়া (GET)
router.get('/all', async (req, res) => {
    try {
        const levelSnap = await db.ref('bot_videos/level_videos').once('value');
        const teaserSnap = await db.ref('bot_videos/teaser_videos').once('value');

        const levelData = levelSnap.val() || {};
        const teaserData = teaserSnap.val() || {};

        const levelVideos = Object.keys(levelData).map(k => ({ id: k, ...levelData[k] }));
        const teaserVideos = Object.keys(teaserData).map(k => ({ id: k, ...teaserData[k] }));

        res.status(200).json({
            success: true,
            levelVideos,
            teaserVideos
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ২. নতুন Level Video যুক্ত করা (POST)
router.post('/add-level', async (req, res) => {
    try {
        const { fileId, caption, mediaType } = req.body;

        if (!fileId) {
            return res.status(400).json({ success: false, message: 'Telegram File ID is required' });
        }

        const newVideo = {
            fileId: fileId.trim(),
            caption: caption ? caption.trim() : '',
            mediaType: mediaType || 'Video',
            createdAt: Date.now()
        };

        await db.ref('bot_videos/level_videos').push(newVideo);
        res.status(200).json({ success: true, message: 'Level Video added successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ৩. নতুন Teaser Video যুক্ত করা (POST)
router.post('/add-teaser', async (req, res) => {
    try {
        const { fileId, caption, mediaType } = req.body;

        if (!fileId) {
            return res.status(400).json({ success: false, message: 'File ID is required' });
        }

        const newTeaser = {
            fileId: fileId.trim(),
            caption: caption ? caption.trim() : '',
            mediaType: mediaType || 'Video',
            createdAt: Date.now()
        };

        await db.ref('bot_videos/teaser_videos').push(newTeaser);
        res.status(200).json({ success: true, message: 'Teaser Video added successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ৪. ভিডিও মুছে ফেলা (DELETE)
router.delete('/delete/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params; // type = 'level_videos' or 'teaser_videos'
        await db.ref(`bot_videos/${type}/${id}`).remove();
        res.status(200).json({ success: true, message: 'Video deleted successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
