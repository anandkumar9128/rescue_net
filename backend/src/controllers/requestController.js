const Request = require('../models/Request');
const Cluster = require('../models/Cluster');
const Assignment = require('../models/Assignment');
const { clusterRequest } = require('../services/clusteringService');
const { calculatePriorityScore, calculateClusterPriority } = require('../services/priorityService');
const { selectNGO } = require('../services/ngoSelectionService');
const { assignVolunteers } = require('../services/volunteerAssignmentService');
const { sendEmergencySMS } = require('../services/smsService');
const offlineQueue = require('../utils/offlineQueue');

/**
 * Core pipeline: save → cluster → prioritize → assign NGO → assign volunteers
 */
const processPipeline = async (requestDoc, io) => {
  try {
    // Step 1: Compute priority score
    requestDoc.priority_score = calculatePriorityScore({
      need_type: requestDoc.need_type,
      severity: requestDoc.severity,
      people_count: requestDoc.people_count,
      created_at: requestDoc.createdAt,
    });
    await requestDoc.save();

    // Step 2: Cluster the request
    const cluster = await clusterRequest(requestDoc);

    // Step 3: Update cluster priority
    cluster.priority_score = calculateClusterPriority(cluster);
    await cluster.save();

    // Step 4: Notify NGO dashboard via Socket.io
    if (io) {
      io.emit('new_cluster', {
        cluster_id: cluster._id,
        need_type: cluster.need_type,
        location: cluster.location,
        total_people: cluster.total_people,
        max_severity: cluster.max_severity,
        priority_score: cluster.priority_score,
      });
    }

    // Step 5: Select best NGO
    const { primary: ngo, backups } = await selectNGO(cluster);
    if (!ngo) return cluster;

    // Step 6: Create assignment
    const assignment = await Assignment.create({
      cluster_id: cluster._id,
      ngo_id: ngo._id,
      backup_ngo_ids: backups.map((b) => b._id),
      status: 'Pending',
    });

    cluster.status = 'Assigned';
    await cluster.save();

    // Step 7: Auto-assign volunteers (no NGO approval needed)
    await assignVolunteers(assignment, cluster, io);

    // Notify NGO room
    if (io) {
      io.to(`ngo_${ngo._id}`).emit('new_assignment', {
        assignment_id: assignment._id,
        cluster_id: cluster._id,
        need_type: cluster.need_type,
        location: cluster.location,
        total_people: cluster.total_people,
        priority_score: cluster.priority_score,
      });
    }

    return cluster;
  } catch (err) {
    console.error(`❌ Pipeline error: ${err.message}`);
    throw err;
  }
};

/**
 * POST /api/requests
 * Main request creation with fallback chain:
 *   API → SMS → Offline Queue
 */
const createRequest = async (req, res, next) => {
  const io = req.app.get('io');

  try {
    const {
      need_type, people_count, severity, description,
      location, is_sos, submitter_name, submitter_phone,
    } = req.body;

    // Validate required fields
    if (!need_type || !location?.lat || !location?.lng) {
      return res.status(400).json({
        success: false,
        message: 'need_type and location (lat, lng) are required',
      });
    }

    // Save request to DB
    const requestDoc = await Request.create({
      user_id: req.user?._id || null,
      submitter_name: submitter_name || req.user?.name || 'Anonymous',
      submitter_phone: submitter_phone || req.user?.phone,
      location,
      need_type,
      people_count: people_count || 1,
      severity: severity || (is_sos ? 'High' : 'Medium'),
      description: description || '',
      is_sos: is_sos || false,
    });

    // Run the full pipeline
    const cluster = await processPipeline(requestDoc, io);

    return res.status(201).json({
      success: true,
      message: 'Request submitted and processing pipeline started',
      request_id: requestDoc._id,
      cluster_id: cluster._id,
    });
  } catch (err) {
    // FALLBACK 1: Try SMS
    console.warn('⚠️  API pipeline failed. Attempting SMS fallback...');
    const requestData = req.body;

    try {
      // Find nearest NGO phone for SMS
      const NGO = require('../models/NGO');
      const ngos = await NGO.find({ isActive: true }).limit(3);
      let smsSent = false;

      for (const ngo of ngos) {
        smsSent = await sendEmergencySMS(requestData, ngo.contact_phone);
        if (smsSent) break;
      }

      if (smsSent) {
        return res.status(202).json({
          success: true,
          fallback: 'sms',
          message: 'API failed. Emergency SMS sent to NGO.',
        });
      }
    } catch (smsErr) {
      console.error(`❌ SMS fallback failed: ${smsErr.message}`);
    }

    // FALLBACK 2: Offline Queue
    const queued = offlineQueue.enqueue(requestData);
    return res.status(202).json({
      success: true,
      fallback: 'offline_queue',
      queue_id: queued.id,
      message: 'API and SMS failed. Request queued for when connectivity restores.',
    });
  }
};

/**
 * GET /api/requests
 * Get all requests (paginated, filterable by status/type)
 */
const getRequests = async (req, res, next) => {
  try {
    const { status, need_type, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (need_type) filter.need_type = need_type;

    const requests = await Request.find(filter)
      .sort({ priority_score: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('user_id', 'name phone')
      .populate('cluster_id', 'status total_people');

    const total = await Request.countDocuments(filter);

    res.json({ success: true, data: requests, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/requests/clusters
 * Get all clusters (for NGO map view)
 */
const getClusters = async (req, res, next) => {
  try {
    const { status = 'Open' } = req.query;
    const clusters = await Cluster.find({ status })
      .sort({ priority_score: -1 })
      .populate({ path: 'request_ids', select: 'need_type severity people_count' });

    res.json({ success: true, data: clusters });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/requests/queue
 * View offline queue (admin only)
 */
const getOfflineQueue = async (req, res) => {
  res.json({
    success: true,
    queue_length: offlineQueue.queueLength(),
    items: offlineQueue.getQueue(),
  });
};

module.exports = { createRequest, getRequests, getClusters, getOfflineQueue };
