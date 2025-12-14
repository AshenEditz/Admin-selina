module.exports = {
    // Bot Settings
    BOT_NAME: '💞Selina-Admin-Bot💞',
    OWNER_NAME: 'AshenEdtz',
    OWNER_NUMBER: '94726962984',
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
    SESSION_ID: 'SELINA_SESSION',
    AUTO_READ: true,
    AUTO_TYPING: true,
    ALWAYS_ONLINE: true,
    
    // Replit Keep Alive
    KEEP_ALIVE: true,
    PORT: 3000,
    
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
        },
        {
            name: 'SimSimi',
            url: 'https://api.simsimi.vn/v2/simtalk',
            method: 'POST',
            params: (text) => ({ text: text, lc: 'en' })
        }
    ]
};
