import React from 'react';
import { Link } from 'react-router-dom';
import { IoShieldHalfOutline, IoArrowBackOutline } from 'react-icons/io5';
import Button from '../components/ui/Button';

const Unauthorized = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-lg text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
          <IoShieldHalfOutline className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">403 - Access Denied</h1>
        <p className="text-slate-600 text-sm mb-6">
          You do not have the required permissions or role to access this portal page. Please
          contact your hospital administrator if you believe this is an error.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button variant="primary" icon={IoArrowBackOutline} className="w-full sm:w-auto">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
