const { Telegraf, Scenes, session, Markup } = require('telegraf');
const db = require('../config/firebase');
const { createCanvas, loadImage } = require('canvas');

// --- ১. থাম্বনেলের মাঝখানে Play Icon যুক্ত করার ফাংশন ---
async function addPlayIconToThumbnail(imageBuffer) {
    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    // মূল ছবি আঁকা
    ctx.drawImage(img, 0, 0, img.width, img.height);

    const centerX = img.width / 2;
    const centerY = img.height / 2;
    const radius = Math.min(img.width, img.height) * 0.15;

    // প্লে বাটন সার্কেল
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, false);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // প্লে ত্রিভুজ আইকন
    ctx.beginPath();
    const triangleSize = radius * 0.8;
    ctx.moveTo(centerX - triangleSize / 3, centerY - triangleSize / 2);
    ctx.lineTo(centerX + triangleSize / 1.5, centerY);
    ctx.lineTo(centerX - triangleSize / 3, centerY + triangleSize / 2);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    return canvas.toBuffer('image/jpeg');
}

// --- ২. Upload Post Wizard Scene ---
const uploadPostWizard = new Scenes.WizardScene(
    'upload_post_wizard',
    
    // Step 0: Send Title
    async (ctx) => {
        ctx.wizard.state.postData = {};
        await ctx.reply('✍️ Send Title:');
        return ctx.wizard.next();
    },

    // Step 1: Select Category
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) {
            return ctx.reply('Please send a valid title text.');
        }
        ctx.wizard.state.postData.title = ctx.message.text;

        const catSnap = await db.ref('categories').once('value');
        const categories = catSnap.val() || {};
        const catKeys = Object.keys(categories);

        if (catKeys.length === 0) {
            ctx.wizard.state.postData.category = 'General';
            await ctx.reply('⚙️ How many Ads?');
            return ctx.wizard.selectStep(3);
        }

        const buttons = catKeys.map(key => [Markup.button.callback(categories[key].name, `cat_${categories[key].name}`)]);
        await ctx.reply('📦 Select category:', Markup.inlineKeyboard(buttons));
        return ctx.wizard.next();
    },

    // Step 2: How many Ads?
    async (ctx) => {
        if (ctx.callbackQuery) {
            ctx.wizard.state.postData.category = ctx.callbackQuery.data.replace('cat_', '');
            await ctx.answerCbQuery();
        } else if (ctx.message && ctx.message.text) {
            ctx.wizard.state.postData.category = ctx.message.text;
        }

        await ctx.reply('⚙️ How many Ads?');
        return ctx.wizard.next();
    },

    // Step 3: Send Video File or URL
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) {
            return ctx.reply('Please enter a valid number for Ads (e.g., 1, 2, 3).');
        }
        ctx.wizard.state.postData.adsCount = parseInt(ctx.message.text) || 1;

        await ctx.reply('🔗 Send Video file or URL:');
        return ctx.wizard.next();
    },

    // Step 4: Send Thumbnail
    async (ctx) => {
        if (ctx.message.text) {
            ctx.wizard.state.postData.videoUrl = ctx.message.text;
        } else if (ctx.message.video) {
            ctx.wizard.state.postData.videoUrl = ctx.message.video.file_id;
        } else {
            return ctx.reply('Please send a valid Video Link or File.');
        }

        await ctx.reply('🖼 Send Thumbnail (Photo) for Website & Telegram:');
        return ctx.wizard.next();
    },

    // Step 5: Select Channels & Overlay Play Icon
    async (ctx) => {
        if (!ctx.message || !ctx.message.photo) {
            return ctx.reply('Please send a valid Photo for thumbnail.');
        }

        await ctx.reply('⏳ Processing Thumbnail & Adding Play Icon...');

        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        
        const response = await fetch(fileLink.href);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const processedImageBuffer = await addPlayIconToThumbnail(buffer);
        ctx.wizard.state.postData.processedImage = processedImageBuffer;

        const channelsSnap = await db.ref('settings/post_channels').once('value');
        const channels = channelsSnap.val() || [];

        ctx.wizard.state.postData.selectedChannels = [...channels];

        const buttons = channels.map(ch => [
            Markup.button.callback(`✅ ${ch.name || ch.id}`, `toggle_${ch.id}`)
        ]);
        buttons.push([Markup.button.callback('🔘 Select All Channels', 'select_all_channels')]);
        buttons.push([Markup.button.callback('🚀 PUBLISH NOW', 'publish_post')]);

        await ctx.replyWithPhoto({ source: processedImageBuffer }, {
            caption: `*Post Preview:*\n📌 Title: ${ctx.wizard.state.postData.title}\n📁 Category: ${ctx.wizard.state.postData.category}\n⚙️ Ads: ${ctx.wizard.state.postData.adsCount}\n\n*Select Target Channels:*`,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });

        return ctx.wizard.next();
    },

    // Step 6: Mini App Direct Link সহ পাবলিশ করা
    async (ctx) => {
        if (!ctx.callbackQuery) return;

        const action = ctx.callbackQuery.data;

        if (action === 'publish_post') {
            await ctx.answerCbQuery('Publishing Post...');
            const post = ctx.wizard.state.postData;

            // ১. ফায়ারবেস ডেটাবেসে পোস্ট সেভ করে ইউনিক Post ID জেনারেট করা
            const newPostRef = db.ref('posts').push();
            const postId = newPostRef.key;

            await newPostRef.set({
                id: postId,
                title: post.title,
                category: post.category,
                adsCount: post.adsCount,
                videoUrl: post.videoUrl,
                createdAt: Date.now()
            });

            // ২. ফায়ারবেস সেটিংস থেকে Telegram Web App Link লোড করা
            const webAppConfigSnap = await db.ref('settings/bot_config').once('value');
            const webAppConfig = webAppConfigSnap.val() || {};
            
            // ডিফল্ট লিংক বা ফায়ারবেসের সেভ করা ওয়েব অ্যাপ লিংক
            const baseWebAppLink = webAppConfig.webAppLink || 'https://t.me/YourBot_bot/app';

            // মিনি অ্যাপের ডাইরেক্ট ভিডিও ওপেন লিংক তৈরি (startapp parameter)
            const postMiniAppLink = `${baseWebAppLink}?startapp=${postId}`;

            // ৩. পোস্টের নিচে থাকা পার্মানেন্ট মিনি অ্যাপ প্লে বাটন
            const postKeyboard = Markup.inlineKeyboard([
                [Markup.button.url('▶️ Watch Full Video On App', postMiniAppLink)]
            ]);

            // ৪. সিলেক্টেড চ্যানেলগুলোতে ডাইরেক্ট বাটনসহ পোস্ট সেন্ড করা
            for (const chId of post.selectedChannels) {
                try {
                    await ctx.telegram.sendPhoto(chId.id || chId, { source: post.processedImage }, {
                        caption: `🎬 *${post.title}*\n📁 Category: ${post.category}\n\n👇 *ক্লিক করে মিনি অ্যাপে সম্পূর্ণ ভিডিওটি দেখুন:*`,
                        parse_mode: 'Markdown',
                        ...postKeyboard
                    });
                } catch (e) {
                    console.log(`Failed to post to ${chId}:`, e.message);
                }
            }

            await ctx.reply('✅ Post published successfully with Mini App Permanent URL!');
            return ctx.scene.leave();
        }
    }
);

// --- ৩. মূল বট ড্রাইভার ---
function initPosterBot(token) {
    const bot = new Telegraf(token);
    const stage = new Scenes.Stage([uploadPostWizard]);

    bot.use(session());
    bot.use(stage.middleware());

    const mainKeyboard = Markup.keyboard([
        ['🚀 Upload New Post', '💎 Full Collection'],
        ['📝 Pre-save Titles', '📦 Manage Categories'],
        ['🗑 Delete Posts', '⚙️ Ad Settings'],
        ['📊 Create Poll', '📅 Scheduled List'],
        ['🔗 Manage Join Buttons', '❌ Cancel']
    ]).resize();

    bot.start((ctx) => ctx.reply('Welcome to Admin Poster Bot Control Panel', mainKeyboard));

    bot.hears('🚀 Upload New Post', (ctx) => ctx.scene.enter('upload_post_wizard'));
    bot.hears('❌ Cancel', (ctx) => {
        ctx.reply('Action Cancelled.', mainKeyboard);
        return ctx.scene.leave();
    });

    return bot;
}

module.exports = { initPosterBot };
