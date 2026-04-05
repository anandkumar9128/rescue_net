const express = require('express');
const router = express.Router();
const { handleSmsWebhook } = require('../controllers/smsController');

/**
 * @route   POST /api/sms-webhook
 * @desc    Android SMS Forwarder Webhook to create an SOS request
 * @access  Public (called directly by Android app)
 * 
 * --- ANDROID APP CONFIG INSTRUCTIONS ---
 * 1. Use ngrok or cloud URL (e.g. `https://your-domain.com`) in the Forwarder App
 * 2. Set webhook URL in App to:
 *    https://<domain>/api/sms-webhook
 * 3. HTTP method: POST
 * 4. Content-Type: application/json
 * 5. Format: { "message": "TYPE|LAT|LNG|SEV", "sender": "+91..." }
 */
router.post('/', handleSmsWebhook);

module.exports = router;
