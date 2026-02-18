const express = require('express');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
const User = require('../models/User');
const Social = require('../models/Social');

const router = express.Router();

/**
 * ==========================================
 * OPTIONAL AUTH MIDDLEWARE (internal use)
 * ==========================================
 */
async function optionalAuth(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    return user || null;
  } catch {
    return null;
  }
}

/**
 * ==========================================
 * GET /api/profile/:id?/connections
 * (Public for others, Protected for own)
 * ==========================================
 */
router.get('/:id?/connections', async (req, res) => {
  try {
    const { id } = req.params;
    const requester = await optionalAuth(req);

    let userId = id;
    let isOwner = false;

    if (!userId) {
      if (!requester) return res.status(401).json({ error: 'Authentication required.' });
      userId = requester._id;
      isOwner = true;
    } else if (requester && requester._id.toString() === userId) {
      isOwner = true;
    }

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    let socials = [];

    // 1️⃣ Include OAuth socials (Spotify, Twitch, GitHub, YouTube)
    const oauthSocials = user.socials || {};
    for (const [platform, data] of Object.entries(oauthSocials)) {
      if (data.connected) {
        socials.push({
          platform,
          connected: true,
          username: data.username || '',
          profileUrl: data.profileUrl || ''
        });
      }
    }

    // 2️⃣ Include normal socials (TikTok, Twitter, Instagram, etc.)
    const publicSocials = await Social.find({ user: user._id }).lean();
    publicSocials.forEach(s => {
      socials.push({
        platform: s.platform,
        connected: true,
        username: s.handle,
        profileUrl: s.url
      });
    });

    res.json({ socials });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * ==========================================
 * GET /api/profile
 * GET /api/profile/:id
 * ==========================================
 */
router.get('/:id?', async (req, res) => {
  try {
    const { id } = req.params;
    const requester = await optionalAuth(req);

    let user;

    // ==========================
    // OWN PROFILE (requires login)
    // ==========================
    if (!id) {
      if (!requester) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      user = await User.findById(requester._id).lean();
    }
    // ==========================
    // PUBLIC PROFILE
    // ==========================
    else {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      user = await User.findById(id).lean();
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Serve frontend if browser request
    const acceptsHTML =
      req.headers.accept && req.headers.accept.includes('text/html');

    if (acceptsHTML) {
      return res.sendFile(path.join(__dirname, '../profile/index.html'));
    }

    const isSelf =
      requester && requester._id.toString() === user._id.toString();

    const isAdmin =
      requester && requester.role === 'admin';

    const response = {
      _id: user._id,
      discordUsername: user.discordUsername || '',
      discordTag: user.discordTag || '',
      role: user.role || 'user',
      isVerified: user.isVerified || false,
    };

    // Private fields
    if (isSelf || isAdmin) {
      response.email = user.email || '';
      response.discordUserID = user.discordUserID || '';
    }

    // Public socials
    const socials = await Social.find({ user: user._id }).lean();
    response.socials = socials.map(s => ({
      _id: s._id,
      platform: s.platform,
      handle: s.handle,
      url: s.url,
    }));

    // Discord widget (safe info)
    if (user.discordUserID) {
      const avatarHash = user.discordAvatar || '';
      response.discordWidget = {
        avatar: avatarHash
          ? `https://cdn.discordapp.com/avatars/${user.discordUserID}/${avatarHash}.png`
          : 'https://cdn.discordapp.com/embed/avatars/0.png',
        username: user.discordUsername || '',
        status: user.discordStatus || 'offline',
        activity: user.discordActivity || '',
        badges: user.discordBadges || [],
      };
    }

    res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * ==========================================
 * POST /api/profile/socials/add
 * (Protected)
 * ==========================================
 */
router.post('/socials/add', auth, async (req, res) => {
  try {
    const { platform, handle } = req.body;
    const userId = req.user._id;

    if (!platform || !handle) {
      return res.status(400).json({
        success: false,
        message: 'Platform and handle required'
      });
    }

    let url;
    switch (platform) {
      case 'twitter': url = `https://twitter.com/${handle}`; break;
      case 'instagram': url = `https://instagram.com/${handle}`; break;
      case 'github': url = `https://github.com/${handle}`; break;
      case 'discord': url = `https://discord.com/users/${handle}`; break;
      case 'tiktok': url = `https://www.tiktok.com/@${handle}`; break;
      case 'linkedin': url = `https://linkedin.com/in/${handle}`; break;
      default: url = handle;
    }

    const newSocial = await Social.create({
      user: userId,
      platform,
      handle,
      url
    });

    res.json({ success: true, social: newSocial });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ==========================================
 * DELETE /api/profile/socials/delete/:id
 * (Protected)
 * ==========================================
 */
router.delete('/socials/delete/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const social = await Social.findById(id);
    if (!social)
      return res.status(404).json({ success: false, message: 'Social not found' });

    if (social.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    await social.deleteOne();
    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
