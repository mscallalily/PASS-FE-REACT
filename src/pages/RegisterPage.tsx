import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PassMark } from '../components/Brand';
import RegistrationForm from '../components/RegistrationForm';

export default function RegisterPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><PassMark size="lg" /></div>
          <h1 className="text-2xl font-bold text-[#080677]">Create Your Account</h1>
          <p className="text-sm text-slate-500 mt-1">Join PASS — Parking Access and Space Management System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 sm:p-8">
          <RegistrationForm variant="web" onBackToLogin={() => navigate('/login')} />
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account? <Link to="/login" className="text-[#2563EB] font-semibold hover:underline">Sign In</Link>
        </p>
        <p className="text-center text-xs text-slate-400 mt-2">
          <Link to="/" className="hover:text-[#2563EB]">← Back to Home</Link>
        </p>
      </div>
    </div>
  );
}
