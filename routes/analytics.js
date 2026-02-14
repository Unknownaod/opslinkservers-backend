import express from 'express';
import auth from '../middleware/auth.js';
import Snapshot from '../models/Snapshot.js';
import Server from '../models/Server.js';

const router = express.Router();

// ---------------------------
// Utility to parse range
// ---------------------------
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

// ---------------------------
// GET analytics for a server
// ---------------------------
router.get('/:serverId', auth, async (req, res) => {
  try {
    const { serverId } = req.params;
    const range = req.query.range || '7d';
    const since = parseRange(range);

    if (!serverId) return res.status(400).json({ error: 'Invalid server ID' });

    // ---------------------------
    // 1️⃣ Check server exists
    // ---------------------------
    let server;
    try {
      server = await Server.findById(serverId).lean();
    } catch {
      return res.status(400).json({ error: 'Invalid server ID format' });
    }
    if (!server) return res.status(404).json({ error: 'Server not found' });

    // ---------------------------
    // 2️⃣ Fetch snapshots
    // ---------------------------
    const snapshots = await Snapshot.find({
      serverId,
      range,
      createdAt: { $gte: since }
    }).sort({ createdAt: 1 }).lean();

    // If no snapshots exist, return default empty data
    if (!snapshots.length) {
      return res.json({
        serverName: server.name || 'Unknown',
        members: { current: 0, delta: 0 },
        messages: { current: 0, delta: 0 },
        voice: { current: 0, delta: 0 },
        joins: { current: 0, delta: 0 },
        topChannels: [],
        topMembers: [],
        chart: { labels: [], data: [] }
      });
    }

    const latest = snapshots[snapshots.length - 1];
    const prev = snapshots[snapshots.length - 2] || latest;

    const delta = (field) => (latest[field]?.current || 0) - (prev[field]?.current || 0);

    const topChannels = (latest.topChannels || []).slice(0, 5).map(c => ({
      name: c.name || 'Unknown',
      count: c.count || 0
    }));

    const topMembers = (latest.topMembers || []).slice(0, 5).map(m => ({
      name: m.name || 'Unknown',
      count: m.count || 0
    }));

    res.json({
      serverName: server.name || 'Unknown',
      members: { current: latest.members?.current || 0, delta: delta('members') },
      messages: { current: latest.messages?.current || 0, delta: delta('messages') },
      voice: { current: latest.voice?.current || 0, delta: delta('voice') },
      joins: { current: latest.joins || 0, delta: delta('joins') },
      topChannels,
      topMembers,
      chart: latest.chart || { labels: [], data: [] }
    });

  } catch (err) {
    console.error('Analytics fetch error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
