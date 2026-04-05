/**
 * Dispatch Service (Automated Team Formation)
 *
 * Replaces old single-volunteer assignment with dynamic team formation.
 * 
 * Includes:
 * - getRequiredVolunteers: Rule engine
 * - autoDispatch: Broadcasts to N volunteers
 * - acceptTask: Handles first-K acceptances
 */
const Volunteer = require('../models/Volunteer');
const Assignment = require('../models/Assignment');
const { haversineMetres } = require('./clusteringService');
const { sendVolunteerNotification } = require('./smsService');

const VOLUNTEER_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * 1. Team Requirement Engine
 * Calculates how many volunteers are needed based on type and people count.
 */
const getRequiredVolunteers = (need_type, people_count = 1) => {
  switch (need_type) {
    case 'Medical': return 1; // 1 doctor max per cluster usually needed for triage
    case 'Rescue': return Math.ceil(people_count / 3) + 1; // 1 leader + 1 per 3 people
    case 'Food': return Math.ceil(people_count / 10); // 1 per 10 people
    case 'Shelter': return Math.ceil(people_count / 5);
    default: return 1;
  }
};

/**
 * 2. Auto-dispatch (Broadcast to volunteers)
 */
const autoDispatch = async (assignment, cluster, io) => {
  try {
    // If not calculated yet
    if (!assignment.required_volunteers) {
      assignment.required_volunteers = getRequiredVolunteers(cluster.need_type, cluster.total_people);
    }

    const needed = assignment.required_volunteers - assignment.volunteers.filter(v => v.status === 'Accepted').length;
    if (needed <= 0) return true; // Already full

    // Find available volunteers not already in this assignment
    const alreadyNotified = assignment.volunteers.map(v => v.volunteer_id.toString());
    
    // Convert current target NGO to string representation safely
    const targetNgoId = (assignment.ngo_id || '').toString();

    const volunteers = await Volunteer.find({
      ngo_id: targetNgoId,
      status: 'Available',
      skill_type: { $in: [cluster.need_type, 'General'] },
      _id: { $nin: alreadyNotified }
    });

    if (volunteers.length === 0) {
      console.warn(`⚠️ No more available volunteers for NGO ${targetNgoId}`);
      return false; // Tells the caller we need fallback
    }

    // Sort by proximity
    const sorted = volunteers
      .filter((v) => v.location && v.location.lat)
      .map((v) => ({
        volunteer: v,
        dist: haversineMetres(cluster.location.lat, cluster.location.lng, v.location.lat, v.location.lng),
      }))
      .sort((a, b) => a.dist - b.dist);

    const candidates = sorted.length > 0 ? sorted.map(s => s.volunteer) : volunteers;
    
    // Broadcast to top N available
    // For every 1 needed, let's ask 2. Max 6 at a time to prevent spam.
    const toNotifyCount = Math.min(needed * 2, 6);
    const batch = candidates.slice(0, toNotifyCount);

    for (const vol of batch) {
      assignment.volunteers.push({
        volunteer_id: vol._id,
        status: 'Notified'
      });

      if (io) {
        io.to(`volunteer_${vol._id}`).emit('task_offer', {
          assignment_id: assignment._id,
          cluster_id: cluster._id,
          need_type: cluster.need_type,
          location: cluster.location,
          total_people: cluster.total_people,
          max_severity: cluster.max_severity,
          timeout_ms: VOLUNTEER_TIMEOUT_MS,
          required_volunteers: assignment.required_volunteers
        });
      }

      await sendVolunteerNotification(vol, {
        need_type: cluster.need_type,
        assignment_id: assignment._id,
        location: cluster.location,
      });
    }

    assignment.volunteer_notified_at = new Date();
    assignment.volunteer_timeout_ms = VOLUNTEER_TIMEOUT_MS;
    await assignment.save();

    console.log(`📣 Task offered to ${batch.length} volunteers for team of ${needed}`);
    return true;
  } catch (err) {
    console.error(`❌ Dispatch error: ${err.message}`);
    return false;
  }
};

/**
 * 3. Handle a volunteer accepting a task
 */
const acceptTask = async (assignmentId, volunteerId, io) => {
  const assignment = await Assignment.findById(assignmentId).populate('cluster_id');

  if (!assignment) return { success: false, message: 'Assignment not found' };
  
  if (assignment.status !== 'Pending') {
    return { success: false, message: 'Team is already full or task canceled' };
  }

  // Find volunteer in array
  const volEntry = assignment.volunteers.find(v => v.volunteer_id.toString() === volunteerId.toString());
  if (!volEntry) {
    return { success: false, message: 'You were not notified for this task' };
  }
  
  if (volEntry.status === 'Accepted') return { success: true, assignment };

  const acceptedCount = assignment.volunteers.filter(v => v.status === 'Accepted').length;
  if (acceptedCount >= assignment.required_volunteers) {
    return { success: false, message: 'Team is already full' };
  }

  // Accept them
  volEntry.status = 'Accepted';
  volEntry.responded_at = new Date();

  // Legacy compatibility: Keep first accepted as volunteer_id
  if (!assignment.volunteer_id) {
    assignment.volunteer_id = volunteerId;
  }

  // Check if team is full
  const newAcceptedCount = assignment.volunteers.filter(v => v.status === 'Accepted').length;
  if (newAcceptedCount >= assignment.required_volunteers) {
    assignment.status = 'Volunteer Assigned';
  }

  await assignment.save();
  await Volunteer.findByIdAndUpdate(volunteerId, { status: 'En Route' });

  // Notify the primary NGO dashboard
  if (io) {
    io.to(`ngo_${assignment.ngo_id}`).emit('volunteer_accepted', {
      assignment_id: assignmentId,
      volunteer_id: volunteerId,
      status: assignment.status,
      team_full: newAcceptedCount >= assignment.required_volunteers
    });

    if (newAcceptedCount >= assignment.required_volunteers) {
      io.to(`ngo_${assignment.ngo_id}`).emit('task_taken', { assignment_id: assignmentId });
    }
  }

  console.log(`✅ Volunteer ${volunteerId} joined team ${assignmentId}`);
  return { success: true, assignment };
};

// Map old assignVolunteers export to new autoDispatch to prevent breaking existing imports
module.exports = { getRequiredVolunteers, autoDispatch, assignVolunteers: autoDispatch, acceptTask };
