/**
 * Offline Queue
 *
 * In-memory queue that stores requests when both the API pipeline
 * AND SMS fallback fail (e.g., truly offline scenario).
 *
 * When connectivity is restored, queued items are flushed to the DB.
 */
const { v4: uuidv4 } = require('uuid');

const queue = [];
let isProcessing = false;

/**
 * Add a request to the offline queue
 */
const enqueue = (requestData) => {
  const item = {
    id: uuidv4(),
    data: requestData,
    queued_at: new Date().toISOString(),
    retries: 0,
  };
  queue.push(item);
  console.log(`📦 Request queued offline. Queue length: ${queue.length}`);
  return item;
};

/**
 * Get all queued items (for admin review or manual flush)
 */
const getQueue = () => [...queue];

/**
 * Flush queue — attempt to save all pending requests to DB
 * Called when network is restored (can be triggered by a cron or event)
 */
const flushQueue = async (saveFunction) => {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  console.log(`🔄 Flushing offline queue: ${queue.length} items`);

  const toProcess = [...queue];

  for (const item of toProcess) {
    try {
      await saveFunction(item.data);
      // Remove from queue on success
      const idx = queue.findIndex((q) => q.id === item.id);
      if (idx !== -1) queue.splice(idx, 1);
      console.log(`✅ Flushed queued request ${item.id}`);
    } catch (err) {
      item.retries++;
      console.error(`❌ Failed to flush ${item.id} (attempt ${item.retries}): ${err.message}`);

      // Drop after 10 failed retries to prevent queue bloat
      if (item.retries >= 10) {
        const idx = queue.findIndex((q) => q.id === item.id);
        if (idx !== -1) queue.splice(idx, 1);
        console.warn(`🗑️  Dropped request ${item.id} after 10 retries`);
      }
    }
  }

  isProcessing = false;
};

/**
 * Queue length for health-check endpoint
 */
const queueLength = () => queue.length;

module.exports = { enqueue, getQueue, flushQueue, queueLength };
