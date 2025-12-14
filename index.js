const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    getContentType,
    Browsers,
    delay
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const chalk = require("chalk");
const axios = require("axios");
const fs = require("fs");
const config = require("./config");
const { chatWithAI } = require("./lib/ai");
const { sleep, formatTime, getUptime, formatBytes } = require("./lib/functions");
const keepAlive = require("./keep_alive");

// Start keep-alive server
if (config.KEEP_ALIVE) {
    keepAlive();
}

// Global variables
let startTime = Date.now();
const messageTracker = new Map();
let qrShown = false;
let pairingCodeShown = false;

// Console colors
const colors = {
    info: chalk.cyan,
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    highlight: chalk.bgMagenta.white
};

// Rate limiting
function checkRateLimit(from) {
    if (!config.ANTI_BAN) return true;
    
    const now = Date.now();
    const tracker = messageTracker.get(from) || { count: 0, firstMsg: now };
    
    if (now - tracker.firstMsg > 60000) {
        tracker.count = 1;
        tracker.firstMsg = now;
    } else {
        tracker.count++;
    }
    
    messageTracker.set(from, tracker);
    
    return tracker.count <= config.MAX_MSGS_PER_MINUTE;
}

// Main connection function
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    console.log(colors.highlight(`
╔════════════════════════════════╗
║   💞 SELINA-ADMIN-BOT 💞      ║
║   Replit Edition v2.0          ║
╚════════════════════════════════╝
    `));

    const conn = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.ubuntu("Chrome"),
        version,
        keepAliveIntervalMs: 50000,
        defaultQueryTimeoutMs: undefined,
        connectTimeoutMs: 60000,
        markOnlineOnConnect: config.ALWAYS_ONLINE,
        syncFullHistory: false,
        getMessage: async () => ({ conversation: "Hi" })
    });

    const store = makeInMemoryStore({
        logger: pino().child({ level: "silent" })
    });
    
    store?.bind(conn.ev);

    // Handle pairing code or QR
    if (!conn.authState.creds.registered) {
        console.log(colors.info('\n📱 Connection Method: ' + config.CONNECTION_METHOD));
        
        if (config.CONNECTION_METHOD === 'PAIRING') {
            console.log(colors.warning('\n⏳ Requesting pairing code...'));
            console.log(colors.info('📞 Phone Number: ' + config.PHONE_NUMBER));
            
            // Wait a bit before requesting code
            await delay(2000);
            
            try {
                const code = await conn.requestPairingCode(config.PHONE_NUMBER);
                console.log(colors.success('\n╔═══════════════════════════╗'));
                console.log(colors.success('║  ✅ YOUR PAIRING CODE:   ║'));
                console.log(colors.success('║                           ║'));
                console.log(colors.highlight(`║        ${code}          ║`));
                console.log(colors.success('║                           ║'));
                console.log(colors.success('╚═══════════════════════════╝\n'));
                console.log(colors.info('📱 Enter this code in WhatsApp:'));
                console.log(colors.info('   Settings > Linked Devices > Link a Device\n'));
                pairingCodeShown = true;
            } catch (error) {
                console.log(colors.error('❌ Error requesting pairing code:'));
                console.log(colors.error(error.message));
                console.log(colors.warning('\n💡 Switching to QR Code method...\n'));
            }
        } else {
            console.log(colors.warning('\n📱 Waiting for QR Code...\n'));
        }
    }

    // Connection updates
    conn.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Show QR code
        if (qr && !qrShown) {
            console.log(colors.warning('\n╔════════════════════════════╗'));
            console.log(colors.warning('║   SCAN QR CODE BELOW 👇   ║'));
            console.log(colors.warning('╚════════════════════════════╝\n'));
            
            const qrcode = require('qrcode-terminal');
            qrcode.generate(qr, { small: true });
            
            console.log(colors.info('\n📱 Scan with WhatsApp: Linked Devices > Link a Device\n'));
            qrShown = true;
        }

        // Connected
        if (connection === "open") {
            qrShown = false;
            pairingCodeShown = false;
            
            console.log(colors.success('\n╔════════════════════════════════╗'));
            console.log(colors.success('║  ✅ CONNECTED SUCCESSFULLY!   ║'));
            console.log(colors.success('╚════════════════════════════════╝\n'));
            console.log(colors.info('🤖 Bot: ' + config.BOT_NAME));
            console.log(colors.info('👤 Owner: ' + config.OWNER_NAME));
            console.log(colors.info('🧠 AI Mode: ' + (config.AI_AUTO_REPLY ? 'ON ✅' : 'OFF ❌')));
            console.log(colors.info('⚡ Status: Running 24/7\n'));
            
            // Set profile picture
            try {
                const ppBuffer = await axios.get(config.PROFILE_PIC, { 
                    responseType: 'arraybuffer',
                    timeout: 10000 
                });
                await conn.updateProfilePicture(conn.user.id, Buffer.from(ppBuffer.data));
                console.log(colors.success("✅ Profile picture updated!\n"));
            } catch (error) {
                console.log(colors.warning("⚠️ Could not update profile picture\n"));
            }

            // Set status
            try {
                await conn.updateProfileStatus(`💞 Selina Bot | 24/7 AI | ${config.OWNER_NAME}`);
            } catch {}
        }

        // Disconnected
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log(colors.error('\n❌ Connection closed!'));
            console.log(colors.warning('Reason: ' + (lastDisconnect?.error?.message || 'Unknown')));
            
            if (shouldReconnect) {
                console.log(colors.info('🔄 Reconnecting in 3 seconds...\n'));
                setTimeout(() => connectToWhatsApp(), 3000);
            } else {
                console.log(colors.error('⚠️ Logged out! Delete session folder and restart.\n'));
            }
        }
    });

    // Save credentials
    conn.ev.on("creds.update", saveCreds);

    // Message handler
    conn.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            if (mek.key.fromMe) return;

            const message = mek.message;
            const type = getContentType(message);
            const from = mek.key.remoteJid;
            
            const body = (type === "conversation") ? message.conversation :
                        (type === "extendedTextMessage") ? message.extendedTextMessage.text :
                        (type === "imageMessage") ? message.imageMessage.caption :
                        (type === "videoMessage") ? message.videoMessage.caption : "";

            if (!body) return;

            const isGroup = from.endsWith("@g.us");
            if (isGroup) return; // Ignore groups

            const sender = from;
            const senderNum = sender.split("@")[0];
            const pushname = mek.pushName || "User";
            const isOwner = senderNum === config.OWNER_NUMBER;
            const isCmd = body.startsWith(config.PREFIX);
            const command = isCmd ? body.slice(config.PREFIX.length).trim().split(" ")[0].toLowerCase() : "";
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(" ");

            // Rate limiting
            if (!checkRateLimit(from)) {
                console.log(colors.warning(`⚠️ Rate limit: ${pushname}`));
                return;
            }

            // Anti-ban delay
            if (config.ANTI_BAN) await sleep(config.MSG_DELAY);
            
            // Auto read and typing
            if (config.AUTO_READ) await conn.readMessages([mek.key]);
            if (config.AUTO_TYPING) await conn.sendPresenceUpdate('composing', from);

            // Create quoted message
            const getQuoted = async () => {
                try {
                    const thumbBuffer = await axios.get(config.PROFILE_PIC, { 
                        responseType: 'arraybuffer',
                        timeout: 5000 
                    });
                    return {
                        key: {
                            remoteJid: config.CHANNEL_JID,
                            fromMe: false,
                            id: 'SELINA' + Math.random().toString(36).substr(2, 9),
                            participant: '0@s.whatsapp.net'
                        },
                        message: {
                            groupInviteMessage: {
                                groupJid: config.CHANNEL_JID,
                                inviteCode: "Selina2024",
                                groupName: "💞 Selina Community 💞",
                                caption: "Join our channel!",
                                jpegThumbnail: Buffer.from(thumbBuffer.data)
                            }
                        }
                    };
                } catch {
                    return null;
                }
            };

            const quoted = await getQuoted();

            // Reply function
            const reply = async (text) => {
                try {
                    return await conn.sendMessage(from, {
                        text: `${config.BOT_NAME}\n\n${text}\n\n${config.FOOTER}`,
                        contextInfo: {
                            mentionedJid: [sender],
                            forwardingScore: 1,
                            isForwarded: true,
                            externalAdReply: {
                                title: config.BOT_NAME,
                                body: `By ${config.OWNER_NAME}`,
                                thumbnailUrl: config.PROFILE_PIC,
                                sourceUrl: config.CHANNEL_LINK,
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        }
                    }, { quoted });
                } catch (error) {
                    console.log(colors.error('Reply error:', error.message));
                }
            };

            // Reply with image
            const replyImg = async (img, caption) => {
                try {
                    return await conn.sendMessage(from, {
                        image: { url: img },
                        caption: `${config.BOT_NAME}\n\n${caption}\n\n${config.FOOTER}`,
                        contextInfo: {
                            mentionedJid: [sender],
                            forwardingScore: 1,
                            isForwarded: true
                        }
                    }, { quoted });
                } catch (error) {
                    console.log(colors.error('Image reply error:', error.message));
                }
            };

            console.log(colors.info(`[${formatTime()}] ${pushname}: ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}`));

            // Command handler
            switch (command) {
                case "menu":
                case "help":
                case "commands":
                    const menu = `╭━━━『 💞 SELINA MENU 💞 』━━━╮
┃
┃  👋 Hi *${pushname}*!
┃  
┃  🤖 Bot: ${config.BOT_NAME}
┃  👤 Owner: ${config.OWNER_NAME}
┃  ⚡ Prefix: ${config.PREFIX}
┃  🧠 AI: ${config.AI_AUTO_REPLY ? 'ON ✅' : 'OFF ❌'}
┃  🕐 Time: ${formatTime()}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━『 🏠 MAIN 』━━━╮
┃ ${config.PREFIX}menu
┃ ${config.PREFIX}ping
┃ ${config.PREFIX}alive
┃ ${config.PREFIX}owner
┃ ${config.PREFIX}channel
┃ ${config.PREFIX}status
╰━━━━━━━━━━━━━━╯

╭━━━『 🧠 AI 』━━━╮
┃ ${config.PREFIX}ai <text>
┃ ${config.PREFIX}chat <text>
┃ 
┃ 💡 Just chat with me!
┃ I reply automatically!
╰━━━━━━━━━━━━━━╯

╭━━━『 🎮 FUN 』━━━╮
┃ ${config.PREFIX}joke
┃ ${config.PREFIX}quote
┃ ${config.PREFIX}fact
┃ ${config.PREFIX}advice
╰━━━━━━━━━━━━━━╯

📢 Channel: ${config.CHANNEL_LINK}`;
                    await replyImg(config.PROFILE_PIC, menu);
                    break;

                case "ping":
                    const start = Date.now();
                    const pingMsg = await reply("⚡ Pinging...");
                    const end = Date.now();
                    const ping = end - start;
                    
                    if (pingMsg) {
                        await conn.sendMessage(from, {
                            text: `${config.BOT_NAME}\n\n🏓 *Pong!*\n\n⚡ Speed: ${ping}ms\n📡 Status: Online 24/7\n🧠 AI: Active\n\n${config.FOOTER}`,
                            edit: pingMsg.key
                        });
                    }
                    break;

                case "alive":
                case "runtime":
                    const aliveText = `✅ *I'm Alive!*\n\n⏱️ *Uptime:* ${getUptime(startTime)}\n🧠 *AI:* Active\n📡 *Status:* Online 24/7\n💾 *Memory:* ${formatBytes(process.memoryUsage().heapUsed)}\n🌐 *Platform:* Replit`;
                    await replyImg(config.PROFILE_PIC, aliveText);
                    break;

                case "ai":
                case "chat":
                case "ask":
                    if (!q) return reply("❌ Please provide text!\n\n*Example:* .ai Hello, how are you?");
                    
                    await conn.sendPresenceUpdate('composing', from);
                    await sleep(config.TYPING_DELAY);
                    
                    const aiResponse = await chatWithAI(q, senderNum);
                    await reply(`🧠 *AI Response:*\n\n${aiResponse}`);
                    break;

                case "owner":
                case "dev":
                case "creator":
                    try {
                        await conn.sendMessage(from, {
                            contact: {
                                displayName: config.OWNER_NAME,
                                contacts: [{
                                    displayName: config.OWNER_NAME,
                                    vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${config.OWNER_NAME}\nTEL;type=CELL;type=VOICE;waid=${config.OWNER_NUMBER}:+${config.OWNER_NUMBER}\nEND:VCARD`
                                }]
                            }
                        }, { quoted });
                        
                        await reply(`👤 *Owner:* ${config.OWNER_NAME}\n📞 *Number:* +${config.OWNER_NUMBER}\n\n💞 Thank you for using Selina!`);
                    } catch (error) {
                        await reply(`👤 *Owner:* ${config.OWNER_NAME}\n📞 *Number:* +${config.OWNER_NUMBER}`);
                    }
                    break;

                case "channel":
                    await reply(`📢 *Join Our Official Channel!*\n\n🔗 ${config.CHANNEL_LINK}\n\n✨ Get updates about:\n• New features\n• Bot updates\n• Tips & tricks\n\n💞 Join now!`);
                    break;

                case "status":
                case "info":
                    const statusText = `╭━━━『 📊 BOT STATUS 』━━━╮
┃
┃  🤖 *Bot:* ${config.BOT_NAME}
┃  ⚡ *Status:* Online
┃  🕐 *Uptime:* ${getUptime(startTime)}
┃  🧠 *AI:* ${config.AI_AUTO_REPLY ? 'Active ✅' : 'Inactive ❌'}
┃  📡 *Mode:* ${config.MODE}
┃  💾 *Memory:* ${formatBytes(process.memoryUsage().heapUsed)}
┃  📱 *Platform:* Replit
┃  🌐 *24/7:* Yes ✅
┃
╰━━━━━━━━━━━━━━━━━━━━╯`;
                    await reply(statusText);
                    break;

                case "joke":
                    try {
                        const jokeRes = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 10000 });
                        await reply(`😂 *Random Joke:*\n\n${jokeRes.data.setup}\n\n*${jokeRes.data.punchline}* 🤣`);
                    } catch {
                        await reply("❌ Failed to fetch joke. Try again!");
                    }
                    break;

                case "quote":
                    try {
                        const quoteRes = await axios.get('https://api.quotable.io/random', { timeout: 10000 });
                        await reply(`💭 *Inspirational Quote:*\n\n_"${quoteRes.data.content}"_\n\n— *${quoteRes.data.author}*`);
                    } catch {
                        await reply("❌ Failed to fetch quote. Try again!");
                    }
                    break;

                case "fact":
                    try {
                        const factRes = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', { timeout: 10000 });
                        await reply(`🎲 *Random Fact:*\n\n${factRes.data.text}`);
                    } catch {
                        await reply("❌ Failed to fetch fact. Try again!");
                    }
                    break;

                case "advice":
                    try {
                        const adviceRes = await axios.get('https://api.adviceslip.com/advice', { timeout: 10000 });
                        await reply(`🌟 *Advice:*\n\n${adviceRes.data.slip.advice}`);
                    } catch {
                        await reply("❌ Failed to fetch advice. Try again!");
                    }
                    break;

                case "restart":
                    if (!isOwner) return reply("❌ This command is only for the owner!");
                    await reply("🔄 Restarting bot in 3 seconds...");
                    setTimeout(() => process.exit(), 3000);
                    break;

                default:
                    // 24/7 AI Auto Reply
                    if (config.AI_AUTO_REPLY && !isCmd && body.length > 1) {
                        await conn.sendPresenceUpdate('composing', from);
                        await sleep(config.TYPING_DELAY);
                        
                        const autoAiResponse = await chatWithAI(body, senderNum);
                        await reply(autoAiResponse);
                    }
                    break;
            }

            // Stop typing
            if (config.AUTO_TYPING) {
                await conn.sendPresenceUpdate('paused', from);
            }

        } catch (error) {
            console.error(colors.error("[MESSAGE ERROR]"), error.message);
        }
    });

    // Keep alive check
    setInterval(() => {
        if (conn.ws.readyState !== 1) {
            console.log(colors.warning("⚠️ Connection unstable. Reconnecting..."));
        }
    }, 30000);

    return conn;
}

// Start bot
connectToWhatsApp().catch((error) => {
    console.error(colors.error("FATAL ERROR:"), error);
    process.exit(1);
});

// Error handlers
process.on('unhandledRejection', (error) => {
    console.error(colors.error('Unhandled Rejection:'), error);
});

process.on('uncaughtException', (error) => {
    console.error(colors.error('Uncaught Exception:'), error);
});
