/**
 * Priority Service
 *
 * Computes a numeric priority score for a request or cluster.
 * Higher score = more urgent = served first.
 *
 * Score components:
 *  - Type weight  (Medical=40, Rescue=30, Shelter=20, Food=10)
 *  - Severity     (Critical=30, High=20, Medium=10, Low=5)
 *  - People count (+0.5 per person, capped at 25)
 *  - Time waiting (+1 per minute waiting, capped at 30)
 */

const TYPE_WEIGHTS = {
  Medical: 40,
  Rescue: 30,
  Shelter: 20,
  Food: 10,
};

const SEVERITY_WEIGHTS = {
  Critical: 30,
  High: 20,
  Medium: 10,
  Low: 5,
};

/**
 * Calculate priority score for a single request
 *
 * @param {Object} params
 * @param {string} params.need_type
 * @param {string} params.severity
 * @param {number} params.people_count
 * @param {Date}   params.created_at
 * @returns {number} priority score
 */
const calculatePriorityScore = ({ need_type, severity, people_count, created_at }) => {
  const typeScore = TYPE_WEIGHTS[need_type] || 10;
  const severityScore = SEVERITY_WEIGHTS[severity] || 10;

  // People bonus: 0.5 per person, max 25
  const peopleScore = Math.min((people_count || 1) * 0.5, 25);

  // Time-waiting bonus: 1 point per minute, max 30
  const minutesWaiting = (Date.now() - new Date(created_at).getTime()) / 60000;
  const timeScore = Math.min(minutesWaiting, 30);

  const total = typeScore + severityScore + peopleScore + timeScore;
  return Math.round(total * 10) / 10; // 1 decimal place
};

/**
 * Calculate priority score for a cluster
 * Uses max_severity and total_people
 */
const calculateClusterPriority = (cluster) => {
  return calculatePriorityScore({
    need_type: cluster.need_type,
    severity: cluster.max_severity,
    people_count: cluster.total_people,
    created_at: cluster.createdAt,
  });
};

module.exports = { calculatePriorityScore, calculateClusterPriority };
