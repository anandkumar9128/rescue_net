const Assignment = require('../models/Assignment');
const Cluster = require('../models/Cluster');
const Volunteer = require('../models/Volunteer');
const { findNearbyNGOs } = require('../utils/geo');
const { getRequiredWorkforce, getAvailableWorkforce, canFulfill } = require('../utils/workforce');

/**
 * Commits the atomic assignment of specific volunteers from the validated NGO to the cluster.
 */
const assignToNGO = async (cluster, ngo, requirement, rawVolunteers) => {
  const selectedVolunteers = [];
  
  // Clone raw volunteers so we can mutate/splice to prevent assigning same person twice
  let pool = [...rawVolunteers];

  // For each specified requirement (e.g. { Medical: 1, Rescue: 2 })
  for (const [skill, count] of Object.entries(requirement)) {
    let assignedForSkill = 0;
    
    // Find matching volunteers
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].skill_type === skill) {
        selectedVolunteers.push({
          volunteer_id: pool[i]._id,
          status: "Accepted" // Immediately assigned as requested by automated flow
        });
        assignedForSkill++;
        
        // Remove from pool so they aren't double counted
        pool.splice(i, 1);
        i--;
        
        if (assignedForSkill === count) {
          break; // Requirement met for this skill
        }
      }
    }
  }

  const totalRequired = Object.values(requirement).reduce((a, b) => a + b, 0);

  // Create Assignment
  const assignment = await Assignment.create({
    cluster_id: cluster._id,
    ngo_id: ngo._id,
    volunteers: selectedVolunteers,
    required_volunteers: totalRequired,
    status: "Volunteer Assigned" // Auto-accepted status
  });

  // Update Cluster
  cluster.status = "Assigned";
  await cluster.save();

  // Mark all selected volunteers as busy ('En Route' or 'Volunteer Assigned')
  const volIds = selectedVolunteers.map(v => v.volunteer_id);
  await Volunteer.updateMany(
    { _id: { $in: volIds } },
    { $set: { status: 'En Route' } }
  );

  return { assignment, volIds };
};


/**
 * Core Automated Dispatch Service.
 * Progressively expands search radius to find a fully capable NGO.
 */
const dispatchRequest = async (cluster, io, stepIndex = 0) => {
  // Pre-defined radius escalation steps in meters (500m, 1km, 2km, 5km, 20km)
  const RADIUS_STEPS = [500, 1000, 2000, 5000, 20000];
  
  // Base case: All normal radii exhausted
  if (stepIndex >= RADIUS_STEPS.length) {
    console.log(`⏳ RADIUS EXHAUSTED for Cluster ${cluster._id}. Waiting 2 minutes to retry...`);
    // Wait 2 minutes and retry with max radius. (Non-blocking background retry)
    setTimeout(async () => {
      // Re-fetch cluster to ensure it hasn't been manually assigned while waiting
      const currentCluster = await Cluster.findById(cluster._id);
      if (currentCluster && currentCluster.status === "Open") {
        console.log(`🔄 Retrying Dispatch for Cluster ${cluster._id} after 2 minutes`);
        dispatchRequest(currentCluster, io, RADIUS_STEPS.length - 1); // Retry max step
      }
    }, 120000); // 2 minutes
    return null;
  }

  const radius = RADIUS_STEPS[stepIndex];
  console.log(`🚁 DISPATCHING Cluster ${cluster._id} (Radius: ${radius}m)`);

  const isSOS = cluster.request_ids && cluster.request_ids.some(r => r.is_sos);
  
  // 1. Fetch nearby NGOs mathematically sorted by distance
  const nearbyNGOs = await findNearbyNGOs(cluster.location, radius);

  // 2. Evaluate each nearby NGO and just grab the first one with ANY available manpower
  for (const ngo of nearbyNGOs) {
    const availableVols = await Volunteer.find({ ngo_id: ngo._id, status: 'Available' });
    
    // If this NGO has ANY available volunteer, just select the first one and instantly assign
    if (availableVols.length > 0) {
      console.log(`✅ MATCH FOUND: NGO ${ngo.name} at radius ${radius}m`);
      
      const selectedVol = availableVols[0]; // Just select one volunteer

      // Create Assignment
      const assignment = await Assignment.create({
        cluster_id: cluster._id,
        ngo_id: ngo._id,
        volunteer_id: selectedVol._id,
        volunteers: [{
          volunteer_id: selectedVol._id,
          status: "Accepted" 
        }],
        required_volunteers: 1,
        status: "Volunteer Assigned" 
      });

      // Update Cluster
      cluster.status = "Assigned";
      await cluster.save();

      // Mark volunteer
      await Volunteer.findByIdAndUpdate(selectedVol._id, { status: "En Route" });

      // Socket emits
      if (io) {
        io.to(`ngo_${ngo._id}`).emit('assignment-created', { assignment_id: assignment._id, cluster_id: cluster._id });
        io.to(`volunteer_${selectedVol._id}`).emit('task_assigned', { assignment_id: assignment._id });
        io.emit("cluster_claimed", { cluster_id: cluster._id, ngo_id: ngo._id });
        io.emit("assignment_status_update", { assignment_id: assignment._id, status: "Volunteer Assigned" });
      }

      return assignment; // Success, STOP loop
    }
  }

  // 3. Failed to find capable NGO at this radius. Expand radius and retry instantly.
  console.log(`❌ No available volunteers at ${radius}m. Expanding radius...`);
  return await dispatchRequest(cluster, io, stepIndex + 1);
};


module.exports = {
  dispatchRequest
};
