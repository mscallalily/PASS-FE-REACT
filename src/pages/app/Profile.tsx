import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Input } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/apiClient';
type ProfileData = { name: string; email: string; id_number: string; department: string | null; contact_number: string; account_status: string; registration_category?: string | null; year_level?: string | null; section?: string | null };
export default function Profile() {
  const { logout } = useAuth(), navigate = useNavigate();
  const [data, setData] = useState<ProfileData | null>(null), [contact, setContact] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState(''), [revision, setRevision] = useState(0), [busy, setBusy] = useState(false);
  const [grade, setGrade] = useState(''), [section, setSection] = useState('');
  const [passwords, setPasswords] = useState({ current_password: '', password: '', password_confirmation: '' }); const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    apiRequest<{ data: ProfileData }>('/api/profile', { signal: controller.signal }).then(r => { setData(r.data); setContact(r.data.contact_number); setGrade(r.data.year_level || ''); setSection(r.data.section || ''); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [revision]);
  async function save(event: React.FormEvent, password = false) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await apiRequest<{ message: string }>(password ? '/api/profile/password' : '/api/profile', { method: password ? 'POST' : 'PATCH', body: password ? passwords : { contact_number: contact, ...(data?.registration_category === 'shs' ? { year_level: grade, section: section.trim() } : {}) } });
      if (password) { setPasswords({ current_password: '', password: '', password_confirmation: '' }); await logout(); navigate('/login?password=changed', { replace: true }); }
      else { setMessage(result.message); setRevision(v => v + 1); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save changes.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="max-w-3xl space-y-5 animate-fadein"><PageHeader title="My Profile" subtitle="Manage your contact information and password" />
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 text-sm break-words">{error}{!data && <Button variant="outline" onClick={() => setRevision(v => v + 1)}>Retry</Button>}</div>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800 text-sm">{message}</p>}
    {!data && !error && <p role="status">Loading your profile…</p>}
    {data && <><Card className="p-5 sm:p-6"><h2 className="font-semibold text-[#080677] mb-4">Account Information</h2>
      <dl className="space-y-3">{[['Full Name', data.name], ['Email', data.email], ['Institutional ID', data.id_number], ['Department', data.department], ...(data.registration_category === 'shs' ? [['Grade / Year Level', data.year_level ? `GRADE ${data.year_level}` : '—'], ['Section', data.section]] : []), ['Account Status', data.account_status]].map(([k, v]) => <div key={k} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm border-b border-slate-50 pb-2"><dt className="text-slate-500">{k}</dt><dd className="font-medium break-words sm:text-right sm:max-w-[65%]">{v || '—'}</dd></div>)}</dl>
      <p className="mt-4 text-xs text-slate-500">Contact PASS staff to correct verified identity or email details.</p>
      <form onSubmit={e => save(e)} className="mt-5 space-y-4"><Input label="Contact Number" value={contact} onChange={e => setContact(e.target.value)} required maxLength={13} />{data.registration_category === 'shs' && <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold text-[#080677]">School Details</legend><div><label htmlFor="profile-grade-level" className="block text-sm font-medium text-slate-700">Grade / Year Level</label><select id="profile-grade-level" required value={grade} disabled={busy} onChange={e => setGrade(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"><option value="">Select grade level</option><option value="11">GRADE 11</option><option value="12">GRADE 12</option></select></div><Input label="Section" value={section} onChange={e => setSection(e.target.value.toUpperCase())} required disabled={busy} maxLength={60} /></fieldset>}<Button disabled={busy} type="submit">{busy ? 'Saving…' : data.registration_category === 'shs' ? 'Save Details' : 'Save Contact'}</Button></form>
    </Card><Card className="p-5 sm:p-6"><h2 className="font-semibold text-[#080677] mb-4">Change Password</h2>
      <form onSubmit={e => save(e, true)} className="space-y-4 max-w-sm">{(['current_password', 'password', 'password_confirmation'] as const).map((key, i) => <Input key={key} label={['Current Password', 'New Password', 'Confirm New Password'][i]} type="password" autoComplete={i === 0 ? 'current-password' : 'new-password'} required minLength={i === 0 ? undefined : 8} maxLength={72} value={passwords[key]} onChange={e => setPasswords(p => ({ ...p, [key]: e.target.value }))} />)}
        <p className="text-xs text-slate-500">Changing your password signs out your existing sessions.</p><Button disabled={busy} type="submit">Update Password</Button>
      </form></Card></>}
  </div>;
}
