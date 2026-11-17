import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getDoctorAppointments,
  updateAppointmentStatus,
  startConsultation,
  endConsultation,
  getPrescriptionsByAppointment,
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
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Alert from '../../components/ui/Alert';
import useQueueSocket from '../../hooks/useQueueSocket';
import {
  IoCalendarOutline,
  IoCheckmarkOutline,
  IoCloseOutline,
  IoDocumentTextOutline,
  IoTimeOutline,
  IoRefreshOutline,
} from 'react-icons/io5';

const DoctorAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Prescription View Modal
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [viewingPrescription, setViewingPrescription] = useState(null);
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getDoctorAppointments();
      setAppointments(res.appointments || []);
    } catch (err) {
      console.error('Error fetching doctor appointments:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const { isConnected: isLiveConnected } = useQueueSocket({
    onQueueUpdate: () => {
      fetchAppointments();
    },
    onStatusChange: () => {
      fetchAppointments();
    },
  });

  const handleStatusUpdate = async (id, newStatus) => {
    setActionLoadingId(id);
    try {
      await updateAppointmentStatus(id, {
        status: newStatus,
        notes: `Status updated to ${newStatus} by doctor`,
      });
      await fetchAppointments();
    } catch (err) {
      console.error(`Error updating status to ${newStatus}:`, err);
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartConsultation = async (id) => {
    setActionLoadingId(id);
    try {
      await startConsultation(id);
      await fetchAppointments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEndConsultation = async (id) => {
    setActionLoadingId(id);
    try {
      await endConsultation(id);
      await fetchAppointments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleViewPrescription = async (appointmentId) => {
    setPrescriptionLoading(true);
    setPrescriptionModalOpen(true);
    setViewingPrescription(null);
    try {
      const res = await getPrescriptionsByAppointment(appointmentId);
      const list = res.prescriptions || [];
      if (list.length > 0) {
        setViewingPrescription(list[0]);
      } else {
        setViewingPrescription({ empty: true });
      }
    } catch (err) {
      console.error('Error viewing prescription:', err);
      setError(getErrorMessage(err));
    } finally {
      setPrescriptionLoading(false);
    }
  };

  // Filter appointments
  const filteredAppointments = appointments.filter((appt) => {
    if (statusFilter !== 'all' && appt.status !== statusFilter) {
      return false;
    }
    if (dateFilter) {
      const apptDateStr = new Date(appt.appointmentDate).toISOString().split('T')[0];
      if (apptDateStr !== dateFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Consultations</h1>
          <p className="text-sm text-slate-500">
            Review appointments, update statuses, and prescribe medication
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {isLiveConnected && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Consultations
            </span>
          )}
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
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-48">
            <Select
              name="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder=""
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="in-queue">In Queue</option>
              <option value="in-consultation">In Consultation</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
              <option value="missed">Missed</option>
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Input
              type="date"
              name="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="Filter by date"
            />
          </div>
          {dateFilter && (
            <Button variant="ghost" size="sm" onClick={() => setDateFilter('')}>
              Clear Date
            </Button>
          )}
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredAppointments.length} of {appointments.length} appointments
        </span>
      </div>

      {/* Appointments Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Date & Time</TableHeader>
              <TableHeader>Patient Name</TableHeader>
              <TableHeader>Contact Phone</TableHeader>
              <TableHeader>Reason / Symptoms</TableHeader>
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
                message="No appointments matching your filters."
                icon={IoCalendarOutline}
              />
            ) : (
              filteredAppointments.map((appt) => {
                const dateObj = new Date(appt.appointmentDate);
                const isActionLoading = actionLoadingId === appt._id;

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
                      <div className="font-medium text-slate-900">
                        {appt.patient?.name || 'Patient'}
                      </div>
                      <div className="text-xs text-slate-500">{appt.patient?.email}</div>
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {appt.patient?.phone || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-600 line-clamp-2 max-w-xs">
                        {appt.reason || 'General checkup'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge status={appt.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {appt.status === 'pending' && (
                          <>
                            <Button
                              variant="success"
                              size="sm"
                              icon={IoCheckmarkOutline}
                              isLoading={isActionLoading}
                              onClick={() => handleStatusUpdate(appt._id, 'confirmed')}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={IoCloseOutline}
                              isLoading={isActionLoading}
                              onClick={() => handleStatusUpdate(appt._id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </>
                        )}

                        {appt.status === 'in-queue' && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={IoCheckmarkOutline}
                            isLoading={isActionLoading}
                            onClick={() => handleStartConsultation(appt._id)}
                          >
                            Start Consult
                          </Button>
                        )}

                        {appt.status === 'in-consultation' && (
                          <>
                            <Link to={`/doctor/prescriptions/create/${appt._id}`}>
                              <Button
                                variant="primary"
                                size="sm"
                                icon={IoDocumentTextOutline}
                              >
                                Prescribe
                              </Button>
                            </Link>
                            <Button
                              variant="success"
                              size="sm"
                              icon={IoCheckmarkOutline}
                              isLoading={isActionLoading}
                              onClick={() => handleEndConsultation(appt._id)}
                            >
                              End Consult
                            </Button>
                          </>
                        )}

                        {appt.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            icon={IoDocumentTextOutline}
                            onClick={() => handleViewPrescription(appt._id)}
                          >
                            Prescription
                          </Button>
                        )}

                        {(appt.status === 'cancelled' || appt.status === 'rejected') && (
                          <span className="text-xs text-slate-400 italic">No action</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </tbody>
        </Table>
      </TableContainer>

      {/* Prescription View Modal */}
      <Modal
        isOpen={prescriptionModalOpen}
        onClose={() => setPrescriptionModalOpen(false)}
        title="Consultation Prescription"
        subtitle="Medical record details for this appointment"
      >
        {prescriptionLoading ? (
          <div className="py-8 text-center">
            <LoadingSpinner size="md" text="Loading prescription data..." />
          </div>
        ) : !viewingPrescription || viewingPrescription.empty ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No prescription has been written for this appointment yet.
          </div>
        ) : (
          <div className="space-y-4 text-left text-sm">
            <div>
              <span className="text-xs font-bold uppercase text-slate-500">Diagnosis</span>
              <p className="font-semibold text-slate-900 mt-0.5">
                {viewingPrescription.diagnosis}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold uppercase text-slate-500 block mb-2">
                Medicines
              </span>
              <div className="space-y-2">
                {viewingPrescription.medicines?.map((med, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-semibold text-slate-800">{med.name}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {med.dosage} &bull; {med.frequency} &bull; {med.duration}
                    </div>
                    {med.instructions && (
                      <div className="text-xs text-slate-500 mt-1 italic">
                        Note: {med.instructions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {viewingPrescription.advice && (
              <div>
                <span className="text-xs font-bold uppercase text-slate-500">
                  Doctor's Advice
                </span>
                <p className="text-slate-700 bg-amber-50/70 p-3 rounded-lg border border-amber-200/60 mt-1">
                  {viewingPrescription.advice}
                </p>
              </div>
            )}

            {viewingPrescription.followUpDate && (
              <div className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-800">Follow-up Date: </span>
                {new Date(viewingPrescription.followUpDate).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DoctorAppointments;
