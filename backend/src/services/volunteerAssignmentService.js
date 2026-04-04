/**
 * Volunteer Assignment Service
 *
 * Auto-assigns volunteers to accepted clusters WITHOUT manual NGO approval.
 *
 * Flow:
 *  1. Find available volunteers with matching skill under the NGO
 *  2. Send task to top 3 volunteers simultaneously
 *  3. First to ACCEPT wins — others are auto-released
 *  4. If no response within timeout → retry or escalate
 */
const Volunteer = require('../models/Volunteer');
const Assignment = require('../models/Assignment');
const { haversineMetres } = require('./clusteringService');
const { sendVolunteerNotification } = require('./smsService');

// Default timeout before retrying (2 minutes)
const VOLUNTEER_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Find and assign best volunteers to an assignment.
 *
 * @param {Object} assignment - Assignment document
 * @param {Object} cluster    - Cluster document
 * @param {Object} io         - Socket.io instance for real-time notifications
 */
const assignVolunteers = async (assignment, cluster, io) => {
  try {
    // Get available volunteers for this NGO with matching skill
    const volunteers = await Volunteer.find({
      ngo_id: assignment.ngo_id,
      status: 'Available',
      skill_type: { $in: [cluster.need_type, 'General'] },
    });

    if (volunteers.length === 0) {
      console.warn(`⚠️  No available volunteers under NGO ${assignment.ngo_id}`);
      return;
    }

    // Sort volunteers by proximity to cluster (closest first)
    const sorted = volunteers
      .filter((v) => v.location && v.location.lat)
      .map((v) => ({
        volunteer: v,
        dist: haversineMetres(
          cluster.location.lat,
          cluster.location.lng,
          v.location.lat,
          v.location.lng
        ),
      }))
      .sort((a, b) => a.dist - b.dist);

    // If no location data, fall back to all volunteers
    const candidates =
      sorted.length > 0
        ? sorted.slice(0, 3).map((s) => s.volunteer)
        : volunteers.slice(0, 3);

    // Notify top candidates via Socket.io
    for (const vol of candidates) {
      if (io) {
        io.to(`volunteer_${vol._id}`).emit('task_offer', {
          assignment_id: assignment._id,
          cluster_id: cluster._id,
          need_type: cluster.need_type,
          location: cluster.location,
          total_people: cluster.total_people,
          max_severity: cluster.max_severity,
          timeout_ms: VOLUNTEER_TIMEOUT_MS,
        });
      }

      // SMS fallback notification (includes location + Maps link)
      await sendVolunteerNotification(vol, {
        need_type: cluster.need_type,
        assignment_id: assignment._id,
        location: cluster.location,
      });
    }

    // Store notification timestamp for timeout tracking
    assignment.volunteer_notified_at = new Date();
    assignment.volunteer_timeout_ms = VOLUNTEER_TIMEOUT_MS;
    await assignment.save();

    console.log(`📣 Task offered to ${candidates.length} volunteers for assignment ${assignment._id}`);

    // Set timeout — if no one accepts, escalate
    setTimeout(async () => {
      const fresh = await Assignment.findById(assignment._id);
      if (fresh && fresh.status === 'Pending') {
        console.warn(`⏰ Volunteer timeout for assignment ${assignment._id}. Retrying...`);
        // Re-call this function (retry once with remaining volunteers)
        const nextBatch = volunteers.slice(3, 6);
        if (nextBatch.length > 0) {
          for (const vol of nextBatch) {
            if (io) {
              io.to(`volunteer_${vol._id}`).emit('task_offer', {
                assignment_id: assignment._id,
                cluster_id: cluster._id,
                need_type: cluster.need_type,
                location: cluster.location,
                total_people: cluster.total_people,
                max_severity: cluster.max_severity,
                timeout_ms: VOLUNTEER_TIMEOUT_MS,
              });
            }
          }
        } else {
          // Mark assignment as needing manual intervention
          fresh.status = 'Cancelled';
          await fresh.save();
          if (io) {
            io.to(`ngo_${assignment.ngo_id}`).emit('assignment_timeout', {
              assignment_id: assignment._id,
              message: 'No volunteer accepted. Manual assignment required.',
            });
          }
        }
      }
    }, VOLUNTEER_TIMEOUT_MS);
  } catch (err) {
    console.error(`❌ Volunteer assignment error: ${err.message}`);
  }
};

/**
 * Handle a volunteer accepting a task
 *
 * @param {string} assignmentId  - Assignment ID
 * @param {string} volunteerId   - Volunteer ID accepting the task
 * @param {Object} io            - Socket.io instance
 */
const acceptTask = async (assignmentId, volunteerId, io) => {
  const assignment = await Assignment.findById(assignmentId).populate('cluster_id');

  if (!assignment || assignment.status !== 'Pending') {
    return { success: false, message: 'Assignment no longer available' };
  }

  // Assign the volunteer
  assignment.volunteer_id = volunteerId;
  assignment.status = 'Volunteer Assigned';
  await assignment.save();

  // Update volunteer status
  await Volunteer.findByIdAndUpdate(volunteerId, { status: 'En Route' });

  // Notify the NGO dashboard
  if (io) {
    io.to(`ngo_${assignment.ngo_id}`).emit('volunteer_accepted', {
      assignment_id: assignmentId,
      volunteer_id: volunteerId,
      status: 'Volunteer Assigned',
    });

    // Notify other volunteers that task is taken
    io.to(`ngo_${assignment.ngo_id}`).emit('task_taken', { assignment_id: assignmentId });
  }

  console.log(`✅ Volunteer ${volunteerId} accepted assignment ${assignmentId}`);
  return { success: true, assignment };
};

module.exports = { assignVolunteers, acceptTask };
