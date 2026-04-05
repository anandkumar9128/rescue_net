const Request = require('../models/Request');
const { processPipeline } = require('./requestController');

/**
 * Handle incoming SMS from custom Android SMS Forwarder App
 * POST /api/sms-webhook
 * Payload format: application/json
 * Body: { "message": "TYPE|LAT|LNG|SEVERITY", "sender": "+919128171568" }
 */
const handleSmsWebhook = async (req, res) => {
  const io = req.app.get('io');

  try {
    const { message, sender } = req.body;

    if (!message || !sender) {
      console.error('❌ SMS Webhook validation failed. Missing message or sender keys.');
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing message or sender' 
      });
    }

    console.log(`📩 Processing SMS from ${sender}: "${message}"`);

    // 1. Parse the SMS format (TYPE|LAT|LNG|SEVERITY)
    const parts = message.trim().split('|');
    if (parts.length < 4) {
      console.warn(`⚠️ Invalid SMS format received: ${message}`);
      return res.status(400).json({ 
        status: 'error', 
        message: 'Invalid message format. Use TYPE|LAT|LNG|SEVERITY' 
      });
    }

    const [rawType, rawLat, rawLng, rawSeverity] = parts;

    // 2. Parse and Validate Coordinates
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn(`⚠️ Invalid coordinates in SMS: ${rawLat}, ${rawLng}`);
      return res.status(400).json({ 
        status: 'error', 
        message: 'Invalid coordinates' 
      });
    }

    // 3. Map Need Type
    const typeMap = {
      M: 'Medical',
      F: 'Food',
      R: 'Rescue',
    };
    const need_type = typeMap[rawType.toUpperCase()];
    
    if (!need_type) {
      console.warn(`⚠️ Invalid type in SMS: ${rawType}`);
      return res.status(400).json({ 
        status: 'error', 
        message: 'Invalid TYPE. Use M, F, or R.' 
      });
    }

    // 4. Map Severity
    const sevUpper = rawSeverity.toUpperCase();
    let severity = 'Medium';
    if (sevUpper.includes('HIGH')) severity = 'High';
    else if (sevUpper.includes('LOW')) severity = 'Low';

    // 5. Deduplication Check (Same phone, recent time)
    const recentTimeLimit = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes
    const duplicate = await Request.findOne({
      submitter_phone: sender,
      createdAt: { $gte: recentTimeLimit },
    });

    if (duplicate) {
      console.log(`⚠️ Duplicate request blocked from ${sender}`);
      return res.status(409).json({ 
        status: 'error', 
        message: 'Duplicate request already registered' 
      });
    }

    // 6. Rapidly return success to the Android app
    res.status(200).json({
      status: 'success',
      message: 'Request received'
    });

    // 7. Process remaining heavy logic asynchronously (non-blocking)
    (async () => {
      try {
        const requestDoc = await Request.create({
          user_id: null,
          submitter_name: 'SMS User',
          submitter_phone: sender,
          location: { lat, lng },
          need_type,
          people_count: 1, // Defaulting for SMS
          severity,
          description: `Emergency reported via SMS Forwarder: ${message}`,
          is_sos: true,
          source: 'sms', // Traceability
        });

        console.log(`✅ Forwarder Request Created: ${requestDoc._id}`);
        
        // Execute pipeline assignment offline
        await processPipeline(requestDoc, io);
      } catch (backgroundErr) {
        console.error(`❌ Background SMS Pipeline Error: ${backgroundErr.message}`);
      }
    })();

  } catch (err) {
    console.error(`❌ SMS Webhook Error: ${err.message}`);
    // Only return 500 if we haven't already responded
    if (!res.headersSent) {
      res.status(500).json({ 
        status: 'error', 
        message: 'Internal server error' 
      });
    }
  }
};

module.exports = { handleSmsWebhook };
