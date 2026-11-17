import React, { useState, useEffect } from 'react';
import {
  getMyAppointments,
  cancelAppointment,
  rescheduleAppointment,
  getErrorMessage,
} from '../../services/api';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableEmpty,
  TableLoading,
} from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';
import {
  IoCalendarOutline,
  IoCloseCircleOutline,
  IoRefreshOutline,
  IoTimeOutline,
} from 'react-icons/io5';

const MyAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Cancel Modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedApptToCancel, setSelectedApptToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Reschedule Modal state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedApptToReschedule, setSelectedApptToReschedule] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [rescheduling, setRescheduling] = useState(false);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyAppointments();
      setAppointments(res.appointments || []);
    } catch (err) {
      console.error('Error fetching my appointments:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Filter logic
  const now = new Date();
  const filteredAppointments = appointments.filter((appt) => {
    const apptDate = new Date(appt.appointmentDate);
    if (activeTab === 'upcoming') {
      return (
        ['pending', 'confirmed', 'in-queue', 'in-consultation'].includes(appt.status)
      );
    }
    if (activeTab === 'past') {
      return (
        ['completed', 'missed'].includes(appt.status) ||
        (apptDate < now && !['in-queue', 'in-consultation', 'pending', 'confirmed'].includes(appt.status))
      );
    }
    if (activeTab === 'cancelled') {
      return appt.status === 'cancelled' || appt.status === 'rejected';
    }
    return true; // 'all'
  });

  // Handle Cancel
  const openCancelModal = (appt) => {
    setSelectedApptToCancel(appt);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!selectedApptToCancel) return;
    setCancelling(true);
    try {
      await cancelAppointment(
        selectedApptToCancel._id,
        cancelReason.trim() || 'Patient requested cancellation'
      );
      setCancelModalOpen(false);
      setSelectedApptToCancel(null);
      await fetchAppointments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  // Handle Reschedule
  const openRescheduleModal = (appt) => {
    setSelectedApptToReschedule(appt);
    const existingDate = new Date(appt.appointmentDate);
    setNewDate(existingDate.toISOString().split('T')[0]);
    setNewTime(existingDate.toTimeString().substring(0, 5));
    setRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedApptToReschedule || !newDate || !newTime) return;
    setRescheduling(true);
    try {
      const combined = new Date(`${newDate}T${newTime}:00`);
      await rescheduleAppointment(selectedApptToReschedule._id, combined.toISOString());
      setRescheduleModalOpen(false);
      setSelectedApptToReschedule(null);
      await fetchAppointments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Appointments</h1>
          <p className="text-sm text-slate-500">
            View, track, and manage all your medical appointments
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={IoRefreshOutline}
          onClick={fetchAppointments}
          isLoading={loading}
        >
          Refresh
        </Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        {[
          { key: 'all', label: 'All' },
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'past', label: 'Past & Completed' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px cursor-pointer ${
              activeTab === tab.key
                ? 'border-[#0E382C] text-[#0E382C] font-bold'
                : 'border-transparent text-[#526B62] hover:text-[#0E382C]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Appointments Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Date & Time</TableHeader>
              <TableHeader>Doctor</TableHeader>
              <TableHeader>Department</TableHeader>
              <TableHeader>Reason</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <tbody>
            {loading ? (
              <TableLoading colSpan={6} />
            ) : filteredAppointments.length === 0 ? (
              <TableEmpty
                colSpan={6}
                message={`No ${activeTab !== 'all' ? activeTab : ''} appointments found.`}
                icon={IoCalendarOutline}
              />
            ) : (
              filteredAppointments.map((appt) => {
                const dateObj = new Date(appt.appointmentDate);
                const doctorName =
                  appt.doctor?.userId?.name || appt.doctor?.name || 'Assigned Doctor';
                const deptName =
                  appt.department?.name || appt.doctor?.department?.name || 'General';

                const canCancel = appt.status === 'pending' || appt.status === 'confirmed' || appt.status === 'in-queue';
                const canReschedule = appt.status === 'pending';

                return (
                  <TableRow key={appt._id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">
                        {dateObj.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <IoTimeOutline className="w-3.5 h-3.5" />
                        {dateObj.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">Dr. {doctorName}</div>
                      <div className="text-xs text-slate-500">{appt.doctor?.specialization}</div>
                    </TableCell>
                    <TableCell>{deptName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-xs text-slate-600 line-clamp-2 max-w-xs">
                          {appt.reason || 'General Checkup'}
                        </span>
                        {appt.aiTriageSuggestion?.urgency && (
                          <span
                            title={appt.aiTriageSuggestion.disclaimer || 'AI suggestion only, not a medical diagnosis.'}
                            className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              appt.aiTriageSuggestion.urgency === 'high'
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : appt.aiTriageSuggestion.urgency === 'medium'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            Triage: {appt.aiTriageSuggestion.urgency}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge status={appt.status} />
                        {appt.status === 'in-queue' && appt.predictedWaitMinutes !== null && appt.predictedWaitMinutes !== undefined && (
                          <span
                            title={`${appt.waitPredictionSource === 'ml-model' ? 'Predicted by ML Model' : 'Estimated by Queue Formula'} (Approximate queue wait, not guaranteed. Typical prediction error: ${appt.typicalErrorMinutes ?? (appt.waitPredictionSource === 'ml-model' ? 2.4 : 5)} min)`}
                            className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 flex items-center gap-1"
                          >
                            <IoTimeOutline className="w-3 h-3" />
                            ~{appt.predictedWaitMinutes} min (Typical error: {appt.typicalErrorMinutes ?? (appt.waitPredictionSource === 'ml-model' ? 2.4 : 5)}m)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {canReschedule && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRescheduleModal(appt)}
                        >
                          Reschedule
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => openCancelModal(appt)}
                        >
                          Cancel
                        </Button>
                      )}
                      {!canCancel && !canReschedule && (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </tbody>
        </Table>
      </TableContainer>

      {/* Cancel Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Appointment"
        subtitle="Are you sure you want to cancel this appointment?"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelling}
            >
              Keep Appointment
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelSubmit}
              isLoading={cancelling}
              icon={IoCloseCircleOutline}
            >
              Confirm Cancellation
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-left">
          <p className="text-sm text-slate-600">
            Please let the hospital know the reason for cancellation:
          </p>
          <textarea
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g., Scheduling conflict, recovered, booked another date..."
            className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        isOpen={rescheduleModalOpen}
        onClose={() => setRescheduleModalOpen(false)}
        title="Reschedule Appointment"
        subtitle="Choose a new date and time for your consultation"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setRescheduleModalOpen(false)}
              disabled={rescheduling}
            >
              Dismiss
            </Button>
            <Button
              variant="primary"
              onClick={handleRescheduleSubmit}
              isLoading={rescheduling}
            >
              Update Appointment
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-left">
          <Input
            label="New Date"
            type="date"
            min={new Date().toISOString().split('T')[0]}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            required
          />
          <Input
            label="New Time"
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            required
          />
        </div>
      </Modal>
    </div>
  );
};

export default MyAppointments;
