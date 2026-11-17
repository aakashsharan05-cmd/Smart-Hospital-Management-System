import React from 'react';

const Badge = ({ status = '', variant, children, className = '' }) => {
  const normalized = (variant || status || '').toLowerCase();

  const getStyle = () => {
    switch (normalized) {
      case 'confirmed':
      case 'doctor':
      case 'info':
        return 'bg-[#EDF7F2] text-[#0E382C] border-[#C6E7D5]';
      case 'in-queue':
        return 'bg-[#FDF8EB] text-[#9A7412] border-[#F5DE9B] font-bold';
      case 'in-consultation':
        return 'bg-[#E5F3EE] text-[#13543F] border-[#A8DAC5] font-bold';
      case 'completed':
      case 'paid':
      case 'active':
      case 'success':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'pending':
      case 'warning':
      case 'low stock':
      case 'low-stock':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'cancelled':
      case 'rejected':
      case 'missed':
      case 'failed':
      case 'danger':
      case 'expired':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'admin':
        return 'bg-[#F5F2FC] text-[#5B3E96] border-[#DFD6F5]';
      case 'patient':
        return 'bg-[#EDF7F2] text-[#0E382C] border-[#C6E7D5]';
      case 'receptionist':
        return 'bg-[#FEF9ED] text-[#8C6709] border-[#F5E2B0]';
      case 'refunded':
      case 'inactive':
      default:
        return 'bg-[#F4F7F5] text-[#526B62] border-[#E2EAE5]';
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
