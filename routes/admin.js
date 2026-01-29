const express = require('express');
const auth = require('../middleware/auth');
const Server = require('../models/Server');
const sendDiscordNotification = require('../utils/discordWebhook');

const router = express.Router();

// Approve a server
router.post('/approve/:id', auth, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).json({ error:'Forbidden' });
  const server = await Server.findByIdAndUpdate(req.params.id,{ status:'approved' }, { new:true });
  if(server) await sendDiscordNotification(`Server approved: **${server.name}**`);
  res.json({ message:'Server approved' });
});

// Deny a server
router.post('/deny/:id', auth, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).json({ error:'Forbidden' });
  const server = await Server.findByIdAndUpdate(req.params.id,{ status:'denied' }, { new:true });
  if(server) await sendDiscordNotification(`Server denied: **${server.name}**`);
  res.json({ message:'Server denied' });
});

module.exports = router;
