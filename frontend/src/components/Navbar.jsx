import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  IoMenuOutline,
  IoLogOutOutline,
  IoPersonCircleOutline,
} from 'react-icons/io5';
import { FaHospitalSymbol } from 'react-icons/fa';
import Badge from './ui/Badge';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-xs h-16 flex items-center justify-between px-4 sm:px-6">
      {/* Left side: Hamburger (mobile) + App Brand */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Toggle Navigation"
        >
          <IoMenuOutline className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <FaHospitalSymbol className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none m-0">
              SHMS
            </h1>
            <span className="text-[11px] font-medium text-slate-500 tracking-wide uppercase">
              Smart Hospital
            </span>
          </div>
        </div>
      </div>

      {/* Right side: User info & Logout */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200/60 sm:border-l-0">
            <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <IoPersonCircleOutline className="w-7 h-7" />
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-sm font-semibold text-slate-800 leading-tight">
                {user.name || 'User'}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge status={user.role} className="text-[10px] py-0 px-2" />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 cursor-pointer"
          title="Sign out of SHMS"
        >
          <IoLogOutOutline className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
