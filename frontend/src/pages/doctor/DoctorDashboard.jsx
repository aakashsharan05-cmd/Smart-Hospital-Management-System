import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDoctorAppointments, getErrorMessage } from '../../services/api';
import { StatCard, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  IoCalendarOutline,
  IoTimeOutline,
  IoPeopleOutline,
  IoArrowForwardOutline,
  IoCheckmarkCircleOutline,
} from 'react-icons/io5';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDoctorData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getDoctorAppointments();
      setAppointments(res.appointments || []);
    } catch (err) {
      console.error('Error fetching doctor dashboard:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorData();
  }, []);

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading doctor dashboard..." />;
  }

  // Calculate metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter((appt) => {
    const apptDateStr = new Date(appt.appointmentDate).toISOString().split('T')[0];
    return apptDateStr === todayStr;
  });

  const pendingAppointments = appointments.filter((appt) => appt.status === 'pending').length;

  // Unique patient count
  const uniquePatients = new Set(
    appointments.map((a) => a.patient?._id || a.patient?.email || a.patient).filter(Boolean)
  ).size;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <span className="text-xs font-semibold tracking-wider uppercase text-blue-200">
          Physician Portal
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1 text-white">
          Welcome, Dr. {user?.name || 'Physician'}
        </h1>
        <p className="text-blue-100 text-sm mt-1 max-w-xl">
          Here is your daily clinical schedule, patient consultations queue, and pending
          appointment requests.
        </p>

        <div className="mt-5 flex gap-3">
          <Link to="/doctor/appointments">
            <Button
              variant="secondary"
              icon={IoCalendarOutline}
              className="bg-white text-blue-800 hover:bg-blue-50 border-0 font-semibold"
            >
              Manage Appointments
            </Button>
          </Link>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Today's Consultations"
          value={todayAppointments.length}
          subtitle="Scheduled for today"
          icon={IoTimeOutline}
          color="blue"
        />
        <StatCard
          title="Total Consulted Patients"
          value={uniquePatients}
          subtitle="Unique patient records"
          icon={IoPeopleOutline}
          color="emerald"
        />
        <StatCard
          title="Pending Requests"
          value={pendingAppointments}
          subtitle="Requires doctor confirmation"
          icon={IoCalendarOutline}
          color="amber"
        />
      </div>

      {/* Today's Schedule Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Today's Patient Schedule</CardTitle>
            <p className="text-xs text-slate-500">
              Patients scheduled to visit your clinic today ({todayAppointments.length})
            </p>
          </div>
          <Link
            to="/doctor/appointments"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            All Appointments ({appointments.length}) <IoArrowForwardOutline className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {todayAppointments.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <IoCheckmarkCircleOutline className="w-10 h-10 mx-auto text-emerald-400 stroke-1 mb-2" />
              <p className="text-sm font-medium">No patient visits scheduled for today.</p>
              <p className="text-xs text-slate-400 mt-1">
                New appointments will appear here when scheduled by patients.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {todayAppointments.map((appt) => {
                const dateObj = new Date(appt.appointmentDate);
                const patientName = appt.patient?.name || 'Anonymous Patient';

                return (
                  <div
                    key={appt._id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                        <IoPeopleOutline className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{patientName}</h4>
                        <p className="text-xs text-slate-500">
                          Reason: {appt.reason || 'General checkup'} &bull; Phone:{' '}
                          {appt.patient?.phone || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-800">
                          {dateObj.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {appt.queueNumber && (
                          <div className="text-[11px] font-bold text-blue-600">
                            Queue #{appt.queueNumber}
                          </div>
                        )}
                      </div>
                      <Badge status={appt.status} />
                      <Link to="/doctor/appointments">
                        <Button variant="outline" size="sm">
                          Manage
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DoctorDashboard;
