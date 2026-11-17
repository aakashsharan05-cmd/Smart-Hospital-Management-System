import React, { useState, useEffect } from 'react';
import {
  getDoctors,
  getDepartments,
  createDoctor,
  updateDoctor,
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
import {
  IoAddCircleOutline,
  IoEyeOutline,
  IoPencilOutline,
  IoMedicalOutline,
  IoRefreshOutline,
} from 'react-icons/io5';

const ALL_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const ManageDoctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [viewingDoctor, setViewingDoctor] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    specialization: '',
    qualification: '',
    experience: '',
    consultationFee: '',
    department: '',
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [docsRes, deptsRes] = await Promise.all([
        getDoctors(),
        getDepartments(),
      ]);
      setDoctors(docsRes.doctors || []);
      setDepartments(deptsRes.departments || []);
    } catch (err) {
      console.error('Error fetching doctors data:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingDoctor(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      specialization: '',
      qualification: '',
      experience: '5',
      consultationFee: '100',
      department: departments[0]?._id || '',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    });
    setFormError('');
    setFormModalOpen(true);
  };

  const openEditModal = (doc) => {
    setEditingDoctor(doc);
    setFormData({
      name: doc.userId?.name || doc.name || '',
      email: doc.userId?.email || doc.email || '',
      phone: doc.userId?.phone || doc.phone || '',
      specialization: doc.specialization || '',
      qualification: doc.qualification || '',
      experience: doc.experience?.toString() || '0',
      consultationFee: doc.consultationFee?.toString() || '0',
      department: doc.department?._id || doc.department || '',
      availableDays: doc.availableDays || [],
    });
    setFormError('');
    setFormModalOpen(true);
  };

  const openViewModal = (doc) => {
    setViewingDoctor(doc);
    setViewModalOpen(true);
  };

  const handleDayToggle = (day) => {
    setFormData((prev) => {
      const exists = prev.availableDays.includes(day);
      const nextDays = exists
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day];
      return { ...prev, availableDays: nextDays };
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.specialization.trim() || !formData.qualification.trim()) {
      setFormError('Specialization and Qualification are required.');
      return;
    }
    if (!formData.department) {
      setFormError('Please select a hospital department.');
      return;
    }

    setSubmitting(true);

    try {
      if (editingDoctor) {
        // Update doctor profile
        const updatePayload = {
          specialization: formData.specialization.trim(),
          qualification: formData.qualification.trim(),
          experience: Number(formData.experience),
          consultationFee: Number(formData.consultationFee),
          department: formData.department,
          availableDays: formData.availableDays,
        };
        await updateDoctor(editingDoctor._id, updatePayload);
      } else {
        // Create new doctor
        if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
          setFormError('Name, email, and password are required for new doctor registration.');
          setSubmitting(false);
          return;
        }
        const createPayload = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          phone: formData.phone.trim(),
          specialization: formData.specialization.trim(),
          qualification: formData.qualification.trim(),
          experience: Number(formData.experience) || 0,
          consultationFee: Number(formData.consultationFee) || 0,
          department: formData.department,
          availableDays: formData.availableDays,
        };
        await createDoctor(createPayload);
      }

      setFormModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Error saving doctor:', err);
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manage Doctors</h1>
          <p className="text-sm text-slate-500">
            Maintain physician credentials, departments, consultation rates, and working schedules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={IoRefreshOutline}
            onClick={fetchData}
            isLoading={loading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={IoAddCircleOutline}
            onClick={openAddModal}
          >
            Add Doctor
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Doctors Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Doctor Name</TableHeader>
              <TableHeader>Specialization</TableHeader>
              <TableHeader>Department</TableHeader>
              <TableHeader>Experience</TableHeader>
              <TableHeader>Fee</TableHeader>
              <TableHeader>Availability</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <tbody>
            {loading ? (
              <TableLoading colSpan={7} />
            ) : doctors.length === 0 ? (
              <TableEmpty
                colSpan={7}
                message="No doctor profiles found. Click 'Add Doctor' to register one."
                icon={IoMedicalOutline}
              />
            ) : (
              doctors.map((doc) => {
                const name = doc.userId?.name || doc.name || 'Doctor';
                const email = doc.userId?.email || doc.email || 'N/A';
                const deptName = doc.department?.name || 'Unassigned';

                return (
                  <TableRow key={doc._id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{formatDoctorName(name)}</div>
                      <div className="text-xs text-slate-500">{email}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-800">{doc.specialization}</span>
                      <div className="text-xs text-slate-500">{doc.qualification}</div>
                    </TableCell>
                    <TableCell>{deptName}</TableCell>
                    <TableCell>{doc.experience} yrs</TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      ₹{doc.consultationFee}
                    </TableCell>
                    <TableCell>
                      <Badge
                        status={doc.isAvailable !== false ? 'available' : 'unavailable'}
                        variant={doc.isAvailable !== false ? 'success' : 'neutral'}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={IoEyeOutline}
                          onClick={() => openViewModal(doc)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={IoPencilOutline}
                          onClick={() => openEditModal(doc)}
                        >
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </tbody>
        </Table>
      </TableContainer>

      {/* View Doctor Details Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={formatDoctorName(viewingDoctor?.userId?.name || viewingDoctor?.name)}
        subtitle="Physician Profile & Practice Credentials"
      >
        {viewingDoctor && (
          <div className="space-y-4 text-left text-sm">
            <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Email Address
                </span>
                <p className="font-medium text-slate-800 mt-0.5">
                  {viewingDoctor.userId?.email || viewingDoctor.email || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Contact Phone
                </span>
                <p className="font-medium text-slate-800 mt-0.5">
                  {viewingDoctor.userId?.phone || viewingDoctor.phone || 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Specialization
                </span>
                <p className="font-medium text-slate-800 mt-0.5">
                  {viewingDoctor.specialization}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Qualification
                </span>
                <p className="font-medium text-slate-800 mt-0.5">
                  {viewingDoctor.qualification}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Department
                </span>
                <p className="font-medium text-slate-800 mt-0.5">
                  {viewingDoctor.department?.name || 'General'}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Consultation Fee
                </span>
                <p className="font-bold text-slate-900 mt-0.5">
                  ₹{viewingDoctor.consultationFee}
                </p>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">
                Available Working Days
              </span>
              <div className="flex flex-wrap gap-1.5">
                {viewingDoctor.availableDays?.map((d) => (
                  <Badge key={d} status="confirmed">
                    {d}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Doctor Modal */}
      <Modal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={editingDoctor ? 'Edit Doctor Profile' : 'Register New Doctor'}
        subtitle="Provide practitioner medical qualifications and working terms"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setFormModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleFormSubmit}
              isLoading={submitting}
            >
              {editingDoctor ? 'Save Changes' : 'Register Doctor'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
          {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

          {!editingDoctor && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Doctor Full Name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Dr. Gregory House"
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="house@hospital.com"
                required
              />
              <Input
                label="Initial Account Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                required
              />
              <Input
                label="Contact Phone"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+1 555-0199"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Specialization"
              value={formData.specialization}
              onChange={(e) => setFormData((p) => ({ ...p, specialization: e.target.value }))}
              placeholder="e.g. Cardiology, Orthopedics"
              required
            />
            <Input
              label="Qualification"
              value={formData.qualification}
              onChange={(e) => setFormData((p) => ({ ...p, qualification: e.target.value }))}
              placeholder="e.g. MD, MBBS, FACS"
              required
            />
            <Input
              label="Years of Experience"
              type="number"
              min="0"
              value={formData.experience}
              onChange={(e) => setFormData((p) => ({ ...p, experience: e.target.value }))}
              required
            />
            <Input
              label="Consultation Fee (₹)"
              type="number"
              min="0"
              value={formData.consultationFee}
              onChange={(e) => setFormData((p) => ({ ...p, consultationFee: e.target.value }))}
              required
            />
          </div>

          <Select
            label="Assigned Department"
            value={formData.department}
            onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))}
            required
            placeholder="-- Select Department --"
          >
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </Select>

          {/* Working Days Checkboxes */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Working Availability Days
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((day) => {
                const checked = formData.availableDays.includes(day);
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => handleDayToggle(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      checked
                        ? 'bg-[#0E382C] text-[#E5B229] border-[#0E382C] font-bold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ManageDoctors;
