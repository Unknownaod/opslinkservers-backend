const express = require('express');
const auth = require('../middleware/auth'); // your JWT middleware
const User = require('../models/User');
const Social = require('../models/Social'); // socials model
const router = express.Router();

/**
 * GET /api/profile/:id?
 * - No :id → current user
 * - Admins can fetch any user
 * - Normal users fetching others → only public info
 * Returns:
 * {
 *   _id,
 *   discordUsername,
 *   discordTag,
 *   role,
 *   email?, isVerified?, discordUserID?, socials?, discordWidget?
 * }
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

    // Base response
    let response = { _id: user._id };

    const isSelf = requester._id.toString() === user._id.toString();
    const isAdmin = requester.role === 'admin';

    // Fields to include
    if (isAdmin || isSelf) {
      // Full profile for admin or self
      response.email = user.email;
      response.discordUsername = user.discordUsername;
      response.discordTag = user.discordTag;
      response.discordUserID = user.discordUserID;
      response.role = user.role;
      response.isVerified = user.isVerified;
    } else {
      // Public info only
      response.discordUsername = user.discordUsername;
      response.discordTag = user.discordTag;
      response.role = user.role;
    }

    // Fetch socials (public)
    const socials = await Social.find({ user: user._id }).lean();
    response.socials = socials.map(s => ({
      _id: s._id,
      platform: s.platform,
      handle: s.handle,
      url: s.url
    }));

    // Discord widget info (public)
    if (user.discordUserID) {
      response.discordWidget = {
        avatar: user.discordAvatar || `https://cdn.discordapp.com/avatars/${user.discordUserID}/${user.discordAvatar}.png`,
        username: user.discordUsername,
        status: user.discordStatus || 'offline',
        activity: user.discordActivity || '',
        badges: user.discordBadges || []
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
 * - Add a social for the logged-in user
 * Body: { platform, handle }
 */
router.post('/socials/add', auth, async (req, res) => {
  try {
    const { platform, handle } = req.body;
    const userId = req.user._id;

    if (!platform || !handle) return res.status(400).json({ message: 'Platform and handle required' });

    // Generate URL based on platform
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

  } catch(err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/socials/delete/:id
 * - Deletes a social for the logged-in user
 */
router.delete('/socials/delete/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const social = await Social.findById(id);
    if (!social) return res.status(404).json({ message: 'Social not found' });

    // Only owner can delete
    if (social.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    await social.deleteOne();
    res.json({ success: true });

  } catch(err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
