const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    cluster_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cluster', required: true },
    ngo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NGO', required: true },
    volunteer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer' },

    status: {
      type: String,
      enum: [
        'Pending',          // NGO assigned, waiting for volunteer to accept
        'Volunteer Assigned', // Volunteer accepted
        'En Route',         // Volunteer heading to location
        'On Task',          // Volunteer at location, working
        'Completed',        // Task finished
        'Cancelled',        // Cancelled or timed out
      ],
      default: 'Pending',
    },

    // Backup NGOs in priority order (if primary NGO fails)
    backup_ngo_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NGO' }],

    // Timestamp when volunteer was notified (for timeout tracking)
    volunteer_notified_at: { type: Date },

    // Timeout duration in ms (default 2 minutes)
    volunteer_timeout_ms: { type: Number, default: 120000 },

    // Notes from volunteer or NGO
    notes: { type: String },

    completed_at: { type: Date },
  },
  { timestamps: true }
);

assignmentSchema.index({ cluster_id: 1 });
assignmentSchema.index({ ngo_id: 1, status: 1 });
assignmentSchema.index({ volunteer_id: 1, status: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
