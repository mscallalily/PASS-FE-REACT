import { staffBarrier, type GateTicket } from '../../lib/staffBarrier'; // PASS_STAFF_BARRIER_V1
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/apiClient';
import { formatCampusDateTime } from '../../lib/datetime';
import { PageHeader, Card, Button, Input, Select, Modal, Badge } from '../../components/ui';

type Row = { release_id: number; transaction_id: number; plate_number: string; driver_name: string; driver_contact: string; license_reference: string; license_expiry: string; reason: string; status: string; expires_at: string; reviewed_by: number | null; released_by: number | null; released_at: string | null; review_remarks: string | null };
type Data = { data: Row[]; sessions: { transaction_id: number; plate_number: string }[]; can_manage: boolean; };
const empty = { transaction_id: '', driver_name: '', driver_contact: '', license_number: '', license_expiry: '', reason: '' };
export default function VehicleRelease() {
  const { user } = useAuth();
  const regular = ['student', 'faculty', 'employee'].includes(user?.role ?? '');
  const [data, setData] = useState<Data>({ data: [], sessions: [], can_manage: false });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(empty);
  const [create, setCreate] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [identity, setIdentity] = useState(false);
  const [authorization, setAuthorization] = useState(false);
  const [remarks, setRemarks] = useState('');
  const load = useCallback(async () => {
    try { setData(await apiRequest<Data>('/api/vehicle-releases')); setLoaded(true); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load release requests.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await apiRequest<{ message: string }>('/api/vehicle-releases', { method: 'POST', body: { ...form, transaction_id: Number(form.transaction_id), acknowledged: ack } });
      setMessage(result.message); setCreate(false); setForm(empty); setAck(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  async function act(action: string) {
    if (!selected) return;
    let gateTicket: GateTicket | null = null;
    setBusy(true); setError('');
    try {
      if (user?.role === 'parking_staff' && action === 'release') gateTicket = staffBarrier.begin();
      const result = await apiRequest<{ message: string; status?: string; gate_action?: string; release_id?: number; barrier_receipt?: string | null; barrier_command_id?: number | null; barrier_status?: string }>(`/api/vehicle-releases/${selected.release_id}/action`, { method: 'POST', body: { action, remarks, identity_checked: identity, authorization_checked: authorization } });
      const gateOutcome = gateTicket ? await staffBarrier.approved(gateTicket, { kind: 'emergency', action, barrier_receipt: result.barrier_receipt, barrier_command_id: result.barrier_command_id, barrier_status: result.barrier_status, gate_action: result.gate_action, status: result.status, release_id: result.release_id, expected_release_id: selected.release_id }) : null;
      setMessage([result.message, gateOutcome?.message].filter(Boolean).join(' ')); setSelected(null); await load();
    } catch (e) {
      if (gateTicket) staffBarrier.failed(gateTicket, e); setError(e instanceof Error ? e.message : 'Action failed.'); }
    finally { if (gateTicket) staffBarrier.finish(gateTicket); setBusy(false); }
  }
  function open(row: Row) { setSelected(row); setIdentity(false); setAuthorization(false); setRemarks(''); setError(''); }
  const pending = selected?.status === 'pending';
  const actionable = selected && ['pending', 'approved'].includes(selected.status);
  return <>
    <PageHeader title="Emergency Vehicle Release" subtitle="A different driver may take your currently parked vehicle out after staff verification." action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={load}>Refresh</Button>{regular && <Button disabled={!data.sessions.length} onClick={() => { setCreate(true); setError(''); }}>Authorize another driver</Button>}</div>} />
    <Card><div className="p-5 text-sm leading-relaxed text-slate-600"><p className="font-semibold text-[#080677] mb-2">One parking session · one exit · expires after two hours</p><p>Owner authorizes the named substitute driver → staff checks the owner authorization, actual driver, physical license and plate → staff confirms and records the exit in one action.</p><p className="mt-2 text-xs text-slate-500">This grants no entry access and does not transfer your RFID or permanently change your registered driver. If the owner cannot authorize through their account, contact campus security. PASS does not allow an administrator to substitute their own authorization for the owner’s.</p></div></Card>
    {message && <p role="status" className="my-4 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">{message}</p>}
    {error && !selected && !create && <p role="alert" className="my-4 text-sm text-red-700">{error}</p>}
    <div className="mt-5 space-y-3">{!loaded && !error && <p className="text-sm text-slate-500">Loading requests…</p>}{loaded && !data.data.length && <Card><p className="p-8 text-center text-sm text-slate-500">No emergency release requests.{regular && !data.sessions.length ? ' You need a vehicle currently inside to request one.' : ''}</p></Card>}{data.data.map(row => <Card key={row.release_id}><div className="p-5 flex flex-wrap justify-between items-center gap-4"><div className="min-w-0"><div className="flex flex-wrap gap-2 items-center"><strong className="text-[#080677]">{row.plate_number}</strong><Badge variant={row.status === 'used' ? 'success' : row.status === 'approved' ? 'info' : row.status === 'pending' ? 'warning' : 'default'}>{row.status.replace('_', ' ')}</Badge></div><p className="text-sm text-slate-600 mt-1 break-words">Substitute driver: {row.driver_name}</p><p className="text-xs text-slate-400 mt-1">#{row.release_id} · Expires {formatCampusDateTime(row.expires_at)}</p></div><Button variant="outline" size="sm" onClick={() => open(row)}>View request</Button></div></Card>)}</div>
    <Modal open={create} onClose={() => !busy && setCreate(false)} title="Authorize another driver" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm text-slate-600">Currently parked vehicle<Select required value={form.transaction_id} onChange={e => setForm(f => ({ ...f, transaction_id: e.target.value }))}><option value="">Select vehicle…</option>{data.sessions.map(s => <option key={s.transaction_id} value={s.transaction_id}>{s.plate_number} · session #{s.transaction_id}</option>)}</Select></label>
        <div className="grid gap-4 sm:grid-cols-2">{(['driver_name', 'driver_contact', 'license_number', 'license_expiry'] as const).map(key => <Input key={key} required label={{ driver_name: 'Actual substitute driver’s full name', driver_contact: 'Driver contact number', license_number: 'Driver’s license number', license_expiry: 'License expiry' }[key]} type={key === 'license_expiry' ? 'date' : 'text'} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />)}</div>
        <Input required label="Emergency reason" minLength={10} maxLength={1000} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
        <label className="flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" required checked={ack} onChange={e => setAck(e.target.checked)} className="mt-1"/>I authorize this named driver to take this vehicle out for this parking session only.</label>
        <p className="text-xs text-slate-500">The driver must present the original physical license at the gate. No additional RFID or reusable QR is issued.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy || !ack}>{busy ? 'Submitting…' : 'Submit for review'}</Button>
      </form>
    </Modal>
    <Modal open={!!selected} onClose={() => !busy && setSelected(null)} title="Emergency release review" size="lg">{selected && <div className="space-y-4">
      <Badge variant="info">{selected.status.replace('_', ' ')}</Badge>
      <dl className="text-sm divide-y divide-slate-100">{Object.entries({ Vehicle: selected.plate_number, 'Substitute driver': selected.driver_name, Contact: selected.driver_contact, License: selected.license_reference, 'License expiry': selected.license_expiry, Reason: selected.reason, Authorization: 'Submitted by the signed-in vehicle owner', Expires: formatCampusDateTime(selected.expires_at), 'Reviewed by (staff ID)': selected.reviewed_by ?? '—', 'Released by (staff ID)': selected.released_by ?? '—', 'Release time': selected.released_at ? formatCampusDateTime(selected.released_at) : '—', Remarks: selected.review_remarks ?? '—' }).map(([key, value]) => <div className="py-2 flex gap-4 justify-between" key={key}><dt className="text-slate-400">{key}</dt><dd className="min-w-0 break-words text-right text-slate-700">{value}</dd></div>)}</dl>
      {data.can_manage && actionable && <><label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={identity} onChange={e => setIdentity(e.target.checked)} className="mt-1"/>I physically checked the actual driver’s face, original license, number and expiry, and matched the vehicle plate.</label>{pending && <label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={authorization} onChange={e => setAuthorization(e.target.checked)} className="mt-1"/>I checked this authorization submitted by the vehicle owner in PASS.</label>}<Input label="Review remarks / rejection reason" value={remarks} onChange={e => setRemarks(e.target.value)} /></>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">{data.can_manage && pending && <><Button variant="success" disabled={busy || !identity || !authorization} onClick={() => act('release')}>Confirm driver & record exit</Button><Button variant="danger" disabled={busy || remarks.trim().length < 5} onClick={() => act('reject')}>Reject</Button></>}{actionable && <Button variant="outline" disabled={busy} onClick={() => act('cancel')}>Cancel request</Button>}</div>
    </div>}</Modal>
  </>;
}
