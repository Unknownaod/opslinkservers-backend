const express = require('express');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const User = require('../models/User');
const Social = require('../models/Social');

const router = express.Router();

/**
 * ==========================================
 * GET /api/profile/connections
 * Returns OAuth-connected platforms
 * ==========================================
 */
router.get('/connections', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // If you store OAuth socials inside user.socials object
    const socialsObject = user.socials || {};

    const socials = Object.entries(socialsObject).map(([platform, data]) => ({
      platform,
      connected: data.connected || false,
      username: data.username || '',
      profileUrl: data.profileUrl || ''
    }));

    res.json({ socials });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


/**
 * ==========================================
 * GET /api/profile/:id?
 * ==========================================
 */
router.get('/:id?', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: 'Unauthorized' });

    let user;

    // If no ID → current user
    if (!id) {
      user = await User.findById(requester._id).lean();
    } else {
      // Prevent "connections" or invalid IDs from crashing
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      user = await User.findById(id).lean();
    }

    if (!user) return res.status(404).json({ message: 'User not found' });

    const isSelf = requester._id.toString() === user._id.toString();
    const isAdmin = requester.role === 'admin';

    const response = {
      _id: user._id,
      discordUsername: user.discordUsername || '',
      discordTag: user.discordTag || '',
      role: user.role || 'user',
    };

    if (isSelf || isAdmin) {
      response.email = user.email || '';
      response.isVerified = user.isVerified || false;
      response.discordUserID = user.discordUserID || '';
    }

    // Manual socials collection
    const socials = await Social.find({ user: user._id }).lean();
    response.socials = socials.map(s => ({
      _id: s._id,
      platform: s.platform,
      handle: s.handle,
      url: s.url,
    }));

    // Discord widget
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

/**
 * ==========================================
 * DELETE /api/profile/connections/:platform
 * Completely removes a connected social
 * ==========================================
 */
router.delete('/connections/:platform', auth, async (req, res) => {
  try {
    const { platform } = req.params;
    const userId = req.user._id;

    if (!platform) {
      return res.status(400).json({ success: false, message: 'Platform required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.socials || !user.socials[platform]) {
      return res.status(404).json({ success: false, message: 'Platform not connected' });
    }

    const social = user.socials[platform];
    if (platform === 'spotify' && social.accessToken) {
      await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(
            process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
          ).toString('base64')
        },
        body: new URLSearchParams({
          token: social.accessToken
        })
      }).catch(() => {});
    }


    // 🔥 Completely remove the platform object
    user.socials.set(platform, undefined);
    delete user.socials[platform];

    // VERY IMPORTANT for nested objects
    user.markModified('socials');

    await user.save();

    return res.json({
      success: true,
      message: `${platform} fully disconnected`,
      socials: user.socials
    });

  } catch (err) {
    console.error('Disconnect error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});



module.exports = router;
