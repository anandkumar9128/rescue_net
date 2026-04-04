const express = require('express');
const router  = express.Router();
const {
  submitJoinRequest,
  getIncomingRequests,
  getMyRequests,
  respondToRequest,
} = require('../controllers/joinRequestController');
const { protect, authorize } = require('../middleware/auth');

// Volunteer submits a join request to an NGO
router.post('/', protect, authorize('volunteer'), submitJoinRequest);

// Volunteer checks their own request statuses
router.get('/my', protect, authorize('volunteer'), getMyRequests);

// NGO admin views all incoming requests for their NGO
router.get('/incoming', protect, authorize('ngo_admin'), getIncomingRequests);

// NGO admin approves or rejects a request
router.patch('/:id', protect, authorize('ngo_admin'), respondToRequest);

module.exports = router;
