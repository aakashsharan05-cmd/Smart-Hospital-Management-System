import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyAppointments, getMyBills, getErrorMessage } from '../../services/api';
import { StatCard, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import useQueueSocket from '../../hooks/useQueueSocket';
import { formatDoctorName } from '../../utils/formatters';
import {
  IoCalendarOutline,
  IoTimeOutline,
  IoReceiptOutline,
  IoAddCircleOutline,
  IoDocumentTextOutline,
  IoPersonOutline,
  IoArrowForwardOutline,
} from 'react-icons/io5';

const PatientDashboard = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setError('');
      const [apptsRes, billsRes] = await Promise.all([
        getMyAppointments(),
        getMyBills(),
      ]);
      setAppointments(apptsRes.appointments || []);
      setBills(billsRes.bills || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
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

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading your dashboard..." />;
  }

  // Calculate metrics
  const totalAppointments = appointments.length;
  const now = new Date();
  const upcomingAppointments = appointments.filter((appt) => {
    return ['pending', 'confirmed', 'in-queue', 'in-consultation'].includes(appt.status);
  }).length;

  const pendingBills = bills.filter((b) => b.paymentStatus === 'pending').length;

  // Last 5 appointments
  const recentAppointments = [...appointments]
    .sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-linear-to-r from-[#0E382C] via-[#124637] to-[#175241] rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden border border-[#164638]">
        <div className="relative z-10">
          <span className="text-xs font-bold tracking-wider uppercase text-[#E5B229]">
            Patient Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-1 text-white">
            Welcome back, {user?.name || 'Patient'}!
          </h1>
          <p className="text-emerald-100/90 text-sm mt-1 max-w-xl">
            Access your health care information, schedule appointments with top doctors, and track
            your medical history anytime.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link to="/patient/book-appointment">
              <Button
                variant="mustard"
                icon={IoAddCircleOutline}
                className="shadow-sm font-bold"
              >
                Book Appointment
              </Button>
            </Link>
            <Link to="/patient/records">
              <Button
                variant="outline"
                icon={IoDocumentTextOutline}
                className="text-white border-white/30 hover:bg-white/10"
              >
                View Medical Records
              </Button>
            </Link>
            {isLiveConnected && (
              <span className="inline-flex items-center gap-1.5 text-xs text-white bg-white/20 backdrop-blur-xs px-3 py-1.5 rounded-full font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Updates Active
              </span>
            )}
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Total Appointments"
          value={totalAppointments}
          subtitle="All recorded bookings"
          icon={IoCalendarOutline}
          color="blue"
        />
        <StatCard
          title="Upcoming Appointments"
          value={upcomingAppointments}
          subtitle="Pending or confirmed"
          icon={IoTimeOutline}
          color="emerald"
        />
        <StatCard
          title="Pending Invoices"
          value={pendingBills}
          subtitle="Awaiting payment"
          icon={IoReceiptOutline}
          color="amber"
        />
      </div>

      {/* Recent Appointments Section */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent Appointments</CardTitle>
            <p className="text-xs text-[#526B62]">Your latest appointment requests & schedules</p>
          </div>
          <Link
            to="/patient/appointments"
            className="text-xs font-bold text-[#0E382C] hover:text-[#164638] flex items-center gap-1 hover:underline"
          >
            View All ({appointments.length}) <IoArrowForwardOutline className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentAppointments.length === 0 ? (
            <div className="py-12 text-center text-[#526B62]">
              <IoCalendarOutline className="w-10 h-10 mx-auto text-[#CCD8D1] stroke-1 mb-2" />
              <p className="text-sm font-medium">No appointments booked yet.</p>
              <Link to="/patient/book-appointment" className="mt-3 inline-block">
                <Button variant="primary" size="sm" icon={IoAddCircleOutline}>
                  Book Your First Appointment
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#EEF3F0]">
              {recentAppointments.map((appt) => {
                const dateObj = new Date(appt.appointmentDate);
                const doctorName =
                  appt.doctor?.userId?.name || appt.doctor?.name || 'Assigned Specialist';
                const departmentName =
                  appt.department?.name || appt.doctor?.department?.name || 'General';

                return (
                  <div
                    key={appt._id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F8FAF7] transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#EDF7F2] text-[#0E382C] flex items-center justify-center font-bold shrink-0">
                        <IoPersonOutline className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#11261F]">{formatDoctorName(doctorName)}</h4>
                        <p className="text-xs text-[#526B62]">
                          {departmentName} &bull; Reason: {appt.reason || 'General checkup'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-left sm:text-right">
                        <div className="text-xs font-semibold text-[#11261F]">
                          {dateObj.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-[#526B62]">
                          {dateObj.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge status={appt.status} />
                        {appt.status === 'in-queue' && appt.predictedWaitMinutes !== null && appt.predictedWaitMinutes !== undefined && (
                          <span
                            title={`${appt.waitPredictionSource === 'ml-model' ? 'Predicted by ML Model' : 'Estimated by Queue Formula'} (Approximate queue wait, not guaranteed. Typical prediction error: ${appt.typicalErrorMinutes ?? (appt.waitPredictionSource === 'ml-model' ? 2.4 : 5)} min)`}
                            className="text-[11px] font-semibold text-[#9A7412] bg-[#FDF8EB] px-2 py-0.5 rounded border border-[#F5DE9B] flex items-center gap-1"
                          >
                            <IoTimeOutline className="w-3 h-3" />
                            ~{appt.predictedWaitMinutes} min (Typical error: {appt.typicalErrorMinutes ?? (appt.waitPredictionSource === 'ml-model' ? 2.4 : 5)}m)
                          </span>
                        )}
                      </div>
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

export default PatientDashboard;
