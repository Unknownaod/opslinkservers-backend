const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Server = require('../models/Server');
const auth = require('../middleware/auth');
const { sendEmail } = require('../utils/sendEmail');
const bcrypt = require('bcrypt');

const router = express.Router();
const logoURL = "https://cdn.discordapp.com/attachments/1463619235904229378/1466802083834368184/FuwELkz.png?ex=69889d64&is=69874be4&hm=d91b7dc2a57a579671ead07b48c9dcf31f17984940c54ac8029b4bf571283396";

// Helper to generate sleek email HTML
const generateEmailHTML = (title, message, buttonText, buttonURL) => `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0a0a; color: #fff; padding: 40px 0;">
    <div style="max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden; background: linear-gradient(145deg, #1b1b1b, #0a0a0a); box-shadow: 0 8px 25px rgba(0,0,0,0.5); border: 1px solid #222;">
      <!-- Header -->
      <div style="background: linear-gradient(90deg, #111, #222); padding: 20px; text-align: center;">
        <img src="${logoURL}" alt="OpsLink Logo" style="max-width: 150px;" />
      </div>

      <!-- Body -->
      <div style="padding: 30px 25px; line-height: 1.6; font-size: 16px;">
        <h2 style="font-size: 24px; margin-bottom: 20px; color: #f1f1f1;">${title}</h2>
        <p style="color: #ccc; margin-bottom: 30px;">${message}</p>
        <a href="${buttonURL}" style="display:inline-block; padding:12px 25px; background: linear-gradient(90deg,#4f46e5,#6366f1); color:#fff; text-decoration:none; border-radius:8px; font-weight:bold; transition: all 0.3s ease;">
          ${buttonText}
        </a>
      </div>

      <!-- Footer -->
      <div style="background: #111; padding: 15px 25px; font-size: 12px; color: #666; text-align: center;">
        OpsLink &copy; ${new Date().getFullYear()}. All rights reserved.
      </div>
    </div>
  </div>
`;

// =======================
// Signup
// =======================
router.post('/signup', async (req, res) => {
  const { email, password, discordUsername, discordUserID, discordTag } = req.body;

  if (!email || !password || !discordUsername || !discordUserID) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser)
      return res.status(400).json({ error: 'Email already exists' });

    const existingDiscordUser = await User.findOne({ discordUsername });
    if (existingDiscordUser)
      return res.status(400).json({ error: 'Discord username already exists' });

    const existingDiscordID = await User.findOne({ discordUserID });
    if (existingDiscordID)
      return res.status(400).json({ error: 'Discord ID already exists' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    const user = new User({
      email,
      password,
      discordUsername,
      discordUserID,
      discordTag,
      isVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    await user.save();

    const verifyURL = `https://opslinkservers-backend.onrender.com/api/auth/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: email,
      subject: 'Verify Your OpsLink Account',
      html: generateEmailHTML(
        "Welcome to OpsLink",
        "Please verify your email by clicking the button below:",
        "Verify Email",
        verifyURL
      )
    });

    res.status(201).json({ message: 'Account created', redirect: '/verify.html', email });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Login
// =======================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    if (!user.isVerified)
      return res.status(403).json({ error: 'Please verify your email before logging in' });

    // === PREMIUM CHECK ONLY FOR SPECIFIC DOMAIN ===
    const allowedDomain = 'https://dash.opslinksystems.xyz';
    const referer = req.get('Referer'); // Check if the request is coming from the allowed domain

    if (referer && referer.startsWith(allowedDomain)) {
      if (!user.isPremium) {
        return res.status(403).json({ error: 'You must be a premium user to log in here' });
      }
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      token,
      user: {
        email: user.email,
        discordUsername: user.discordUsername,
        role: user.role,
        isPremium: user.isPremium  // include this if frontend wants to know
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// =======================
// Resend Verification Email
// =======================
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.isVerified) return res.status(400).json({ error: 'Email already verified' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    const verifyURL = `https://opslinkservers-backend.onrender.com/api/auth/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify Your OpsLink Account',
      html: generateEmailHTML(
        "Email Verification",
        "Please verify your email by clicking the button below:",
        "Verify Email",
        verifyURL
      )
    });

    res.json({ success: true, message: 'Verification email resent' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Change Email (Before Verification)
// =======================
router.post('/change-email', async (req, res) => {
  const { oldEmail, newEmail } = req.body;

  if (!oldEmail || !newEmail)
    return res.status(400).json({ error: 'Both emails required' });

  try {
    const user = await User.findOne({ email: oldEmail });

    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.isVerified)
      return res.status(400).json({ error: 'Email already verified' });

    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists)
      return res.status(400).json({ error: 'Email already in use' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    user.email = newEmail;
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    const verifyURL = `https://opslinkservers-backend.onrender.com/api/auth/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: newEmail,
      subject: 'Verify Your OpsLink Account',
      html: generateEmailHTML(
        "Email Updated",
        "Please verify your new email by clicking the button below:",
        "Verify Email",
        verifyURL
      )
    });

    res.json({ success: true, message: 'Email updated and verification resent' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Verify Email Token
// =======================
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect(`${process.env.FRONTEND_URL}/verify-failed.html`);

  try {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/verify-failed.html`);
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    res.redirect(`${process.env.FRONTEND_URL}/verified.html`);

  } catch (err) {
    console.error(err);
    res.redirect(`${process.env.FRONTEND_URL}/verify-failed.html`);
  }
});


// =======================
// Forgot Password
// =======================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Account not found' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    const resetURL = `${process.env.FRONTEND_URL}/reset.html?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: 'OpsLink Password Reset',
      html: generateEmailHTML(
        "Reset Your Password",
        "Click the button below to reset your password. This link expires in 1 hour.",
        "Reset Password",
        resetURL
      )
    });

    res.json({ success: true, message: 'Password reset email sent', redirect: '/passwordverify.html' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Verify Reset Token
// =======================
router.get('/reset-password', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token missing' });

  try {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    res.json({ success: true, email: user.email });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// =======================
// Reset Password
// =======================
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password required' });
  }

  try {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Set new password (pre-save hook will hash it)
    user.password = newPassword;

    // Clear reset token
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Increment tokenVersion to invalidate old sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Change Discord Username
// =======================
router.post('/change-username', auth, async (req, res) => {
  const { newDiscordUsername } = req.body;

  if (!newDiscordUsername) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if the new username is already taken
    const existingUser = await User.findOne({ discordUsername: newDiscordUsername });
    if (existingUser) {
      return res.status(400).json({ error: 'Discord username already exists' });
    }

    // Update user's Discord username
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const oldUsername = user.discordUsername;
    user.discordUsername = newDiscordUsername;
    await user.save();

    // Update submitterDiscord in all servers submitted by this user
    await Server.updateMany(
      { 'submitter': user._id },
      {
        $set: {
          'submitterDiscord.username': newDiscordUsername
        }
      }
    );

    res.status(200).json({
      message: 'Discord username updated successfully',
      discordUsername: newDiscordUsername
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// =======================
// Social Connections Routes
// =======================
const fetch = require('node-fetch');
const querystring = require('querystring');

// =======================
// OAuth Config
// =======================
const OAUTH_CONFIG = {
  spotify: {
    client_id: process.env.SPOTIFY_CLIENT_ID,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    scope: 'user-read-email',
    auth_url: 'https://accounts.spotify.com/authorize',
    token_url: 'https://accounts.spotify.com/api/token',
    profile_url: 'https://api.spotify.com/v1/me'
  },
  github: {
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
    scope: 'read:user user:email',
    auth_url: 'https://github.com/login/oauth/authorize',
    token_url: 'https://github.com/login/oauth/access_token',
    profile_url: 'https://api.github.com/user'
  },
  twitch: {
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    redirect_uri: process.env.TWITCH_REDIRECT_URI,
    scope: 'user:read:email',
    auth_url: 'https://id.twitch.tv/oauth2/authorize',
    token_url: 'https://id.twitch.tv/oauth2/token',
    profile_url: 'https://api.twitch.tv/helix/users'
  },
  youtube: {
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    profile_url: 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json'
  }
};

// =======================
// GET connected socials
// =======================
router.get('/connections', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const user = await User.findById(decoded._id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const socials = Object.entries(user.socials || {}).map(([platform, data]) => ({
    platform,
    connected: data.connected,
    username: data.username,
    profileUrl: data.profileUrl
  }));

  res.json({ socials });
});

// =======================
// OAuth Start
// =======================
router.get('/connect/:platform', (req, res) => {
  const { platform } = req.params;
  const { token } = req.query;

  if (!token) return res.status(401).send('Unauthorized');

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).send('Invalid token');
  }

  const cfg = OAUTH_CONFIG[platform];
  if (!cfg) return res.status(400).send('Invalid platform');

  const params = querystring.stringify({
    client_id: cfg.client_id,
    response_type: 'code',
    redirect_uri: cfg.redirect_uri,
    scope: cfg.scope,
    state: token // pass JWT through OAuth
  });

  res.redirect(`${cfg.auth_url}?${params}`);
});

// =======================
// OAuth Callback
// =======================
router.get('/connect/callback/:platform', async (req, res) => {
  const { platform } = req.params;
  const { code, state } = req.query;

  if (!state) return res.status(401).send('Unauthorized');

  // Decode JWT from state
  let decoded;
  try {
    decoded = jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return res.status(401).send('Invalid token');
  }

  // Support both old and new JWT payloads
  const userId = decoded.id || decoded._id;
  const user = await User.findById(userId);
  if (!user) return res.status(404).send('User not found');

  const cfg = OAUTH_CONFIG[platform];
  if (!cfg || !code) return res.status(400).send('Invalid request');

  try {
    let tokenData, username, profileUrl;

    // ===== Spotify =====
    if (platform === 'spotify') {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: cfg.redirect_uri,
        client_id: cfg.client_id,
        client_secret: cfg.client_secret
      });

      const tokenRes = await fetch(cfg.token_url, { method: 'POST', body });
      tokenData = await tokenRes.json();

      const profile = await fetch(cfg.profile_url, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      }).then(r => r.json());

      username = profile.display_name || profile.id;
      profileUrl = profile.external_urls.spotify;
    }

// ===== GitHub =====
if (platform === 'github') {
  // Use URLSearchParams for x-www-form-urlencoded body
  const body = new URLSearchParams({
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    code
  });

  const tokenRes = await fetch(cfg.token_url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error('GitHub did not return an access token');
  }

  const profile = await fetch(cfg.profile_url, {
    headers: { Authorization: `token ${tokenData.access_token}` }
  }).then(r => r.json());

  username = profile.login;
  profileUrl = profile.html_url;
}

    // ===== Twitch =====
    if (platform === 'twitch') {
      const tokenRes = await fetch(
        `${cfg.token_url}?client_id=${cfg.client_id}&client_secret=${cfg.client_secret}&code=${code}&grant_type=authorization_code&redirect_uri=${cfg.redirect_uri}`,
        { method: 'POST' }
      );
      tokenData = await tokenRes.json();

      const profile = await fetch(cfg.profile_url, {
        headers: {
          'Client-ID': cfg.client_id,
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }).then(r => r.json());

      username = profile.data[0].display_name;
      profileUrl = `https://twitch.tv/${profile.data[0].login}`;
    }

    // ===== YouTube =====
    if (platform === 'youtube') {
      const body = new URLSearchParams({
        code,
        client_id: cfg.client_id,
        client_secret: cfg.client_secret,
        redirect_uri: cfg.redirect_uri,
        grant_type: 'authorization_code'
      });

      const tokenRes = await fetch(cfg.token_url, { method: 'POST', body });
      tokenData = await tokenRes.json();

      const profile = await fetch(cfg.profile_url, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      }).then(r => r.json());

      username = profile.name;
      profileUrl = `https://youtube.com`;
    }

    // ===== Save Social Connection =====
    user.socials = user.socials || {};
    user.socials[platform] = {
      connected: true,
      username,
      profileUrl,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token
    };
    await user.save();

    // ✅ Return a page that sets the JWT in localStorage and redirects
    const frontendUrl = process.env.FRONTEND_URL || 'https://opslinkservers.com/';
    res.send(`
      <html>
        <body>
          <h2>${platform} connected as ${username}</h2>
          <script>
            // Persist JWT from OAuth state so user stays logged in
            localStorage.setItem('token', '${state}');
            // Redirect back to frontend profile page
            window.location.href = '${frontendUrl}';
          </script>
        </body>
      </html>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send('OAuth failed');
  }
});




// =======================
// QR Login Routes
// =======================

// Temporary in-memory QR token storage
// Format: { token: { valid: true, createdAt: timestamp } }
const qrTokens = {};

// =======================
// Middleware: Verify JWT (Mobile Users)
// =======================
function verifyJWT(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1]; // Bearer token
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains id, email, discordUsername, role, etc.
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// =======================
// Generate QR Token (Desktop)
// =======================
router.get('/qr-generate', (req, res) => {
  const token = crypto.randomBytes(16).toString('hex');
  qrTokens[token] = { valid: true, createdAt: Date.now() };

  // Auto-expire after 60 seconds
  setTimeout(() => {
    if (qrTokens[token]) qrTokens[token].valid = false;
  }, 60 * 1000);

  res.json({ token });
});

// =======================
// Mobile scans QR token
// =======================
router.post('/qr-scan', verifyJWT, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing QR token' });

  const qrEntry = qrTokens[token];
  if (!qrEntry || !qrEntry.valid) {
    return res.status(400).json({ error: 'Invalid or expired QR token' });
  }

  qrEntry.valid = false; // mark token as used

  try {
    // Fetch full user info from DB
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Create JWT for desktop
    const desktopToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        discordUsername: user.discordUsername,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Emit login-success to desktop via Socket.IO
    if (global.io) {
      global.io.to(token).emit('login-success', {
        token: desktopToken,
        user: {
          id: user._id,
          email: user.email,
          discordUsername: user.discordUsername,
          role: user.role
        }
      });
    }

    res.json({ success: true, message: 'QR login approved' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Desktop subscribes to QR token (Socket.IO room)
// =======================
router.post('/qr-subscribe', (req, res) => {
  const { token, socketId } = req.body;
  if (!token || !socketId) return res.status(400).json({ error: 'Missing token or socketId' });

  if (global.io) {
    const socket = global.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(token); // desktop joins a room named after the token
      return res.json({ success: true, message: 'Subscribed to QR token' });
    }
  }

  res.status(400).json({ error: 'Socket not found or server not initialized' });
});

module.exports = router;







