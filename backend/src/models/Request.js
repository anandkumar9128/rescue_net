const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Who submitted (for anonymous SOS, no user_id needed)
    submitter_name: { type: String, default: 'Anonymous' },
    submitter_phone: { type: String },

    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String },
    },

    need_type: {
      type: String,
      enum: ['Medical', 'Food', 'Rescue', 'Shelter'],
      required: true,
    },

    people_count: { type: Number, default: 1, min: 1 },

    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },

    description: { type: String, default: '' },

    // SOS mode = auto-submitted with GPS
    is_sos: { type: Boolean, default: false },

    // Computed priority score (higher = more urgent)
    priority_score: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['Pending', 'Clustered', 'Assigned', 'In Progress', 'Resolved', 'Cancelled'],
      default: 'Pending',
    },

    // Which cluster this request was merged into
    cluster_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cluster' },

    // Fallback flags
    api_failed: { type: Boolean, default: false },
    sms_sent: { type: Boolean, default: false },
    queued_offline: { type: Boolean, default: false },
  },
  { timestamps: true }
);

requestSchema.index({ 'location.lat': 1, 'location.lng': 1 });
requestSchema.index({ need_type: 1, status: 1 });
requestSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Request', requestSchema);
