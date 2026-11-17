import React from 'react';

const Badge = ({ status = '', variant, children, className = '' }) => {
  const normalized = (variant || status || '').toLowerCase();

  const getStyle = () => {
    switch (normalized) {
      case 'confirmed':
      case 'doctor':
      case 'info':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'in-queue':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'in-consultation':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'completed':
      case 'paid':
      case 'active':
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending':
      case 'receptionist':
      case 'warning':
      case 'low stock':
      case 'low-stock':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelled':
      case 'rejected':
      case 'missed':
      case 'failed':
      case 'danger':
      case 'expired':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'patient':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'refunded':
      case 'inactive':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const displayText = children || (status ? status.charAt(0).toUpperCase() + status.slice(1) : '');

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border capitalize ${getStyle()} ${className}`}
    >
      {displayText}
    </span>
  );
};

export default Badge;
