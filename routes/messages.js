const router = require('express').Router();
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * Helper: map participants/messages with badge
 */
function mapUserWithBadge(user) {
  return {
    _id: user._id,
    username: user.username || user.discordUsername, // for frontend consistency
    role: user.role,
    badge: user.role === 'admin' ? '[OPSLINK STAFF]' : null
  };
}

/**
 * GET /api/messages
 * List all chats for logged-in user
 */
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user._id })
      .populate('participants', 'username role')
      .sort({ updatedAt: -1 });

    res.json(
      chats.map(chat => ({
        _id: chat._id,
        participants: chat.participants.map(mapUserWithBadge),
        lastMessage: chat.messages.at(-1)?.content || '',
        updatedAt: chat.updatedAt
      }))
    );
  } catch (err) {
    console.error('Error fetching chats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/messages/start
 * Start (or reuse) chat by discordUsername
 */
router.post('/start', auth, async (req, res) => {
  try {
    const { discordUsername } = req.body;
    if (!discordUsername?.trim()) return res.status(400).json({ error: 'discordUsername required' });

    const target = await User.findOne({ username: discordUsername.trim() });
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (target._id.equals(req.user._id))
      return res.status(400).json({ error: 'You cannot message yourself' });

    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, target._id] }
    });

    if (!chat) {
      chat = await Chat.create({
        participants: [req.user._id, target._id],
        messages: []
      });
    }

    res.json({ chatId: chat._id });
  } catch (err) {
    console.error('Error starting chat:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/messages/:id
 * Load messages for a chat
 */
router.get('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid chat ID' });

    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'username role')
      .populate('messages.sender', 'username role');

    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const isParticipant = chat.participants.some(p => p._id.equals(req.user._id));
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const participants = chat.participants.map(mapUserWithBadge);
    const messages = chat.messages.map(m => ({
      _id: m._id,
      content: m.content,
      sender: mapUserWithBadge(m.sender),
      createdAt: m.createdAt
    }));

    res.json({ _id: chat._id, participants, messages, updatedAt: chat.updatedAt });
  } catch (err) {
    console.error('Error loading chat:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/messages/:id
 * Send a message
 */
router.post('/:id', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message content required' });

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid chat ID' });

    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const isParticipant = chat.participants.some(id => id.equals(req.user._id));
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const message = {
      sender: req.user._id,
      content: content.trim(),
      createdAt: new Date()
    };

    chat.messages.push(message);
    chat.updatedAt = new Date();
    await chat.save();

    res.status(200).json({ message: 'Message sent' });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
