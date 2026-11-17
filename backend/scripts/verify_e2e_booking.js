require('dotenv').config();
const mongoose = require('mongoose');

async function verifyE2E() {
  const uri = process.env.MONGOURL;
  await mongoose.connect(uri);
  console.log('--- E2E Booking & Doctor Integration Verification ---');

  const Department = require('../src/models/department.model');
  const Doctor = require('../src/models/doctor.model');
  const User = require('../src/models/user.model');
  const { triageSymptoms } = require('../src/services/triage.service');

  // Scenario 1: All 8 departments present and active
  const departments = await Department.find({ isActive: true }).sort({ name: 1 }).lean();
  console.log(`\n1. Active Departments in Atlas: ${departments.length}`);
  if (departments.length !== 8) throw new Error(`Expected 8 departments, got ${departments.length}`);

  // Scenario 2: Doctor queries per department
  console.log('\n2. Testing Doctor Lookup by Department:');
  for (const dept of departments) {
    const docs = await Doctor.find({ department: dept._id, isAvailable: true })
      .populate('userId', 'name email phone isActive role')
      .populate('department', 'name')
      .lean();

    if (docs.length !== 1) {
      throw new Error(`Expected 1 doctor for ${dept.name}, got ${docs.length}`);
    }
    const d = docs[0];
    console.log(
      ` - ${dept.name.padEnd(18)} -> ${d.userId.name} | Fee: ₹${d.consultationFee} | Days: [${d.availableDays.join(', ')}] | Hours: ${d.availableTime.start}-${d.availableTime.end}`
    );
  }

  // Scenario 3: AI symptom triage for "burning sensation in my eyes"
  console.log('\n3. Testing Symptom Triage Suggestion:');
  const eyeSymptom = 'burning sensation in my eyes';
  const triageResult = await triageSymptoms(eyeSymptom);
  console.log(`Input symptoms: "${eyeSymptom}"`);
  console.log('Triage response:', {
    suggestedDepartment: triageResult.suggestedDepartment,
    urgency: triageResult.urgency,
    confidence: triageResult.confidence,
    source: triageResult.source,
  });

  if (triageResult.suggestedDepartment !== 'Ophthalmology') {
    throw new Error(
      `Expected triage recommendation "Ophthalmology", got "${triageResult.suggestedDepartment}"`
    );
  }
  console.log('✓ AI Triage correctly recommended Ophthalmology for eye symptoms.');

  // Scenario 4: Slot calculation check for Dr. Ananya Sen
  console.log('\n4. Testing Doctor Slot Generation for Dr. Ananya Sen:');
  const ophthDept = departments.find((d) => d.name === 'Ophthalmology');
  const ophthDoctor = await Doctor.findOne({ department: ophthDept._id })
    .populate('userId')
    .lean();
  console.log(`Doctor: ${ophthDoctor.userId.name}`);
  console.log(`Available days: ${ophthDoctor.availableDays.join(', ')}`);
  console.log(`Available hours: ${ophthDoctor.availableTime.start} to ${ophthDoctor.availableTime.end}`);

  // Calculate slots from start to end (e.g. 09:00 to 17:00 at 30 min intervals)
  const parseMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const fmtMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const slots = [];
  for (let c = parseMin(ophthDoctor.availableTime.start); c < parseMin(ophthDoctor.availableTime.end); c += 30) {
    slots.push(fmtMin(c));
  }
  console.log(`Generated ${slots.length} available slots: [${slots.slice(0, 4).join(', ')}, ..., ${slots.slice(-2).join(', ')}]`);
  if (slots.length < 10) throw new Error('Slot generation failed');
  console.log('✓ Doctor availability and slots verified.');

  // Scenario 5: Cardiology doctor verification
  console.log('\n5. Verifying Cardiology Doctor:');
  const cardioDept = departments.find((d) => d.name === 'Cardiology');
  const cardioDoctor = await Doctor.findOne({ department: cardioDept._id })
    .populate('userId')
    .lean();
  if (cardioDoctor.userId.name !== 'Dr. Rahul Sharma' || cardioDoctor.consultationFee !== 800) {
    throw new Error('Cardiology doctor check failed');
  }
  console.log(`Cardiology doctor: ${cardioDoctor.userId.name} (Fee: ₹${cardioDoctor.consultationFee})`);
  console.log('✓ Cardiology doctor Dr. Rahul Sharma confirmed intact.');

  await mongoose.disconnect();
  console.log('\n=== All E2E Integration Checks Passed Successfully ===');
}

verifyE2E().catch((err) => {
  console.error('E2E Verification failed:', err);
  process.exit(1);
});
