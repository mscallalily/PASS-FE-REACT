import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function EmailCodeVerification({ initialEmail = '', notice = '' }: { initialEmail?: string; notice?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(notice);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  React.useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const request = async (verify: boolean) => {
    if (busy) return;
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your registered email address.'); return; }
    if (verify && !/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your email.'); return; }
    setBusy(true); setError(''); setMessage('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(verify ? '/api/email/verify-code' : '/api/email/verification-notification', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), ...(verify ? { code } : {}) }), signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.errors?.email?.[0] || data.message || 'Request failed. Please try again.');
      setMessage(data.message);
      if (verify) setVerified(true); else { setCooldown(60); setCode(''); }
    } catch (err) {
      setError(err instanceof Error && err.name !== 'AbortError' ? err.message : 'The server took too long. Please try again shortly.');
    } finally { window.clearTimeout(timer); setBusy(false); }
  };
  return <section className="bg-white rounded-2xl border border-blue-100 p-6 max-w-md w-full mx-auto text-left">
    <h1 className="text-2xl font-bold text-[#080677] mb-3">Verify your email</h1>
    <p className="text-sm text-slate-600 mb-4">Enter the 6-digit code sent to your inbox. Codes expire in 10 minutes. Check spam too.</p>
    {message && <p role="status" className="bg-green-50 text-green-800 p-3 rounded-xl mb-4">{message}</p>}
    {error && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl mb-4">{error}</p>}
    {!verified && <form onSubmit={e => { e.preventDefault(); request(true); }} className="space-y-4">
      <label className="block text-sm">Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required className="block w-full border rounded-xl p-3 mt-1" /></label>
      <label className="block text-sm">Verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="block w-full border rounded-xl p-3 mt-1 tracking-widest" /></label>
      <button disabled={busy} className="w-full rounded-xl bg-blue-700 text-white py-3 disabled:opacity-50">{busy ? 'Please wait…' : 'Verify email'}</button>
      <button type="button" disabled={busy || cooldown > 0} onClick={() => request(false)} className="w-full text-blue-700 underline disabled:opacity-50">{cooldown ? `Resend code in ${cooldown}s` : 'Send / resend code'}</button>
    </form>}
    <Link to="/login" className="block text-center mt-5 text-blue-700 underline">{verified ? 'Continue to sign in' : 'Back to sign in'}</Link>
  </section>;
}
