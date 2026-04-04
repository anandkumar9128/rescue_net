const mongoose = require('mongoose');

const joinRequestSchema = new mongoose.Schema(
  {
    volunteer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer', required: true },
    ngo_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'NGO',       required: true },
    // pending → approved / rejected
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    message: { type: String, default: '' },
  },
  { timestamps: true }
);

// Prevent duplicate pending requests from the same volunteer to the same NGO
joinRequestSchema.index({ volunteer_id: 1, ngo_id: 1 }, { unique: true });
joinRequestSchema.index({ ngo_id: 1, status: 1 });

module.exports = mongoose.model('JoinRequest', joinRequestSchema);
