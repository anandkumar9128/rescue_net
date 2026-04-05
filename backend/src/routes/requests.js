const express = require('express');
const router = express.Router();
const {
  createRequest, getRequests, getClusters, getOfflineQueue, triggerDispatch
} = require('../controllers/requestController');
const { protect } = require('../middleware/auth');

// Public SOS (no auth required — anyone can send emergency)
router.post('/', createRequest);

// Protected routes
router.get('/', protect, getRequests);
router.get('/clusters', getClusters);
router.post('/assign', protect, triggerDispatch);
router.get('/queue', protect, getOfflineQueue);

module.exports = router;
