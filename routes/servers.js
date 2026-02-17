const { ChannelType } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Server = require('../models/Server');
const Comment = require('../models/Comment');
const sendDiscordNotification = require('../utils/discordWebhook');
const User = require('../models/User'); // adjust the path if needed

const router = express.Router();

// ============================
// PUBLIC ROUTES
// ============================

// Get all approved servers
router.get('/', async (req, res) => {
  try {
    const servers = await Server.find({ status: 'approved' }).lean();
    res.json(servers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// ============================
// ADMIN ROUTES
// ============================

// Get all servers (admin)
router.get('/all', auth, adminAuth, async (req, res) => {
  try {
    const servers = await Server.find({}).lean();
    res.json(servers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// ============================
// SERVER SUBMISSION
// ============================

router.post('/', auth, async (req, res) => {
  try {
    const data = req.body;

    if (!data.logo || !/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(data.logo)) {
      return res.status(400).json({ error: 'Valid logo image URL required.' });
    }

    if (!data.discordServerId) {
      return res.status(400).json({ error: 'Discord server ID required.' });
    }

    let tags = [];
    if (data.tags) {
      tags = [...new Set(
        (Array.isArray(data.tags) ? data.tags : [data.tags])
          .map(t => t.toLowerCase().trim())
          .filter(t => t.length >= 2 && t.length <= 24)
      )].slice(0, 5);
    }

    const server = new Server({
      name: data.name,
      invite: data.invite,
      description: data.description,
      language: data.language,
      members: Number(data.members) || 0,
      type: data.type,
      rules: data.rules,
      website: data.website,
      logo: data.logo,
      nsfw: !!data.nsfw,
      tags,
      discordServerId: data.discordServerId,
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
      `🆕 New server submitted: **${server.name}**
Owner: ${req.user.discordUsername}
Invite: ${server.invite}
Discord ID: ${server.discordServerId}`
    );

    res.status(201).json({ message: 'Server submitted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submission failed.' });
  }
});

// ============================
// USER-SPECIFIC ROUTES
// ============================

// Get servers submitted by logged-in user
router.get('/mine', auth, async (req, res) => {
  try {
    const servers = await Server.find({ submitter: req.user._id }).lean();
    res.json(servers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch your servers' });
  }
});

// ============================
// SERVER PARAMETER ROUTES
// ============================

// Update server status (admin)
router.patch('/:id/status', auth, adminAuth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid server ID' });

  const { status, rejectionReason } = req.body;
  if (!['approved', 'denied', 'pending', 'taken-down'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    server.status = status;
    server.rejectionReason = status === 'denied' ? rejectionReason : undefined;
    await server.save();

    await sendDiscordNotification(
      `🛠 Server **${server.name}** status: ${status.toUpperCase()}`
    );

    res.json({ message: 'Status updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Status update failed.' });
  }
});

// Request edit (owner)
router.post('/:id/request-edit', auth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid server ID' });

  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    if (server.submitter.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Not server owner' });

    const changes = req.body.changes || {};
    if (!Object.keys(changes).length) return res.status(400).json({ error: 'No changes submitted.' });

    // sanitize tags
    if (changes.tags) {
      changes.tags = [...new Set(
        (Array.isArray(changes.tags) ? changes.tags : [changes.tags])
          .map(t => t.toLowerCase().trim())
          .filter(t => t.length >= 2 && t.length <= 24)
      )].slice(0, 5);
    }

    server.editRequests.push({
      requestedBy: req.user._id,
      changes
    });

    await server.save();

    await sendDiscordNotification(
      `✏️ Edit request for **${server.name}**\nBy: ${req.user.discordUsername}`
    );

    res.json({ message: 'Edit request submitted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Edit request failed.' });
  }
});

// Approve edit (admin)
router.post('/:id/edit-approve', auth, adminAuth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid server ID' });

  try {
    const { editId } = req.body;
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const edit = server.editRequests.id(editId);
    if (!edit) return res.status(404).json({ error: 'Edit request not found' });

    Object.assign(server, edit.changes);
    edit.deleteOne();
    await server.save();

    await sendDiscordNotification(`✅ Edit approved for **${server.name}**`);
    res.json({ message: 'Edit approved.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Approve failed.' });
  }
});

// Deny edit (admin)
router.post('/:id/edit-deny', auth, adminAuth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid server ID' });

  try {
    const { editId } = req.body;
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const edit = server.editRequests.id(editId);
    if (!edit) return res.status(404).json({ error: 'Edit request not found' });

    edit.deleteOne();
    await server.save();

    await sendDiscordNotification(`❌ Edit denied for **${server.name}**`);
    res.json({ message: 'Edit denied.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Deny failed.' });
  }
});

// Post comment
router.post('/:id/comments', auth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid server ID' });

  try {
    const server = await Server.findById(req.params.id);
    if (!server || server.status !== 'approved') return res.status(404).json({ error: 'Server not found' });

    const comment = new Comment({
      server: server._id,
      user: req.user._id,
      userDiscord: {
        username: req.user.discordUsername,
        tag: req.user.discordTag
      },
      text: req.body.text
    });

    await comment.save();
    res.json({ message: 'Comment posted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Comment failed.' });
  }
});

// Report server
router.post('/:id/report', auth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid server ID' });
  if (!req.body.reason) return res.status(400).json({ error: 'Reason required' });

  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    server.reports.push({
      user: req.user._id,
      reason: req.body.reason
    });

    await server.save();

    await sendDiscordNotification(
      `🚨 Server reported: **${server.name}**
Reason: ${req.body.reason}
By: ${req.user.discordUsername}`
    );

    res.json({ message: 'Report submitted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Report failed.' });
  }
});

// Update member count (bot)
router.patch('/:discordServerId/updateMembers', async (req, res) => {
  try {
    if (isNaN(req.body.members)) return res.status(400).json({ error: 'Invalid members count.' });

    const server = await Server.findOne({ discordServerId: req.params.discordServerId });
    if (!server) return res.status(404).json({ error: 'Server not found' });

    server.members = Number(req.body.members);
    await server.save();

    res.json({ message: 'Members updated.', members: server.members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Member update failed.' });
  }
});

// Delete server (management only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  // ⛔ extra safety: only management can delete
  if (req.user.role !== 'management') {
    return res.status(403).json({ error: 'Access denied. Management only.' });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid server ID' });
  }

  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    await Comment.deleteMany({ server: server._id });
    await server.deleteOne();

    await sendDiscordNotification(`🗑 Server deleted: **${server.name}**`);
    res.json({ message: 'Server deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed.' });
  }
});


// Get single server + comments
router.get('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid server ID' });

  try {
    const server = await Server.findById(req.params.id).lean();
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const comments = await Comment.find({ server: server._id }).sort({ createdAt: -1 }).lean();

    res.json({
      ...server,
      comments: comments.map(c => ({
        user: c.userDiscord.username,
        tag: c.userDiscord.tag,
        text: c.text,
        createdAt: c.createdAt
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});


// ================================
// REVIEW ROUTES
// ================================
router.post('/:id/reviews', auth, async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    // Check if the user already reviewed this server by discordUsername
    const existingReview = server.reviews?.find(r => r.discordUsername === req.user.discordUsername);
    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.comment = comment || '';
      existingReview.createdAt = new Date();
    } else {
      // Add new review
      const newReview = {
        discordUsername: req.user.discordUsername, // store Discord username
        rating,
        comment: comment || '',
        createdAt: new Date()
      };
      server.reviews = server.reviews || [];
      server.reviews.push(newReview);
    }

    await server.save();
    res.json({ message: 'Review submitted', reviews: server.reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ================================
// GET all reviews for a server
// ================================
router.get('/:id/reviews', async (req, res) => {
  try {
    const server = await Server.findById(req.params.id).select('reviews');
    if (!server) return res.status(404).json({ error: 'Server not found' });

    res.json(server.reviews || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------
// GET ROLE OF USER BY DISCORD USERNAME
// ------------------------
router.get('/role/:discordUsername', async (req, res) => {
  try {
    const { discordUsername } = req.params;
    if (!discordUsername) return res.status(400).json({ error: 'Missing Discord username' });

    const username = decodeURIComponent(discordUsername);
    const user = await User.findOne({ discordUsername: username }).select('role');

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ role: user.role });
  } catch (err) {
    console.error('Role fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// routes/servers.js
router.post('/sponsor/:id', async (req, res) => {
  const server = await Server.findById(req.params.id);
  if(!server) return res.status(404).json({error: 'Server not found'});

  server.sponsored = !server.sponsored;
  await server.save();
  res.json({success: true, sponsored: server.sponsored});
});


module.exports = router;









