import React from 'react';
import { Link } from 'react-router-dom';
import { IoCompassOutline, IoHomeOutline } from 'react-icons/io5';
import Button from '../components/ui/Button';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-lg text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#EDF7F2] text-[#0E382C] flex items-center justify-center mx-auto mb-4 border border-[#C6E7D5]">
          <IoCompassOutline className="w-9 h-9" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-1">404</h1>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Page Not Found</h2>
        <p className="text-slate-600 text-sm mb-6">
          The requested page could not be located in the SHMS portal system. It may have been moved
          or removed.
        </p>
        <div className="flex justify-center">
          <Link to="/">
            <Button variant="primary" icon={IoHomeOutline}>
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
