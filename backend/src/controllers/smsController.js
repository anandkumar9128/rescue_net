const Request = require('../models/Request');
const { processPipeline } = require('./requestController');

/**
 * Handle incoming SMS from Twilio webhook
 * POST /api/sms-webhook
 * Payload format: application/x-www-form-urlencoded
 * Body: "TYPE|LAT|LNG|SEVERITY"
 */
const handleSmsWebhook = async (req, res) => {
  const io = req.app.get('io');
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const { Body, From } = req.body;

    // 1. Log incoming SMS
    console.log(`📩 Incoming SMS from ${From}: "${Body}"`);

    if (!Body || !From) {
      console.error('❌ Invalid Twilio payload (missing Body or From)');
      return res.status(400).send('Bad Request');
    }

    console.log(`📩 Processing SMS from ${sender}: "${message}"`);

    // 2. Parse the SMS format (TYPE|LAT|LNG|SEVERITY)
    const parts = Body.trim().split('|');
    if (parts.length < 4) {
      twiml.message('Invalid format. Use TYPE|LAT|LNG|SEVERITY');
      return res.type('text/xml').send(twiml.toString());
    }

    const [rawType, rawLat, rawLng, rawSeverity] = parts;

    // 2. Parse and Validate Coordinates
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);

    if (isNaN(lat) || isNaN(lng)) {
      twiml.message('Invalid coordinates. Please ensure LAT and LNG are numbers.');
      return res.type('text/xml').send(twiml.toString());
    }

    // 3. Map Need Type
    const typeMap = {
      M: 'Medical',
      F: 'Food',
      R: 'Rescue',
    };
    const need_type = typeMap[rawType.toUpperCase()];
    
    if (!need_type) {
      twiml.message('Invalid TYPE. Use M (Medical), F (Food), or R (Rescue).');
      return res.type('text/xml').send(twiml.toString());
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
      console.log(`⚠️ Duplicate request blocked from ${From}`);
      twiml.message('Request already registered for your location.');
      return res.type('text/xml').send(twiml.toString());
    }

    // 4. Map Data and Create Request
    const requestDoc = await Request.create({
      user_id: null,
      submitter_name: 'SMS User',
      submitter_phone: From,
      location: { lat, lng },
      need_type,
      people_count: 1, // Defaulting for SMS
      severity,
      description: `Emergency reported via SMS: ${Body}`,
      is_sos: true,
      source: 'sms', // Traceability
    });

    console.log(`✅ SMS Request Created: ${requestDoc._id}`);

    // 5. Integrate with Existing Pipeline
    try {
      const cluster = await processPipeline(requestDoc, io);
      
      // Bonus: If no NGO available (cluster generated, but assignment maybe missing in assigned scope)
      // Actually `processPipeline` selects NGO. Let's see if the cluster was assigned.
      if (cluster.status === 'Assigned') {
        twiml.message('Request received. Help is on the way.');
      } else {
        twiml.message('Request received. Trying to assign help.');
      }
    } catch (pipelineErr) {
      console.error(`❌ SMS Pipeline Error: ${pipelineErr.message}`);
      // The request was saved, but pipeline failed for some reason
      twiml.message('Request received. Trying to assign help.');
    }

    // Return TwiML response
    res.type('text/xml').send(twiml.toString());

  } catch (err) {
    console.error(`❌ SMS Webhook Error: ${err.message}`);
    // Respond with a default error message
    twiml.message('An error occurred while processing your request. Please try again.');
    res.type('text/xml').send(twiml.toString());
  }
};

module.exports = { handleSmsWebhook };
