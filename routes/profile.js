const express = require('express');
const auth = require('../middleware/auth'); // JWT middleware
const User = require('../models/User');
const Social = require('../models/Social');
const router = express.Router();

/**
 * GET /api/profile/:id?
 * - No :id → current user
 * - Admins can fetch any user
 * - Normal users fetching others → only public info
 * Response structure matches front-end expectation
 */
router.get('/:id?', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: 'Unauthorized' });

    // Fetch target user
    let user;
    if (!id || id === requester._id.toString()) {
      user = await User.findById(requester._id).lean();
    } else {
      user = await User.findById(id).lean();
    }

    if (!user) return res.status(404).json({ message: 'User not found' });

    const isSelf = requester._id.toString() === user._id.toString();
    const isAdmin = requester.role === 'admin';

    // Base response
    const response = {
      _id: user._id,
      discordUsername: user.discordUsername || '',
      discordTag: user.discordTag || '',
      role: user.role || 'user',
    };

    // Include private info for self/admin
    if (isSelf || isAdmin) {
      response.email = user.email || '';
      response.isVerified = user.isVerified || false;
      response.discordUserID = user.discordUserID || '';
    }

    // Fetch socials (all public)
    const socials = await Social.find({ user: user._id }).lean();
    response.socials = socials.map(s => ({
      _id: s._id,
      platform: s.platform,
      handle: s.handle,
      url: s.url,
    }));

    // Discord widget info
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
 * POST /api/socials/add
 * Body: { platform, handle }
 * Adds a social for logged-in user
 */
router.post('/socials/add', auth, async (req, res) => {
  try {
    const { platform, handle } = req.body;
    const userId = req.user._id;

    if (!platform || !handle) {
      return res.status(400).json({ success: false, message: 'Platform and handle required' });
    }

    // Generate URL
    let url;
    switch(platform) {
      case 'twitter': url = `https://twitter.com/${handle}`; break;
      case 'instagram': url = `https://instagram.com/${handle}`; break;
      case 'github': url = `https://github.com/${handle}`; break;
      case 'discord': url = `https://discord.com/users/${handle}`; break;
      case 'tiktok': url = `https://www.tiktok.com/@${handle}`; break;
      case 'linkedin': url = `https://linkedin.com/in/${handle}`; break;
      default: url = handle;
    }

    const newSocial = await Social.create({ user: userId, platform, handle, url });
    res.json({ success: true, social: newSocial });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/socials/delete/:id
 * Deletes a social for the logged-in user
 */
router.delete('/socials/delete/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const social = await Social.findById(id);
    if (!social) return res.status(404).json({ success: false, message: 'Social not found' });

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
