import React, { useState, useEffect } from 'react';
import { getMyPrescriptions, getErrorMessage } from '../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  IoDocumentTextOutline,
  IoPersonOutline,
  IoCalendarOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoMedkitOutline,
  IoChatboxEllipsesOutline,
  IoRefreshOutline,
} from 'react-icons/io5';

const MyRecords = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyPrescriptions();
      const records = res.prescriptions || [];
      setPrescriptions(records);
      // Auto expand first record if exists
      if (records.length > 0) {
        setExpandedId(records[0]._id);
      }
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading your medical records & prescriptions..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Medical Records</h1>
          <p className="text-sm text-slate-500">
            View prescriptions, doctor diagnoses, medications, and health advice
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={IoRefreshOutline}
          onClick={fetchRecords}
          isLoading={loading}
        >
          Refresh
        </Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {prescriptions.length === 0 ? (
        <Card className="py-16 text-center border-dashed">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <IoDocumentTextOutline className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No Medical Records Yet</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Your prescription details and diagnostic records will appear here after a completed
              doctor consultation.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((record) => {
            const isExpanded = expandedId === record._id;
            const dateObj = new Date(record.createdAt || record.appointment?.appointmentDate);
            const doctorName =
              record.doctor?.userId?.name || record.doctor?.name || 'Assigned Physician';
            const specialization = record.doctor?.specialization || 'General Practice';

            return (
              <Card
                key={record._id}
                className={`overflow-hidden transition-all duration-200 ${
                  isExpanded ? 'border-blue-300 ring-2 ring-blue-500/10' : ''
                }`}
              >
                {/* Header click toggles expand */}
                <div
                  onClick={() => toggleExpand(record._id)}
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <IoDocumentTextOutline className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>Diagnosis:</span>
                        <span className="text-blue-700">{record.diagnosis}</span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <IoPersonOutline /> Dr. {doctorName} ({specialization})
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <IoCalendarOutline />
                          {dateObj.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span>&bull;</span>
                        <span className="font-semibold text-emerald-600">
                          {record.medicines?.length || 0} Medicines Prescribed
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
                    aria-label={isExpanded ? 'Collapse record' : 'Expand record'}
                  >
                    {isExpanded ? (
                      <IoChevronUpOutline className="w-5 h-5" />
                    ) : (
                      <IoChevronDownOutline className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <CardContent className="border-t border-slate-100 bg-slate-50/40 p-6 space-y-6 animate-fade-in">
                    {/* Medicines List */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
                        <IoMedkitOutline className="w-4 h-4 text-blue-600" /> Prescribed Medicines
                      </h4>
                      {record.medicines && record.medicines.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                              <tr>
                                <th className="px-4 py-2.5">Medicine Name</th>
                                <th className="px-4 py-2.5">Dosage</th>
                                <th className="px-4 py-2.5">Frequency</th>
                                <th className="px-4 py-2.5">Duration</th>
                                <th className="px-4 py-2.5">Instructions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {record.medicines.map((med, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-semibold text-slate-900">
                                    {med.name}
                                  </td>
                                  <td className="px-4 py-3 text-slate-700">{med.dosage}</td>
                                  <td className="px-4 py-3 text-slate-700">{med.frequency}</td>
                                  <td className="px-4 py-3 text-slate-700">{med.duration}</td>
                                  <td className="px-4 py-3 text-slate-500 italic">
                                    {med.instructions || 'As directed'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No specific medications prescribed.</p>
                      )}
                    </div>

                    {/* Doctor Advice */}
                    {record.advice && (
                      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-left">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5 mb-1">
                          <IoChatboxEllipsesOutline className="w-4 h-4 text-amber-700" />
                          Physician's Advice & Remarks
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                          {record.advice}
                        </p>
                      </div>
                    )}

                    {/* Follow up info */}
                    {record.followUpDate && (
                      <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-2 border-t border-slate-200">
                        <IoCalendarOutline className="text-blue-600" />
                        <span className="font-semibold text-slate-900">Recommended Follow-up: </span>
                        {new Date(record.followUpDate).toLocaleDateString(undefined, {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyRecords;
