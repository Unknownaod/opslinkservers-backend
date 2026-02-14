const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');

const router = express.Router();

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

    if (!serverId) 
      return res.status(400).json({ error: 'Invalid server ID' });

    // Use default mongoose connection and Snapshots collection
    const Snapshot = mongoose.model('Snapshot', new mongoose.Schema({}, { strict: false }));

    // Fetch snapshots for this server and range
    const snapshots = await Snapshot.find({
      serverId,
      range,
      createdAt: { $gte: since }
    }).sort({ createdAt: 1 }).lean();

    if (!snapshots.length) return res.status(404).json({ error: 'No snapshots found' });

    // Aggregate data for response
    const latest = snapshots[snapshots.length - 1];

    // Calculate deltas (previous snapshot vs latest)
    const prev = snapshots[snapshots.length - 2] || latest;

    const delta = (field) => (latest[field]?.current || 0) - (prev[field]?.current || 0);

    // Top channels/members
    const topChannels = (latest.topChannels || []).slice(0, 5).map(c => ({
      name: c.name,
      count: c.count
    }));
    const topMembers = (latest.topMembers || []).slice(0, 5).map(m => ({
      name: m.name,
      count: m.count
    }));

    res.json({
      members: { current: latest.members?.current || 0, delta: delta('members') },
      messages: { current: latest.messages?.current || 0, delta: delta('messages') },
      voice: { current: latest.voice?.current || 0, delta: delta('voice') },
      joins: { current: latest.joins || 0, delta: delta('joins') },
      topChannels,
      topMembers,
      chart: latest.chart || { labels: [], data: [] }
    });

  } catch (err) {
    console.error('Analytics fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
