const JoinRequest = require('../models/JoinRequest');
const Volunteer   = require('../models/Volunteer');
const NGO         = require('../models/NGO');

/**
 * POST /api/join-requests
 * Volunteer submits a join request to an NGO.
 */
const submitJoinRequest = async (req, res, next) => {
  try {
    const { ngo_id, message } = req.body;

    // Find the volunteer record linked to this user
    const volunteer = await Volunteer.findOne({ user_id: req.user._id });
    if (!volunteer) {
      return res.status(404).json({ success: false, message: 'Volunteer profile not found' });
    }

    // Check the NGO exists and is active
    const ngo = await NGO.findById(ngo_id);
    if (!ngo || !ngo.isActive) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }

    // Upsert: if a rejected request exists, allow re-send
    let joinReq = await JoinRequest.findOne({ volunteer_id: volunteer._id, ngo_id });
    if (joinReq) {
      if (joinReq.status === 'pending') {
        return res.status(409).json({ success: false, message: 'Request already pending for this NGO' });
      }
      if (joinReq.status === 'approved') {
        return res.status(409).json({ success: false, message: 'Already a member of this NGO' });
      }
      // rejected — allow re-apply
      joinReq.status  = 'pending';
      joinReq.message = message || '';
      await joinReq.save();
    } else {
      joinReq = await JoinRequest.create({
        volunteer_id: volunteer._id,
        ngo_id,
        message: message || '',
      });
    }

    // Real-time notification to NGO
    const io = req.app.get('io');
    if (io) {
      io.to(`ngo_${ngo_id}`).emit('join_request_new', {
        request_id:     joinReq._id,
        volunteer_name: volunteer.name,
        skill_type:     volunteer.skill_type,
        ngo_id,
      });
    }

    res.status(201).json({ success: true, data: joinReq });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/join-requests/incoming
 * NGO admin gets all join requests addressed to their NGO.
 */
const getIncomingRequests = async (req, res, next) => {
  try {
    const ngoId = req.user.ngo_id;
    if (!ngoId) {
      return res.status(400).json({ success: false, message: 'No NGO linked to this account' });
    }

    const requests = await JoinRequest.find({ ngo_id: ngoId })
      .populate('volunteer_id', 'name phone skill_type status completed_tasks location')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/join-requests/my
 * Volunteer checks the status of their own join request(s).
 */
const getMyRequests = async (req, res, next) => {
  try {
    const volunteer = await Volunteer.findOne({ user_id: req.user._id });
    if (!volunteer) {
      return res.status(404).json({ success: false, message: 'Volunteer profile not found' });
    }

    const requests = await JoinRequest.find({ volunteer_id: volunteer._id })
      .populate('ngo_id', 'name contact_email capabilities location')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/join-requests/:id
 * NGO admin approves or rejects a join request.
 * Body: { action: 'approve' | 'reject' }
 */
const respondToRequest = async (req, res, next) => {
  try {
    const { action } = req.body; // 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' });
    }

    const joinReq = await JoinRequest.findById(req.params.id).populate('volunteer_id');
    if (!joinReq) {
      return res.status(404).json({ success: false, message: 'Join request not found' });
    }

    // Ensure the NGO admin owns this request
    if (String(joinReq.ngo_id) !== String(req.user.ngo_id)) {
      return res.status(403).json({ success: false, message: 'Not authorised for this request' });
    }

    joinReq.status = action === 'approve' ? 'approved' : 'rejected';
    await joinReq.save();

    // On approval → link volunteer to this NGO
    if (action === 'approve') {
      await Volunteer.findByIdAndUpdate(joinReq.volunteer_id._id, { ngo_id: joinReq.ngo_id });
    }

    // Notify volunteer in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`volunteer_${joinReq.volunteer_id._id}`).emit('join_request_response', {
        ngo_id:  joinReq.ngo_id,
        status:  joinReq.status,
        message: action === 'approve'
          ? 'Your request to join the NGO was approved! 🎉'
          : 'Your join request was not approved. You may apply elsewhere.',
      });
    }

    res.json({ success: true, data: joinReq });
  } catch (err) {
    next(err);
  }
};

module.exports = { submitJoinRequest, getIncomingRequests, getMyRequests, respondToRequest };
