import mongoose from 'mongoose';

const SnapshotSchema = new mongoose.Schema({
  serverId: { type: String, index: true },
  range: { type: String, enum: ['24h', '7d', '30d'], index: true },

  members: {
    current: Number,
    delta: Number
  },

  messages: {
    current: Number,
    delta: Number
  },

  voice: {
    current: Number,
    delta: Number
  },

  chart: {
    labels: [String],
    data: [Number]
  },

  topChannels: [{
    channelId: String,
    name: String,
    count: Number
  }],

  topMembers: [{
    userId: String,
    name: String,
    count: Number
  }],

  createdAt: { type: Date, default: Date.now }
});

SnapshotSchema.index({ serverId: 1, range: 1 });

export default mongoose.model('Snapshot', SnapshotSchema);
