/**
 * Seed Script — populates the database with sample NGOs and volunteers for testing.
 * Run with: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const NGO = require('../models/NGO');
const Volunteer = require('../models/Volunteer');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing seed data
  await NGO.deleteMany({});
  await Volunteer.deleteMany({});
  await User.deleteMany({ role: { $in: ['ngo_admin', 'volunteer'] } });

  // Create NGO admin users
  const ngoAdmins = await User.create([
    { name: 'Red Cross India Admin', phone: '+911111111111', password: 'password123', role: 'ngo_admin' },
    { name: 'NDRF Admin',            phone: '+912222222222', password: 'password123', role: 'ngo_admin' },
    { name: 'Goonj Admin',           phone: '+913333333333', password: 'password123', role: 'ngo_admin' },
  ]);

  // Create NGOs
  const ngos = await NGO.create([
    {
      name: 'Red Cross India',
      contact_email: 'redcross@rescuenet.in',
      contact_phone: '+911111111111',
      location: { lat: 28.6139, lng: 77.2090, address: 'New Delhi' },
      capabilities: ['Medical', 'Rescue', 'Shelter'],
      avg_response_time: 15,
      admin_user_id: ngoAdmins[0]._id,
      isVerified: true,
    },
    {
      name: 'NDRF Team Alpha',
      contact_email: 'ndrf@rescuenet.in',
      contact_phone: '+912222222222',
      location: { lat: 28.7041, lng: 77.1025, address: 'Delhi NCR' },
      capabilities: ['Rescue', 'Medical'],
      avg_response_time: 20,
      admin_user_id: ngoAdmins[1]._id,
      isVerified: true,
    },
    {
      name: 'Goonj Relief',
      contact_email: 'goonj@rescuenet.in',
      contact_phone: '+913333333333',
      location: { lat: 28.5355, lng: 77.3910, address: 'Noida' },
      capabilities: ['Food', 'Shelter'],
      avg_response_time: 25,
      admin_user_id: ngoAdmins[2]._id,
      isVerified: true,
    },
  ]);

  // Link NGO ids to admin users
  for (let i = 0; i < ngoAdmins.length; i++) {
    ngoAdmins[i].ngo_id = ngos[i]._id;
    await ngoAdmins[i].save();
  }

  // Create volunteer users and profiles
  const volunteerData = [
    { name: 'Aryan Sharma',  phone: '+919001111111', skill: 'Medical',  ngo: ngos[0] },
    { name: 'Priya Singh',   phone: '+919002222222', skill: 'Rescue',   ngo: ngos[0] },
    { name: 'Rahul Verma',   phone: '+919003333333', skill: 'General',  ngo: ngos[0] },
    { name: 'Anita Rao',     phone: '+919004444444', skill: 'Rescue',   ngo: ngos[1] },
    { name: 'Karan Mehta',   phone: '+919005555555', skill: 'Medical',  ngo: ngos[1] },
    { name: 'Sneha Gupta',   phone: '+919006666666', skill: 'Food',     ngo: ngos[2] },
    { name: 'Dev Patel',     phone: '+919007777777', skill: 'Shelter',  ngo: ngos[2] },
  ];

  for (const vd of volunteerData) {
    const user = await User.create({
      name: vd.name, phone: vd.phone, password: 'password123', role: 'volunteer', ngo_id: vd.ngo._id,
    });
    await Volunteer.create({
      user_id: user._id,
      ngo_id: vd.ngo._id,
      name: vd.name,
      phone: vd.phone,
      skill_type: vd.skill,
      status: 'Available',
      location: {
        lat: vd.ngo.location.lat + (Math.random() - 0.5) * 0.05,
        lng: vd.ngo.location.lng + (Math.random() - 0.5) * 0.05,
      },
    });
  }

  console.log(`✅ Seeded ${ngos.length} NGOs and ${volunteerData.length} volunteers`);
  console.log('\nNGO Login Credentials:');
  console.log('  Red Cross Admin — phone: +911111111111  password: password123');
  console.log('  NDRF Admin      — phone: +912222222222  password: password123');
  console.log('  Goonj Admin     — phone: +913333333333  password: password123');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
