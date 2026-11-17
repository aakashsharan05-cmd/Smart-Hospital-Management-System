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
          className="fixed inset-0 bg-[#09261E]/70 z-40 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      {/* Sidebar aside */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#0E382C] text-emerald-100/90 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 border-r border-[#154637] shadow-xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#154637]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E5B229] flex items-center justify-center text-[#0E382C] font-black text-sm shadow-xs">
              +
            </div>
            <div className="text-left">
              <span className="text-white font-bold text-base tracking-wide">SHMS PORTAL</span>
              <p className="text-[10px] text-emerald-200/70 capitalize tracking-wider font-semibold">
                {role ? `${role} portal` : 'Hospital system'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-emerald-200/70 hover:text-white hover:bg-[#154637] transition-colors cursor-pointer"
          >
            <IoClose className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-emerald-300/60 uppercase tracking-wider text-left">
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
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-[#E5B229] text-[#0E382C] shadow-md font-bold'
                      : 'text-emerald-100/80 hover:bg-[#154637] hover:text-white'
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
        <div className="p-4 border-t border-[#154637] text-xs text-emerald-200/80 text-left">
          <div className="bg-[#09261E] p-3 rounded-lg border border-[#164738]">
            <p className="font-semibold text-white truncate">{user?.email}</p>
            <p className="text-[11px] text-[#E5B229] font-medium capitalize mt-0.5">Role: {user?.role}</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
