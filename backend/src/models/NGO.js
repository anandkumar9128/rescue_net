const mongoose = require('mongoose');

const ngoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contact_email: { type: String, required: true, unique: true, lowercase: true },
    contact_phone: { type: String, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String },
    },
    // Capabilities this NGO can handle
    capabilities: {
      type: [String],
      enum: ['Medical', 'Food', 'Rescue', 'Shelter'],
      default: ['Food', 'Shelter'],
    },
    // How many active tasks currently handled (used in scoring)
    current_load: { type: Number, default: 0 },
    // Average response time in minutes (updated dynamically)
    avg_response_time: { type: Number, default: 30 },
    // Linked admin user
    admin_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Geo index for proximity queries
ngoSchema.index({ 'location.lat': 1, 'location.lng': 1 });

module.exports = mongoose.model('NGO', ngoSchema);
