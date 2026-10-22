import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, KeyRound, MailCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, getToken } from '../lib/apiClient';
import { Button, Input } from './ui';
import { PassMark } from './Brand';

export interface AccountSetupState {
  required: boolean;
  step: 'verify_email' | 'change_password' | 'complete';
  expired: boolean;
  expiresAt: string;
  codeExpiresAt: string | null;
  resendAvailableAt: string | null;
  delivery: 'pending' | 'accepted' | 'failed';
}

export function PrivilegedSetupGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const setup = (user as typeof user & { accountSetup?: AccountSetupState | null })?.accountSetup;
  // Providers that poll protected APIs are children, so they cannot run during setup.
  return setup?.required ? <PrivilegedAccountSetup initial={setup} /> : <>{children}</>;
}

function PrivilegedAccountSetup({ initial }: { initial: AccountSetupState }) {
  const { user, logout } = useAuth();
  const [setup, setSetup] = useState(initial);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [clock, setClock] = useState(Date.now());
  const lock = useRef(false);
  const mounted = useRef(true);
  const statusGeneration = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const generation = statusGeneration.current;
    void apiRequest<{ accountSetup: AccountSetupState }>('/api/account/setup', { signal: controller.signal })
      .then(data => { if (mounted.current && generation === statusGeneration.current && data.accountSetup) setSetup(data.accountSetup); })
      .catch(e => { if (mounted.current && generation === statusGeneration.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load account setup.'); });
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => { mounted.current = false; controller.abort(); window.clearInterval(timer); };
  }, []);
  const wait = Math.max(0, Math.ceil(((setup.resendAvailableAt ? Date.parse(setup.resendAvailableAt) : 0) - clock) / 1000));
  const expired = setup.expired || Date.parse(setup.expiresAt) <= clock;

  async function act(action: 'verify' | 'resend-code' | 'complete') {
    if (lock.current) return;
    statusGeneration.current++;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    const originalToken = getToken();
    try {
      const data = await apiRequest<{ message: string; accountSetup?: AccountSetupState; token?: string }>(`/api/account/setup/${action}`, {
        method: 'POST', body: action === 'verify' ? { code } : action === 'complete' ? { password, password_confirmation: confirmation } : {},
      });
      if (getToken() !== originalToken) return; // Never overwrite a newer session from another tab.
      if (action === 'complete') {
        if (!data.token) throw new Error('Setup completed without a session response. Please sign in again.');
        const storage = localStorage.getItem('pass_auth_token') === originalToken ? localStorage : sessionStorage;
        localStorage.removeItem('pass_auth_token'); sessionStorage.removeItem('pass_auth_token');
        storage.setItem('pass_auth_token', data.token);
        window.location.replace('/app/dashboard');
        return;
      }
      if (!mounted.current) return;
      if (data.accountSetup) setSetup(data.accountSetup);
      setMessage(data.message); setCode('');
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Unable to complete this action.');
      if (action === 'resend-code') {
        try {
          const latest = await apiRequest<{ accountSetup: AccountSetupState }>('/api/account/setup');
          if (mounted.current && latest.accountSetup) setSetup(latest.accountSetup);
        } catch { /* Preserve the original action error. */ }
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#F4F7FB] px-4 py-8 sm:py-12 flex items-center justify-center">
    <div className="w-full max-w-lg min-w-0">
      <div className="flex justify-center mb-6"><PassMark size="xl" /></div>
      <section className="rounded-2xl bg-white border border-blue-100 shadow-lg p-5 sm:p-8">
        <ShieldCheck className="text-[#2563EB] mb-3" size={30} />
        <h1 className="text-2xl font-bold text-[#080677]">Set up your PASS account</h1>
        <p className="text-sm text-slate-600 mt-2 break-all">{user?.email}</p>
        <ol className="my-6 grid grid-cols-3 gap-2 text-xs text-center" aria-label="Account setup steps">
          {['Temporary sign-in', 'Activate email', 'New password'].map((text, i) => <li key={text} className={`rounded-xl border p-2 ${i === 0 || (i === 1 && setup.step === 'change_password') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
            <span className="block font-bold mb-1">{i + 1}</span>{text}
          </li>)}
        </ol>
        {error && <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 break-words">{error}</p>}
        {message && <p role="status" className="mb-4 text-sm text-green-800 bg-green-50 rounded-xl p-3">{message}</p>}
        {expired ? <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Your invitation has expired. Ask your PASS administrator to resend the invitation, then sign in using the new temporary password.</div>
          : setup.step === 'verify_email' ? <form onSubmit={e => { e.preventDefault(); void act('verify'); }} className="space-y-4">
            <div className="flex items-center gap-2 font-semibold text-slate-800"><MailCheck size={20} />Activate your email</div>
            <p className="text-sm text-slate-600">Enter the 6-digit activation code from your invitation email. Codes expire in 10 minutes. Request a fresh code if needed.</p>
            <Input label="Activation code" aria-label="Activation code" value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required pattern="[0-9]{6}" disabled={busy} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <Button type="submit" disabled={busy || code.length !== 6} className="w-full">{busy ? 'Please wait…' : 'Verify activation code'}</Button>
            <Button type="button" variant="outline" className="w-full" disabled={busy || wait > 0} onClick={() => void act('resend-code')}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend activation code'}</Button>
          </form> : <form onSubmit={e => { e.preventDefault(); void act('complete'); }} className="space-y-4">
            <div className="flex items-center gap-2 text-green-800 text-sm"><CheckCircle2 size={18} />Email activated</div>
            <h2 className="font-semibold text-slate-800 flex gap-2 items-center"><KeyRound size={20} />Choose your own password</h2>
            <p className="text-sm text-slate-600">Use at least 12 characters with uppercase and lowercase letters and a number. Choose a different password from the temporary password.</p>
            <Input label="New password" aria-label="New password" type="password" value={password} autoComplete="new-password" required minLength={12} maxLength={72} disabled={busy} onChange={e => setPassword(e.target.value)} />
            <Input label="Confirm new password" aria-label="Confirm new password" type="password" value={confirmation} autoComplete="new-password" required minLength={12} maxLength={72} disabled={busy} onChange={e => setConfirmation(e.target.value)} />
            {confirmation && password !== confirmation && <p className="text-sm text-red-700">Passwords must match.</p>}
            <Button type="submit" className="w-full" disabled={busy || !password || password !== confirmation}>{busy ? 'Saving…' : 'Save password & open dashboard'}</Button>
          </form>}
        <button type="button" disabled={busy} className="mt-5 text-sm text-slate-600 underline disabled:opacity-50" onClick={() => void logout().catch(() => {}).finally(() => window.location.replace('/login'))}>Sign out</button>
      </section>
      <p className="mt-4 text-xs text-center text-slate-500">Dr. Yanga&apos;s Colleges, Inc. · PASS</p>
    </div>
  </main>;
}
