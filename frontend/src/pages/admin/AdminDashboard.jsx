import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getUsers,
  getDoctors,
  getDepartments,
  getAllAppointments,
  getErrorMessage,
} from '../../services/api';
import { StatCard, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  IoPeopleOutline,
  IoMedicalOutline,
  IoBusinessOutline,
  IoCalendarOutline,
  IoTimeOutline,
  IoRefreshOutline,
  IoArrowForwardOutline,
  IoSpeedometerOutline,
} from 'react-icons/io5';

const AdminDashboard = () => {
  const [usersCount, setUsersCount] = useState(0);
  const [doctorsCount, setDoctorsCount] = useState(0);
  const [departmentsCount, setDepartmentsCount] = useState(0);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);
      setError('');

      const [usersRes, docsRes, deptsRes, apptsRes] = await Promise.all([
        getUsers(),
        getDoctors(),
        getDepartments(),
        getAllAppointments(),
      ]);

      setUsersCount((usersRes.users || []).length);
      setDoctorsCount(docsRes.count || (docsRes.doctors || []).length);
      setDepartmentsCount((deptsRes.departments || []).length);
      setAppointments(apptsRes.appointments || []);
    } catch (err) {
      console.error('Error fetching admin dashboard metrics:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading administrative dashboard metrics..." />;
  }

  const totalAppointments = appointments.length;
  const pendingAppointments = appointments.filter((a) => a.status === 'pending').length;
  const confirmedAppointments = appointments.filter((a) => a.status === 'confirmed').length;

  // Recent 5 appointments for activity feed
  const recentAppointments = [...appointments]
    .sort((a, b) => new Date(b.createdAt || b.appointmentDate) - new Date(a.createdAt || a.appointmentDate))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-linear-to-r from-slate-900 via-blue-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-blue-300 flex items-center gap-1.5">
            <IoSpeedometerOutline /> Hospital Overview
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-1 text-white">
            System Administration
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Monitor healthcare staff, hospital departments, user registrations, billing, and system activity.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={IoRefreshOutline}
          onClick={fetchDashboardMetrics}
          className="text-white border-white/20 hover:bg-white/10 shrink-0 self-start sm:self-center"
        >
          Refresh Data
        </Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Users"
          value={usersCount}
          subtitle="System accounts"
          icon={IoPeopleOutline}
          color="purple"
        />
        <StatCard
          title="Total Doctors"
          value={doctorsCount}
          subtitle="Active physicians"
          icon={IoMedicalOutline}
          color="blue"
        />
        <StatCard
          title="Departments"
          value={departmentsCount}
          subtitle="Clinical units"
          icon={IoBusinessOutline}
          color="emerald"
        />
        <StatCard
          title="Appointments"
          value={totalAppointments}
          subtitle={`${confirmedAppointments} confirmed`}
          icon={IoCalendarOutline}
          color="amber"
        />
        <StatCard
          title="Pending Queue"
          value={pendingAppointments}
          subtitle="Needs review"
          icon={IoTimeOutline}
          color="red"
        />
      </div>

      {/* Quick Admin Actions & Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Links Column */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Administrative Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                title: 'Manage Doctors',
                desc: 'Add physicians, update schedules & fees',
                path: '/admin/doctors',
                icon: IoMedicalOutline,
                color: 'text-blue-600 bg-blue-50',
              },
              {
                title: 'Manage Departments',
                desc: 'Organize medical wings & specialties',
                path: '/admin/departments',
                icon: IoBusinessOutline,
                color: 'text-emerald-600 bg-emerald-50',
              },
              {
                title: 'Manage Users & Roles',
                desc: 'User permissions & active status',
                path: '/admin/users',
                icon: IoPeopleOutline,
                color: 'text-purple-600 bg-purple-50',
              },
              {
                title: 'Hospital Billing',
                desc: 'Invoices, settlements & reports',
                path: '/admin/billing',
                icon: IoCalendarOutline,
                color: 'text-amber-600 bg-amber-50',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/30 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${item.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                  <IoArrowForwardOutline className="w-4 h-4 text-slate-400" />
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent System Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Recent Appointment Activity</CardTitle>
              <p className="text-xs text-slate-500">Latest consultations booked across all wards</p>
            </div>
            <Link
              to="/receptionist/appointments"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View Full Logs <IoArrowForwardOutline className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentAppointments.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <IoCalendarOutline className="w-10 h-10 mx-auto text-slate-300 stroke-1 mb-2" />
                <p className="text-sm font-medium">No appointments logged yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentAppointments.map((appt) => {
                  const dateObj = new Date(appt.appointmentDate);
                  const patientName = appt.patient?.name || 'Patient';
                  const docName =
                    appt.doctor?.userId?.name || appt.doctor?.name || 'Physician';

                  return (
                    <div
                      key={appt._id}
                      className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                          {patientName.charAt(0)}
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-semibold text-slate-900">
                            {patientName} &rarr; Dr. {docName}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {dateObj.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            at{' '}
                            {dateObj.toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>

                      <Badge status={appt.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
