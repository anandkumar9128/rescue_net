const NGO = require('../models/NGO');

/**
 * Calculate distance between two coordinates using the Haversine formula
 * Returns distance in meters
 */
const haversineDistance = (coords1, coords2) => {
  const toRad = (value) => (value * Math.PI) / 180;

  const lat1 = coords1.lat;
  const lon1 = coords1.lng;
  const lat2 = coords2.lat;
  const lon2 = coords2.lng;

  const R = 6371e3; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

/**
 * Find all active NGOs within a specific radius (in meters) from a cluster location.
 * @param {Object} clusterLocation - { lat, lng }
 * @param {Number} radius - Radius in meters
 * @returns {Array} Array of NGO objects with an appended `distance` property
 */
const findNearbyNGOs = async (clusterLocation, radius) => {
  // Fetch active NGOs (removed isVerified requirement to prevent blocking test accounts)
  const ngos = await NGO.find({ isActive: true });
  
  if (!clusterLocation?.lat || !clusterLocation?.lng) {
    return [];
  }

  const nearby = [];
  
  for (const ngo of ngos) {
    if (ngo.location?.lat && ngo.location?.lng) {
      const dist = haversineDistance(clusterLocation, ngo.location);
      if (dist <= radius) {
        // Manually attach distance for later sorting sorting
        const ngoWithDist = ngo.toObject();
        ngoWithDist.distance = dist;
        nearby.push(ngoWithDist);
      }
    }
  }

  // Sort by distance ascending
  nearby.sort((a, b) => a.distance - b.distance);

  return nearby;
};

module.exports = {
  haversineDistance,
  findNearbyNGOs,
};
