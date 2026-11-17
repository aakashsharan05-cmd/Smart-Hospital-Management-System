import React, { useState, useEffect } from 'react';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  toggleDepartmentActive,
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
import Modal from '../../components/ui/Modal';
import Alert from '../../components/ui/Alert';
import {
  IoAddCircleOutline,
  IoBusinessOutline,
  IoPencilOutline,
  IoPowerOutline,
  IoRefreshOutline,
} from 'react-icons/io5';

const ManageDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchDepts = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getDepartments();
      setDepartments(res.departments || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  const openAddModal = () => {
    setEditingDepartment(null);
    setFormData({ name: '', description: '', location: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (dept) => {
    setEditingDepartment(dept);
    setFormData({
      name: dept.name || '',
      description: dept.description || '',
      location: dept.location || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Department name is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (editingDepartment) {
        await updateDepartment(editingDepartment._id, formData);
      } else {
        await createDepartment(formData);
      }
      setIsModalOpen(false);
      await fetchDepts();
    } catch (err) {
      console.error('Error saving department:', err);
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (dept) => {
    setActionLoadingId(dept._id);
    try {
      await toggleDepartmentActive(dept._id);
      await fetchDepts();
    } catch (err) {
      console.error('Error toggling department active status:', err);
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manage Departments</h1>
          <p className="text-sm text-slate-500">
            Configure hospital medical units, wards, locations, and descriptions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={IoRefreshOutline}
            onClick={fetchDepts}
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
            Add Department
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Departments Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Department Name</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Location / Wing</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <tbody>
            {loading ? (
              <TableLoading colSpan={5} />
            ) : departments.length === 0 ? (
              <TableEmpty
                colSpan={5}
                message="No departments found. Click 'Add Department' to create one."
                icon={IoBusinessOutline}
              />
            ) : (
              departments.map((dept) => {
                const isToggling = actionLoadingId === dept._id;
                const isActive = dept.isActive !== false;

                return (
                  <TableRow key={dept._id}>
                    <TableCell className="font-semibold text-slate-900">
                      {dept.name}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-600 line-clamp-2 max-w-sm">
                        {dept.description || 'No description provided.'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-slate-700">
                        {dept.location || 'Main Hospital'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        status={isActive ? 'active' : 'inactive'}
                        variant={isActive ? 'success' : 'neutral'}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={IoPencilOutline}
                          onClick={() => openEditModal(dept)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={isActive ? 'ghost' : 'success'}
                          size="sm"
                          icon={IoPowerOutline}
                          isLoading={isToggling}
                          onClick={() => handleToggleActive(dept)}
                          className={isActive ? 'text-amber-600 hover:text-amber-700' : ''}
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
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

      {/* Create / Edit Department Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDepartment ? 'Edit Department' : 'Add New Department'}
        subtitle="Specify medical specialty, floor, and operational details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleFormSubmit}
              isLoading={submitting}
            >
              {editingDepartment ? 'Save Changes' : 'Create Department'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
          {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

          <Input
            label="Department Name"
            name="name"
            placeholder="e.g. Cardiology, Pediatrics, Neurology"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            required
          />

          <Input
            label="Hospital Location / Floor"
            name="location"
            placeholder="e.g. Building A - 3rd Floor"
            value={formData.location}
            onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
          />

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Brief summary of treatments and services offered..."
              className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ManageDepartments;
