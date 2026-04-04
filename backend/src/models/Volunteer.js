const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ngo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NGO' },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    // Skills this volunteer can provide
    skill_type: {
      type: String,
      enum: ['Medical', 'Food', 'Rescue', 'Shelter', 'General'],
      default: 'General',
    },
    // Current operational status
    status: {
      type: String,
      enum: ['Available', 'En Route', 'On Task', 'Completed', 'Offline'],
      default: 'Available',
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    // Total completed tasks for reliability scoring
    completed_tasks: { type: Number, default: 0 },
    // Timestamp of last known activity
    last_active: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

volunteerSchema.index({ 'location.lat': 1, 'location.lng': 1 });
volunteerSchema.index({ status: 1, skill_type: 1 });

module.exports = mongoose.model('Volunteer', volunteerSchema);
