import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup } from '../components/Brand';
import { jsonRequest } from '../lib/http';
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const submitting = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const data = await jsonRequest<{ message: string }>('/api/forgot-password', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
      setMessage(data.message);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to request a reset link.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="w-full max-w-sm">
    <div className="flex justify-center mb-6"><BrandLockup /></div>
    <section className="bg-white border border-blue-100 rounded-2xl shadow-lg p-6 sm:p-8">
      <h1 className="text-xl font-bold text-[#080677]">Password Recovery</h1>
      <p className="text-sm text-slate-500 mt-2 mb-6">Enter your registered email to request a password reset link.</p>
      {error && <p role="alert" className="text-sm text-red-700 mb-4 break-words">{error}</p>}
      {message && <p role="status" className="text-sm text-green-800 mb-4">{message}</p>}
      <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Email Address<input type="email" autoComplete="email" required maxLength={255} value={email} onChange={e => setEmail(e.target.value)} className="block w-full mt-2 rounded-xl border border-slate-200 p-3" /></label>
        <button disabled={busy} className="w-full rounded-xl bg-[#2563EB] text-white font-semibold py-3 disabled:opacity-50">{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>
    </section><Link to="/login" className="block text-center text-sm text-blue-700 mt-5">Back to Login</Link>
  </div></main>;
}
