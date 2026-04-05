require('dotenv').config();
const mongoose = require('mongoose');
const Cluster = require('./src/models/Cluster');
const { dispatchRequest } = require('./src/services/dispatch.service');
const { findNearbyNGOs } = require('./src/utils/geo');
const { getRequiredWorkforce, getAvailableWorkforce, canFulfill } = require('./src/utils/workforce');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    // Pick the most recent open cluster
    const cluster = await Cluster.findOne({ status: "Open" }).sort({ createdAt: -1 });
    if (!cluster) {
      console.log("No Open clusters found to test.");
      process.exit(0);
    }

    console.log(`\n=== Testing Dispatch for Cluster ${cluster._id} ===`);
    console.log("Location:", cluster.location);
    console.log("Need Type:", cluster.need_type);

    const isSOS = cluster.request_ids && cluster.request_ids.some(r => r.is_sos);
    const requirement = getRequiredWorkforce(cluster.need_type, cluster.total_people, isSOS || cluster.max_severity === "Critical");
    
    console.log("Strict Formulated Requirement:", requirement);

    console.log("\n--- Checking NGOs at 50,000m ---");
    const ngos = await findNearbyNGOs(cluster.location, 50000);
    console.log(`Found ${ngos.length} NGOs in radius.`);

    for (const ngo of ngos) {
      console.log(`\nNGO: ${ngo.name} (Dist: ${ngo.distance}m)`);
      const { workforce, rawVolunteers } = await getAvailableWorkforce(ngo._id);
      console.log(`Available Workforce Counts:`, workforce);
      console.log(`canFulfill validation result:`, canFulfill(requirement, workforce));
    }

    console.log("\n=========================");
    console.log("Running actual dispatchRequest()...");
    await dispatchRequest(cluster, null);
    
    console.log("\nDone!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
