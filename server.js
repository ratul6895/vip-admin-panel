const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ১. মূল ড্যাশবোর্ড রাউট
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-config.html'));
});

app.get('/admin/admin-config', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-config.html'));
});

// ২. ফিচারভিত্তিক সঠিক পেজ রাউটসমূহ
app.get('/admin/channel-post', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'post-channels.html'));
});

app.get('/admin/post-channels', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'post-channels.html'));
});

app.get('/admin/approver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'req-approver.html'));
});

app.get('/admin/broadcast', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'broadcast.html'));
});

app.get('/admin/videos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'videos.html'));
});

// সঠিক Force Join & Promo পেজ রাউট
app.get('/admin/promo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'promo-buttons.html'));
});

app.get('/admin/lock-channels', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'lock-channels.html'));
});

// সঠিক Bot Configuration পেজ রাউট (আগের ভুল এডিটিং সংশোধন করা হলো)
app.get('/admin/bot-config', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-config.html')); // অথবা আপনার ডেডিকেটেড বট কনফিগ ফাইল থাকলে তার নাম দিন
});


// ৩. ব্যাকএন্ড API রাউটসমূহ সংযুক্তকরণ
const postChannelsRoute = require('./routes/postChannels');
const botConfigRoute = require('./routes/botConfig');
const broadcastRoute = require('./routes/broadcast');
const videosRoute = require('./routes/videos');
const promoRoute = require('./routes/promo');
const approverRoute = require('./routes/approver');

app.use('/api/channels', postChannelsRoute);
app.use('/api/bot', botConfigRoute);
app.use('/api/broadcast', broadcastRoute);
app.use('/api/videos', videosRoute);
app.use('/api/promo', promoRoute);
app.use('/api/approver', approverRoute);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
