import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { IoMailOutline, IoLockClosedOutline } from 'react-icons/io5';
import { FaHospitalSymbol } from 'react-icons/fa';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) setServerError('');
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError('');

    try {
      await login(formData.email, formData.password);
      // Navigate to destination or home (which redirects based on role)
      const destination = location.state?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setServerError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8F5] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0E382C] flex items-center justify-center text-[#E5B229] shadow-lg border border-[#164638]">
            <FaHospitalSymbol className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-[#11261F]">
          Sign In to SHMS
        </h2>
        <p className="mt-1 text-center text-sm text-[#526B62]">
          Smart Hospital Management System Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl shadow-[#0E382C]/5 rounded-2xl border border-[#E2EAE5] sm:px-10">
          {serverError && (
            <Alert
              type="error"
              message={serverError}
              className="mb-6"
              onClose={() => setServerError('')}
            />
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <Input
              label="Email Address"
              id="email"
              name="email"
              type="email"
              placeholder="doctor@hospital.com"
              icon={IoMailOutline}
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              icon={IoLockClosedOutline}
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              required
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={loading}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#EEF3F0] text-center">
            <p className="text-sm text-[#526B62]">
              Don't have a patient account?{' '}
              <Link
                to="/register"
                className="font-bold text-[#0E382C] hover:text-[#164638] underline-offset-2 hover:underline transition-colors"
              >
                Register as Patient
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
