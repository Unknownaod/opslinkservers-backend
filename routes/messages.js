const router = require('express').Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * Helper: map participants/messages with badge
 */
function mapUserWithBadge(user) {
  return {
    _id: user._id,
    discordUsername: user.discordUsername,
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
    const chats = await Chat.find({
      participants: req.user._id
    })
      .populate('participants', 'discordUsername role')
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
    console.error(err);
    res.sendStatus(500);
  }
});

/**
 * POST /api/messages/start
 * Start (or reuse) chat by discordUsername
 */
router.post('/start', auth, async (req, res) => {
  try {
    const { discordUsername } = req.body;
    if (!discordUsername?.trim()) return res.sendStatus(400);

    const target = await User.findOne({ discordUsername: discordUsername.trim() });
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Prevent chatting with yourself
    if (target._id.equals(req.user._id)) {
      return res.status(400).json({ error: 'You cannot message yourself' });
    }

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
    console.error(err);
    res.sendStatus(500);
  }
});

/**
 * GET /api/messages/:id
 * Load messages for a chat
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'discordUsername role')
      .populate('messages.sender', 'discordUsername role');

    if (!chat) return res.sendStatus(404);

    const isParticipant = chat.participants.some(p => p._id.equals(req.user._id));
    if (!isParticipant) return res.sendStatus(403);

    const participants = chat.participants.map(mapUserWithBadge);
    const messages = chat.messages.map(m => ({
      _id: m._id,
      content: m.content,
      sender: mapUserWithBadge(m.sender),
      createdAt: m.createdAt
    }));

    res.json({ ...chat.toObject(), participants, messages });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

/**
 * POST /api/messages/:id
 * Send a message
 */
router.post('/:id', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.sendStatus(400);

    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.sendStatus(404);

    const isParticipant = chat.participants.some(id => id.equals(req.user._id));
    if (!isParticipant) return res.sendStatus(403);

    chat.messages.push({
      sender: req.user._id,
      content: content.trim(),
      createdAt: new Date()
    });

    chat.updatedAt = new Date();
    await chat.save();

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

module.exports = router;
