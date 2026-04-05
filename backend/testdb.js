require('dotenv').config();
const connectDB = require('./src/config/db');
const NGO = require('./src/models/NGO');
const Cluster = require('./src/models/Cluster');

connectDB().then(async () => {
  const ngos = await NGO.find();
  console.log('NGOs:', ngos.map(n => ({ id: n._id, name: n.name, caps: n.capabilities })));
  
  const clusters = await Cluster.find();
  console.log('Clusters:', clusters.map(c => ({ id: c._id, need_type: c.need_type, status: c.status })));
  process.exit(0);
});
