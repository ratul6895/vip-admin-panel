const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/firebase');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 3000;

// Render/VPS Platform Auto Live URL Detection
const LIVE_WEB_URL = process.env.RENDER_EXTERNAL_URL || process.env.LIVE_URL || `http://localhost:${PORT}`;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend Files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// API Routes Integration
// ==========================================
try {
    app.use('/api/bot-config', require('./routes/botConfig'));
    app.use('/api/channel-post', require('./routes/postChannels'));
    
    // Optional / Extra Modules ( if files exist )
    try { app.use('/api/lock-channels', require('./routes/lockChannels')); } catch (e) {}
    try { app.use('/api/promo', require('./routes/promo')); } catch (e) {}
    try { app.use('/api/approver', require('./routes/approver')); } catch (e) {}
    try { app.use('/api/broadcast', require('./routes/broadcast')); } catch (e) {}
} catch (err) {
    console.error('Error loading API routes:', err.message);
}

// ==========================================
// Admin Panel Direct Page Routes
// ==========================================
app.get('/admin/bot-config', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'bot-config.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-config.html'));
});

app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>🚀 Web App Admin Server is Running Online!</h2>
            <p>Admin Dashboard live at: <a href="${LIVE_WEB_URL}/admin/post-channels" target="_blank">${LIVE_WEB_URL}/admin/post-channels</a></p>
        </div>
    `);
});

// ==========================================
// Web App Posting Bot Runner (Firebase Sync)
// ==========================================
let activeBot = null;

async function startPostingBot() {
    try {
        const configSnap = await db.ref('settings/bot_config').once('value');
        const config = configSnap.val() || {};

        if (!config.webAppBotToken) {
            console.log('⚠️ Posting Bot Token is missing in Firebase. Configure it from Admin Dashboard.');
            return;
        }

        // Stop previous bot instance if running
        if (activeBot) {
            try { activeBot.stop(); } catch (e) {}
        }

        activeBot = new Telegraf(config.webAppBotToken);

        // Load Bot Logic Module
        try {
            const posterBotModule = require('./bot/posterBot');
            if (typeof posterBotModule === 'function') {
                posterBotModule(activeBot);
            }
        } catch (botErr) {
            console.log('ℹ️ Bot custom handler (bot/posterBot.js) optional/not loaded:', botErr.message);
        }

        // Basic Bot Commands
        activeBot.start((ctx) => {
            ctx.reply('👋 Welcome to Web App Poster Bot! Use /upload or Dashboard to generate posts.');
        });

        // Launch Bot in Polling Mode
        await activeBot.launch();
        console.log('✅ Telegram Web App Bot Launched Successfully!');

    } catch (error) {
        console.error('❌ Failed to start Posting Bot:', error.message);
    }
}

// Enable graceful stop
process.once('SIGINT', () => activeBot && activeBot.stop('SIGINT'));
process.once('SIGTERM', () => activeBot && activeBot.stop('SIGTERM'));

// ==========================================
// Start Express Server
// ==========================================
app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 SERVER RUNNING ON PORT: ${PORT}`);
    console.log(`🌐 LIVE WEBSITE ADMIN URL: ${LIVE_WEB_URL}`);
    console.log(`📌 Channels Admin Panel : ${LIVE_WEB_URL}/admin/post-channels`);
    console.log(`📌 Web App Bot Config    : ${LIVE_WEB_URL}/admin/bot-config`);
    console.log(`==================================================\n`);

    // Start Telegram Bot
    startPostingBot();
});
