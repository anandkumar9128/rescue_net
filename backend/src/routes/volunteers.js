const express = require('express');
const router = express.Router();
const {
  getMyProfile,
  getMyTasks,
  getVolunteers,
  getVolunteerTasks,
  updateVolunteerStatus,
  acceptVolunteerTask,
  rejectVolunteerTask,
  updateAssignmentStatus,
  updateMyLocation,
} = require('../controllers/volunteerController');
const { protect } = require('../middleware/auth');

// ── /me routes MUST come before /:id to avoid Express matching 'me' as an id ──
router.get('/me', protect, getMyProfile);
router.get('/me/tasks', protect, getMyTasks);
router.patch('/me/location', protect, updateMyLocation);  // 📍 real-time location push

router.get('/', protect, getVolunteers);
router.get('/:id/tasks', protect, getVolunteerTasks);
router.patch('/:id/status', protect, updateVolunteerStatus);
router.post('/accept-task', protect, acceptVolunteerTask);
router.post('/reject-task', protect, rejectVolunteerTask);
router.patch('/assignments/:id/status', protect, updateAssignmentStatus);

module.exports = router;
