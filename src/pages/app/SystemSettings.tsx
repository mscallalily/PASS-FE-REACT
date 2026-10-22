import React, { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { PageHeader, Card, Button, Input } from '../../components/ui';
import { apiRequest, ApiError } from '../../lib/apiClient';

type GeneralSettings = {
  system_name: string;
  institution_name: string;
  contact_email: string;
  contact_phone: string;
  timezone: string;
  date_format: string;
};
const DEFAULTS: GeneralSettings = {
  system_name: 'PASS — Parking Access and Space Management System',
  institution_name: "Dr. Yanga's Colleges, Inc.",
  contact_email: '', contact_phone: '', timezone: 'Asia/Manila', date_format: 'MM/DD/YYYY',
};
function normalize(input: Record<string, unknown>): GeneralSettings {
  const value = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof GeneralSettings)[]) {
    if (typeof input[key] === 'string') value[key] = input[key];
  }
  value.timezone = 'Asia/Manila';
  return value;
}

export default function SystemSettings() {
  const [form, setForm] = useState<GeneralSettings | null>(null);
  const [saved, setSaved] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void apiRequest<{ data: Record<string, unknown> }>('/api/admin/system-settings', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { const value = normalize(result.data); setForm(value); setSaved(value); } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load system information.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const dirty = form !== null && JSON.stringify(form) !== JSON.stringify(saved);
  const busy = loading || saving;
  function field(key: 'system_name' | 'institution_name' | 'contact_email' | 'contact_phone') {
    return {
      value: form?.[key] ?? '', disabled: busy,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setForm(current => current && ({ ...current, [key]: value }));
        setErrors(current => ({ ...current, [key]: '' })); setMessage('');
      },
    };
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !form || !dirty) return;
    lock.current = true; setSaving(true); setError(''); setErrors({}); setMessage('');
    try {
      const result = await apiRequest<{ message: string }>('/api/admin/system-settings', { method: 'PUT', body: form });
      if (mounted.current) { setSaved({ ...form }); setMessage(result.message); }
    } catch (e) {
      if (mounted.current) { setError(e instanceof Error ? e.message : 'Unable to save system information.'); if (e instanceof ApiError) setErrors(e.fieldErrors); }
    } finally { lock.current = false; if (mounted.current) setSaving(false); }
  }
  return <div className="max-w-2xl space-y-5 animate-fadein">
    <PageHeader title="System Settings" subtitle="Manage saved system and institutional contact information" />
    {loading && <p role="status" className="text-sm text-slate-500">Loading system information…</p>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 break-words">{error}{!form && <Button className="mt-3" variant="outline" onClick={() => setRevision(value => value + 1)}>Try again</Button>}</div>}
    {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    {form && <Card className="p-4 sm:p-6">
      <h2 className="mb-5 flex items-center gap-2 font-semibold text-[#080677]"><Settings size={18} />General Information</h2>
      <form onSubmit={save} className="space-y-5">
        <Input label="System Name" required maxLength={150} error={errors.system_name} {...field('system_name')} />
        <Input label="Institution Name" required maxLength={150} error={errors.institution_name} {...field('institution_name')} />
        <Input label="Contact Email" type="email" required maxLength={255} error={errors.contact_email} {...field('contact_email')} />
        <Input label="Contact Phone" maxLength={30} error={errors.contact_phone} {...field('contact_phone')} />
        <p className="text-xs text-slate-500">All schedules and transaction times use Philippine Time (PHT / UTC+08:00), Asia/Manila.</p>
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <Button type="button" variant="outline" disabled={busy || !dirty} onClick={() => { setForm(saved && { ...saved }); setErrors({}); setError(''); setMessage(''); }}>Cancel</Button>
          <Button type="submit" disabled={busy || !dirty}>{saving ? 'Saving…' : 'Save General Settings'}</Button>
        </div>
      </form>
    </Card>}
  </div>;
}
