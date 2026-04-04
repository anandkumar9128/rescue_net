/**
 * SMS Service — Twilio Integration
 *
 * Sends an SMS when the API pipeline fails.
 * Format: TYPE|LAT|LNG|SEVERITY
 */
const twilio = require('twilio');

let twilioClient = null;

// Lazy init — only create client if credentials exist
const getClient = () => {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;

    if (!sid || !token || sid.startsWith('your_') || token.startsWith('your_')) {
      console.warn('⚠️  Twilio credentials not configured — SMS disabled');
      return null;
    }

    twilioClient = twilio(sid, token);
  }
  return twilioClient;
};

/**
 * sendEmergencySMS
 * Sends a structured SMS for a disaster request.
 *
 * @param {Object} requestData - { need_type, location, severity, people_count }
 * @param {string} toPhone     - Recipient phone number (NGO hotline)
 * @returns {boolean}          - true if SMS sent, false otherwise
 */
const sendEmergencySMS = async (requestData, toPhone) => {
  const client = getClient();
  if (!client) return false;

  try {
    const { need_type, location, severity, people_count } = requestData;

    // Structured format: TYPE|LAT|LNG|SEVERITY|PEOPLE
    const body = `🚨 RESCUENET ALERT\n${need_type}|${location.lat}|${location.lng}|${severity}|${people_count} people\nVisit dashboard for details.`;

    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toPhone,
    });

    console.log(`📱 SMS sent to ${toPhone} for ${need_type} request`);
    return true;
  } catch (err) {
    console.error(`❌ SMS failed: ${err.message}`);
    return false;
  }
};

/**
 * sendVolunteerNotification
 * Notifies a volunteer via SMS about a new task assignment (includes location).
 *
 * @param {Object} volunteer   - Volunteer document
 * @param {Object} assignment  - { need_type, assignment_id, location: { lat, lng, address } }
 */
const sendVolunteerNotification = async (volunteer, assignment) => {
  const client = getClient();
  if (!client) return false;

  try {
    const { need_type, location } = assignment;
    const mapsLink = location?.lat && location?.lng
      ? `https://maps.google.com/?q=${location.lat},${location.lng}`
      : null;

    const locationLine = location?.address
      ? `📍 ${location.address}`
      : location?.lat
      ? `📍 Lat: ${location.lat}, Lng: ${location.lng}`
      : '📍 Location not available';

    const body = [
      `🔔 RescueNet Emergency Task`,
      `Type: ${need_type || 'Emergency'}`,
      locationLine,
      mapsLink ? `Map: ${mapsLink}` : '',
      `Reply ACCEPT or REJECT.`,
    ].filter(Boolean).join('\n');

    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: volunteer.phone,
    });

    return true;
  } catch (err) {
    console.error(`❌ Volunteer SMS failed: ${err.message}`);
    return false;
  }
};

module.exports = { sendEmergencySMS, sendVolunteerNotification };
