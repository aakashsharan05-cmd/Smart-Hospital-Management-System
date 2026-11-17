require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DEMO_DOCTOR_PASSWORD = process.env.DEMO_DOCTOR_PASSWORD || 'Doctor@123';

const demoDoctorsToSeed = [
  {
    departmentName: 'General Medicine',
    departmentId: '6afc36756214cfe8b9986ff1',
    user: {
      name: 'Dr. Priya Nair',
      email: 'priya.nair@example.com',
      phone: '9876500001',
      role: 'doctor',
      avatar: '',
      isActive: true,
    },
    doctor: {
      specialization: 'General Medicine',
      qualification: 'MBBS, MD Internal Medicine',
      experience: 8,
      consultationFee: 500,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTime: { start: '09:00', end: '17:00' },
      isAvailable: true,
    },
  },
  {
    departmentName: 'Ophthalmology',
    departmentId: '6afc36976214cfe8b9986ff3',
    user: {
      name: 'Dr. Ananya Sen',
      email: 'ananya.sen@example.com',
      phone: '9876500002',
      role: 'doctor',
      avatar: '',
      isActive: true,
    },
    doctor: {
      specialization: 'Ophthalmology',
      qualification: 'MBBS, MS Ophthalmology',
      experience: 6,
      consultationFee: 600,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableTime: { start: '09:00', end: '17:00' },
      isAvailable: true,
    },
  },
  {
    departmentName: 'Dermatology',
    departmentId: '6afc36976214cfe8b9986ff4',
    user: {
      name: 'Dr. Vikram Patel',
      email: 'vikram.patel@example.com',
      phone: '9876500003',
      role: 'doctor',
      avatar: '',
      isActive: true,
    },
    doctor: {
      specialization: 'Dermatology',
      qualification: 'MBBS, MD Dermatology & Venereology',
      experience: 7,
      consultationFee: 700,
      availableDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
      availableTime: { start: '09:00', end: '17:00' },
      isAvailable: true,
    },
  },
  {
    departmentName: 'Pediatrics',
    departmentId: '6afc36976214cfe8b9986ff5',
    user: {
      name: 'Dr. Sneha Kulkarni',
      email: 'sneha.kulkarni@example.com',
      phone: '9876500004',
      role: 'doctor',
      avatar: '',
      isActive: true,
    },
    doctor: {
      specialization: 'Pediatrics',
      qualification: 'MBBS, MD Pediatrics, DCH',
      experience: 9,
      consultationFee: 600,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableTime: { start: '09:00', end: '17:00' },
      isAvailable: true,
    },
  },
  {
    departmentName: 'Orthopedics',
    departmentId: '6afc36976214cfe8b9986ff6',
    user: {
      name: 'Dr. Rajesh Iyer',
      email: 'rajesh.iyer@example.com',
      phone: '9876500005',
      role: 'doctor',
      avatar: '',
      isActive: true,
    },
    doctor: {
      specialization: 'Orthopedics',
      qualification: 'MBBS, MS Orthopedics',
      experience: 10,
      consultationFee: 750,
      availableDays: ['Tuesday', 'Thursday', 'Saturday'],
      availableTime: { start: '09:00', end: '17:00' },
      isAvailable: true,
    },
  },
  {
    departmentName: 'ENT',
    departmentId: '6afc36976214cfe8b9986ff7',
    user: {
      name: 'Dr. Kavita Menon',
      email: 'kavita.menon@example.com',
      phone: '9876500006',
      role: 'doctor',
      avatar: '',
      isActive: true,
    },
    doctor: {
      specialization: 'ENT',
      qualification: 'MBBS, MS ENT',
      experience: 7,
      consultationFee: 650,
      availableDays: ['Monday', 'Wednesday', 'Thursday', 'Friday'],
      availableTime: { start: '09:00', end: '17:00' },
      isAvailable: true,
    },
  },
  {
    departmentName: 'Neurology',
    departmentId: '6afc36986214cfe8b9986ff8',
    user: {
      name: 'Dr. Arjun Mehta',
      email: 'arjun.mehta@example.com',
      phone: '9876500007',
      role: 'doctor',
      avatar: '',
      isActive: true,
    },
    doctor: {
      specialization: 'Neurology',
      qualification: 'MBBS, MD Medicine, DM Neurology',
      experience: 11,
      consultationFee: 900,
      availableDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      availableTime: { start: '09:00', end: '17:00' },
      isAvailable: true,
    },
  },
];

async function seedDoctors() {
  const uri = process.env.MONGOURL;
  if (!uri) {
    console.error('MONGOURL not found in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas');

  const User = require('../src/models/user.model');
  const Doctor = require('../src/models/doctor.model');
  const Department = require('../src/models/department.model');

  // Pre-execution snapshot
  const initialDoctors = await Doctor.find({}).populate('userId').populate('department').lean();
  console.log(`Pre-execution total doctors in Atlas: ${initialDoctors.length}`);

  const rahulDoctor = initialDoctors.find(
    (d) => d._id.toString() === '6acb6355d8fe29c1d84062f6'
  );
  if (!rahulDoctor) {
    throw new Error('Dr. Rahul Sharma (Cardiology) not found in Atlas! Aborting for safety.');
  }
  console.log('Verified existing Dr. Rahul Sharma:', {
    doctorId: rahulDoctor._id.toString(),
    userId: rahulDoctor.userId?._id?.toString(),
    name: rahulDoctor.userId?.name,
    department: rahulDoctor.department?.name,
    fee: rahulDoctor.consultationFee,
  });

  // Verify all 7 departments exist and are active
  for (const item of demoDoctorsToSeed) {
    const dept = await Department.findById(item.departmentId).lean();
    if (!dept || !dept.isActive || dept.name !== item.departmentName) {
      throw new Error(
        `Department ${item.departmentName} (ID: ${item.departmentId}) not found, inactive, or mismatched! Aborting.`
      );
    }
  }
  console.log('Verified all 7 target departments are present and active.');

  // Check for any conflicting accounts before proceeding
  for (const item of demoDoctorsToSeed) {
    const conflictUser = await User.findOne({
      $or: [{ email: item.user.email.toLowerCase() }, { phone: item.user.phone }],
    }).lean();

    if (conflictUser && conflictUser.role !== 'doctor') {
      throw new Error(
        `Email ${item.user.email} or Phone ${item.user.phone} already belongs to an existing non-doctor account (${conflictUser.role}). Aborting.`
      );
    }
  }

  const hashedPassword = await bcrypt.hash(DEMO_DOCTOR_PASSWORD, 10);
  const results = [];
  let insertedUsersCount = 0;
  let insertedDoctorsCount = 0;

  for (const item of demoDoctorsToSeed) {
    // 1. Idempotently resolve or insert User
    const existingUser = await User.findOne({ email: item.user.email.toLowerCase() });
    let userDoc;

    if (!existingUser) {
      userDoc = await User.create({
        name: item.user.name,
        email: item.user.email.toLowerCase(),
        password: hashedPassword,
        phone: item.user.phone,
        role: 'doctor',
        avatar: item.user.avatar || '',
        isActive: true,
      });
      insertedUsersCount++;
    } else {
      userDoc = existingUser;
    }

    // 2. Idempotently resolve or insert Doctor profile
    const existingDoctor = await Doctor.findOne({ userId: userDoc._id });
    let doctorDoc;

    if (!existingDoctor) {
      doctorDoc = await Doctor.create({
        userId: userDoc._id,
        specialization: item.doctor.specialization,
        qualification: item.doctor.qualification,
        experience: item.doctor.experience,
        consultationFee: item.doctor.consultationFee,
        department: item.departmentId,
        availableDays: item.doctor.availableDays,
        availableTime: item.doctor.availableTime,
        isAvailable: item.doctor.isAvailable,
      });
      insertedDoctorsCount++;
    } else {
      doctorDoc = existingDoctor;
    }

    results.push({
      department: item.departmentName,
      doctorName: userDoc.name,
      doctorId: doctorDoc._id.toString(),
      userId: userDoc._id.toString(),
      consultationFee: `₹${doctorDoc.consultationFee}`,
      isNewUser: !existingUser,
      isNewDoctor: !existingDoctor,
      isAvailable: doctorDoc.isAvailable,
    });
  }

  console.log('\n--- Doctor Seeding Summary ---');
  console.table(results);
  console.log(`Newly inserted users: ${insertedUsersCount}`);
  console.log(`Newly inserted doctors: ${insertedDoctorsCount}`);

  // Post-execution verification
  const finalDoctors = await Doctor.find({}).populate('userId').populate('department').lean();
  console.log(`\nPost-execution total doctors in Atlas: ${finalDoctors.length}`);

  // Confirm Dr. Rahul Sharma remains completely unchanged
  const postRahul = finalDoctors.find(
    (d) => d._id.toString() === '6acb6355d8fe29c1d84062f6'
  );
  if (
    !postRahul ||
    postRahul.userId?._id?.toString() !== '6acb6354d8fe29c1d84062f5' ||
    postRahul.department?._id?.toString() !== '6aca8f45500f3b66e1e7231d' ||
    postRahul.consultationFee !== 800
  ) {
    throw new Error('Post-check assertion failed: Dr. Rahul Sharma was altered!');
  }
  console.log('Verified Dr. Rahul Sharma remains completely unchanged.');

  // Verify all 8 departments have an assigned doctor
  const allDepts = await Department.find({ isActive: true }).lean();
  for (const dept of allDepts) {
    const docForDept = finalDoctors.filter(
      (d) => d.department?._id?.toString() === dept._id.toString()
    );
    console.log(
      `Department [${dept.name.padEnd(16)}]: ${docForDept.length} doctor(s) -> ${docForDept.map((d) => d.userId?.name).join(', ')}`
    );
    if (docForDept.length !== 1) {
      throw new Error(`Expected exactly 1 doctor for ${dept.name}, found ${docForDept.length}`);
    }
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB Atlas');
  return { insertedUsersCount, insertedDoctorsCount, totalDoctors: finalDoctors.length, results };
}

if (require.main === module) {
  seedDoctors().catch((err) => {
    console.error('Doctor seeding error:', err);
    process.exit(1);
  });
}

module.exports = { seedDoctors };
