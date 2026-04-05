/**
 * Clustering Service
 *
 * Merges requests that are:
 *   - Same need_type
 *   - Within 50 metres of each other
 *   - Submitted within 10 minutes of each other
 *
 * Uses Haversine formula for distance calculation.
 */
const Request = require("../models/Request");
const Cluster = require("../models/Cluster");

/**
 * Haversine distance between two lat/lng points, returns metres
 */
const haversineMetres = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Severity order for comparison
 */
const SEVERITY_ORDER = { Low: 1, Medium: 2, High: 3, Critical: 4 };

/**
 * Find or create a cluster for a new request.
 * Returns the cluster the request was added to.
 *
 * @param {Object} requestDoc - Mongoose Request document
 * @returns {Object}          - The cluster document
 */
const clusterRequest = async (requestDoc) => {
  const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000);
  const RADIUS_METRES = 100; // Merge requests within 100m of each other

  // Find ANY active cluster near the same location (regardless of need_type or time)
  const candidates = await Cluster.find({
    status: { $in: ["Open", "Assigned", "In Progress"] },
  });

  let targetCluster = null;

  for (const cluster of candidates) {
    const dist = haversineMetres(
      requestDoc.location.lat,
      requestDoc.location.lng,
      cluster.location.lat,
      cluster.location.lng,
    );

    if (dist <= RADIUS_METRES) {
      targetCluster = cluster;
      break;
    }
  }

  if (targetCluster) {
    // Merge into existing cluster
    targetCluster.request_ids.push(requestDoc._id);
    targetCluster.total_people += requestDoc.people_count || 1;

    // Upgrade severity if new request is worse
    if (
      SEVERITY_ORDER[requestDoc.severity] >
      SEVERITY_ORDER[targetCluster.max_severity]
    ) {
      targetCluster.max_severity = requestDoc.severity;
    }

    // Recalculate cluster center (average of all request locations)
    const allRequests = await Request.find({
      _id: { $in: targetCluster.request_ids },
    });
    const avgLat =
      allRequests.reduce((sum, r) => sum + r.location.lat, 0) /
      allRequests.length;
    const avgLng =
      allRequests.reduce((sum, r) => sum + r.location.lng, 0) /
      allRequests.length;
    targetCluster.location.lat = avgLat;
    targetCluster.location.lng = avgLng;

    await targetCluster.save();
    console.log(
      `🔗 Request merged into cluster ${targetCluster._id} (${targetCluster.request_ids.length} requests)`,
    );
  } else {
    // Create new cluster for this request
    targetCluster = await Cluster.create({
      location: {
        lat: requestDoc.location.lat,
        lng: requestDoc.location.lng,
        address: requestDoc.location.address || "",
      },
      need_type: requestDoc.need_type,
      request_ids: [requestDoc._id],
      total_people: requestDoc.people_count || 1,
      max_severity: requestDoc.severity,
    });
    console.log(
      `🆕 New cluster created: ${targetCluster._id} for ${requestDoc.need_type}`,
    );
  }

  // Link request back to its cluster
  requestDoc.cluster_id = targetCluster._id;
  requestDoc.status = "Clustered";
  await requestDoc.save();

  return targetCluster;
};

module.exports = { clusterRequest, haversineMetres };
