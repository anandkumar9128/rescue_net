const NGO = require("../models/NGO");
const Assignment = require("../models/Assignment");
const Cluster = require("../models/Cluster");
const Volunteer = require("../models/Volunteer");

/**
 * GET /api/ngos
 */
const getAllNGOs = async (req, res, next) => {
  try {
    const ngos = await NGO.find({ isActive: true }).select("-__v");
    res.json({ success: true, data: ngos });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ngos/:id
 */
const getNGOById = async (req, res, next) => {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo)
      return res.status(404).json({ success: false, message: "NGO not found" });
    res.json({ success: true, data: ngo });
  } catch (err) {
    next(err);
  }
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
        .populate("cluster_id")
        .populate("volunteer_id", "name phone status")
        .sort({ createdAt: -1 })
        .limit(50),
      Volunteer.find({ ngo_id: ngoId }).sort({ status: 1 }),
      Cluster.find({ status: { $in: ["Open", "Assigned", "In Progress"] } })
        .populate("request_ids", "need_type severity people_count is_sos")
        .sort({ priority_score: -1 })
        .limit(30),
    ]);

    res.json({ success: true, data: { assignments, volunteers, clusters } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/ngos/:id/assignments/:assignmentId/override
 * NGO manually overrides volunteer assignment
 */
const overrideVolunteer = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const { volunteer_id } = req.body;
    const io = req.app.get("io");

    const assignment = await Assignment.findByIdAndUpdate(
      assignmentId,
      { volunteer_id, status: "Volunteer Assigned" },
      { new: true },
    );

    await Volunteer.findByIdAndUpdate(volunteer_id, { status: "En Route" });

    if (io) {
      io.to(`volunteer_${volunteer_id}`).emit("task_assigned", {
        assignment_id: assignmentId,
        message: "You have been manually assigned a task by your NGO.",
      });
    }

    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ngos/:id/clusters/:clusterId/claim
 * NGO claims an open cluster from the shared pool and assigns a volunteer
 */
const claimCluster = async (req, res, next) => {
  try {
    const ngoId = req.params.id;
    const { clusterId } = req.params;
    const { volunteer_id } = req.body;
    const io = req.app.get("io");

    const cluster = await Cluster.findById(clusterId);
    if (!cluster) return res.status(404).json({ success: false, message: "Cluster not found" });
    if (cluster.status !== "Open") return res.status(400).json({ success: false, message: "Cluster already claimed or resolved" });

    // Create the Assignment now!
    const assignment = await Assignment.create({
      cluster_id: clusterId,
      ngo_id: ngoId,
      volunteer_id: volunteer_id,
      status: "Volunteer Assigned",
      volunteers: [{
        volunteer_id: volunteer_id,
        status: 'Accepted',
        responded_at: new Date()
      }]
    });

    cluster.status = "Assigned";
    await cluster.save();

    await Volunteer.findByIdAndUpdate(volunteer_id, { status: "En Route" });

    // Notify the volunteer's app
    if (io) {
      io.to(`volunteer_${volunteer_id}`).emit("task_assigned", {
        assignment_id: assignment._id,
        message: "You have been manually assigned a task by your NGO.",
      });

      // Broadcast update so other NGOs know it's no longer open
      io.emit("cluster_claimed", { cluster_id: clusterId, ngo_id: ngoId });
    }

    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/ngos/:id
 * Update NGO profile
 */
const updateNGO = async (req, res, next) => {
  try {
    const ngo = await NGO.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: ngo });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllNGOs,
  getNGOById,
  getNGODashboard,
  overrideVolunteer,
  claimCluster,
  updateNGO,
};
