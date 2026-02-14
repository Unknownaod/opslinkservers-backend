const express = require('express');
const auth = require('../middleware/auth');
const Snapshot = require('../models/Snapshot');
const Server = require('../models/Server');

const router = express.Router();

// ---------------------------
// Utility to parse range
// ---------------------------
function parseRange(range) {
  const now = new Date();
  const since = new Date(now);

  const ranges = {
    '24h': 24,
    '7d': 7 * 24,
    '30d': 30 * 24,
    '90d': 90 * 24
  };

  const hoursAgo = ranges[range] || ranges['7d'];
  since.setHours(now.getHours() - hoursAgo);
  return since;
}

// ---------------------------
// GET analytics for a server by Discord server ID
// ---------------------------
router.get('/:discordServerId', auth, async (req, res) => {
  try {
    const { discordServerId } = req.params;
    const range = req.query.range || '7d';
    const since = parseRange(range);

    if (!discordServerId) return res.status(400).json({ error: 'Invalid Discord server ID' });

    // ---------------------------
    // 1️⃣ Fetch snapshots
    // ---------------------------
    const snapshots = await Snapshot.find({
      serverId: discordServerId,
      createdAt: { $gte: since }
    }).sort({ createdAt: 1 }).lean();

    // ---------------------------
    // 2️⃣ Handle no snapshots
    // ---------------------------
    if (!snapshots.length) {
      return res.json({
        serverName: 'Unknown',
        members: { current: 0, delta: 0 },
        messages: { current: 0, delta: 0 },
        voice: { current: 0, delta: 0 },
        joins: { current: 0, delta: 0 },
        textChannelsCount: 0,
        voiceChannelsCount: 0,
        rolesCount: 0,
        emojisCount: 0,
        boosts: 0,
        afkMembers: 0,
        topChannels: [],
        topMembers: [],
        chart: { labels: [], members: [], messages: [], voice: [], joins: [] }
      });
    }

    // ---------------------------
    // 3️⃣ Aggregate latest snapshot
    // ---------------------------
    const latest = snapshots[snapshots.length - 1];
    const prev = snapshots[snapshots.length - 2] || latest;

    const delta = (field) => (latest[field]?.current || 0) - (prev[field]?.current || 0);

    // ---------------------------
    // 4️⃣ Recompute charts from snapshots
    // ---------------------------
    const chartLabels = snapshots.map(s => {
      const d = new Date(s.createdAt);
      return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:00`;
    });

    const chart = {
      labels: chartLabels,
      members: snapshots.map(s => s.members?.current || 0),
      messages: snapshots.map(s => s.messages?.current || 0),
      voice: snapshots.map(s => s.voice?.current || 0),
      joins: snapshots.map(s => s.joins?.current || 0)
    };

    res.json({
      serverName: latest.serverName || 'Unknown',
      members: { current: latest.members?.current || 0, delta: delta('members') },
      messages: { current: latest.messages?.current || 0, delta: delta('messages') },
      voice: { current: latest.voice?.current || 0, delta: delta('voice') },
      joins: { current: latest.joins?.current || 0, delta: delta('joins') },

      textChannelsCount: latest.textChannelsCount || 0,
      voiceChannelsCount: latest.voiceChannelsCount || 0,
      rolesCount: latest.rolesCount || 0,
      emojisCount: latest.emojisCount || 0,
      boosts: latest.boosts || 0,
      afkMembers: latest.afkMembers || 0,

      topChannels: (latest.topChannels || []).slice(0, 5).map(c => ({
        name: c.name || 'Unknown',
        count: c.count || 0
      })),

      topMembers: (latest.topMembers || []).slice(0, 5).map(m => ({
        name: m.name || 'Unknown',
        count: m.count || 0
      })),

      chart
    });

  } catch (err) {
    console.error('Analytics fetch error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
