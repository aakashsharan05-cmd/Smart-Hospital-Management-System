import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  IoGridOutline,
  IoCalendarOutline,
  IoAddCircleOutline,
  IoDocumentTextOutline,
  IoReceiptOutline,
  IoBusinessOutline,
  IoMedicalOutline,
  IoPeopleOutline,
  IoMedkitOutline,
  IoClose,
} from 'react-icons/io5';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const role = user?.role;

  // Determine navigation items by role
  const getNavLinks = () => {
    switch (role) {
      case 'patient':
        return [
          { name: 'Dashboard', path: '/patient/dashboard', icon: IoGridOutline },
          { name: 'Book Appointment', path: '/patient/book-appointment', icon: IoAddCircleOutline },
          { name: 'My Appointments', path: '/patient/appointments', icon: IoCalendarOutline },
          { name: 'My Medical Records', path: '/patient/records', icon: IoDocumentTextOutline },
          { name: 'My Invoices & Bills', path: '/patient/bills', icon: IoReceiptOutline },
        ];
      case 'doctor':
        return [
          { name: 'Dashboard', path: '/doctor/dashboard', icon: IoGridOutline },
          { name: 'My Appointments', path: '/doctor/appointments', icon: IoCalendarOutline },
        ];
      case 'admin':
        return [
          { name: 'Dashboard', path: '/admin/dashboard', icon: IoGridOutline },
          { name: 'Departments', path: '/admin/departments', icon: IoBusinessOutline },
          { name: 'Doctors', path: '/admin/doctors', icon: IoMedicalOutline },
          { name: 'Users', path: '/admin/users', icon: IoPeopleOutline },
          { name: 'Billing', path: '/admin/billing', icon: IoReceiptOutline },
          { name: 'Pharmacy', path: '/admin/pharmacy', icon: IoMedkitOutline },
        ];
      case 'receptionist':
        return [
          { name: 'Dashboard', path: '/receptionist/dashboard', icon: IoGridOutline },
          { name: 'Appointments', path: '/receptionist/appointments', icon: IoCalendarOutline },
        ];
      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      {/* Sidebar aside */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
              +
            </div>
            <div className="text-left">
              <span className="text-white font-bold text-base tracking-wide">SHMS PORTAL</span>
              <p className="text-[10px] text-slate-400 capitalize tracking-wider font-semibold">
                {role ? `${role} portal` : 'Hospital system'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <IoClose className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-left">
            Navigation
          </div>
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer info */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 text-left">
          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
            <p className="font-medium text-slate-300 truncate">{user?.email}</p>
            <p className="text-[11px] text-slate-400 capitalize mt-0.5">Role: {user?.role}</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
