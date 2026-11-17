require('dotenv').config();
const mongoose = require('mongoose');

const departmentsToSeed = [
  {
    name: 'General Medicine',
    description: 'Primary healthcare, internal medicine, and acute consultations',
    location: '',
    isActive: true
  },
  {
    name: 'Ophthalmology',
    description: 'Eye care, vision assessments, and ocular treatments',
    location: '',
    isActive: true
  },
  {
    name: 'Dermatology',
    description: 'Skin, hair, nail conditions, and allergic skin disorders',
    location: '',
    isActive: true
  },
  {
    name: 'Pediatrics',
    description: 'Comprehensive infant, child, and adolescent healthcare',
    location: '',
    isActive: true
  },
  {
    name: 'Orthopedics',
    description: 'Musculoskeletal system, joint, bone, and spine care',
    location: '',
    isActive: true
  },
  {
    name: 'ENT',
    description: 'Ear, nose, throat, head and neck medical services',
    location: '',
    isActive: true
  },
  {
    name: 'Neurology',
    description: 'Brain, spinal cord, nerve, and neuromuscular consultations',
    location: '',
    isActive: true
  }
];

async function seed() {
  const uri = process.env.MONGOURL;
  if (!uri) {
    console.error('MONGOURL not found in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas');

  const Department = require('../src/models/department.model');
  const Doctor = require('../src/models/doctor.model');

  // Pre-check
  const initialDepts = await Department.find({}).lean();
  console.log(`Current department count before run: ${initialDepts.length}`);
  const initialCardiology = initialDepts.find(d => d.name === 'Cardiology');
  console.log('Cardiology check:', initialCardiology ? { id: initialCardiology._id.toString(), name: initialCardiology.name, location: initialCardiology.location } : 'Not found');

  const initialDoctor = await Doctor.findOne({ 'userId.name': /Rahul Sharma/i }).populate('department').lean() || await Doctor.findOne({}).populate('department').lean();
  console.log('Doctor check:', initialDoctor ? { id: initialDoctor._id.toString(), deptId: initialDoctor.department?._id?.toString(), deptName: initialDoctor.department?.name } : 'None');

  const seedResults = [];

  for (const dept of departmentsToSeed) {
    const existing = await Department.findOne({ name: dept.name }).lean();
    const doc = await Department.findOneAndUpdate(
      { name: dept.name },
      { $setOnInsert: dept },
      { upsert: true, returnDocument: 'after' }
    );
    seedResults.push({
      name: doc.name,
      _id: doc._id.toString(),
      alreadyExisted: !!existing,
      isActive: doc.isActive,
      location: doc.location
    });
  }

  console.log('\nSeeding summary:');
  console.table(seedResults);

  // Post-check
  const finalDepts = await Department.find({}).sort({ name: 1 }).lean();
  console.log(`\nFinal department count: ${finalDepts.length}`);

  const postCardiology = await Department.findById(initialCardiology._id).lean();
  console.log('Post-seed Cardiology:', {
    id: postCardiology._id.toString(),
    name: postCardiology.name,
    location: postCardiology.location,
    isActive: postCardiology.isActive
  });

  const postDoctor = await Doctor.findById(initialDoctor._id).populate('department').lean();
  console.log('Post-seed Doctor check:', {
    id: postDoctor._id.toString(),
    deptId: postDoctor.department?._id?.toString(),
    deptName: postDoctor.department?.name
  });

  // Check duplicates
  const names = finalDepts.map(d => d.name);
  const duplicates = names.filter((item, index) => names.indexOf(item) !== index);
  console.log('Duplicates found:', duplicates.length === 0 ? 'None' : duplicates);

  console.log('\nAll Active Departments in Atlas:');
  finalDepts.forEach((d, idx) => {
    console.log(`${idx + 1}. ${d.name.padEnd(18)} | ID: ${d._id} | Active: ${d.isActive} | Location: "${d.location}"`);
  });

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB Atlas');
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
