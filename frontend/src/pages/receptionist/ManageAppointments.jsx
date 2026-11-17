import React, { useState, useEffect } from 'react';
import {
  getAllAppointments,
  getDoctors,
  updateAppointmentStatus,
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
import Alert from '../../components/ui/Alert';
import {
  IoCalendarOutline,
  IoCheckmarkOutline,
  IoCloseOutline,
  IoSearchOutline,
  IoTimeOutline,
  IoRefreshOutline,
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
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </Select>
          <Select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            placeholder=""
          >
            <option value="all">All Doctors</option>
            {doctors.map((doc) => (
              <option key={doc._id} value={doc._id}>
                Dr. {doc.userId?.name || doc.name} ({doc.specialization})
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
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
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
                      <div className="text-slate-800 font-medium">Dr. {docName}</div>
                      <div className="text-xs text-slate-500">{appt.department?.name}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-600 line-clamp-2 max-w-xs">
                        {appt.reason || 'General'}
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
                        {appt.status === 'confirmed' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={IoCheckmarkOutline}
                            isLoading={isActionLoading}
                            onClick={() => handleStatusUpdate(appt._id, 'completed')}
                          >
                            Mark Completed
                          </Button>
                        )}
                        {(appt.status === 'completed' ||
                          appt.status === 'cancelled' ||
                          appt.status === 'rejected') && (
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
    </div>
  );
};

export default ManageAppointments;
