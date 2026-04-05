const Assignment = require('../models/Assignment');
const { autoDispatch } = require('./volunteerAssignmentService');

const CHECK_INTERVAL_MS = 30000;
const MAX_ATTEMPTS = 3;

/**
 * Initializes the background job to check for timed-out assignments
 * and automatically retry them or escalate to backup NGOs.
 */
const initTimeoutChecker = (io) => {
  setInterval(async () => {
    try {
      const now = new Date();
      // Find all pending assignments. Note: Mongoose populate is required to pass cluster_id to autoDispatch.
      const pendingAssignments = await Assignment.find({ status: 'Pending' }).populate('cluster_id');

      for (const assignment of pendingAssignments) {
        if (!assignment.volunteer_notified_at) continue;

        const timeElapsed = now.getTime() - new Date(assignment.volunteer_notified_at).getTime();
        const timeoutMs = assignment.volunteer_timeout_ms || 120000;

        // If time passed the timeout
        if (timeElapsed > timeoutMs) {
          console.log(`⏰ Timeout hit for assignment ${assignment._id}. Attempt ${assignment.attempt_count + 1}`);
          await retryAssignment(assignment, io);
        }
      }
    } catch (err) {
      console.error(`❌ Timeout checker error: ${err.message}`);
    }
  }, CHECK_INTERVAL_MS);
};

const retryAssignment = async (assignment, io) => {
  assignment.attempt_count += 1;
  await assignment.save();

  // Try finding more available volunteers in the CURRENT NGO
  let dispatched = await autoDispatch(assignment, assignment.cluster_id, io);

  // If no available volunteers left in current NGO, switch to BACKUP NGO
  if (!dispatched) {
    if (assignment.backup_ngo_ids && assignment.backup_ngo_ids.length > 0) {
      const nextNgoId = assignment.backup_ngo_ids.shift();
      console.log(`🔄 Switching assignment ${assignment._id} fallback to NGO ${nextNgoId}`);
      assignment.ngo_id = nextNgoId;
      await assignment.save();

      // Retry immediately with the new NGO
      dispatched = await autoDispatch(assignment, assignment.cluster_id, io);
    }
  }

  // If still completely failed and out of retries/backups, mark cancelled
  if (!dispatched && assignment.attempt_count >= MAX_ATTEMPTS) {
    assignment.status = 'Cancelled';
    await assignment.save();
    console.log(`❌ Assignment ${assignment._id} exhausted all retries. Cancelled.`);
    
    if (io) {
      // Notify current NGO that it's cancelled
      io.to(`ngo_${assignment.ngo_id}`).emit('assignment_timeout', {
        assignment_id: assignment._id,
        message: 'No volunteers accepted. Manual intervention required.'
      });
    }
  }
};

module.exports = { initTimeoutChecker, retryAssignment };
