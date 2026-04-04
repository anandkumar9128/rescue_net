/**
 * NGO Selection Service
 *
 * Selects the best NGO (and backups) for a given cluster.
 *
 * Scoring formula:
 *  - Capability match: must handle the need_type
 *  - Distance score:   closer = higher score (max 40 pts)
 *  - Load score:       lower load = higher score (max 30 pts)
 *  - Response time:    faster historical avg = higher score (max 30 pts)
 */
const NGO = require('../models/NGO');
const { haversineMetres } = require('./clusteringService');

const MAX_DISTANCE_METRES = 50000; // 50 km search radius

/**
 * Score a single NGO for a given cluster
 */
const scoreNGO = (ngo, cluster) => {
  const distMetres = haversineMetres(
    cluster.location.lat,
    cluster.location.lng,
    ngo.location.lat,
    ngo.location.lng
  );

  // Distance score: 0–40 (0 if beyond max range)
  const distScore =
    distMetres <= MAX_DISTANCE_METRES
      ? 40 * (1 - distMetres / MAX_DISTANCE_METRES)
      : 0;

  // Load score: 0–30 (30 when load=0, decreasing as load grows)
  const loadScore = Math.max(0, 30 - ngo.current_load * 3);

  // Response time score: 0–30 (30 for ≤5 min, 0 for ≥35 min)
  const respScore = Math.max(0, 30 - (ngo.avg_response_time - 5));

  return {
    ngo,
    distMetres,
    score: distScore + loadScore + respScore,
  };
};

/**
 * Select best NGO + backup NGOs for a cluster
 *
 * @param {Object} cluster - Cluster document (must have location, need_type)
 * @returns {{ primary: NGO, backups: NGO[] }}
 */
const selectNGO = async (cluster) => {
  // Get all active, capable NGOs
  const ngos = await NGO.find({
    isActive: true,
    capabilities: cluster.need_type,
  });

  if (ngos.length === 0) {
    console.warn(`⚠️  No NGOs found for capability: ${cluster.need_type}`);
    return { primary: null, backups: [] };
  }

  // Score and sort descending
  const scored = ngos
    .map((ngo) => scoreNGO(ngo, cluster))
    .filter((s) => s.score > 0) // remove NGOs out of range
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    console.warn(`⚠️  All NGOs out of range for cluster ${cluster._id}`);
    return { primary: null, backups: [] };
  }

  const primary = scored[0].ngo;
  const backups = scored.slice(1, 4).map((s) => s.ngo); // top 3 backups

  console.log(
    `🏥 Selected NGO "${primary.name}" (score: ${scored[0].score.toFixed(1)}) for cluster ${cluster._id}`
  );

  return { primary, backups };
};

module.exports = { selectNGO };
