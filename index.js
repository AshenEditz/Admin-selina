const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    getContentType,
    Browsers
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const chalk = require("chalk");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const moment = require("moment-timezone");
const config = require("./config");
const { getAIResponse, chatWithAI } = require("./lib/ai");
const { sleep, formatTime, getUptime, formatBytes } = require("./lib/functions");
const keepAlive = require("./keep_alive");

// Start keep-alive server for Replit
if (config.KEEP_ALIVE) {
    keepAlive();
}

// Global variables
let startTime = Date.now();
const messageTracker = new Map();

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
    
    if (tracker.count > config.MAX_MSGS_PER_MINUTE) {
        return false;
    }
    
    return true;
}

// Main connection
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS("Desktop"),
        version,
        keepAliveIntervalMs: 50000,
        markOnlineOnConnect: config.ALWAYS_ONLINE,
        getMessage: async (key) => {
            return { conversation: "Hi" };
        }
    });

    const store = makeInMemoryStore({
        logger: pino().child({ level: "silent", stream: "store" })
    });
    store.bind(conn.ev);

    // Pairing/QR
    if (!conn.authState.creds.registered) {
        console.log(chalk.bgMagenta.white('\n╔═══════════════════════════════╗'));
        console.log(chalk.bgMagenta.white('║  💞 SELINA-ADMIN-BOT 💞      ║'));
        console.log(chalk.bgMagenta.white('╚═══════════════════════════════╝\n'));
        
        console.log(chalk.cyan('📱 Choose Connection Method:\n'));
        console.log(chalk.green('  [1] QR Code (Scan with WhatsApp)'));
        console.log(chalk.green('  [2] Pairing Code (Enter number)\n'));

        const readline = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question(chalk.yellow('Choose (1 or 2): '), async (choice) => {
            if (choice.trim() === "2") {
                readline.question(chalk.yellow('Enter phone (e.g., 94726962984): '), async (phone) => {
                    try {
                        const code = await conn.requestPairingCode(phone.trim());
                        console.log(chalk.bgGreen.black(`\n✅ Pairing Code: ${code}\n`));
                    } catch (err) {
                        console.log(chalk.red('❌ Error:', err.message));
                    }
                    readline.close();
                });
            } else {
                console.log(chalk.yellow('\n📱 Scan QR Code:\n'));
                readline.close();
            }
        });
    }

    // Connection updates
    conn.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log(chalk.green('\n✅ CONNECTED!\n'));
            console.log(chalk.cyan(`🤖 ${config.BOT_NAME}`));
            console.log(chalk.cyan(`👤 ${config.OWNER_NAME}`));
            console.log(chalk.cyan(`🧠 AI: ${config.AI_AUTO_REPLY ? 'ON' : 'OFF'}\n`));
            
            // Set profile picture
            try {
                const ppBuff = await axios.get(config.PROFILE_PIC, { responseType: 'arraybuffer' });
                await conn.updateProfilePicture(conn.user.id, Buffer.from(ppBuff.data));
            } catch {}
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 3000);
            }
        }
    });

    conn.ev.on("creds.update", saveCreds);

    // Message handler
    conn.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

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
            const isCmd = body.startsWith(config.PREFIX);
            const command = isCmd ? body.slice(config.PREFIX.length).trim().split(" ")[0].toLowerCase() : "";
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(" ");

            if (!checkRateLimit(from)) return;
            if (config.ANTI_BAN) await sleep(config.MSG_DELAY);
            if (config.AUTO_TYPING) await conn.sendPresenceUpdate('composing', from);
            if (config.AUTO_READ) await conn.readMessages([mek.key]);

            // Quoted message
            const getQuoted = async () => {
                try {
                    const thumbBuff = await axios.get(config.PROFILE_PIC, { responseType: 'arraybuffer' });
                    return {
                        key: {
                            remoteJid: config.CHANNEL_JID,
                            fromMe: false,
                            id: 'SEL' + Math.random().toString(36).substr(2, 9),
                            participant: '0@s.whatsapp.net'
                        },
                        message: {
                            groupInviteMessage: {
                                groupJid: config.CHANNEL_JID,
                                inviteCode: "Selina2024",
                                groupName: "💞 Selina 💞",
                                caption: "Join",
                                jpegThumbnail: Buffer.from(thumbBuff.data)
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
                return await conn.sendMessage(from, {
                    text: `${config.BOT_NAME}\n\n${text}\n\n${config.FOOTER}`,
                    contextInfo: {
                        mentionedJid: [sender],
                        externalAdReply: {
                            title: config.BOT_NAME,
                            body: config.OWNER_NAME,
                            thumbnailUrl: config.PROFILE_PIC,
                            sourceUrl: config.CHANNEL_LINK,
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                }, { quoted });
            };

            const replyImg = async (img, caption) => {
                return await conn.sendMessage(from, {
                    image: { url: img },
                    caption: `${config.BOT_NAME}\n\n${caption}\n\n${config.FOOTER}`
                }, { quoted });
            };

            console.log(chalk.blue(`[${formatTime()}] ${pushname}: ${body}`));

            // Commands
            switch (command) {
                case "menu":
                case "help":
                    const menu = `╭━━━『 💞 MENU 💞 』━━━╮
┃
┃ 👋 Hi ${pushname}!
┃
┃ 🤖 ${config.BOT_NAME}
┃ 👤 ${config.OWNER_NAME}
┃ ⚡ ${config.PREFIX}
┃ 🧠 AI: ${config.AI_AUTO_REPLY ? 'ON ✅' : 'OFF'}
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━『 🏠 MAIN 』━━━╮
┃ ${config.PREFIX}menu
┃ ${config.PREFIX}ping
┃ ${config.PREFIX}alive
┃ ${config.PREFIX}owner
┃ ${config.PREFIX}channel
┃ ${config.PREFIX}status
╰━━━━━━━━━━━━━━━╯

╭━━━『 🧠 AI 』━━━╮
┃ ${config.PREFIX}ai <text>
┃ ${config.PREFIX}chat <text>
┃ 
┃ 💡 Just chat with me!
╰━━━━━━━━━━━━━━━╯

╭━━━『 🎮 FUN 』━━━╮
┃ ${config.PREFIX}joke
┃ ${config.PREFIX}quote
┃ ${config.PREFIX}fact
┃ ${config.PREFIX}advice
╰━━━━━━━━━━━━━━━╯

📢 ${config.CHANNEL_LINK}`;
                    await replyImg(config.PROFILE_PIC, menu);
                    break;

                case "ping":
                    const start = Date.now();
                    const pm = await reply("⚡ Pinging...");
                    const end = Date.now();
                    await conn.sendMessage(from, {
                        text: `${config.BOT_NAME}\n\n🏓 Pong!\n⚡ ${end - start}ms\n\n${config.FOOTER}`,
                        edit: pm.key
                    });
                    break;

                case "alive":
                    await replyImg(config.PROFILE_PIC, `✅ I'm Alive!\n\n⏱️ Uptime: ${getUptime(startTime)}\n🧠 AI: Active\n📡 Status: Online 24/7`);
                    break;

                case "ai":
                case "chat":
                    if (!q) return reply("❌ Provide text!\n\nExample: .ai Hello");
                    await conn.sendPresenceUpdate('composing', from);
                    await sleep(config.TYPING_DELAY);
                    const aiRes = await chatWithAI(q, senderNum);
                    await reply(`🧠 AI:\n\n${aiRes}`);
                    break;

                case "owner":
                    await conn.sendMessage(from, {
                        contact: {
                            displayName: config.OWNER_NAME,
                            contacts: [{
                                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${config.OWNER_NAME}\nTEL;waid=${config.OWNER_NUMBER}:+${config.OWNER_NUMBER}\nEND:VCARD`
                            }]
                        }
                    }, { quoted });
                    await reply(`👤 Owner: ${config.OWNER_NAME}\n📞 +${config.OWNER_NUMBER}`);
                    break;

                case "channel":
                    await reply(`📢 Join Channel!\n\n${config.CHANNEL_LINK}\n\nStay updated! 🚀`);
                    break;

                case "status":
                    await reply(`📊 Status:\n\n⏱️ Uptime: ${getUptime(startTime)}\n💾 Memory: ${formatBytes(process.memoryUsage().heapUsed)}\n🧠 AI: ${config.AI_AUTO_REPLY ? 'Active' : 'Inactive'}\n📡 Platform: Replit\n✅ Status: Online 24/7`);
                    break;

                case "joke":
                    try {
                        const j = await axios.get('https://official-joke-api.appspot.com/random_joke');
                        await reply(`😂 ${j.data.setup}\n\n${j.data.punchline} 🤣`);
                    } catch { await reply("❌ Error fetching joke!"); }
                    break;

                case "quote":
                    try {
                        const qo = await axios.get('https://api.quotable.io/random');
                        await reply(`💭 "${qo.data.content}"\n\n— ${qo.data.author}`);
                    } catch { await reply("❌ Error!"); }
                    break;

                case "fact":
                    try {
                        const f = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
                        await reply(`🎲 ${f.data.text}`);
                    } catch { await reply("❌ Error!"); }
                    break;

                case "advice":
                    try {
                        const a = await axios.get('https://api.adviceslip.com/advice');
                        await reply(`🌟 ${a.data.slip.advice}`);
                    } catch { await reply("❌ Error!"); }
                    break;

                default:
                    // Auto AI
                    if (config.AI_AUTO_REPLY && !isCmd && body.length > 1) {
                        await conn.sendPresenceUpdate('composing', from);
                        await sleep(config.TYPING_DELAY);
                        const autoAi = await chatWithAI(body, senderNum);
                        await reply(autoAi);
                    }
                    break;
            }

            if (config.AUTO_TYPING) {
                await conn.sendPresenceUpdate('paused', from);
            }

        } catch (err) {
            console.error(chalk.red("[ERROR]"), err);
        }
    });

    return conn;
}

console.log(chalk.bgMagenta.white(`
╔════════════════════════════════╗
║   💞 SELINA-ADMIN-BOT 💞      ║
║   Replit Edition - 24/7        ║
╚════════════════════════════════╝
`));

connectToWhatsApp().catch(console.error);
