const axios = require("axios");
const config = require("../config");

const conversationContext = new Map();

async function getAIResponse(text) {
    for (const api of config.AI_APIS) {
        try {
            let response;
            
            if (api.method === 'POST') {
                response = await axios.post(api.url, api.params(text), { 
                    timeout: 15000,
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                response = await axios.get(api.url, { 
                    params: api.params(text), 
                    timeout: 15000 
                });
            }

            const aiReply = response.data?.result || 
                           response.data?.response || 
                           response.data?.message || 
                           response.data?.reply || 
                           response.data?.answer ||
                           response.data?.data?.response;

            if (aiReply && typeof aiReply === 'string' && aiReply.length > 0) {
                console.log(`✅ AI (${api.name}): OK`);
                return aiReply.trim();
            }
        } catch (error) {
            console.log(`❌ AI (${api.name}): Failed`);
            continue;
        }
    }
    
    return "I'm experiencing technical difficulties. Please try again! 😊";
}

async function chatWithAI(text, userId) {
    let context = conversationContext.get(userId) || [];
    context.push({ role: 'user', content: text });
    
    if (context.length > 10) {
        context = context.slice(-10);
    }
    
    const aiResponse = await getAIResponse(text);
    context.push({ role: 'assistant', content: aiResponse });
    conversationContext.set(userId, context);
    
    setTimeout(() => conversationContext.delete(userId), 3600000);
    
    return aiResponse;
}

module.exports = { getAIResponse, chatWithAI };
