import { jsonFetch } from '../lib/http';
import EmailCodeVerification from '../components/EmailCodeVerification';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandLockup } from '../components/Brand';
import { Shield, Check, User, Eye, EyeOff, Info, ChevronRight } from 'lucide-react';

export default function GuestRegisterPage() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', password: '', confirmPwd: '',
    agree: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: k === 'fullName' && typeof v === 'string' ? v.toUpperCase() : v }));

  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  // Same rules as the server (POST /api/guest/register).
  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^\S+(\s+\S+)+$/.test(form.fullName.trim())) e.fullName = 'Enter your first and last name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Valid email is required';
    if (!/^(\+63|0)9\d{9}$/.test(form.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a mobile number like 09171234567';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) e.password = 'Use at least 8 characters with letters and numbers';
    if (form.password !== form.confirmPwd) e.confirmPwd = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const FIELD: Record<string, string> = { full_name: 'fullName', email: 'email', contact_number: 'phone', password: 'password', agree: 'agree' };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (busy || !form.agree || !validate()) return;
    setBusy(true);
    try {
      const response = await jsonFetch('/api/guest/register', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          contact_number: form.phone,
          password: form.password,
          password_confirmation: form.confirmPwd,
          agree: form.agree,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setVerificationMessage(data.message || 'Check your inbox and spam folder to verify your email before signing in.');
        setSubmitted(true);
        return;
      }
      const fieldErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries((data.errors ?? {}) as Record<string, string[]>)) {
        fieldErrors[FIELD[field] ?? field] = Array.isArray(messages) ? messages[0] : String(messages);
      }
      setErrors(fieldErrors);
      setServerError(Object.keys(fieldErrors).length ? 'Please correct the highlighted fields.' : data.message || 'Registration failed. Please try again.');
    } catch {
      setServerError('Cannot reach the server. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  if (submitted) {
    return <div className="min-h-screen bg-slate-50 p-6 flex items-center"><EmailCodeVerification initialEmail={form.email.trim()} notice={verificationMessage} /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><BrandLockup /></div>
          <h1 className="text-2xl font-bold text-[#080677]">Guest Registration</h1>
          <p className="text-sm text-slate-500 mt-1">Create a guest account before submitting a visitor parking request</p>
        </div>

        <p className="mb-5 text-sm text-center"><Link to="/verify-email" className="text-blue-700 underline">Already registered? Verify email / resend code</Link></p>

        {/* Guest Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-6">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <strong>Account creation is not parking approval.</strong> After registering, verify your email, then sign in and submit your visit purpose, schedule, and required vehicle details. A temporary visitor QR pass can only be issued after approval.
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 space-y-5">
          {/* Personal Info */}
          <div>
            <h3 className="font-semibold text-[#080677] flex items-center gap-2 mb-4"><User size={16} /> Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <input aria-label="Full Name" value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Juan dela Cruz"
                  className={`w-full border ${errors.fullName ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]`} />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Email Address <span className="text-red-500">*</span></label>
                <input aria-label="Email Address" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="juan@email.com"
                  className={`w-full border ${errors.email ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]`} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Contact Number <span className="text-red-500">*</span></label>
                <input aria-label="Contact Number" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="09XX XXX XXXX"
                  className={`w-full border ${errors.phone ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]`} />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input aria-label="Password" type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="At least 8 characters, letters and numbers"
                    className={`w-full border ${errors.password ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-[#2563EB]`} />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
                <input aria-label="Confirm Password" type="password" value={form.confirmPwd} onChange={e => set('confirmPwd', e.target.value)} placeholder="Repeat password"
                  className={`w-full border ${errors.confirmPwd ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]`} />
                {errors.confirmPwd && <p className="text-xs text-red-500 mt-1">{errors.confirmPwd}</p>}
              </div>
            </div>
          </div>

          {/* Agree */}
          <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.agree} onChange={e => set('agree', e.target.checked)} className="mt-1 rounded" />
            <span>I agree to the PASS <span className="text-[#2563EB]">Terms and Conditions</span> and <span className="text-[#2563EB]">Privacy Notice</span>. I understand this is a temporary guest account.</span>
          </label>

          {errors.agree && <p className="text-xs text-red-500">{errors.agree}</p>}
          {serverError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">{serverError}</p>}
          <button type="submit" disabled={!form.agree || busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <ChevronRight size={18} />
            {busy ? 'Creating account…' : 'Create Guest Account'}
          </button>
        </form>

        <div className="text-center mt-5 space-y-2">
          <p className="text-sm text-slate-500">
            Are you a student, faculty, or employee?{' '}
            <Link to="/register" className="text-[#2563EB] font-semibold hover:underline">Register with your institutional ID →</Link>
          </p>
          <p className="text-sm text-slate-400">
            Already have an account? <Link to="/login" className="text-[#2563EB] hover:underline">Sign In</Link>
          </p>
          <p className="text-xs text-slate-400">
            <Link to="/guest" className="hover:text-[#2563EB]">← Back to Guest Page</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
