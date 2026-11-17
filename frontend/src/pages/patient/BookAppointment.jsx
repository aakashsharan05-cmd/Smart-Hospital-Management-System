import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDepartments,
  getDoctors,
  bookAppointment,
  getTriageSuggestion,
  getErrorMessage,
} from '../../services/api';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  IoCalendarOutline,
  IoCheckmarkCircle,
  IoPersonOutline,
  IoCashOutline,
  IoTimeOutline,
  IoArrowForward,
  IoWarningOutline,
  IoSparklesOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const BookAppointment = () => {
  const navigate = useNavigate();

  // Data sources
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Form selections
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [reason, setReason] = useState('');

  // AI Triage State
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState(null);

  // Form submission states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // 1. Fetch departments on mount
  useEffect(() => {
    let isMounted = true;
    const fetchDepts = async () => {
      try {
        setLoadingDepts(true);
        const res = await getDepartments();
        if (isMounted) {
          setDepartments(res.departments || []);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
        if (isMounted) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setLoadingDepts(false);
        }
      }
    };

    fetchDepts();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch doctors when department changes
  useEffect(() => {
    if (!selectedDepartment) {
      setDoctors([]);
      setSelectedDoctorId('');
      return;
    }

    let isMounted = true;
    const fetchDocs = async () => {
      try {
        setLoadingDocs(true);
        const res = await getDoctors({ department: selectedDepartment });
        if (isMounted) {
          setDoctors(res.doctors || []);
          setSelectedDoctorId('');
          setAppointmentDate('');
          setSelectedTimeSlot('');
        }
      } catch (err) {
        console.error('Error fetching doctors:', err);
        if (isMounted) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setLoadingDocs(false);
        }
      }
    };

    fetchDocs();
    return () => {
      isMounted = false;
    };
  }, [selectedDepartment]);

  const triageRequestIdRef = useRef(0);

  // 3. Debounced AI Symptom Triage Suggestion (500ms delay, minimum 5 chars)
  useEffect(() => {
    const text = reason.trim();
    if (text.length < 5) {
      triageRequestIdRef.current++;
      setTriageResult(null);
      setTriageLoading(false);
      return;
    }

    // Invalidate previous in-flight requests and clear stale recommendation immediately
    const currentRequestId = ++triageRequestIdRef.current;
    setTriageResult(null);
    setTriageLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await getTriageSuggestion(text);
        if (currentRequestId === triageRequestIdRef.current) {
          if (res.success && res.triage) {
            setTriageResult(res.triage);
          }
        }
      } catch (err) {
        // Triage is non-blocking; do not disrupt booking flow if rate-limited
        console.error('Triage suggestion unavailable:', err);
      } finally {
        if (currentRequestId === triageRequestIdRef.current) {
          setTriageLoading(false);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [reason]);

  // Handle clicking "Apply Suggested Department"
  const handleApplySuggestedDept = () => {
    if (!triageResult?.suggestedDepartment || !departments.length) return;
    const matched = departments.find(
      (d) => d.name.toLowerCase() === triageResult.suggestedDepartment.toLowerCase()
    );
    if (matched) {
      setSelectedDepartment(matched._id);
    }
  };

  // Find currently selected doctor object
  const selectedDoctor = useMemo(() => {
    return doctors.find((d) => d._id === selectedDoctorId) || null;
  }, [doctors, selectedDoctorId]);

  // Generate 30-min time slots from doctor's availableTime (e.g. 09:00 to 17:00)
  const timeSlots = useMemo(() => {
    if (!selectedDoctor) return [];

    const startTime = selectedDoctor.availableTime?.start || '09:00';
    const endTime = selectedDoctor.availableTime?.end || '17:00';

    const parseMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    const formatMinutes = (totalMinutes) => {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const startMin = parseMinutes(startTime);
    const endMin = parseMinutes(endTime);

    const slots = [];
    for (let current = startMin; current < endMin; current += 30) {
      slots.push(formatMinutes(current));
    }

    return slots;
  }, [selectedDoctor]);

  // Validate if selected date falls on an available day
  const isDateValidForDoctor = (dateStr) => {
    if (!dateStr || !selectedDoctor) return false;
    const selected = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected < today) return false;

    const dayName = DAYS_OF_WEEK[selected.getDay()];
    if (
      selectedDoctor.availableDays &&
      selectedDoctor.availableDays.length > 0 &&
      !selectedDoctor.availableDays.includes(dayName)
    ) {
      return false;
    }
    return true;
  };

  const handleDateChange = (e) => {
    const val = e.target.value;
    setAppointmentDate(val);
    setSelectedTimeSlot('');

    if (val && selectedDoctor) {
      const selected = new Date(val + 'T00:00:00');
      const dayName = DAYS_OF_WEEK[selected.getDay()];
      if (
        selectedDoctor.availableDays &&
        selectedDoctor.availableDays.length > 0 &&
        !selectedDoctor.availableDays.includes(dayName)
      ) {
        setError(
          `Dr. ${selectedDoctor.userId?.name || 'Doctor'} is not available on ${dayName}s. Available days: ${selectedDoctor.availableDays.join(', ')}`
        );
      } else {
        setError('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('Please describe your medical reason or symptoms for the visit.');
      return;
    }
    if (!selectedDepartment) {
      setError('Please choose a medical department.');
      return;
    }
    if (!selectedDoctorId) {
      setError('Please choose a doctor for consultation.');
      return;
    }
    if (!appointmentDate) {
      setError('Please choose a valid appointment date.');
      return;
    }
    if (!isDateValidForDoctor(appointmentDate)) {
      setError('Selected appointment date is invalid or doctor is not available on this day.');
      return;
    }
    if (!selectedTimeSlot) {
      setError('Please pick an available time slot.');
      return;
    }

    setSubmitting(true);

    try {
      const combinedDateTime = new Date(`${appointmentDate}T${selectedTimeSlot}:00`);

      const payload = {
        doctorId: selectedDoctorId,
        appointmentDate: combinedDateTime.toISOString(),
        reason: reason.trim(),
      };

      const res = await bookAppointment(payload);
      setSuccessData(res.appointment || { ...payload, doctor: selectedDoctor });
    } catch (err) {
      console.error('Error booking appointment:', err);
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Minimum date for date picker: tomorrow or today
  const minDate = new Date().toISOString().split('T')[0];

  if (loadingDepts) {
    return <LoadingSpinner size="lg" text="Loading hospital departments..." />;
  }

  // Render Confirmation view after successful booking
  if (successData) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Card className="border-emerald-200 shadow-md">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <IoCheckmarkCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Appointment Booked Successfully!</h2>
            <p className="text-sm text-slate-600 mt-2">
              Your appointment request has been recorded. The clinic will review and confirm your
              slot shortly.
            </p>

            <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5 text-left space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
                <Badge status={successData.status || 'pending'} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Doctor</span>
                <span className="text-sm font-semibold text-slate-900">
                  Dr. {selectedDoctor?.userId?.name || selectedDoctor?.name || 'Doctor'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Specialization</span>
                <span className="text-sm text-slate-700">{selectedDoctor?.specialization}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Scheduled Date & Time</span>
                <span className="text-sm font-bold text-[#0E382C]">
                  {appointmentDate} at {selectedTimeSlot}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Consultation Fee</span>
                <span className="text-sm font-bold text-slate-900">
                  ${selectedDoctor?.consultationFee}
                </span>
              </div>
              {successData.queueNumber && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-sm text-slate-500">Queue Number</span>
                  <span className="text-sm font-bold text-emerald-700">
                    #{successData.queueNumber}
                  </span>
                </div>
              )}

              {/* Server-persisted AI Triage Suggestion */}
              {successData.aiTriageSuggestion?.suggestedDepartment && (
                <div className="pt-3 border-t border-slate-200 text-xs text-slate-700 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <IoSparklesOutline className="text-[#0E382C]" /> AI Triage Assessment
                    </span>
                    <span className="font-bold text-slate-900">
                      {successData.aiTriageSuggestion.suggestedDepartment} (
                      <span className={
                        successData.aiTriageSuggestion.urgency === 'high'
                          ? 'text-red-600 font-bold'
                          : successData.aiTriageSuggestion.urgency === 'medium'
                          ? 'text-amber-600 font-bold'
                          : 'text-emerald-600 font-bold'
                      }>
                        {successData.aiTriageSuggestion.urgency || 'low'} urgency
                      </span>
                      )
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 italic text-right">
                    {successData.aiTriageSuggestion.disclaimer || 'AI suggestion only, not a medical diagnosis.'}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="primary"
                onClick={() => navigate('/patient/appointments')}
                icon={IoCalendarOutline}
              >
                View My Appointments
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSuccessData(null);
                  setSelectedDepartment('');
                  setSelectedDoctorId('');
                  setAppointmentDate('');
                  setSelectedTimeSlot('');
                  setReason('');
                  setTriageResult(null);
                }}
              >
                Book Another
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Book an Appointment</h1>
        <p className="text-sm text-slate-500 mt-1">
          Describe your symptoms, choose your department and physician, and reserve an available appointment slot.
        </p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <Card>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Reason / Symptoms with AI Triage Assistant */}
            <div className="text-left space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-[#11261F] block">
                  1. Reason for Visit & Symptoms <span className="text-red-500">*</span>
                </label>
                {triageLoading && (
                  <span className="text-xs text-[#0E382C] font-semibold flex items-center gap-1">
                    <IoSparklesOutline className="animate-spin w-3.5 h-3.5" />
                    AI analyzing symptoms...
                  </span>
                )}
              </div>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe what symptoms or issues you are experiencing (e.g. persistent headache, chest discomfort, joint pain)..."
                required
                maxLength={500}
                className="w-full rounded-lg border border-[#CCD8D1] p-3 text-sm text-[#11261F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E382C]/20 focus:border-[#0E382C]"
              />
              <div className="flex justify-between items-center text-xs text-[#526B62]">
                <span>Real-time AI suggestions activate after 5 characters</span>
                <span>{reason.length}/500</span>
              </div>

              {/* Loading indicator while analyzing */}
              {triageLoading && (
                <div className="p-3.5 rounded-xl bg-[#EDF7F2] border border-[#C6E7D5] flex items-center gap-2 text-xs text-[#0D4233] animate-pulse text-left font-medium">
                  <IoSparklesOutline className="animate-spin w-4 h-4 text-[#0E382C] shrink-0" />
                  <span>Analyzing symptoms with clinical AI triage...</span>
                </div>
              )}

              {/* High-Urgency Emergency Notice */}
              {!triageLoading && triageResult?.urgency === 'high' && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 space-y-1.5 animate-fade-in">
                  <div className="flex items-center gap-2 font-bold text-red-800 text-sm">
                    <IoWarningOutline className="w-5 h-5 text-red-600 shrink-0" />
                    Urgent Medical Attention Notice
                  </div>
                  <p className="text-xs text-red-700 leading-relaxed">
                    The symptoms entered indicate potential high clinical urgency. If you or the patient are experiencing a life-threatening medical emergency (such as severe chest pain, sudden numbness/paralysis, difficulty breathing, or severe trauma), please call emergency services (112 / 102) or proceed to the nearest hospital emergency room immediately.
                  </p>
                </div>
              )}

              {/* Interactive AI Triage Suggestion Card (Subtle Light Green Panel) */}
              {!triageLoading && triageResult && (
                <div className="p-4 rounded-xl bg-[#EDF7F2] border border-[#C6E7D5] space-y-3 animate-fade-in text-left">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-[#0E382C] text-sm">
                      <IoSparklesOutline className="text-[#0E382C] w-4 h-4" />
                      AI Triage Recommendation
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        triageResult.urgency === 'high'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : triageResult.urgency === 'medium'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {triageResult.urgency} Urgency
                    </span>
                  </div>

                  {triageResult.suggestedDepartment ? (
                    <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                      <div>
                        <span className="text-xs text-[#526B62]">Suggested Department: </span>
                        <span className="text-sm font-bold text-[#11261F]">
                          {triageResult.suggestedDepartment}
                        </span>
                      </div>

                      {departments.some(
                        (d) => d.name.toLowerCase() === triageResult.suggestedDepartment.toLowerCase()
                      ) && (
                        <button
                          type="button"
                          onClick={handleApplySuggestedDept}
                          className="text-xs font-bold px-3 py-1.5 bg-[#E5B229] hover:bg-[#D4A11D] text-[#0E382C] rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <IoShieldCheckmarkOutline className="w-3.5 h-3.5" />
                          Select {triageResult.suggestedDepartment}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="pt-1 text-xs text-[#526B62]">
                      No active hospital department specifically matches these symptoms. Please select a department manually or consult General Medicine when available.
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#C6E7D5] text-[11px] text-[#526B62] italic">
                    {triageResult.disclaimer || 'AI suggestion only, not a medical diagnosis.'}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Department */}
            <div>
              <Select
                label="2. Medical Department"
                name="department"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                required
                placeholder="-- Select Department --"
              >
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name} {dept.location ? `(${dept.location})` : ''}
                  </option>
                ))}
              </Select>
            </div>

            {/* Step 3: Doctor */}
            {selectedDepartment && (
              <div>
                <Select
                  label="3. Choose Doctor"
                  name="doctor"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  required
                  disabled={loadingDocs}
                  placeholder={
                    loadingDocs ? 'Loading available doctors...' : '-- Select Doctor --'
                  }
                >
                  {doctors.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      Dr. {doc.userId?.name || doc.name} - {doc.specialization} (
                      {doc.experience} yrs exp)
                    </option>
                  ))}
                </Select>
                {doctors.length === 0 && !loadingDocs && (
                  <p className="text-xs text-amber-600 mt-1">
                    No active doctors available in this department right now.
                  </p>
                )}
              </div>
            )}

            {/* Step 4: Doctor Details Card */}
            {selectedDoctor && (
              <div className="p-4 rounded-xl bg-[#EDF7F2]/80 border border-[#C6E7D5] space-y-2 animate-fade-in text-sm text-left">
                <div className="flex items-center gap-2 font-bold text-[#0E382C]">
                  <IoPersonOutline className="text-[#0E382C] w-5 h-5" />
                  Dr. {selectedDoctor.userId?.name || selectedDoctor.name}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#526B62] pt-1">
                  <div>
                    <span className="font-semibold text-[#11261F]">Qualification: </span>
                    {selectedDoctor.qualification}
                  </div>
                  <div className="flex items-center gap-1">
                    <IoCashOutline className="text-[#526B62]" />
                    <span className="font-semibold text-[#11261F]">Fee: </span>$
                    {selectedDoctor.consultationFee}
                  </div>
                  <div className="flex items-center gap-1">
                    <IoTimeOutline className="text-[#526B62]" />
                    <span className="font-semibold text-[#11261F]">Hours: </span>
                    {selectedDoctor.availableTime?.start} - {selectedDoctor.availableTime?.end}
                  </div>
                </div>
                <div className="text-xs text-[#526B62] pt-1 border-t border-[#C6E7D5]/60">
                  <span className="font-semibold text-[#11261F]">Available Days: </span>
                  {selectedDoctor.availableDays?.length > 0
                    ? selectedDoctor.availableDays.join(', ')
                    : 'All days'}
                </div>
              </div>
            )}

            {/* Step 5: Date */}
            {selectedDoctor && (
              <div>
                <Input
                  label="4. Appointment Date"
                  type="date"
                  min={minDate}
                  value={appointmentDate}
                  onChange={handleDateChange}
                  required
                  icon={IoCalendarOutline}
                  helperText={
                    selectedDoctor.availableDays?.length
                      ? `Doctor available on: ${selectedDoctor.availableDays.join(', ')}`
                      : 'Select any future day'
                  }
                />
              </div>
            )}

            {/* Step 6: Time Slots */}
            {appointmentDate && timeSlots.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-[#11261F] block mb-2 text-left">
                  5. Available Time Slots <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {timeSlots.map((slot) => {
                    const isSelected = selectedTimeSlot === slot;
                    return (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => setSelectedTimeSlot(slot)}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#0E382C] text-[#E5B229] border-[#0E382C] font-bold shadow-xs'
                            : 'bg-white text-[#11261F] border-[#CCD8D1] hover:border-[#0E382C] hover:bg-[#EDF7F2]'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={submitting}
                icon={IoArrowForward}
              >
                Confirm Appointment Booking
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookAppointment;
