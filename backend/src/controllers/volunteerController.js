const Volunteer = require("../models/Volunteer");
const Assignment = require("../models/Assignment");
const { acceptTask } = require("../services/volunteerAssignmentService");

/**
 * GET /api/volunteers/me
 * Returns the Volunteer profile for the currently authenticated user
 */
const getMyProfile = async (req, res, next) => {
  try {
    const volunteer = await Volunteer.findOne({
      user_id: req.user._id,
    }).populate("ngo_id", "name location");
    if (!volunteer) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Volunteer profile not found for this user",
        });
    }
    res.json({ success: true, data: volunteer });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/volunteers/me/tasks
 * Returns all assignments for the currently authenticated volunteer
 */
const getMyTasks = async (req, res, next) => {
  try {
    const volunteer = await Volunteer.findOne({ user_id: req.user._id });
    if (!volunteer) {
      return res
        .status(404)
        .json({ success: false, message: "Volunteer profile not found" });
    }
    const tasks = await Assignment.find({ 'volunteers.volunteer_id': volunteer._id })
      .populate("cluster_id")
      .populate("ngo_id", "name")
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, data: tasks });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/volunteers
 * All volunteers (optionally filter by ngo_id, status)
 */
const getVolunteers = async (req, res, next) => {
  try {
    const { ngo_id, status } = req.query;
    const filter = {};
    if (ngo_id) filter.ngo_id = ngo_id;
    if (status) filter.status = status;

    const volunteers = await Volunteer.find(filter)
      .populate("ngo_id", "name")
      .sort({ status: 1, name: 1 });

    res.json({ success: true, data: volunteers });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/volunteers/:id/tasks
 * Volunteer's task history — :id is the Volunteer document _id
 */
const getVolunteerTasks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tasks = await Assignment.find({ 'volunteers.volunteer_id': id })
      .populate("cluster_id")
      .populate("ngo_id", "name")
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, data: tasks });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/volunteers/:id/status
 * Volunteer updates their own status
 */
const updateVolunteerStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "Available",
      "En Route",
      "On Task",
      "Completed",
      "Offline",
    ];

    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const volunteer = await Volunteer.findByIdAndUpdate(
      req.params.id,
      { status, last_active: new Date() },
      { new: true },
    );

    if (!volunteer) {
      return res
        .status(404)
        .json({ success: false, message: "Volunteer not found" });
    }

    const io = req.app.get("io");
    if (io && volunteer.ngo_id) {
      io.to(`ngo_${volunteer.ngo_id}`).emit("volunteer_status_update", {
        volunteer_id: volunteer._id,
        name: volunteer.name,
        status: volunteer.status,
      });
    }

    res.json({ success: true, data: volunteer });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/volunteers/accept-task
 * Volunteer accepts a task offer
 */
const acceptVolunteerTask = async (req, res, next) => {
  try {
    const { assignment_id, volunteer_id } = req.body;
    const io = req.app.get("io");

    const result = await acceptTask(assignment_id, volunteer_id, io);

    if (!result.success) {
      return res.status(409).json({ success: false, message: result.message });
    }

    res.json({ success: true, data: result.assignment });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/volunteers/reject-task
 * Volunteer rejects a task — no action needed server-side other than logging
 */
const rejectVolunteerTask = async (req, res, next) => {
  try {
    const { assignment_id, volunteer_id } = req.body;
    console.log(
      `🚫 Volunteer ${volunteer_id} rejected assignment ${assignment_id}`,
    );

    res.json({ success: true, message: "Rejection recorded" });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/volunteers/assignments/:id/status
 * Volunteer updates their assignment status (En Route → On Task → Completed)
 */
const updateAssignmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const io = req.app.get("io");

    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(status === "Completed" ? { completed_at: new Date() } : {}),
      },
      { new: true },
    ).populate("ngo_id", "_id");

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // If completed, increment all participating volunteers' completed counts and free them
    if (status === "Completed") {
      const volIds = assignment.volunteers.map(v => v.volunteer_id);
      await Volunteer.updateMany(
        { _id: { $in: volIds } },
        { 
          $set: { status: "Available" },
          $inc: { completed_tasks: 1 } 
        }
      );
    }

    if (io && assignment.ngo_id) {
      io.to(`ngo_${assignment.ngo_id._id}`).emit("assignment_status_update", {
        assignment_id: assignment._id,
        status: assignment.status,
        volunteer_id: assignment.volunteer_id,
      });
    }

    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/volunteers/me/location
 * Volunteer pushes their current GPS coordinates.
 * Broadcast globally so NGO & requester dashboards all receive it.
 */
const updateMyLocation = async (req, res, next) => {
  try {
    const { lat, lng, assignment_id } = req.body;
    if (lat == null || lng == null) {
      return res
        .status(400)
        .json({ success: false, message: "lat and lng are required" });
    }

    const volunteer = await Volunteer.findOneAndUpdate(
      { user_id: req.user._id },
      { location: { lat, lng }, last_active: new Date() },
      { new: true },
    );

    if (!volunteer) {
      return res
        .status(404)
        .json({ success: false, message: "Volunteer not found" });
    }

    // Broadcast to ALL connected clients (NGO, volunteer, users viewing the request)
    const io = req.app.get("io");
    if (io) {
      io.emit("volunteer_location", {
        volunteer_id: volunteer._id,
        volunteer_name: volunteer.name,
        lat,
        lng,
        assignment_id: assignment_id || null,
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyProfile,
  getMyTasks,
  getVolunteers,
  getVolunteerTasks,
  updateVolunteerStatus,
  acceptVolunteerTask,
  rejectVolunteerTask,
  updateAssignmentStatus,
  updateMyLocation,
};
