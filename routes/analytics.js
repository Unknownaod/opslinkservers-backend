const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Server = require('../models/Server');
const Snapshot = require('../models/Snapshot');

const router = express.Router();

// ---------------------------
// Utility to parse range
// ---------------------------
function parseRange(range) {
  const now = new Date();
  let since = new Date(now);

  // Simplified range parsing
  const ranges = {
    '24h': 24,
    '7d': 7,
    '30d': 30,
    '90d': 90
  };

  const hoursAgo = ranges[range] || 7; // default to '7d' if invalid range
  since.setHours(now.getHours() - hoursAgo * 24);
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
    } catch (err) {
      return res.status(400).json({ error: 'Invalid server ID format' });
    }

    if (!server) return res.status(404).json({ error: 'Server not found' });

    // ---------------------------
    // 2️⃣ Fetch snapshots
    // ---------------------------
    let snapshots;
    try {
      snapshots = await Snapshot.find({
        serverId,
        createdAt: { $gte: since }
      }).sort({ createdAt: 1 }).lean();
    } catch (err) {
      return res.status(500).json({ error: 'Error fetching snapshots' });
    }

    // If no snapshots exist, return empty/default data
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

    // ---------------------------
    // 3️⃣ Aggregate latest snapshot
    // ---------------------------
    const latest = snapshots[snapshots.length - 1];
    const prev = snapshots[snapshots.length - 2] || latest;

    const delta = (field) => (latest[field]?.current || 0) - (prev[field]?.current || 0);

    // Top channels and members
    const topChannels = (latest.topChannels || []).slice(0, 5).map(c => ({
      name: c.name || 'Unknown',
      count: c.count || 0
    }));

    const topMembers = (latest.topMembers || []).slice(0, 5).map(m => ({
      name: m.name || 'Unknown',
      count: m.count || 0
    }));

    // Return aggregated data
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

module.exports = router;

