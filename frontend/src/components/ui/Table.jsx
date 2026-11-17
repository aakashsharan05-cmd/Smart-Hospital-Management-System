import React from 'react';
import LoadingSpinner from '../LoadingSpinner';

export const TableContainer = ({ children, className = '' }) => {
  return (
    <div className={`w-full overflow-hidden rounded-xl border border-[#E2EAE5] bg-white shadow-xs ${className}`}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
};

export const Table = ({ children, className = '' }) => {
  return (
    <table className={`w-full text-left border-collapse text-sm text-[#11261F] ${className}`}>
      {children}
    </table>
  );
};

export const TableHead = ({ children, className = '' }) => {
  return (
    <thead className={`bg-[#F4F7F5] text-xs font-semibold uppercase tracking-wider text-[#526B62] border-b border-[#E2EAE5] ${className}`}>
      {children}
    </thead>
  );
};

export const TableRow = ({ children, className = '', onClick }) => {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-[#EEF3F0] last:border-0 hover:bg-[#F8FAF7] transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </tr>
  );
};

export const TableHeader = ({ children, className = '' }) => {
  return (
    <th scope="col" className={`px-4 py-3.5 text-left font-semibold text-[#11261F] ${className}`}>
      {children}
    </th>
  );
};

export const TableCell = ({ children, className = '', colSpan }) => {
  return (
    <td colSpan={colSpan} className={`px-4 py-3.5 align-middle text-[#11261F] ${className}`}>
      {children}
    </td>
  );
};

export const TableEmpty = ({ message = 'No records found', colSpan = 6, icon: Icon }) => {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-slate-400">
        <div className="flex flex-col items-center justify-center gap-2">
          {Icon && <Icon className="w-10 h-10 text-slate-300 stroke-1" />}
          <p className="text-sm font-medium">{message}</p>
        </div>
      </td>
    </tr>
  );
};

export const TableLoading = ({ colSpan = 6 }) => {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center">
        <LoadingSpinner size="md" text="Loading table data..." />
      </td>
    </tr>
  );
};

export default Table;
