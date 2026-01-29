const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth'); // We'll create this middleware below
const Server = require('../models/Server');
const Comment = require('../models/Comment');
const sendDiscordNotification = require('../utils/discordWebhook');

const router = express.Router();

// Get all approved servers (public)
router.get('/', async (req,res)=>{
  const servers = await Server.find({ status:'approved' });
  res.json(servers);
});

// Admin: Get all servers (pending, approved, denied)
router.get('/all', auth, adminAuth, async (req,res) => {
  try {
    const servers = await Server.find({});
    res.json(servers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get single server with comments
router.get('/:id', async (req,res)=>{
  const server = await Server.findById(req.params.id);
  if(!server) return res.status(404).json({ error:'Server not found' });

  const comments = await Comment.find({ server: server._id }).sort({ createdAt:-1 });
  res.json({...server.toObject(), comments: comments.map(c=>({user:c.userDiscord.username, text:c.text}))});
});

// Submit server (requires login)
router.post('/', auth, async (req,res)=>{
  const data = req.body;
  try {
    const server = new Server({
      ...data,
      tags: data.tags || [],
      nsfw: data.nsfw || false,
      submitter: req.user._id,
      submitterDiscord: {
        username: req.user.discordUsername,
        userID: req.user.discordUserID,
        tag: req.user.discordTag
      },
      status: 'pending'
    });
    await server.save();

    await sendDiscordNotification(
      `New server submission: **${server.name}** by ${server.submitterDiscord.username}\nInvite: ${server.invite}`
    );

    res.status(201).json({ message:'Server submitted! Awaiting approval.' });
  } catch(err){
    console.error(err);
    res.status(500).json({ error:'Submission failed' });
  }
});

// Post a comment (requires login)
router.post('/:id/comments', auth, async (req,res)=>{
  const server = await Server.findById(req.params.id);
  if(!server || server.status !== 'approved') return res.status(404).json({ error:'Server not found' });

  const comment = new Comment({
    server: server._id,
    user: req.user._id,
    userDiscord: { username:req.user.discordUsername, tag:req.user.discordTag },
    text: req.body.text
  });

  await comment.save();
  res.status(201).json({ message:'Comment posted' });
});

// Admin: PATCH update server status (approve/deny)
router.patch('/:id/status', auth, adminAuth, async (req,res) => {
  const { status, rejectionReason } = req.body;
  if (!['approved', 'denied', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    server.status = status;
    if (status === 'denied' && rejectionReason) {
      server.rejectionReason = rejectionReason;
    } else {
      server.rejectionReason = undefined;
    }
    await server.save();

    // Optional: Notify user via Discord webhook about status change
    await sendDiscordNotification(
      `Server "${server.name}" has been ${status.toUpperCase()}${status === 'denied' && rejectionReason ? ` with reason: ${rejectionReason}` : ''}.`
    );

    res.json({ message: `Server ${status} successfully.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update server status' });
  }
});

module.exports = router;
