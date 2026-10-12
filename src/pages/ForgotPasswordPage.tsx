import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup } from '../components/Brand';
import { Shield, Mail, KeyRound, Eye, EyeOff, Check, ArrowLeft } from 'lucide-react';

type Step = 'email' | 'code' | 'newpwd' | 'done';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const next = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    if (step === 'email') setStep('code');
    else if (step === 'code') setStep('newpwd');
    else if (step === 'newpwd') setStep('done');
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><BrandLockup /></div>
          <h1 className="text-xl font-bold text-[#080677]">Password Recovery</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8">
          {step === 'email' && (
            <div>
              <div className="flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mx-auto mb-5">
                <Mail size={28} className="text-[#2563EB]" />
              </div>
              <h2 className="font-semibold text-slate-800 text-center mb-2">Forgot your password?</h2>
              <p className="text-sm text-slate-500 text-center mb-6">Enter your registered email and we'll send a verification code.</p>
              <div className="mb-5">
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@university.edu"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
              </div>
              <button onClick={next} disabled={!email || loading}
                className="w-full py-3 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </div>
          )}

          {step === 'code' && (
            <div>
              <div className="flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mx-auto mb-5">
                <KeyRound size={28} className="text-[#2563EB]" />
              </div>
              <h2 className="font-semibold text-slate-800 text-center mb-2">Enter Verification Code</h2>
              <p className="text-sm text-slate-500 text-center mb-1">A 6-digit code was sent to</p>
              <p className="text-sm font-semibold text-[#2563EB] text-center mb-6">{email}</p>
              <div className="mb-5">
                <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="000000" maxLength={6}
                  className="w-full border border-slate-200 rounded-xl px-4 py-4 text-2xl text-center font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
              </div>
              <button onClick={next} disabled={code.length < 6 || loading}
                className="w-full py-3 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
              <p className="text-center text-xs text-slate-400 mt-4">Didn't receive? <button className="text-[#2563EB] hover:underline">Resend code</button></p>
            </div>
          )}

          {step === 'newpwd' && (
            <div>
              <h2 className="font-semibold text-slate-800 text-center mb-2">Create New Password</h2>
              <p className="text-sm text-slate-500 text-center mb-6">Enter your new password below.</p>
              <div className="space-y-4 mb-5">
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="New password"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Confirm new password"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
              </div>
              <button onClick={next} disabled={!pwd || pwd !== confirmPwd || loading}
                className="w-full py-3 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-50">
                {loading ? 'Saving...' : 'Reset Password'}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Check size={36} className="text-green-600" />
              </div>
              <h2 className="font-semibold text-slate-800 mb-2">Password Reset Successful!</h2>
              <p className="text-sm text-slate-500 mb-8">Your password has been updated. You can now log in with your new password.</p>
              <Link to="/login" className="block w-full py-3 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1D4ED8] transition-colors">
                Go to Login
              </Link>
            </div>
          )}
        </div>

        {step !== 'done' && (
          <p className="text-center text-sm text-slate-400 mt-5">
            <Link to="/login" className="flex items-center justify-center gap-1 hover:text-[#2563EB]">
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
