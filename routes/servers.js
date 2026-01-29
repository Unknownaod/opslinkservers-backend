const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Server = require('../models/Server');
const Comment = require('../models/Comment');
const sendDiscordNotification = require('../utils/discordWebhook');

const router = express.Router();

// --- Public: Get all approved servers ---
router.get('/', async (req, res) => {
  try {
    const servers = await Server.find({ status: 'approved' }).lean();
    res.json(servers.map(s => ({ ...s, logo: s.logo || null })));
  } catch (err) {
    console.error('Fetch approved servers error:', err);
    res.status(500).json({ error: 'Failed to fetch approved servers' });
  }
});

// --- Admin: Get all servers ---
router.get('/all', auth, adminAuth, async (req, res) => {
  try {
    const servers = await Server.find({}).lean();
    const fullServers = await Promise.all(
      servers.map(async s => {
        const comments = await Comment.find({ server: s._id }).sort({ createdAt: -1 }).lean();
        return {
          ...s,
          comments: comments.map(c => ({
            user: c.userDiscord.username,
            tag: c.userDiscord.tag,
            text: c.text,
            createdAt: c.createdAt
          }))
        };
      })
    );
    res.json(fullServers);
  } catch (err) {
    console.error('Fetch all servers error:', err);
    res.status(500).json({ error: 'Failed to fetch all servers' });
  }
});

// --- Get single server with comments ---
router.get('/:id', async (req, res) => {
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
    console.error('Fetch server error:', err);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// --- Submit server ---
router.post('/', auth, async (req, res) => {
  try {
    const data = req.body;

    // Validate logo
    if (!data.logo || typeof data.logo !== 'string') {
      return res.status(400).json({ error: 'Server logo is required.' });
    }
    const logo = data.logo.trim();
    if (!/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(logo)) {
      return res.status(400).json({ error: 'Logo must be a direct image URL (png, jpg, jpeg, webp, gif, svg).' });
    }

    // Members
    const members = data.members ? Number(data.members) : undefined;

    // Tags
    let tags = [];
    if (data.tags) {
      let incoming = Array.isArray(data.tags) ? data.tags : [data.tags];
      tags = incoming
        .map(t => String(t).trim().toLowerCase())
        .filter(t => t.length >= 2 && t.length <= 24)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 5);
    }

    // Require Discord bot integration
    if (!data.discordServerId) {
      return res.status(400).json({ error: 'You must provide your Discord server ID for bot integration.' });
    }

    const server = new Server({
      name: data.name,
      invite: data.invite,
      description: data.description,
      language: data.language || undefined,
      members: members,
      type: data.type || undefined,
      rules: data.rules || undefined,
      website: data.website || undefined,
      logo: logo,
      nsfw: !!data.nsfw,
      tags: tags,
      discordServerId: data.discordServerId,
      submitter: req.user._id,
      submitterDiscord: {
        username: req.user.discordUsername,
        userID: req.user.discordUserID,
        tag: req.user.discordTag
      },
      status: 'pending',
      editRequests: [] // initialize empty array for future edit requests
    });

    await server.save();

    await sendDiscordNotification(
      `New server submission: **${server.name}** by ${server.submitterDiscord.username}\nInvite: ${server.invite}\nDiscord Server ID: ${server.discordServerId}`
    );

    res.status(201).json({ message: 'Server submitted! Awaiting approval.', server });
  } catch (err) {
    console.error('Submit server error:', err);
    res.status(500).json({ error: 'Submission failed. Please check your input.' });
  }
});

// --- Request server edit (by owner) ---
router.post('/:id/request-edit', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    // Only the owner can request edits
    if (server.submitter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You are not the owner of this server.' });
    }

    const data = req.body;

    // Validate basic required fields
    if (!data.name || !data.description || !data.logo) {
      return res.status(400).json({ error: 'Name, description, and logo are required.' });
    }

    // Validate logo URL
    if (!/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(data.logo)) {
      return res.status(400).json({ error: 'Logo must be a direct image URL.' });
    }

    // Process tags (up to 5, unique, lowercase)
    let tags = [];
    if (data.tags) {
      let incoming = Array.isArray(data.tags) ? data.tags : [data.tags];
      tags = incoming
        .map(t => String(t).trim().toLowerCase())
        .filter(t => t.length >= 2 && t.length <= 24)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 5);
    }

    // Save edit request
    const editRequest = {
      name: data.name,
      description: data.description,
      logo: data.logo,
      website: data.website || undefined,
      language: data.language || undefined,
      members: data.members != null ? Number(data.members) : undefined,
      type: data.type || undefined,
      nsfw: !!data.nsfw,
      tags: tags,
      requestedAt: new Date(),
      approved: null // pending
    };

    if (!server.editRequests) server.editRequests = [];
    server.editRequests.push(editRequest);

    await server.save();

    await sendDiscordNotification(
      `Server edit requested for "${server.name}" by ${req.user.discordUsername}.\nRequested changes: ${JSON.stringify(editRequest, null, 2)}`
    );

    res.status(201).json({ message: 'Edit request submitted! Staff will review it.' });
  } catch (err) {
    console.error('Request edit error:', err);
    res.status(500).json({ error: 'Failed to submit edit request.' });
  }
});

// --- Post comment ---
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server || server.status !== 'approved') return res.status(404).json({ error: 'Server not found or not approved' });

    const comment = new Comment({
      server: server._id,
      user: req.user._id,
      userDiscord: { username: req.user.discordUsername, tag: req.user.discordTag },
      text: req.body.text
    });

    await comment.save();
    res.status(201).json({ message: 'Comment posted', comment });
  } catch (err) {
    console.error('Post comment error:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// --- Update server members count (by bot) ---
router.patch('/:discordServerId/updateMembers', async (req, res) => {
  try {
    const { members } = req.body;
    if (members == null || isNaN(members)) return res.status(400).json({ error: 'Invalid members count.' });

    const server = await Server.findOne({ discordServerId: req.params.discordServerId });
    if (!server) return res.status(404).json({ error: 'Server not found' });

    server.members = Number(members);
    await server.save();

    res.json({ message: 'Members count updated successfully.', members: server.members });
  } catch (err) {
    console.error('Update members error:', err);
    res.status(500).json({ error: 'Failed to update members.' });
  }
});

// --- Update server status ---
router.patch('/:id/status', auth, adminAuth, async (req, res) => {
  const { status, rejectionReason } = req.body;
  if (!['approved', 'denied', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status value' });

  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    server.status = status;
    server.rejectionReason = status === 'denied' && rejectionReason ? rejectionReason : undefined;
    await server.save();

    await sendDiscordNotification(
      `Server "${server.name}" has been ${status.toUpperCase()}${status === 'denied' && rejectionReason ? ` with reason: ${rejectionReason}` : ''}.`
    );

    res.json({ message: `Server ${status} successfully.` });
  } catch (err) {
    console.error('Update server status error:', err);
    res.status(500).json({ error: 'Failed to update server' });
  }
});

// --- Delete a server ---
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    await Comment.deleteMany({ server: server._id });
    await server.deleteOne();

    await sendDiscordNotification(`Server "${server.name}" has been deleted by an admin.`);

    res.json({ message: 'Server deleted successfully.' });
  } catch (err) {
    console.error('Delete server error:', err);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// --- Report a server ---
router.post('/:id/report', auth, async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'You must provide a reason for reporting the server.' });

  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    server.reports.push({ user: req.user._id, reason });
    await server.save();

    await sendDiscordNotification(
      `A server "${server.name}" has been reported by ${req.user.discordUsername} with reason: ${reason}.`
    );

    res.json({ message: 'Server reported successfully. It will be reviewed by an admin.' });
  } catch (err) {
    console.error('Report server error:', err);
    res.status(500).json({ error: 'Failed to report the server' });
  }
});

module.exports = router;
