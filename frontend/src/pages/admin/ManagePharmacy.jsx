import React, { useState, useEffect } from 'react';
import {
  getPharmacyMedicines,
  createPharmacyMedicine,
  updatePharmacyMedicine,
  getLowStockMedicines,
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
import {
  IoMedkitOutline,
  IoAddCircleOutline,
  IoPencilOutline,
  IoAlertCircleOutline,
  IoRefreshOutline,
} from 'react-icons/io5';

const ManagePharmacy = () => {
  const [medicines, setMedicines] = useState([]);
  const [lowStockList, setLowStockList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    manufacturer: '',
    category: 'Antibiotic',
    price: '',
    stock: '',
    expiryDate: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [medsRes, lowRes] = await Promise.all([
        getPharmacyMedicines(),
        getLowStockMedicines().catch(() => ({ medicines: [] })),
      ]);
      setMedicines(medsRes.medicines || []);
      setLowStockList(lowRes.medicines || []);
    } catch (err) {
      console.error('Error fetching pharmacy inventory:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingMed(null);
    setFormData({
      name: '',
      genericName: '',
      manufacturer: '',
      category: 'Antibiotic',
      price: '',
      stock: '50',
      expiryDate: '',
      description: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (med) => {
    setEditingMed(med);
    setFormData({
      name: med.name || '',
      genericName: med.genericName || '',
      manufacturer: med.manufacturer || '',
      category: med.category || 'General',
      price: med.price?.toString() || '0',
      stock: med.stock?.toString() || '0',
      expiryDate: med.expiryDate ? med.expiryDate.split('T')[0] : '',
      description: med.description || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Medicine name is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: formData.name.trim(),
        genericName: formData.genericName.trim(),
        manufacturer: formData.manufacturer.trim(),
        category: formData.category,
        price: Number(formData.price) || 0,
        stock: Number(formData.stock) || 0,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : undefined,
        description: formData.description.trim(),
      };

      if (editingMed) {
        await updatePharmacyMedicine(editingMed._id, payload);
      } else {
        await createPharmacyMedicine(payload);
      }

      setModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Error saving medicine:', err);
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pharmacy & Medicine Stock</h1>
          <p className="text-sm text-slate-500">
            Monitor dispensary pharmaceutical inventory, unit prices, batches, and reorder levels
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
            Add Medicine
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Low Stock Warning Banner */}
      {lowStockList.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <IoAlertCircleOutline className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-left text-xs sm:text-sm">
            <span className="font-bold">Low Stock Warning: </span>
            {lowStockList.length} pharmaceutical items have less than 10 units in stock (
            {lowStockList.map((m) => `${m.name} [${m.stock}]`).join(', ')}). Consider restocking.
          </div>
        </div>
      )}

      {/* Medicines Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Medicine Name</TableHeader>
              <TableHeader>Category</TableHeader>
              <TableHeader>Unit Price</TableHeader>
              <TableHeader>Current Stock</TableHeader>
              <TableHeader>Expiry Date</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <tbody>
            {loading ? (
              <TableLoading colSpan={6} />
            ) : medicines.length === 0 ? (
              <TableEmpty
                colSpan={6}
                message="No medicines found in the pharmacy registry."
                icon={IoMedkitOutline}
              />
            ) : (
              medicines.map((med) => {
                const expiry = med.expiryDate ? new Date(med.expiryDate) : null;
                const isExpired = expiry && expiry < now;
                const isLowStock = med.stock < 10;

                // Color coding rows
                let rowColorClass = '';
                if (isExpired) {
                  rowColorClass = 'bg-red-50/50 hover:bg-red-50';
                } else if (isLowStock) {
                  rowColorClass = 'bg-amber-50/50 hover:bg-amber-50';
                }

                return (
                  <TableRow key={med._id} className={rowColorClass}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{med.name}</div>
                      <div className="text-xs text-slate-500">
                        {med.genericName} &bull; {med.manufacturer || 'Generic'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {med.category || 'Medication'}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      ${(med.price || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-sm ${
                            isLowStock ? 'text-amber-600' : 'text-slate-800'
                          }`}
                        >
                          {med.stock} units
                        </span>
                        {isLowStock && <Badge status="low stock" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      {expiry ? (
                        <div className="text-xs">
                          <span
                            className={
                              isExpired ? 'font-bold text-red-600' : 'text-slate-700'
                            }
                          >
                            {expiry.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          {isExpired && <Badge status="expired" className="ml-2" />}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={IoPencilOutline}
                        onClick={() => openEditModal(med)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </tbody>
        </Table>
      </TableContainer>

      {/* Add / Edit Medicine Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMed ? 'Edit Medication' : 'Add Medication to Inventory'}
        subtitle="Manage pharmaceutical details, stock level, and pricing"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleFormSubmit}
              isLoading={submitting}
            >
              {editingMed ? 'Update Item' : 'Add to Stock'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
          {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Brand / Trade Name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Paracetamol"
              required
            />
            <Input
              label="Generic Chemical Name"
              value={formData.genericName}
              onChange={(e) => setFormData((p) => ({ ...p, genericName: e.target.value }))}
              placeholder="e.g. Acetaminophen"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Manufacturer / Brand"
              value={formData.manufacturer}
              onChange={(e) => setFormData((p) => ({ ...p, manufacturer: e.target.value }))}
              placeholder="e.g. Pfizer, Novartis"
            />
            <Select
              label="Drug Category"
              value={formData.category}
              onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
            >
              <option value="Antibiotic">Antibiotic</option>
              <option value="Analgesic">Analgesic / Pain Reliever</option>
              <option value="Antipyretic">Antipyretic</option>
              <option value="Cardiovascular">Cardiovascular</option>
              <option value="Antihistamine">Antihistamine</option>
              <option value="Vitamins">Vitamins & Supplements</option>
              <option value="Other">Other</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Unit Price ($)"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
              required
            />
            <Input
              label="Initial Stock Quantity"
              type="number"
              min="0"
              value={formData.stock}
              onChange={(e) => setFormData((p) => ({ ...p, stock: e.target.value }))}
              required
            />
            <Input
              label="Expiry Date"
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData((p) => ({ ...p, expiryDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Description & Dosage Notes
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Storage temperature, precautions, etc."
              className="w-full rounded-lg border border-[#CCD8D1] p-2.5 text-sm text-[#11261F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E382C]/20 focus:border-[#0E382C]"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ManagePharmacy;
