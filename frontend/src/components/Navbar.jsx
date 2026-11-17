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
    <header className="sticky top-0 z-30 bg-white border-b border-[#E2EAE5] shadow-xs h-16 flex items-center justify-between px-4 sm:px-6">
      {/* Left side: Hamburger (mobile) + App Brand */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-[#526B62] hover:text-[#11261F] hover:bg-[#EDF7F2] transition-colors cursor-pointer"
          aria-label="Toggle Navigation"
        >
          <IoMenuOutline className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#0E382C] flex items-center justify-center text-[#E5B229] shadow-xs">
            <FaHospitalSymbol className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#11261F] tracking-tight leading-none m-0">
              SHMS
            </h1>
            <span className="text-[11px] font-medium text-[#526B62] tracking-wide uppercase">
              Smart Hospital
            </span>
          </div>
        </div>
      </div>

      {/* Right side: User info & Logout */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-[#E2EAE5] sm:border-l-0">
            <div className="w-9 h-9 rounded-full bg-[#EDF7F2] border border-[#C6E7D5] flex items-center justify-center text-[#0E382C]">
              <IoPersonCircleOutline className="w-7 h-7" />
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-sm font-semibold text-[#11261F] leading-tight">
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#526B62] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 cursor-pointer"
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
