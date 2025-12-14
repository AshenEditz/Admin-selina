const express = require('express');
const config = require('./config');

function keepAlive() {
    const app = express();
    
    // Health check endpoint
    app.get('/', (req, res) => {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>${config.BOT_NAME}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
            border: 1px solid rgba(255, 255, 255, 0.18);
            max-width: 600px;
            animation: fadeIn 0.5s ease-in;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        h1 {
            font-size: 2.5em;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .status {
            display: inline-block;
            padding: 10px 20px;
            background: #4CAF50;
            border-radius: 50px;
            margin: 20px 0;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        .info {
            margin: 20px 0;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            line-height: 1.8;
        }
        .info-item {
            margin: 10px 0;
            font-size: 1.1em;
        }
        .info-item strong {
            color: #ffd700;
        }
        a {
            color: #ffd700;
            text-decoration: none;
            transition: all 0.3s;
        }
        a:hover {
            color: #ffed4e;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }
        .footer {
            margin-top: 30px;
            font-size: 0.9em;
            opacity: 0.8;
        }
        .emoji {
            font-size: 3em;
            margin: 20px 0;
            animation: bounce 1s infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="emoji">💞</div>
        <h1>${config.BOT_NAME}</h1>
        <div class="status">✅ ONLINE 24/7</div>
        
        <div class="info">
            <div class="info-item">
                <strong>🤖 Bot Name:</strong> ${config.BOT_NAME}
            </div>
            <div class="info-item">
                <strong>👤 Owner:</strong> ${config.OWNER_NAME}
            </div>
            <div class="info-item">
                <strong>🧠 AI Mode:</strong> ${config.AI_AUTO_REPLY ? 'Active ✅' : 'Inactive ❌'}
            </div>
            <div class="info-item">
                <strong>📱 Platform:</strong> WhatsApp
            </div>
            <div class="info-item">
                <strong>⚡ Status:</strong> Running on Replit
            </div>
            <div class="info-item">
                <strong>🕐 Uptime:</strong> ${process.uptime().toFixed(0)}s
            </div>
        </div>

        <div style="margin: 20px 0;">
            <a href="${config.CHANNEL_LINK}" target="_blank">
                📢 Join Our Channel
            </a>
        </div>

        <div class="footer">
            ${config.FOOTER}
        </div>
    </div>
</body>
</html>
        `);
    });

    // Status endpoint
    app.get('/status', (req, res) => {
        res.json({
            status: 'online',
            bot: config.BOT_NAME,
            owner: config.OWNER_NAME,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    });

    // Ping endpoint
    app.get('/ping', (req, res) => {
        res.send('pong');
    });

    const PORT = config.PORT || 3000;
    
    app.listen(PORT, () => {
        console.log(`🌐 Server is running on port ${PORT}`);
        console.log(`🔗 https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
    });
}

module.exports = keepAlive;
