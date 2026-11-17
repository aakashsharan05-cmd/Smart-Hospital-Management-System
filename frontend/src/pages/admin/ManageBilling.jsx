import React, { useState, useEffect } from 'react';
import {
  getAllBills,
  createBill,
  markBillPaid,
  getAllAppointments,
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
  IoReceiptOutline,
  IoAddCircleOutline,
  IoCheckmarkCircleOutline,
  IoRefreshOutline,
} from 'react-icons/io5';

const ManageBilling = () => {
  const [bills, setBills] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create Bill Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formAppointmentId, setFormAppointmentId] = useState('');
  const [consultationFee, setConsultationFee] = useState('100');
  const [medicineCharges, setMedicineCharges] = useState('0');
  const [otherCharges, setOtherCharges] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Mark Paid Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedBillToPay, setSelectedBillToPay] = useState(null);
  const [payMethodSelect, setPayMethodSelect] = useState('cash');
  const [paying, setPaying] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [billsRes, apptsRes] = await Promise.all([
        getAllBills(),
        getAllAppointments(),
      ]);
      setBills(billsRes.bills || []);
      setAppointments(apptsRes.appointments || []);
    } catch (err) {
      console.error('Error fetching billing data:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setFormAppointmentId(appointments[0]?._id || '');
    setConsultationFee('100');
    setMedicineCharges('0');
    setOtherCharges('0');
    setDiscount('0');
    setPaymentMethod('cash');
    setFormError('');
    setCreateModalOpen(true);
  };

  // When selected appointment changes, if doctor fee exists, auto fill
  const handleAppointmentSelect = (e) => {
    const apptId = e.target.value;
    setFormAppointmentId(apptId);
    const chosen = appointments.find((a) => a._id === apptId);
    if (chosen && chosen.doctor?.consultationFee) {
      setConsultationFee(chosen.doctor.consultationFee.toString());
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formAppointmentId) {
      setFormError('Please select an appointment to bill.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        appointmentId: formAppointmentId,
        consultationFee: Number(consultationFee) || 0,
        medicineCharges: Number(medicineCharges) || 0,
        otherCharges: Number(otherCharges) || 0,
        discount: Number(discount) || 0,
        paymentMethod,
      };

      await createBill(payload);
      setCreateModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Error creating bill:', err);
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openPayModal = (bill) => {
    setSelectedBillToPay(bill);
    setPayMethodSelect('cash');
    setPayModalOpen(true);
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!selectedBillToPay) return;

    setPaying(true);
    try {
      await markBillPaid(selectedBillToPay._id, payMethodSelect);
      setPayModalOpen(false);
      setSelectedBillToPay(null);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  const totalCalculated =
    (Number(consultationFee) || 0) +
    (Number(medicineCharges) || 0) +
    (Number(otherCharges) || 0) -
    (Number(discount) || 0);

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manage Hospital Billing</h1>
          <p className="text-sm text-slate-500">
            Generate patient invoices, record treatments, and process settlements
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
            onClick={openCreateModal}
          >
            Create New Bill
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Bills Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Invoice #</TableHeader>
              <TableHeader>Patient</TableHeader>
              <TableHeader>Physician</TableHeader>
              <TableHeader>Total Due</TableHeader>
              <TableHeader>Payment Status</TableHeader>
              <TableHeader>Created Date</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <tbody>
            {loading ? (
              <TableLoading colSpan={7} />
            ) : bills.length === 0 ? (
              <TableEmpty
                colSpan={7}
                message="No billing records found. Click 'Create New Bill' to generate one."
                icon={IoReceiptOutline}
              />
            ) : (
              bills.map((bill) => {
                const dateObj = new Date(bill.createdAt);
                const patientName =
                  bill.patient?.name || bill.appointment?.patient?.name || 'Patient';
                const doctorName =
                  bill.doctor?.userId?.name || bill.doctor?.name || 'Physician';
                const isPaid = bill.paymentStatus === 'paid';

                return (
                  <TableRow key={bill._id}>
                    <TableCell className="font-mono font-bold text-[#0E382C]">
                      {bill.invoiceNumber || bill._id.slice(-6).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{patientName}</div>
                      <div className="text-xs text-slate-500">{bill.patient?.email}</div>
                    </TableCell>
                    <TableCell>{formatDoctorName(doctorName)}</TableCell>
                    <TableCell className="font-bold text-slate-900">
                      ₹{(bill.totalAmount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge status={bill.paymentStatus} />
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {dateObj.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isPaid ? (
                        <Button
                          variant="success"
                          size="sm"
                          icon={IoCheckmarkCircleOutline}
                          onClick={() => openPayModal(bill)}
                        >
                          Mark Paid
                        </Button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600">Settled</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </tbody>
        </Table>
      </TableContainer>

      {/* Create Bill Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Patient Invoice"
        subtitle="Generate itemized billing for a consultation appointment"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateSubmit}
              isLoading={submitting}
            >
              Generate Bill (₹{Math.max(0, totalCalculated).toFixed(2)})
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-left">
          {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

          <Select
            label="Select Consultation Appointment"
            value={formAppointmentId}
            onChange={handleAppointmentSelect}
            required
            placeholder="-- Choose Appointment --"
          >
            {appointments.map((appt) => {
              const pName = appt.patient?.name || 'Patient';
              const dName = appt.doctor?.userId?.name || appt.doctor?.name || 'Doctor';
              const dateStr = new Date(appt.appointmentDate).toLocaleDateString();
              return (
                <option key={appt._id} value={appt._id}>
                  {pName} with {formatDoctorName(dName)} on {dateStr} ({appt.status})
                </option>
              );
            })}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Consultation Fee (₹)"
              type="number"
              min="0"
              value={consultationFee}
              onChange={(e) => setConsultationFee(e.target.value)}
              required
            />
            <Input
              label="Medicine / Pharmacy Charges (₹)"
              type="number"
              min="0"
              value={medicineCharges}
              onChange={(e) => setMedicineCharges(e.target.value)}
            />
            <Input
              label="Other Hospital Charges (₹)"
              type="number"
              min="0"
              value={otherCharges}
              onChange={(e) => setOtherCharges(e.target.value)}
            />
            <Input
              label="Discount / Waiver (₹)"
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>

          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="card">Credit / Debit Card</option>
            <option value="upi">UPI / Mobile Payment</option>
            <option value="online">Online Transfer</option>
            <option value="other">Other</option>
          </Select>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-sm font-semibold text-slate-800">
            <span>Net Calculated Total:</span>
            <span className="text-lg text-[#0E382C] font-bold">
              ₹{Math.max(0, totalCalculated).toFixed(2)}
            </span>
          </div>
        </form>
      </Modal>

      {/* Mark Paid Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Mark Bill as Paid"
        subtitle={`Invoice: ${selectedBillToPay?.invoiceNumber || ''} - Total: ₹${selectedBillToPay?.totalAmount || 0}`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setPayModalOpen(false)}
              disabled={paying}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleConfirmPayment}
              isLoading={paying}
              icon={IoCheckmarkCircleOutline}
            >
              Confirm Settlement
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-left">
          <Select
            label="Received Payment Method"
            value={payMethodSelect}
            onChange={(e) => setPayMethodSelect(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="online">Online Transfer</option>
          </Select>
        </div>
      </Modal>
    </div>
  );
};

export default ManageBilling;
