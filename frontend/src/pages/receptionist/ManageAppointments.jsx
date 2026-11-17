import React, { useState, useEffect } from 'react';
import {
  getAllAppointments,
  getDoctors,
  updateAppointmentStatus,
  checkInAppointment,
  createWalkInAppointment,
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
import { formatDoctorName } from '../../utils/formatters';
import useQueueSocket from '../../hooks/useQueueSocket';
import {
  IoCalendarOutline,
  IoCheckmarkOutline,
  IoCloseOutline,
  IoSearchOutline,
  IoTimeOutline,
  IoRefreshOutline,
  IoPersonAddOutline,
} from 'react-icons/io5';

const ManageAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Filters & Search
  const [searchPatient, setSearchPatient] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Walk-In Modal state
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    name: '',
    phone: '',
    email: '',
    doctorId: '',
    reason: '',
  });
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInError, setWalkInError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [apptsRes, docsRes] = await Promise.all([
        getAllAppointments(),
        getDoctors(),
      ]);
      setAppointments(apptsRes.appointments || []);
      setDoctors(docsRes.doctors || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { isConnected: isLiveConnected } = useQueueSocket({
    onQueueUpdate: () => {
      fetchData();
    },
    onStatusChange: () => {
      fetchData();
    },
  });

  const handleStatusUpdate = async (id, newStatus) => {
    setActionLoadingId(id);
    try {
      await updateAppointmentStatus(id, {
        status: newStatus,
        notes: `Receptionist changed status to ${newStatus}`,
      });
      await fetchData();
    } catch (err) {
      console.error('Error updating appointment status:', err);
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCheckIn = async (id) => {
    setActionLoadingId(id);
    try {
      await checkInAppointment(id);
      await fetchData();
    } catch (err) {
      console.error('Error checking in patient:', err);
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
    if (!walkInForm.name.trim() || !walkInForm.phone.trim() || !walkInForm.doctorId || !walkInForm.reason.trim()) {
      setWalkInError('Please fill in patient name, phone, doctor, and reason for visit.');
      return;
    }

    setWalkInSubmitting(true);
    setWalkInError('');
    try {
      await createWalkInAppointment({
        patient: {
          name: walkInForm.name.trim(),
          phone: walkInForm.phone.trim(),
          email: walkInForm.email.trim() || undefined,
        },
        doctorId: walkInForm.doctorId,
        reason: walkInForm.reason.trim(),
      });
      setIsWalkInOpen(false);
      setWalkInForm({ name: '', phone: '', email: '', doctorId: '', reason: '' });
      await fetchData();
    } catch (err) {
      console.error('Error creating walk-in appointment:', err);
      setWalkInError(getErrorMessage(err));
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // Filter logic
  const filteredAppointments = appointments.filter((appt) => {
    if (statusFilter !== 'all' && appt.status !== statusFilter) {
      return false;
    }
    if (doctorFilter !== 'all') {
      const docId = appt.doctor?._id || appt.doctor;
      if (docId !== doctorFilter) return false;
    }
    if (dateFilter) {
      const apptDateStr = new Date(appt.appointmentDate).toISOString().split('T')[0];
      if (apptDateStr !== dateFilter) return false;
    }
    if (searchPatient.trim()) {
      const q = searchPatient.toLowerCase();
      const patientName = appt.patient?.name?.toLowerCase() || '';
      const patientPhone = appt.patient?.phone?.toLowerCase() || '';
      return patientName.includes(q) || patientPhone.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Front Desk Appointments</h1>
          <p className="text-sm text-slate-500">
            Search patient records, check scheduled visits, and manage arrival statuses
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {isLiveConnected && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Queue
            </span>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={IoPersonAddOutline}
            onClick={() => setIsWalkInOpen(true)}
          >
            New Walk-In Patient
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={IoRefreshOutline}
            onClick={fetchData}
            isLoading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 w-full lg:w-auto flex-1">
          <Input
            icon={IoSearchOutline}
            placeholder="Search patient name or phone..."
            value={searchPatient}
            onChange={(e) => setSearchPatient(e.target.value)}
          />
          <Select
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
          <Select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            placeholder=""
          >
            <option value="all">All Doctors</option>
            {doctors.map((doc) => (
              <option key={doc._id} value={doc._id}>
                {formatDoctorName(doc.userId?.name || doc.name)} ({doc.specialization})
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            placeholder="Filter by date"
          />
        </div>

        <span className="text-xs text-slate-500 font-medium whitespace-nowrap self-end lg:self-center">
          Showing {filteredAppointments.length} of {appointments.length}
        </span>
      </div>

      {/* Appointments Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Date & Time</TableHeader>
              <TableHeader>Queue #</TableHeader>
              <TableHeader>Patient Info</TableHeader>
              <TableHeader>Doctor</TableHeader>
              <TableHeader>Reason</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <tbody>
            {loading ? (
              <TableLoading colSpan={7} />
            ) : filteredAppointments.length === 0 ? (
              <TableEmpty
                colSpan={7}
                message="No appointments found matching your search or filters."
                icon={IoCalendarOutline}
              />
            ) : (
              filteredAppointments.map((appt) => {
                const dateObj = new Date(appt.appointmentDate);
                const isActionLoading = actionLoadingId === appt._id;
                const docName =
                  appt.doctor?.userId?.name || appt.doctor?.name || 'Physician';

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
                      {appt.queueNumber ? (
                        <span className="font-mono font-bold text-[#0E382C] bg-[#EDF7F2] px-2 py-0.5 rounded-md border border-[#C6E7D5]">
                          #{appt.queueNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {appt.patient?.name || 'Patient'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {appt.patient?.phone || appt.patient?.email || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-slate-800 font-medium">{formatDoctorName(docName)}</div>
                      <div className="text-xs text-slate-500">{appt.department?.name}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-600 line-clamp-2 max-w-xs">
                        {appt.reason || 'General'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge status={appt.status} />
                        {appt.status === 'in-queue' && appt.predictedWaitMinutes !== null && appt.predictedWaitMinutes !== undefined && (
                          <span
                            title="Estimate only. Based on simulated data, not guaranteed."
                            className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 flex items-center gap-1"
                          >
                            <IoTimeOutline className="w-3 h-3" />
                            ~{appt.predictedWaitMinutes} min (Estimate only. Based on simulated data, not guaranteed.)
                          </span>
                        )}
                      </div>
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
                        {appt.status === 'confirmed' && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={IoCheckmarkOutline}
                            isLoading={isActionLoading}
                            onClick={() => handleCheckIn(appt._id)}
                          >
                            Check In
                          </Button>
                        )}
                        {appt.status === 'in-queue' && (
                          <span className="text-xs font-bold text-[#9A7412] bg-[#FDF8EB] px-2.5 py-1 rounded-md border border-[#F5DE9B]">
                            In Queue
                          </span>
                        )}
                        {appt.status === 'in-consultation' && (
                          <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                            In Consult
                          </span>
                        )}
                        {(appt.status === 'completed' ||
                          appt.status === 'cancelled' ||
                          appt.status === 'rejected' ||
                          appt.status === 'missed') && (
                          <span className="text-xs text-slate-400 italic">Settled</span>
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

      {/* Walk-in Registration Modal */}
      <Modal
        isOpen={isWalkInOpen}
        onClose={() => {
          setIsWalkInOpen(false);
          setWalkInError('');
        }}
        title="Register Walk-In Patient"
        subtitle="Create an immediate walk-in consultation and place patient directly into today's queue"
      >
        <form onSubmit={handleWalkInSubmit} className="space-y-4">
          {walkInError && (
            <Alert type="error" message={walkInError} onClose={() => setWalkInError('')} />
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Full Name *
            </label>
            <Input
              required
              placeholder="e.g. Ramesh Kumar"
              value={walkInForm.name}
              onChange={(e) => setWalkInForm({ ...walkInForm, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Phone Number *
              </label>
              <Input
                required
                type="tel"
                placeholder="10-digit mobile"
                value={walkInForm.phone}
                onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Address (Optional)
              </label>
              <Input
                type="email"
                placeholder="patient@example.com"
                value={walkInForm.email}
                onChange={(e) => setWalkInForm({ ...walkInForm, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Assign Doctor *
            </label>
            <Select
              required
              value={walkInForm.doctorId}
              onChange={(e) => setWalkInForm({ ...walkInForm, doctorId: e.target.value })}
              placeholder="Select available physician"
            >
              {doctors.map((doc) => (
                <option key={doc._id} value={doc._id}>
                  {formatDoctorName(doc.userId?.name || doc.name)} ({doc.specialization} - {doc.department?.name || 'General'})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Reason / Chief Complaint *
            </label>
            <textarea
              required
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#CCD8D1] focus:outline-none focus:ring-2 focus:ring-[#0E382C]/20 focus:border-[#0E382C] transition-all"
              placeholder="e.g. High fever, persistent cough for 2 days"
              value={walkInForm.reason}
              onChange={(e) => setWalkInForm({ ...walkInForm, reason: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsWalkInOpen(false);
                setWalkInError('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={walkInSubmitting}
            >
              Register & Add to Queue
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ManageAppointments;
