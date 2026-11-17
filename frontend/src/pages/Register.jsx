import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import {
  IoPersonOutline,
  IoMailOutline,
  IoLockClosedOutline,
  IoCallOutline,
  IoCheckmarkCircle,
} from 'react-icons/io5';
import { FaHospitalSymbol } from 'react-icons/fa';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();

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

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please provide a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[0-9+\s-]{7,15}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError('');
    setSuccessMessage('');

    try {
      const response = await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
      });

      setSuccessMessage(
        response.message || 'Registration successful! You can now log into your patient account.'
      );
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
      });
    } catch (err) {
      console.error('Registration error:', err);
      setServerError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
            <FaHospitalSymbol className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Patient Registration
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Create an account to book appointments and track your health records
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200/80 sm:px-10">
          {serverError && (
            <Alert
              type="error"
              message={serverError}
              className="mb-5"
              onClose={() => setServerError('')}
            />
          )}

          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <IoCheckmarkCircle className="w-5 h-5 text-emerald-600" />
                Account Created
              </div>
              <p className="text-sm text-emerald-700">{successMessage}</p>
              <Link
                to="/login"
                className="mt-3 inline-block font-semibold text-sm text-emerald-800 underline hover:text-emerald-900"
              >
                Proceed to Login &rarr;
              </Link>
            </div>
          )}

          {!successMessage && (
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <Input
                label="Full Name"
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                icon={IoPersonOutline}
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                required
              />

              <Input
                label="Email Address"
                id="email"
                name="email"
                type="email"
                placeholder="patient@example.com"
                icon={IoMailOutline}
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                required
              />

              <Input
                label="Phone Number"
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 234 567 8900"
                icon={IoCallOutline}
                value={formData.phone}
                onChange={handleChange}
                error={errors.phone}
                required
              />

              <Input
                label="Password"
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                icon={IoLockClosedOutline}
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                required
              />

              <Input
                label="Confirm Password"
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                icon={IoLockClosedOutline}
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-3"
                isLoading={loading}
              >
                Register Account
              </Button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
