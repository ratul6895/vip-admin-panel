const express = require('express');
const router = express.Router();
const db = require('../config/firebase');

// ১. সব অ্যাক্টিভ প্রমো বাটন নিয়ে আসা (GET)
router.get('/list', async (req, res) => {
    try {
        const ref = db.ref('settings/promo_buttons');
        const snapshot = await ref.once('value');
        const data = snapshot.val() || {};
        
        const promoList = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

        res.status(200).json({ success: true, buttons: promoList });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ২. নতুন প্রমো লিংক যুক্ত করা (POST)
router.post('/add', async (req, res) => {
    try {
        const { buttonText, url } = req.body;

        if (!buttonText || !url) {
            return res.status(400).json({ success: false, message: 'Button Text and URL are required' });
        }

        const newPromo = {
            buttonText: buttonText.trim(),
            url: url.trim(),
            createdAt: Date.now()
        };

        const newRef = db.ref('settings/promo_buttons').push();
        await newRef.set(newPromo);

        res.status(200).json({ success: true, message: 'Promo Link Added Successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ৩. প্রমো লিংক মুছে ফেলা (DELETE)
router.delete('/delete/:id', async (req, res) => {
    try {
        const promoId = req.params.id;
        await db.ref(`settings/promo_buttons/${promoId}`).remove();
        res.status(200).json({ success: true, message: 'Promo Link Removed Successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
