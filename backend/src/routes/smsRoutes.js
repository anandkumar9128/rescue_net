const express = require('express');
const router = express.Router();
const { handleSmsWebhook } = require('../controllers/smsController');

/**
 * @route   POST /api/sms-webhook
 * @desc    Twilio SMS Webhook to create an SOS request
 * @access  Public (called by Twilio)
 * 
 * --- TWILIO CONFIG INSTRUCTIONS ---
 * 1. Use ngrok to expose local server: `ngrok http 5000`
 * 2. Set webhook URL in Twilio console -> Phone Numbers -> Active Numbers -> "A MESSAGE COMES IN":
 *    https://<ngrok-url>/api/sms-webhook
 * 3. HTTP method: POST
 */
router.post('/', handleSmsWebhook);

module.exports = router;
