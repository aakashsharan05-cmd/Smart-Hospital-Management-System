import axios from 'axios';

// Create Axios instance with base configuration
const api = axios.create({
  baseURL: '', // Proxied via Vite to http://localhost:5000
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('shms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle unauthorized access
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and user on 401 Unauthorized
      localStorage.removeItem('shms_token');
      localStorage.removeItem('shms_user');
      if (
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/register')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Utility to extract human-readable error messages from API responses
export const getErrorMessage = (error) => {
  if (error.response && error.response.data) {
    if (error.response.data.message) {
      return error.response.data.message;
    }
    if (error.response.data.error) {
      return typeof error.response.data.error === 'string'
        ? error.response.data.error
        : JSON.stringify(error.response.data.error);
    }
  }
  return error.message || 'An unexpected error occurred. Please try again.';
};

/* =========================================================================
   AUTH API
   ========================================================================= */
export const registerUser = async (userData) => {
  const response = await api.post('/api/auth/register', userData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post('/api/auth/login', credentials);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

/* =========================================================================
   USERS API (Admin & Profile)
   ========================================================================= */
export const getUsers = async (params = {}) => {
  const response = await api.get('/api/users', { params });
  return response.data;
};

export const getUserProfile = async () => {
  const response = await api.get('/api/users/profile');
  return response.data;
};

export const updateUserProfile = async (profileData) => {
  const response = await api.patch('/api/users/profile', profileData);
  return response.data;
};

export const toggleUserActive = async (userId) => {
  const response = await api.patch(`/api/users/${userId}/toggle-active`);
  return response.data;
};

/* =========================================================================
   DEPARTMENTS API
   ========================================================================= */
export const getDepartments = async () => {
  const response = await api.get('/api/departments');
  return response.data;
};

export const getDepartmentById = async (id) => {
  const response = await api.get(`/api/departments/${id}`);
  return response.data;
};

export const createDepartment = async (departmentData) => {
  const response = await api.post('/api/departments', departmentData);
  return response.data;
};

export const updateDepartment = async (id, departmentData) => {
  const response = await api.patch(`/api/departments/${id}`, departmentData);
  return response.data;
};

export const toggleDepartmentActive = async (id) => {
  const response = await api.patch(`/api/departments/${id}/toggle`);
  return response.data;
};

/* =========================================================================
   DOCTORS API
   ========================================================================= */
export const getDoctors = async (params = {}) => {
  const response = await api.get('/api/doctors', { params });
  return response.data;
};

export const getDoctorById = async (id) => {
  const response = await api.get(`/api/doctors/${id}`);
  return response.data;
};

export const createDoctor = async (doctorData) => {
  const response = await api.post('/api/doctors', doctorData);
  return response.data;
};

export const updateDoctor = async (id, doctorData) => {
  const response = await api.patch(`/api/doctors/${id}`, doctorData);
  return response.data;
};

/* =========================================================================
   APPOINTMENTS API
   ========================================================================= */
export const bookAppointment = async (appointmentData) => {
  const response = await api.post('/api/appointments', appointmentData);
  return response.data;
};

export const getMyAppointments = async () => {
  const response = await api.get('/api/appointments/my');
  return response.data;
};

export const getDoctorAppointments = async () => {
  const response = await api.get('/api/appointments/doctor');
  return response.data;
};

export const getAllAppointments = async (params = {}) => {
  const response = await api.get('/api/appointments', { params });
  return response.data;
};

export const getAppointmentById = async (id) => {
  const response = await api.get(`/api/appointments/${id}`);
  return response.data;
};

export const cancelAppointment = async (id, cancellationReason) => {
  const response = await api.patch(`/api/appointments/${id}/cancel`, { cancellationReason });
  return response.data;
};

export const rescheduleAppointment = async (id, appointmentDate) => {
  const response = await api.patch(`/api/appointments/${id}/reschedule`, { appointmentDate });
  return response.data;
};

export const updateAppointmentStatus = async (id, statusData) => {
  const response = await api.patch(`/api/appointments/${id}/status`, statusData);
  return response.data;
};

/* =========================================================================
   PRESCRIPTIONS API
   ========================================================================= */
export const createPrescription = async (prescriptionData) => {
  const response = await api.post('/api/prescriptions', prescriptionData);
  return response.data;
};

export const getPrescriptionsByAppointment = async (appointmentId) => {
  const response = await api.get(`/api/prescriptions/appointment/${appointmentId}`);
  return response.data;
};

export const getMyPrescriptions = async () => {
  const response = await api.get('/api/prescriptions/my');
  return response.data;
};

export const getPrescriptionById = async (id) => {
  const response = await api.get(`/api/prescriptions/${id}`);
  return response.data;
};

/* =========================================================================
   BILLING API
   ========================================================================= */
export const createBill = async (billData) => {
  const response = await api.post('/api/billing', billData);
  return response.data;
};

export const getMyBills = async () => {
  const response = await api.get('/api/billing/my');
  return response.data;
};

export const getAllBills = async () => {
  const response = await api.get('/api/billing');
  return response.data;
};

export const getBillById = async (id) => {
  const response = await api.get(`/api/billing/${id}`);
  return response.data;
};

export const markBillPaid = async (id, paymentMethod = 'cash') => {
  const response = await api.patch(`/api/billing/${id}/pay`, { paymentMethod });
  return response.data;
};

/* =========================================================================
   PHARMACY API
   ========================================================================= */
export const getPharmacyMedicines = async () => {
  const response = await api.get('/api/pharmacy');
  return response.data;
};

export const getPharmacyMedicineById = async (id) => {
  const response = await api.get(`/api/pharmacy/${id}`);
  return response.data;
};

export const createPharmacyMedicine = async (medicineData) => {
  const response = await api.post('/api/pharmacy', medicineData);
  return response.data;
};

export const updatePharmacyMedicine = async (id, medicineData) => {
  const response = await api.patch(`/api/pharmacy/${id}`, medicineData);
  return response.data;
};

export const getLowStockMedicines = async () => {
  const response = await api.get('/api/pharmacy/low-stock');
  return response.data;
};

export default api;
