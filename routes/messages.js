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
    username: user.username,
    role: user.role,
    badge: user.role === 'admin' ? '[OPSLINK STAFF]' : null
  };
}

/**
 * GET /api/messages
 * List all chats for logged-in user
 */
router.get('/', auth, async (req, res) => {
  const chats = await Chat.find({
    participants: req.user._id
  })
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
});

/**
 * POST /api/messages/start
 * Start (or reuse) chat by username
 */
router.post('/start', auth, async (req, res) => {
  const { username } = req.body;
  if (!username?.trim()) return res.sendStatus(400);

  const target = await User.findOne({ username: username.trim() });
  if (!target)
    return res.status(404).json({ error: 'User not found' });

  // Prevent chatting with yourself
  if (target._id.equals(req.user._id)) {
    return res
      .status(400)
      .json({ error: 'You cannot message yourself' });
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
});

/**
 * GET /api/messages/:id
 * Load messages for a chat
 */
router.get('/:id', auth, async (req, res) => {
  const chat = await Chat.findById(req.params.id)
    .populate('participants', 'username role')
    .populate('messages.sender', 'username role');

  if (!chat) return res.sendStatus(404);

  const isParticipant = chat.participants.some(p =>
    p._id.equals(req.user._id)
  );
  if (!isParticipant) return res.sendStatus(403);

  // Map participants & messages to include badge
  const participants = chat.participants.map(mapUserWithBadge);
  const messages = chat.messages.map(m => ({
    _id: m._id,
    content: m.content,
    sender: mapUserWithBadge(m.sender),
    createdAt: m.createdAt
  }));

  res.json({ ...chat.toObject(), participants, messages });
});

/**
 * POST /api/messages/:id
 * Send a message
 */
router.post('/:id', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.sendStatus(400);

  const chat = await Chat.findById(req.params.id);
  if (!chat) return res.sendStatus(404);

  const isParticipant = chat.participants.some(id =>
    id.equals(req.user._id)
  );
  if (!isParticipant) return res.sendStatus(403);

  chat.messages.push({
    sender: req.user._id,
    content: content.trim(),
    createdAt: new Date()
  });

  chat.updatedAt = new Date();
  await chat.save();

  res.sendStatus(200);
});

module.exports = router;
