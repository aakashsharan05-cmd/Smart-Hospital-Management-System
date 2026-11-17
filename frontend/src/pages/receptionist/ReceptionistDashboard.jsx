import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAllAppointments, getErrorMessage } from '../../services/api';
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

const ReceptionistDashboard = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getAllAppointments();
      setAppointments(res.appointments || []);
    } catch (err) {
      console.error('Error fetching receptionist dashboard data:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading receptionist desk..." />;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter((appt) => {
    const apptDateStr = new Date(appt.appointmentDate).toISOString().split('T')[0];
    return apptDateStr === todayStr;
  });

  const pendingCheckins = todayAppointments.filter((a) => a.status === 'confirmed').length;
  const awaitingApproval = appointments.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-linear-to-r from-[#0E382C] via-[#124637] to-[#175241] rounded-2xl p-6 sm:p-8 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-[#164638]">
        <div>
          <span className="text-xs font-bold tracking-wider uppercase text-[#E5B229]">
            Front Desk Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-1 text-white">
            Welcome, {user?.name || 'Receptionist'}
          </h1>
          <p className="text-emerald-100/90 text-sm mt-1 max-w-xl">
            Welcome patients, confirm arrivals, check queue numbers, and manage clinic doctor
            appointments.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link to="/receptionist/appointments">
            <Button
              variant="mustard"
              icon={IoCalendarOutline}
              className="shadow-sm font-bold"
            >
              All Appointments
            </Button>
          </Link>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Today's Appointments"
          value={todayAppointments.length}
          subtitle="Total visits on the roster"
          icon={IoCalendarOutline}
          color="blue"
        />
        <StatCard
          title="Expected Check-ins"
          value={pendingCheckins}
          subtitle="Confirmed visits for today"
          icon={IoTimeOutline}
          color="emerald"
        />
        <StatCard
          title="Pending Approval"
          value={awaitingApproval}
          subtitle="Needs confirmation or triage"
          icon={IoPeopleOutline}
          color="amber"
        />
      </div>

      {/* Today's Schedule Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Today's Patient Schedule</CardTitle>
            <p className="text-xs text-[#526B62]">
              Patients scheduled for hospital visit today ({todayAppointments.length})
            </p>
          </div>
          <Link
            to="/receptionist/appointments"
            className="text-xs font-bold text-[#0E382C] hover:text-[#164638] flex items-center gap-1 hover:underline"
          >
            Manage All <IoArrowForwardOutline className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {todayAppointments.length === 0 ? (
            <div className="py-12 text-center text-[#526B62]">
              <IoCheckmarkCircleOutline className="w-10 h-10 mx-auto text-emerald-500 stroke-1 mb-2" />
              <p className="text-sm font-medium">No appointments scheduled for today yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#EEF3F0]">
              {todayAppointments.map((appt) => {
                const dateObj = new Date(appt.appointmentDate);
                const patientName = appt.patient?.name || 'Patient';
                const docName =
                  appt.doctor?.userId?.name || appt.doctor?.name || 'Assigned Physician';

                return (
                  <div
                    key={appt._id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F8FAF7] transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#EDF7F2] text-[#0E382C] flex items-center justify-center font-bold">
                        <IoPeopleOutline className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#11261F]">{patientName}</h4>
                        <p className="text-xs text-[#526B62]">
                          Doctor: Dr. {docName} &bull; Contact: {appt.patient?.phone || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-[#11261F]">
                          {dateObj.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {appt.queueNumber && (
                          <div className="text-[11px] font-bold text-[#0E382C]">
                            Queue #{appt.queueNumber}
                          </div>
                        )}
                      </div>
                      <Badge status={appt.status} />
                      <Link to="/receptionist/appointments">
                        <Button variant="outline" size="sm">
                          Triage
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

export default ReceptionistDashboard;
