import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getAppointmentById,
  createPrescription,
  getErrorMessage,
} from '../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  IoAddCircleOutline,
  IoTrashOutline,
  IoCheckmarkCircle,
  IoPersonOutline,
  IoCalendarOutline,
  IoArrowBackOutline,
  IoDocumentTextOutline,
} from 'react-icons/io5';

const CreatePrescription = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [loadingAppt, setLoadingAppt] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form State
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [medicines, setMedicines] = useState([
    { name: '', dosage: '', frequency: '', duration: '', instructions: '' },
  ]);

  // Fetch appointment on mount
  useEffect(() => {
    let isMounted = true;
    const fetchAppt = async () => {
      try {
        setLoadingAppt(true);
        setError('');
        const res = await getAppointmentById(appointmentId);
        if (isMounted) {
          setAppointment(res.appointment || null);
        }
      } catch (err) {
        console.error('Error fetching appointment for prescription:', err);
        if (isMounted) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setLoadingAppt(false);
        }
      }
    };

    if (appointmentId) {
      fetchAppt();
    }

    return () => {
      isMounted = false;
    };
  }, [appointmentId]);

  // Dynamic medicines list handlers
  const handleMedicineChange = (index, field, value) => {
    setMedicines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      { name: '', dosage: '', frequency: '', duration: '', instructions: '' },
    ]);
  };

  const handleRemoveMedicine = (index) => {
    if (medicines.length === 1) {
      // Keep at least one empty row
      setMedicines([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
      return;
    }
    setMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!diagnosis.trim()) {
      setError('Diagnosis is required to submit a prescription.');
      return;
    }

    // Validate medicines (only include medicines that have a name filled)
    const validMedicines = medicines.filter((m) => m.name.trim().length > 0);
    if (validMedicines.length === 0) {
      setError('Please add at least one medication with a valid name.');
      return;
    }

    // Ensure required fields for each added medicine
    for (const med of validMedicines) {
      if (!med.dosage.trim() || !med.frequency.trim() || !med.duration.trim()) {
        setError(`Please provide dosage, frequency, and duration for ${med.name}.`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        appointmentId,
        diagnosis: diagnosis.trim(),
        medicines: validMedicines,
        advice: advice.trim(),
        followUpDate: followUpDate || null,
      };

      await createPrescription(payload);
      setSuccess(true);
    } catch (err) {
      console.error('Error creating prescription:', err);
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingAppt) {
    return <LoadingSpinner size="lg" text="Loading appointment details..." />;
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="border-emerald-200 shadow-md text-center p-8">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <IoCheckmarkCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Prescription Saved!</h2>
          <p className="text-sm text-slate-600 mt-2">
            The medical prescription has been added to the patient's medical records and pharmacy
            billing queue.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/doctor/appointments">
              <Button variant="primary" icon={IoArrowBackOutline}>
                Return to Appointments
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const patientName = appointment?.patient?.name || 'Patient';
  const appointmentDate = appointment?.appointmentDate
    ? new Date(appointment.appointmentDate).toLocaleString()
    : 'N/A';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/doctor/appointments">
            <button
              type="button"
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <IoArrowBackOutline className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Prescription</h1>
            <p className="text-xs text-slate-500">
              Formulate patient medication, diagnosis, and medical directions
            </p>
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Appointment Summary Box */}
      <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            <IoPersonOutline className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{patientName}</div>
            <div className="text-xs text-slate-500">
              Phone: {appointment?.patient?.phone || 'N/A'} &bull; Email:{' '}
              {appointment?.patient?.email || 'N/A'}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-600 sm:text-right">
          <div className="font-semibold text-slate-800 flex items-center sm:justify-end gap-1">
            <IoCalendarOutline /> {appointmentDate}
          </div>
          <div className="text-slate-500 mt-0.5">Reason: {appointment?.reason || 'Checkup'}</div>
        </div>
      </div>

      {/* Prescription Form */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Diagnosis */}
            <div>
              <Input
                label="Diagnosis / Clinical Impression"
                placeholder="e.g. Acute Bronchitis, Hypertension Stage 1, Seasonal Allergic Rhinitis"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                required
                icon={IoDocumentTextOutline}
              />
            </div>

            {/* Medicines List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-800 block text-left">
                  Prescribed Medicines <span className="text-red-500">*</span>
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  icon={IoAddCircleOutline}
                  onClick={handleAddMedicine}
                >
                  Add Medicine
                </Button>
              </div>

              <div className="space-y-3">
                {medicines.map((med, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col gap-3 relative animate-fade-in"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        Medicine #{idx + 1}
                      </span>
                      {medicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(idx)}
                          className="text-red-500 hover:text-red-700 p-1 text-xs font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <IoTrashOutline className="w-4 h-4" /> Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <Input
                          label="Medicine Name"
                          placeholder="e.g. Amoxicillin"
                          value={med.name}
                          onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Input
                          label="Dosage"
                          placeholder="e.g. 500mg"
                          value={med.dosage}
                          onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Input
                          label="Frequency"
                          placeholder="e.g. 1-0-1 or 3x/day"
                          value={med.frequency}
                          onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Input
                          label="Duration"
                          placeholder="e.g. 5 days, 2 weeks"
                          value={med.duration}
                          onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          label="Instructions"
                          placeholder="e.g. Take after meals with warm water"
                          value={med.instructions}
                          onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Advice */}
            <div className="text-left">
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Medical Advice / Lifestyle Recommendations
              </label>
              <textarea
                rows={3}
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                placeholder="e.g., Increase fluid intake, rest for 3 days, avoid cold beverages..."
                className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            {/* Follow-up Date */}
            <div className="w-full sm:w-1/2">
              <Input
                label="Follow-up Date (Optional)"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Link to="/doctor/appointments">
                <Button variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={submitting}
                icon={IoDocumentTextOutline}
              >
                Save Prescription
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreatePrescription;
