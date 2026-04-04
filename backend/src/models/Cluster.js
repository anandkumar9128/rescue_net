const mongoose = require('mongoose');

/**
 * A Cluster is a merged group of nearby requests with the same need_type.
 * Clustering reduces duplicate effort and allows NGOs to see a cleaner picture.
 */
const clusterSchema = new mongoose.Schema(
  {
    // Center of the cluster (average lat/lng of merged requests)
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

    // All request IDs merged into this cluster
    request_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Request' }],

    // Total people across all merged requests
    total_people: { type: Number, default: 0 },

    // Worst severity in cluster drives priority
    max_severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },

    // Computed priority score
    priority_score: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['Open', 'Assigned', 'In Progress', 'Resolved'],
      default: 'Open',
    },

    // Resolved at timestamp
    resolved_at: { type: Date },
  },
  { timestamps: true }
);

clusterSchema.index({ 'location.lat': 1, 'location.lng': 1 });
clusterSchema.index({ need_type: 1, status: 1 });

module.exports = mongoose.model('Cluster', clusterSchema);
