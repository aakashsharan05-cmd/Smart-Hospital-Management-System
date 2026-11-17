import React, { useState, useEffect } from 'react';
import { getMyBills, getErrorMessage } from '../../services/api';
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
import { StatCard } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import {
  IoReceiptOutline,
  IoCashOutline,
  IoCheckmarkCircleOutline,
  IoRefreshOutline,
} from 'react-icons/io5';

const MyBills = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyBills();
      setBills(res.bills || []);
    } catch (err) {
      console.error('Error fetching my bills:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const totalBilled = bills.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
  const totalPaid = bills
    .filter((b) => b.paymentStatus === 'paid')
    .reduce((acc, b) => acc + (b.totalAmount || 0), 0);
  const totalPending = bills
    .filter((b) => b.paymentStatus === 'pending')
    .reduce((acc, b) => acc + (b.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Invoices & Billing</h1>
          <p className="text-sm text-slate-500">
            View detailed billing records, payments, and invoices
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={IoRefreshOutline}
          onClick={fetchBills}
          isLoading={loading}
        >
          Refresh
        </Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Total Billed"
          value={`$${totalBilled.toFixed(2)}`}
          subtitle={`${bills.length} invoices generated`}
          icon={IoReceiptOutline}
          color="blue"
        />
        <StatCard
          title="Total Settled"
          value={`$${totalPaid.toFixed(2)}`}
          subtitle="Paid in full"
          icon={IoCheckmarkCircleOutline}
          color="emerald"
        />
        <StatCard
          title="Pending Due"
          value={`$${totalPending.toFixed(2)}`}
          subtitle="Awaiting settlement"
          icon={IoCashOutline}
          color="amber"
        />
      </div>

      {/* Bills Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Invoice #</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader>Doctor</TableHeader>
              <TableHeader>Consultation</TableHeader>
              <TableHeader>Pharmacy</TableHeader>
              <TableHeader>Other</TableHeader>
              <TableHeader>Discount</TableHeader>
              <TableHeader>Total Amount</TableHeader>
              <TableHeader>Status</TableHeader>
            </TableRow>
          </TableHead>
          <tbody>
            {loading ? (
              <TableLoading colSpan={9} />
            ) : bills.length === 0 ? (
              <TableEmpty
                colSpan={9}
                message="No billing records or invoices found."
                icon={IoReceiptOutline}
              />
            ) : (
              bills.map((bill) => {
                const dateObj = new Date(bill.createdAt);
                const doctorName =
                  bill.doctor?.userId?.name || bill.doctor?.name || 'Assigned Doctor';

                return (
                  <TableRow key={bill._id}>
                    <TableCell className="font-mono font-bold text-blue-700">
                      {bill.invoiceNumber || bill._id.slice(-6).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      {dateObj.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-900">Dr. {doctorName}</span>
                    </TableCell>
                    <TableCell>${(bill.consultationFee || 0).toFixed(2)}</TableCell>
                    <TableCell>${(bill.medicineCharges || 0).toFixed(2)}</TableCell>
                    <TableCell>${(bill.otherCharges || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-emerald-600">
                      -${(bill.discount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">
                      ${(bill.totalAmount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge status={bill.paymentStatus} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </tbody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default MyBills;
