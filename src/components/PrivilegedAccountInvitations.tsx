import React, { useEffect, useRef, useState } from 'react';
import { MailPlus, RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { Button, Input, Modal, Select } from './ui';
import type { AccountSetupState } from './PrivilegedAccountSetup';

const EMPTY = { first_name: '', last_name: '', user_code: '', email: '', role: 'parking_staff', contact_number: '' };

export function PrivilegedAccountInviteModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (message: string) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => { if (open) { setForm(EMPTY); setError(''); } }, [open]);
  const field = (key: keyof typeof EMPTY, value: string) => setForm(f => ({ ...f, [key]: ['first_name', 'last_name', 'user_code'].includes(key) ? value.toUpperCase() : value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const data = await apiRequest<{ message: string }>('/api/admin/account-invitations', { method: 'POST', body: form });
      onCreated(data.message); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create the invitation.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Modal open={open} onClose={() => { if (!busy) onClose(); }} title="Invite Admin or Parking Staff" size="md">
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-slate-700 flex gap-2"><MailPlus size={20} className="shrink-0 text-blue-700" /><span>PASS generates a temporary password and emails the invitation. The recipient must activate their email and set a new password before opening the dashboard.</span></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="First name(s)" aria-label="First name(s)" value={form.first_name} maxLength={100} required disabled={busy} autoComplete="given-name" onChange={e => field('first_name', e.target.value)} />
        <Input label="Surname" aria-label="Surname" value={form.last_name} maxLength={100} required disabled={busy} autoComplete="family-name" onChange={e => field('last_name', e.target.value)} />
      </div>
      <Select label="Account role" aria-label="Account role" value={form.role} disabled={busy} onChange={e => field('role', e.target.value)}><option value="parking_staff">Parking Staff</option><option value="admin">Administrator</option></Select>
      <Input label="Account ID" aria-label="Account ID" placeholder="e.g. PST-0002 or ADM-0002" value={form.user_code} required maxLength={50} pattern="[A-Z0-9][A-Z0-9-]*" disabled={busy} onChange={e => field('user_code', e.target.value)} />
      <Input label="Email address" aria-label="Email address" type="email" value={form.email} required maxLength={255} disabled={busy} autoComplete="email" onChange={e => field('email', e.target.value)} />
      <Input label="Contact number (optional)" aria-label="Contact number (optional)" type="tel" value={form.contact_number} disabled={busy} maxLength={13} placeholder="09XXXXXXXXX" onChange={e => field('contact_number', e.target.value)} />
      <p className="text-xs text-slate-500">Confirm the recipient&apos;s email and role before sending. Administrators can manage accounts and system settings.</p>
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Creating invitation…' : 'Create & email invitation'}</Button></div>
    </form>
  </Modal>;
}

export function PrivilegedInvitationStatus({ userId }: { userId: string }) {
  const [setup, setSetup] = useState<AccountSetupState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const lock = useRef(false);
  const requestGeneration = useRef(0);
  useEffect(() => {
    const generation = ++requestGeneration.current;
    lock.current = false; setBusy(false);
    const controller = new AbortController(); setLoaded(false); setSetup(null); setError(''); setMessage('');
    void apiRequest<{ accountSetup: AccountSetupState | null }>(`/api/admin/account-invitations/${encodeURIComponent(userId)}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted && generation === requestGeneration.current) { setSetup(data.accountSetup); setLoaded(true); } })
      .catch(e => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Unable to load invitation status.'); setLoaded(true); } });
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [userId]);
  const wait = Math.max(0, Math.ceil(((setup?.resendAvailableAt ? Date.parse(setup.resendAvailableAt) : 0) - clock) / 1000));
  async function resend() {
    if (lock.current || !window.confirm('Replace this account’s temporary password and code, then email a new invitation? Existing setup sessions will be signed out.')) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    const generation = requestGeneration.current;
    try {
      const data = await apiRequest<{ message: string; accountSetup: AccountSetupState }>(`/api/admin/account-invitations/${encodeURIComponent(userId)}/resend`, { method: 'POST' });
      if (generation === requestGeneration.current) { setSetup(data.accountSetup); setMessage(data.message); }
    } catch (e) { if (generation === requestGeneration.current) setError(e instanceof Error ? e.message : 'Unable to resend invitation.'); }
    finally { if (generation === requestGeneration.current) { lock.current = false; setBusy(false); } }
  }
  if (loaded && !setup && !error) return null;
  return <section className="rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-2 text-sm">
    <h3 className="font-semibold text-[#080677]">Account activation</h3>
    {!loaded ? <p role="status">Loading invitation status…</p> : setup && <>
      <p>{!setup.required ? 'Setup complete' : setup.expired ? 'Invitation expired' : setup.step === 'change_password' ? 'Email activated · password change required' : 'Waiting for email activation'}</p>
      {setup.required && <><p className="text-xs text-slate-600">{setup.delivery === 'failed' ? 'Email delivery failed. Resend the invitation.' : setup.delivery === 'pending' ? 'Email delivery is pending.' : 'Mail server accepted the email. Inbox delivery must be confirmed by the recipient.'}</p><Button type="button" variant="outline" disabled={busy || wait > 0} onClick={() => void resend()}><RefreshCw size={14} />{busy ? 'Sending…' : wait ? `Resend available in ${wait}s` : 'Resend invitation'}</Button></>}
    </>}
    {message && <p role="status" className="text-green-800">{message}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}
