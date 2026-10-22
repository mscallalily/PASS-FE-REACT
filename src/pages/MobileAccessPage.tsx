import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup } from '../components/Brand';
export default function MobileAccessPage() {
  return <main className="min-h-screen bg-slate-50 p-5 flex items-center justify-center"><section className="w-full max-w-sm rounded-2xl bg-white border border-blue-100 p-6 space-y-5"><BrandLockup /><h1 className="text-xl font-bold text-[#080677]">PASS on your phone</h1><p className="text-sm text-slate-600">Sign in to PASS through your phone’s browser to manage your account and view parking information.</p><Link to="/login" className="block text-center rounded-xl bg-blue-600 text-white p-3 font-semibold">Sign In</Link><Link to="/register" className="block text-center text-blue-700">Create Account</Link><Link to="/" className="block text-center text-sm text-slate-500">Back to Home</Link></section></main>;
}
