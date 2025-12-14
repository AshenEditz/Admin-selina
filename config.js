require('dotenv').config();

module.exports = {
    // Connection Method
    CONNECTION_METHOD: process.env.CONNECTION_METHOD || 'PAIRING', // QR or PAIRING
    PHONE_NUMBER: process.env.PHONE_NUMBER || '94726962984', // Your number for pairing
    
    // Bot Settings
    BOT_NAME: process.env.BOT_NAME || '💞Selina-Admin-Bot💞',
    OWNER_NAME: process.env.OWNER_NAME || 'AshenEdtz',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '94726962984',
    PREFIX: '.',
    MODE: 'private',
    
    // AI Settings
    AI_ENABLED: true,
    AI_AUTO_REPLY: true,
    AI_CHAT_MODE: true,
    
    // Links
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029VavLxme5PO0yDv3eUa47',
    CHANNEL_JID: '0029VavLxme5PO0yDv3eUa47@newsletter',
    PROFILE_PIC: 'https://i.imgur.com/WSXTUGI.jpeg',
    
    // Footer
    FOOTER: '💞 Powered by Selina-Admin-Bot 💞\n© AshenEdtz 2024',
    
    // Anti-Ban
    ANTI_BAN: true,
    MSG_DELAY: 1500,
    MAX_MSGS_PER_MINUTE: 15,
    TYPING_DELAY: 2000,
    
    // Session
    AUTO_READ: true,
    AUTO_TYPING: true,
    ALWAYS_ONLINE: true,
    
    // Replit
    KEEP_ALIVE: true,
    PORT: process.env.PORT || 3000,
    
    // AI APIs
    AI_APIS: [
        {
            name: 'GPT-4',
            url: 'https://api.yanzbotz.my.id/api/ai/gpt4',
            method: 'GET',
            params: (text) => ({ query: text })
        },
        {
            name: 'Gemini',
            url: 'https://api.ryzendesu.vip/api/ai/gemini',
            method: 'GET',
            params: (text) => ({ text: text })
        },
        {
            name: 'ChatGPT',
            url: 'https://api.betabotz.eu.org/api/search/openai-chat',
            method: 'GET',
            params: (text) => ({ text: text })
        },
        {
            name: 'Hercai',
            url: 'https://hercai.onrender.com/v3/hercai',
            method: 'GET',
            params: (text) => ({ question: text })
        }
    ]
};
