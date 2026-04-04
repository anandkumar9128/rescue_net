const NGO = require('../models/NGO');
const Assignment = require('../models/Assignment');
const Cluster = require('../models/Cluster');
const Volunteer = require('../models/Volunteer');

/**
 * GET /api/ngos
 */
const getAllNGOs = async (req, res, next) => {
  try {
    const ngos = await NGO.find({ isActive: true }).select('-__v');
    res.json({ success: true, data: ngos });
  } catch (err) { next(err); }
};

/**
 * GET /api/ngos/:id
 */
const getNGOById = async (req, res, next) => {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) return res.status(404).json({ success: false, message: 'NGO not found' });
    res.json({ success: true, data: ngo });
  } catch (err) { next(err); }
};

/**
 * GET /api/ngos/:id/dashboard
 * Full NGO dashboard data: assignments, volunteers, clusters
 */
const getNGODashboard = async (req, res, next) => {
  try {
    const ngoId = req.params.id;

    const [assignments, volunteers, clusters] = await Promise.all([
      Assignment.find({ ngo_id: ngoId })
        .populate('cluster_id')
        .populate('volunteer_id', 'name phone status')
        .sort({ createdAt: -1 })
        .limit(50),
      Volunteer.find({ ngo_id: ngoId }).sort({ status: 1 }),
      Cluster.find({ status: { $in: ['Open', 'Assigned', 'In Progress'] } })
        .sort({ priority_score: -1 })
        .limit(30),
    ]);

    res.json({ success: true, data: { assignments, volunteers, clusters } });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/ngos/:id/assignments/:assignmentId/override
 * NGO manually overrides volunteer assignment
 */
const overrideVolunteer = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const { volunteer_id } = req.body;
    const io = req.app.get('io');

    const assignment = await Assignment.findByIdAndUpdate(
      assignmentId,
      { volunteer_id, status: 'Volunteer Assigned' },
      { new: true }
    );

    await Volunteer.findByIdAndUpdate(volunteer_id, { status: 'En Route' });

    if (io) {
      io.to(`volunteer_${volunteer_id}`).emit('task_assigned', {
        assignment_id: assignmentId,
        message: 'You have been manually assigned a task by your NGO.',
      });
    }

    res.json({ success: true, data: assignment });
  } catch (err) { next(err); }
};

/**
 * PUT /api/ngos/:id
 * Update NGO profile
 */
const updateNGO = async (req, res, next) => {
  try {
    const ngo = await NGO.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: ngo });
  } catch (err) { next(err); }
};

module.exports = { getAllNGOs, getNGOById, getNGODashboard, overrideVolunteer, updateNGO };
