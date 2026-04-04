const express = require('express');
const router = express.Router();
const {
  getAllNGOs, getNGOById, getNGODashboard, overrideVolunteer, updateNGO,
} = require('../controllers/ngoController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getAllNGOs);
router.get('/:id', getNGOById);
router.get('/:id/dashboard', protect, getNGODashboard);
router.put('/:id', protect, authorize('ngo_admin'), updateNGO);
router.patch('/:id/assignments/:assignmentId/override', protect, authorize('ngo_admin'), overrideVolunteer);

module.exports = router;
