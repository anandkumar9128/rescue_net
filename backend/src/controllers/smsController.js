const Request = require('../models/Request');
const { processPipeline } = require('./requestController');

/**
 * Handle incoming SMS from Generic Android webhook
 * POST /api/sms-webhook
 * Payload format: JSON
 */
const handleSmsWebhook = async (req, res) => {
  const io = req.app.get('io');
  
  try {
    // ===== VERBOSE DEBUG LOGGING =====
    console.log('📩 RAW HEADERS:', JSON.stringify(req.headers));
    console.log('📩 RAW BODY:', JSON.stringify(req.body));
    console.log('📩 RAW QUERY:', JSON.stringify(req.query));
    console.log('📩 BODY KEYS:', Object.keys(req.body || {}));

    // Try URL query params FIRST (many SMS forwarder apps substitute variables in URL only)
    // Then fall back to JSON body fields
    const Body = req.query.message || req.query.msg || req.query.body || req.query.text
                 || req.body.message || req.body.content || req.body.Body || req.body.text 
                 || req.body.sms || req.body.body || req.body.msg || req.body.data;

    const From = req.query.sender || req.query.from || req.query.phone
                 || req.body.sender || req.body.from || req.body.From 
                 || req.body.phone || req.body.number || 'Unknown';

    console.log(`📩 Extracted Body: "${Body}" (type: ${typeof Body})`);
    console.log(`📩 Extracted From: "${From}"`);

    if (!Body || typeof Body !== 'string') {
      console.error('❌ Invalid payload (missing or invalid Body)');
      return res.status(400).json({ 
        success: false, 
        message: 'Bad Request: Missing message body',
        debug_received_keys: Object.keys(req.body || {}),
        debug_query_keys: Object.keys(req.query || {}),
        debug_received_body: req.body
      });
    }

    // 2. Parse the SMS format (SOS|TYPE|LAT|LNG|SEVERITY)
    // Accept optional SOS| prefix
    let messageText = Body.trim();
    if (messageText.toUpperCase().startsWith('SOS|')) {
      messageText = messageText.substring(4);
    }
    
    console.log(`📩 MessageText after prefix strip: "${messageText}"`);
    console.log(`📩 Parts:`, messageText.split('|'));

    // Now expect TYPE|LAT|LNG|SEVERITY
    const parts = messageText.split('|');
    if (parts.length < 4) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid format. Use SOS|TYPE|LAT|LNG|SEVERITY',
        debug_received_text: messageText,
        debug_parts_found: parts,
        debug_parts_count: parts.length
      });
    }

    const [rawType, rawLat, rawLng, rawSeverity] = parts;

    // Parse values
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates. Ensure LAT and LNG are numbers.' });
    }

    // Map need type
    const typeMap = {
      M: 'Medical',
      F: 'Food',
      R: 'Rescue',
    };
    const need_type = typeMap[rawType.toUpperCase()];
    if (!need_type) {
      return res.status(400).json({ success: false, message: 'Invalid TYPE. Use M, F, or R.' });
    }

    // Map severity
    const sevUpper = rawSeverity.toUpperCase();
    let severity = 'Medium';
    if (sevUpper.includes('HIGH')) severity = 'High';
    if (sevUpper.includes('LOW')) severity = 'Low';

    // 3. Deduplication Check (Same phone, recent time)
    const recentTimeLimit = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes
    const duplicate = await Request.findOne({
      submitter_phone: From,
      createdAt: { $gte: recentTimeLimit },
    });

    if (duplicate) {
      console.log(`⚠️ Duplicate request blocked from ${From}`);
      return res.status(200).json({ success: true, message: 'Request already registered for your location.' });
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
      description: `Emergency reported via SMS:\n${Body}`,
      is_sos: true,
      source: 'sms', // Traceability
    });

    console.log(`✅ SMS Request Created: ${requestDoc._id}`);

    // 5. Integrate with Existing Pipeline
    try {
      const cluster = await processPipeline(requestDoc, io);
      
      if (cluster && cluster.status === 'Assigned') {
         return res.status(200).json({ success: true, message: 'Request received. Help is on the way.' });
      } else {
         return res.status(200).json({ success: true, message: 'Request received. Trying to assign help.' });
      }
    } catch (pipelineErr) {
      console.error(`❌ SMS Pipeline Error: ${pipelineErr.message}`);
      return res.status(200).json({ success: true, message: 'Request recorded.' });
    }

  } catch (err) {
    console.error(`❌ SMS Webhook Error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'An error occurred while processing your request.' });
  }
};

module.exports = { handleSmsWebhook };
