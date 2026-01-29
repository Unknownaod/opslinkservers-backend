const axios = require('axios');

async function sendDiscordNotification(message){
  if(!process.env.DISCORD_WEBHOOK) return;
  try {
    await axios.post(process.env.DISCORD_WEBHOOK, { content: message });
  } catch(err){
    console.error('Discord webhook error:', err.message);
  }
}

module.exports = sendDiscordNotification;
