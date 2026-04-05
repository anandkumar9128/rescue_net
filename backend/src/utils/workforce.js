const Volunteer = require('../models/Volunteer');

/**
 * Returns required volunteers for a given emergency type and cluster size.
 * Outputs a strict map of required roles.
 */
const getRequiredWorkforce = (type, peopleCount, isSOS) => {
  // If it's an SOS, use the strict immediate template
  if (isSOS) {
    return {
      Medical: 1,
      General: 1
    };
  }

  // Otherwise, scale based on type and people count
  const req = {};
  
  if (type === 'Medical') {
    req['Medical'] = Math.ceil(peopleCount / 5); // 1 medic per 5 people
    req['General'] = 1; 
  } else if (type === 'Rescue') {
    req['Rescue'] = Math.ceil(peopleCount / 3);
    req['Medical'] = 1; // Always send one medic to a rescue
  } else if (type === 'Food' || type === 'Shelter') {
    req[type] = Math.ceil(peopleCount / 10);
    req['General'] = Math.ceil(peopleCount / 5);
  } else {
    // Default fallback
    req['General'] = Math.ceil(peopleCount / 5) || 1;
  }

  return req;
};

/**
 * Fetch counts of all Available volunteers for an NGO grouped by their specific skills.
 */
const getAvailableWorkforce = async (ngoId) => {
  const volunteers = await Volunteer.find({ ngo_id: ngoId, status: 'Available' });
  
  const workforce = {
    Medical: 0,
    Food: 0,
    Rescue: 0,
    Shelter: 0,
    General: 0
  };

  volunteers.forEach(v => {
    if (workforce[v.skill_type] !== undefined) {
      workforce[v.skill_type]++;
    }
  });

  return { workforce, rawVolunteers: volunteers };
};

/**
 * Validates if the NGO's available workforce can strictly fulfill the combined static requirements.
 */
const canFulfill = (requirement, available) => {
  for (const [skill, neededCount] of Object.entries(requirement)) {
    if ((available[skill] || 0) < neededCount) {
      // Failed to fulfill a specific role requirement
      return false;
    }
  }
  return true; // All required role limits are met
};

module.exports = {
  getRequiredWorkforce,
  getAvailableWorkforce,
  canFulfill
};
