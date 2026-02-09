const router = require('express').Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * GET /api/messages
 * List all chats for logged-in user
 */
router.get('/', auth, async (req, res) => {
  const chats = await Chat.find({
    participants: req.user.id
  })
    .populate('participants', 'username')
    .sort({ updatedAt: -1 });

  res.json(
    chats.map(chat => ({
      _id: chat._id,
      participants: chat.participants,
      lastMessage: chat.messages.at(-1)?.content || ''
    }))
  );
});

/**
 * GET /api/messages/:id
 * Load messages for a chat
 */
router.get('/:id', auth, async (req, res) => {
  const chat = await Chat.findById(req.params.id)
    .populate('messages.sender', 'username role');

  if (!chat) return res.sendStatus(404);
  if (!chat.participants.includes(req.user.id))
    return res.sendStatus(403);

  res.json(chat);
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
  if (!chat.participants.includes(req.user.id))
    return res.sendStatus(403);

  chat.messages.push({
    sender: req.user.id,
    content
  });

  chat.updatedAt = new Date();
  await chat.save();

  res.sendStatus(200);
});

/**
 * POST /api/messages/start
 * Start (or reuse) chat by username
 */
router.post('/start', auth, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.sendStatus(400);

  const target = await User.findOne({ username });
  if (!target) return res.status(404).json({ error: 'User not found' });

  let chat = await Chat.findOne({
    participants: { $all: [req.user.id, target._id] }
  });

  if (!chat) {
    chat = await Chat.create({
      participants: [req.user.id, target._id],
      messages: []
    });
  }

  res.json({ chatId: chat._id });
});

module.exports = router;
