const jwt = require('jsonwebtoken');
const User = require('../models/User');
const NGO = require('../models/NGO');
const Volunteer = require('../models/Volunteer');

/** Generate JWT token */
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/**
 * POST /api/auth/register
 * Registers a user, volunteer, or ngo_admin
 */
const register = async (req, res, next) => {
  try {
    const { name, phone, email, password, role, ngo_id, skill_type, ngo } = req.body;

    // Create base user
    const user = await User.create({ name, phone, email, password, role: role || 'user' });

    // If registering as volunteer, create Volunteer profile
    if (role === 'volunteer') {
      await Volunteer.create({
        user_id: user._id,
        ngo_id: ngo_id || null,
        name,
        phone,
        skill_type: skill_type || 'General',
        status: 'Available',
      });
      user.ngo_id = ngo_id || null;
      await user.save();
    }

    // If registering as NGO admin, create NGO profile
    if (role === 'ngo_admin' && ngo) {
      const ngoDoc = await NGO.create({
        ...ngo,
        admin_user_id: user._id,
      });
      user.ngo_id = ngoDoc._id;
      await user.save();
    }

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        ngo_id: user.ngo_id,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password required' });
    }

    const user = await User.findOne({ phone });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        ngo_id: user.ngo_id,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { register, login, getMe };
