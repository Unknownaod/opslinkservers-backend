const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Server = require('../models/Server');
const Comment = require('../models/Comment');
const sendDiscordNotification = require('../utils/discordWebhook');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// --- Multer setup for logo uploads ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/logos';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed (png, jpg, jpeg, gif).'));
  }
});

// --- Public: Get all approved servers ---
router.get('/', async (req, res) => {
  try {
    const servers = await Server.find({ status: 'approved' })
      .select('name invite description type members logo tags');
    res.json(servers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch approved servers' });
  }
});

// --- Admin: Get all servers ---
router.get('/all', auth, adminAuth, async (req, res) => {
  try {
    const servers = await Server.find({})
      .select('name invite status submitter logo tags');
    res.json(servers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch all servers' });
  }
});

// --- Get single server with comments ---
router.get('/:id', async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const comments = await Comment.find({ server: server._id }).sort({ createdAt: -1 });
    res.json({
      ...server.toObject(),
      comments: comments.map(c => ({ user: c.userDiscord.username, text: c.text }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// --- Submit server (requires login) ---
router.post('/', auth, upload.single('logo'), async (req, res) => {
  try {
    const data = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Server logo is required.' });
    }

    const tags = data.tags && Array.isArray(data.tags) ? data.tags.slice(0, 5) : [];

    const server = new Server({
      ...data,
      logo: req.file.path, // save logo path
      tags: tags,
      nsfw: data.nsfw === 'true' || false,
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

    res.status(201).json({ message: 'Server submitted! Awaiting approval.', server });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submission failed' });
  }
});

// --- Post a comment (requires login) ---
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
    res.status(201).json({ message: 'Comment posted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// --- Admin: Update server status ---
router.patch('/:id/status', auth, adminAuth, async (req, res) => {
  const { status, rejectionReason } = req.body;
  if (!['approved', 'denied', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
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
    console.error(err);
    res.status(500).json({ error: 'Failed to update server status' });
  }
});

// --- Admin: Delete a server ---
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    await Comment.deleteMany({ server: server._id });
    await server.deleteOne();

    await sendDiscordNotification(
      `Server "${server.name}" has been deleted by an admin.`
    );

    res.json({ message: 'Server deleted successfully.' });
  } catch (err) {
    console.error(err);
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
    console.error(err);
    res.status(500).json({ error: 'Failed to report the server' });
  }
});

module.exports = router;
