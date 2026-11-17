import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Core Layout and Guards
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Public & Error Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';

// Patient Pages
import PatientDashboard from './pages/patient/PatientDashboard';
import BookAppointment from './pages/patient/BookAppointment';
import MyAppointments from './pages/patient/MyAppointments';
import MyRecords from './pages/patient/MyRecords';
import MyBills from './pages/patient/MyBills';

// Doctor Pages
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorAppointments from './pages/doctor/DoctorAppointments';
import CreatePrescription from './pages/doctor/CreatePrescription';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageDepartments from './pages/admin/ManageDepartments';
import ManageDoctors from './pages/admin/ManageDoctors';
import ManageUsers from './pages/admin/ManageUsers';
import ManageBilling from './pages/admin/ManageBilling';
import ManagePharmacy from './pages/admin/ManagePharmacy';

// Receptionist Pages
import ReceptionistDashboard from './pages/receptionist/ReceptionistDashboard';
import ManageAppointments from './pages/receptionist/ManageAppointments';

// Redirect to role dashboard
const DashboardRedirect = () => {
  const { user } = useAuth();

  if (!user || !user.role) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'patient':
      return <Navigate to="/patient/dashboard" replace />;
    case 'doctor':
      return <Navigate to="/doctor/dashboard" replace />;
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    case 'receptionist':
      return <Navigate to="/receptionist/dashboard" replace />;
    default:
      return <Navigate to="/unauthorized" replace />;
  }
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Authenticated Layout for All Valid Roles */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['patient', 'doctor', 'admin', 'receptionist']} />
            }
          >
            <Route element={<Layout />}>
              {/* Root redirector */}
              <Route path="/" element={<DashboardRedirect />} />

              {/* Patient Routes */}
              <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
                <Route path="/patient/dashboard" element={<PatientDashboard />} />
                <Route path="/patient/book-appointment" element={<BookAppointment />} />
                <Route path="/patient/appointments" element={<MyAppointments />} />
                <Route path="/patient/records" element={<MyRecords />} />
                <Route path="/patient/bills" element={<MyBills />} />
              </Route>

              {/* Doctor Routes */}
              <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
                <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
                <Route path="/doctor/appointments" element={<DoctorAppointments />} />
                <Route
                  path="/doctor/prescriptions/create/:appointmentId"
                  element={<CreatePrescription />}
                />
              </Route>

              {/* Admin Routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/departments" element={<ManageDepartments />} />
                <Route path="/admin/doctors" element={<ManageDoctors />} />
                <Route path="/admin/users" element={<ManageUsers />} />
                <Route path="/admin/billing" element={<ManageBilling />} />
                <Route path="/admin/pharmacy" element={<ManagePharmacy />} />
              </Route>

              {/* Receptionist Routes */}
              <Route element={<ProtectedRoute allowedRoles={['receptionist']} />}>
                <Route path="/receptionist/dashboard" element={<ReceptionistDashboard />} />
                <Route path="/receptionist/appointments" element={<ManageAppointments />} />
              </Route>
            </Route>
          </Route>

          {/* 404 Wildcard */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
