const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');

const router = express.Router();

// ============================
// Connect to Analytics DB
// ============================
const analyticsDb = mongoose.createConnection(process.env.MongoDb_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

analyticsDb.on('error', err => console.error('Analytics DB connection error:', err));
analyticsDb.once('open', () => console.log('Connected to Analytics DB'));

// ============================
// Utility: parse range
// ============================
function parseRange(range) {
  const now = new Date();
  let since = new Date(now);
  switch(range) {
    case '24h': since.setHours(now.getHours() - 24); break;
    case '7d': since.setDate(now.getDate() - 7); break;
    case '30d': since.setDate(now.getDate() - 30); break;
    case '90d': since.setDate(now.getDate() - 90); break;
    default: since.setDate(now.getDate() - 7);
  }
  return since;
}

// ============================
// GET analytics for a server
// ============================
router.get('/:serverId', auth, async (req, res) => {
  try {
    const { serverId } = req.params;
    const range = req.query.range || '7d';
    const since = parseRange(range);

    if (!mongoose.Types.ObjectId.isValid(serverId)) 
      return res.status(400).json({ error: 'Invalid server ID' });

    // Create dynamic Server model
    const ServerModel = analyticsDb.model('Server', new mongoose.Schema({}, { strict: false }));

    const server = await ServerModel.findById(serverId).lean();
    if (!server) return res.status(404).json({ error: 'Server not found' });

    // Current stats
    const members = server.members || 0;
    const messages = server.messages || 0;
    const voice = server.voiceMinutes || 0;
    const joins = server.joins || 0;

    // Randomized delta for demo purposes
    const membersDelta = Math.floor(Math.random() * 10 - 5);
    const messagesDelta = Math.floor(Math.random() * 50 - 25);
    const voiceDelta = Math.floor(Math.random() * 60 - 30);
    const joinsDelta = Math.floor(Math.random() * 5 - 2);

    // Top channels/members with counts
    const topChannels = (server.topChannels || []).slice(0,5).map(c => ({
      name: c.name,
      count: c.value
    }));
    const topMembers = (server.topMembers || []).slice(0,5).map(m => ({
      name: m.name,
      count: m.value
    }));

    // Chart (demo example)
    const chartLabels = ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'];
    const chartData = chartLabels.map((_, i) => members + i);

    // Final JSON response matches frontend structure
    res.json({
      members: { current: members, delta: membersDelta },
      messages: { current: messages, delta: messagesDelta },
      voice: { current: voice, delta: voiceDelta },
      joins: { current: joins, delta: joinsDelta },
      topChannels,
      topMembers,
      chart: { labels: chartLabels, data: chartData }
    });

  } catch (err) {
    console.error('Analytics fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
