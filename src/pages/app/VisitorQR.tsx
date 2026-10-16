import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, Card, Badge, Button, Table, SearchBar, Modal, Tabs, Toast, Input, Select } from '../../components/ui';
import { apiRequest, ApiError } from '../../lib/apiClient';
import { useTopicVersion, useLiveSync } from '../../lib/liveSync';
import { CAMPUS_TIMEZONE, formatCampusDateTime } from '../../lib/datetime';
import { QrCode, Plus, Check, X, Search, LogIn, LogOut, Ban, Copy } from 'lucide-react';
import QrCodeImage from '../../components/QrCode';
import { useAuth } from '../../context/AuthContext';

// Visitor registration, access requests and Visitor QR passes, from the
// visitors, visitor_requests and qr_passes tables. A pass exists only after a
// request is approved; entry and exit go through the real gate endpoints.

type PassStatus = 'active' | 'scheduled' | 'used' | 'expired' | 'revoked' | 'legacy';

interface Pass {
  qr_pass_id: number;
  pass_code: string;
  status: PassStatus;
  request_id: number | null;
  request_status: string | null;
  legacy: boolean;
  visitor_name: string | null;
  plate_number: string | null;
  vehicle_type: string | null;
  valid_from: string | null;
  valid_until: string | null;
  use_count: number;
  max_uses: number;
  issued_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
}

interface VisitorRequest {
  request_id: number;
  request_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  purpose: string | null;
  valid_from: string | null;
  valid_until: string | null;
  window_ended: boolean;
  created_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_remarks: string | null;
  visitor: { visitor_id: number; has_account: boolean; name: string; contact_number: string | null; affiliation: string | null; is_blacklisted: boolean };
  vehicle: { vehicle_id: number | null; plate_number: string | null; vehicle_type: string | null; area_name: string | null };
  pass: Pass | null;
}

interface Options {
  visitors: { visitor_id: number; first_name: string; last_name: string; contact_number: string | null; is_blacklisted: number | boolean; plates: string[] }[];
  vehicle_types: { vehicle_type_id: number; type_name: string; area_name: string }[];
  max_visit_days: number;
}

interface Lookup extends Pass {
  entry_allowed: boolean;
  entry_problem: string | null;
  inside: { transaction_id: number; slot_code: string | null; entry_datetime: string | null } | null;
}

type Notify = (message: string, type?: 'success' | 'error') => void;

const PASS_BADGE: Record<PassStatus, 'success' | 'info' | 'default' | 'danger' | 'warning'> = {
  active: 'success', scheduled: 'info', used: 'default', expired: 'danger', revoked: 'danger', legacy: 'warning',
};
const PASS_LABEL: Record<PassStatus, string> = {
  active: 'Active', scheduled: 'Not valid yet', used: 'Used', expired: 'Expired', revoked: 'Revoked', legacy: 'Legacy (no approved request)',
};
const REQUEST_BADGE = { pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'default', expired: 'default' } as const;

/** A datetime-local value in campus time, `minutes` from now. */
function campusLocal(minutes: number) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(Date.now() + minutes * 60000)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

const window_ = (from: string | null, until: string | null) => `${formatCampusDateTime(from)} – ${formatCampusDateTime(until)}`;

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{message}</div>;
}

// ----------------------------------------------------------------- pass card

function PassCard({ pass }: { pass: Pass }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(pass.pass_code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  return (
    <div className="bg-gradient-to-br from-[#080677] via-[#1E4F8A] to-[#2563EB] rounded-2xl p-6 text-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center"><QrCode size={18} className="text-[#38BDF8]" /></div>
        <div>
          <p className="text-xs text-blue-200 font-medium">PASS — Visitor QR Access Pass</p>
          <p className="text-[10px] text-blue-300">Main Entrance / Exit · visitors only</p>
        </div>
        <span className="ml-auto"><Badge variant={PASS_BADGE[pass.status]}>{PASS_LABEL[pass.status]}</Badge></span>
      </div>
      <h2 className="text-xl font-bold">{pass.visitor_name ?? 'Visitor'}</h2>
      <p className="text-blue-200 text-sm font-mono">{pass.plate_number ?? '—'}{pass.vehicle_type ? ` · ${pass.vehicle_type}` : ''}</p>
      <div className="my-4 flex justify-center">
        <QrCodeImage value={pass.pass_code} size={200} />
      </div>
      <div className="mb-4 bg-white/10 rounded-xl p-3">
        <p className="text-[10px] uppercase tracking-wide text-blue-200 mb-1">Pass code</p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm break-all flex-1">{pass.pass_code}</p>
          <button type="button" onClick={copy} className="text-blue-100 hover:text-white" aria-label="Copy pass code"><Copy size={16} /></button>
        </div>
        {copied && <p className="text-[10px] text-green-300 mt-1">Copied</p>}
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-4"><span className="text-blue-300">Valid from</span><span className="font-semibold text-right">{formatCampusDateTime(pass.valid_from)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-blue-300">Valid until</span><span className="font-semibold text-right">{formatCampusDateTime(pass.valid_until)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-blue-300">Uses</span><span className="font-semibold">{pass.use_count} of {pass.max_uses} (one entry, one exit)</span></div>
        <div className="flex justify-between gap-4"><span className="text-blue-300">Request</span><span className="font-semibold">{pass.request_id ? `#${pass.request_id}` : 'none (legacy)'}</span></div>
      </div>
      <p className="text-[10px] text-blue-300 mt-4 border-t border-white/10 pt-3">
        Present this QR code at the Main Entrance / Exit. Staff can also type the pass code in QR Verification.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------- request form

function RequestForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [visitorId, setVisitorId] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVisitorId('');
    setErrors({});
    setError('');
    setForm({ first_name: '', last_name: '', contact_number: '', email: '', affiliation: '', plate_number: '', vehicle_type_id: '', make: '', model: '', color: '', purpose: '', visiting: '', valid_from: campusLocal(0), valid_until: campusLocal(240) });
    apiRequest<Options>('/api/visitors/options').then(setOptions).catch(err => setError(err instanceof Error ? err.message : 'Unable to load form options.'));
  }, [open]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setErrors({});
    setError('');
    try {
      const body: Record<string, unknown> = { ...form, vehicle_type_id: form.vehicle_type_id ? Number(form.vehicle_type_id) : null };
      if (visitorId) { body.visitor_id = Number(visitorId); ['first_name', 'last_name', 'contact_number', 'email', 'affiliation'].forEach(k => delete body[k]); }
      const r = await apiRequest<{ message: string }>('/api/visitors/requests', { method: 'POST', body });
      onSaved(r.message);
    } catch (err) {
      if (err instanceof ApiError) { setErrors(err.fieldErrors); setError(err.message); } else setError('The request could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const field = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Input label={label} value={form[k] ?? ''} onChange={set(k)} error={errors[k]} disabled={busy} {...props} />
  );

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="New Visitor Access Request" size="lg">
      <div className="space-y-5">
        <p className="text-sm text-slate-500">Register the visitor and their vehicle. The request is saved as pending; a QR pass is issued only when an Administrator approves it.</p>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">Visitor</h4>
          <Select label="Returning visitor (optional)" value={visitorId} onChange={e => setVisitorId(e.target.value)} disabled={busy}>
            <option value="">New visitor</option>
            {options?.visitors.map(v => (
              <option key={v.visitor_id} value={v.visitor_id} disabled={!!v.is_blacklisted}>
                {v.first_name} {v.last_name}{v.contact_number ? ` · ${v.contact_number}` : ''}{v.plates.length ? ` · ${v.plates.join(', ')}` : ''}{v.is_blacklisted ? ' · blacklisted' : ''}
              </option>
            ))}
          </Select>
          {errors.visitor_id && <p className="text-xs text-red-600">{errors.visitor_id}</p>}
          {!visitorId && (
            <div className="grid sm:grid-cols-2 gap-3">
              {field('first_name', 'First name *')}
              {field('last_name', 'Last name *')}
              {field('contact_number', 'Contact number *')}
              {field('email', 'Email', { type: 'email' })}
              <div className="sm:col-span-2">{field('affiliation', 'Company / affiliation')}</div>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">Vehicle</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {field('plate_number', 'Plate number *')}
            <div>
              <Select label="Vehicle type *" value={form.vehicle_type_id ?? ''} onChange={set('vehicle_type_id')} disabled={busy}>
                <option value="">Choose…</option>
                {options?.vehicle_types.map(t => <option key={t.vehicle_type_id} value={t.vehicle_type_id}>{t.type_name} → {t.area_name}</option>)}
              </Select>
              {errors.vehicle_type_id && <p className="text-xs text-red-600 mt-1">{errors.vehicle_type_id}</p>}
            </div>
            {field('make', 'Make')}
            {field('model', 'Model')}
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">Visit</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {field('purpose', 'Purpose *')}
            {field('visiting', 'Person or office visited *')}
            {field('valid_from', 'Arrives from (Manila time) *', { type: 'datetime-local' })}
            {field('valid_until', 'Leaves by (Manila time) *', { type: 'datetime-local' })}
          </div>
          {options && <p className="text-xs text-slate-400">A request may cover up to {options.max_visit_days} days. The pass allows one entry and one exit within this time.</p>}
        </div>
        {error && <ErrorBox message={error} />}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Submit Request'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------- requests tab

function Requests({ notify, onShowPass, reloadKey, onChanged }: { notify: Notify; onShowPass: (p: Pass) => void; reloadKey: number; onChanged: () => void }) {
  // Only Administrators approve or reject; Parking Staff can register requests and see their status.
  const isAdmin = useAuth().user?.role === 'admin';
  const [rows, setRows] = useState<VisitorRequest[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [review, setReview] = useState<{ row: VisitorRequest; action: 'approve' | 'reject' } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (debounced.trim()) params.set('search', debounced.trim());
    try {
      setRows((await apiRequest<{ data: VisitorRequest[] }>(`/api/visitors/requests?${params}`)).data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load visitor requests.');
    }
  }, [status, debounced]);

  const version = useTopicVersion(['visitors']);
  useEffect(() => { load(); }, [load, reloadKey, version]);

  const submitReview = async () => {
    if (!review) return;
    setBusy(true);
    setReviewError('');
    try {
      const r = await apiRequest<{ message: string; pass?: Pass }>(`/api/visitors/requests/${review.row.request_id}/${review.action}`, { method: 'POST', body: { remarks: remarks.trim() || null } });
      setReview(null);
      notify(r.message);
      onChanged();
      if (r.pass) onShowPass(r.pass);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'The request could not be updated.');
      if (err instanceof ApiError && err.status === 409) load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="p-5 border-b border-slate-50">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by visitor, plate, or purpose...">
          <Select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
            <option value="">All requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </SearchBar>
      </div>
      {error && <div className="m-5"><ErrorBox message={error} /></div>}
      {rows === null && !error ? <p className="py-16 text-center text-sm text-slate-400">Loading visitor requests...</p> : rows?.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">No visitor requests yet. Use “New Visitor Request” to register a visitor.</p>
      ) : (
        <Table
          columns={[
            { key: 'id', label: 'Request', render: (r: VisitorRequest) => <div><span className="font-mono text-xs">#{r.request_id}</span><p className="text-[10px] text-slate-400">{formatCampusDateTime(r.created_at)}</p></div> },
            { key: 'visitor', label: 'Visitor', render: (r: VisitorRequest) => (
              <div>
                <p className="font-medium">{r.visitor.name}</p>
                <p className="text-xs text-slate-400">{r.visitor.contact_number ?? ''}{r.visitor.affiliation ? ` · ${r.visitor.affiliation}` : ''}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {r.visitor.has_account && <Badge variant="info">guest account</Badge>}
                  {r.visitor.is_blacklisted && <Badge variant="danger">blacklisted</Badge>}
                </div>
              </div>
            )},
            { key: 'vehicle', label: 'Vehicle', render: (r: VisitorRequest) => <div><span className="font-mono font-bold text-[#080677]">{r.vehicle.plate_number ?? '—'}</span><p className="text-xs text-slate-400">{r.vehicle.vehicle_type} · {r.vehicle.area_name}</p></div> },
            { key: 'purpose', label: 'Purpose', render: (r: VisitorRequest) => <span className="text-sm">{r.purpose}</span> },
            { key: 'window', label: 'Visit Window (Manila)', render: (r: VisitorRequest) => <span className={`text-xs ${r.window_ended ? 'text-slate-400' : ''}`}>{window_(r.valid_from, r.valid_until)}{r.window_ended ? ' · ended' : ''}</span> },
            { key: 'status', label: 'Status', render: (r: VisitorRequest) => (
              <div className="space-y-1">
                <Badge variant={REQUEST_BADGE[r.request_status]}>{r.request_status}</Badge>
                {r.reviewed_by && <p className="text-[10px] text-slate-400">by {r.reviewed_by}</p>}
                {r.review_remarks && <p className="text-[10px] text-slate-500 max-w-[180px]">{r.review_remarks}</p>}
                {r.pass && <p className="text-[10px]">Pass: <span className="font-semibold">{PASS_LABEL[r.pass.status]}</span></p>}
              </div>
            )},
            { key: 'actions', label: 'Actions', render: (r: VisitorRequest) => (
              <div className="flex flex-wrap gap-2">
                {r.request_status === 'pending' && !isAdmin && <span className="text-xs text-amber-700">Awaiting Admin approval</span>}
                {isAdmin && r.request_status === 'pending' && !r.window_ended && (
                  <Button size="sm" variant="success" onClick={() => { setReview({ row: r, action: 'approve' }); setRemarks(''); setReviewError(''); }}><Check size={12} /> Approve</Button>
                )}
                {isAdmin && r.request_status === 'pending' && (
                  <Button size="sm" variant="danger" onClick={() => { setReview({ row: r, action: 'reject' }); setRemarks(''); setReviewError(''); }}><X size={12} /> Reject</Button>
                )}
                {r.pass && <Button size="sm" variant="outline" onClick={() => onShowPass(r.pass!)}><QrCode size={12} /> Pass</Button>}
              </div>
            )},
          ]}
          data={rows ?? []}
        />
      )}

      <Modal open={!!review} onClose={() => !busy && setReview(null)} title={review?.action === 'approve' ? 'Approve Visitor Request' : 'Reject Visitor Request'} size="sm">
        {review && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{review.row.visitor.name}</span> · <span className="font-mono">{review.row.vehicle.plate_number}</span><br />
              {window_(review.row.valid_from, review.row.valid_until)}
            </p>
            {review.action === 'approve'
              ? <p className="text-sm text-slate-500">Approving issues one Visitor QR pass for this vehicle and visit window (one entry and one exit). A guest with an account is notified and sees the pass in their account.</p>
              : <p className="text-sm text-slate-500">No QR pass is issued for a rejected request.</p>}
            <Input label={review.action === 'reject' ? 'Reason for rejecting *' : 'Remarks (optional)'} value={remarks} onChange={e => setRemarks(e.target.value)} disabled={busy} />
            {reviewError && <ErrorBox message={reviewError} />}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setReview(null)} disabled={busy}>Cancel</Button>
              <Button variant={review.action === 'approve' ? 'success' : 'danger'} onClick={submitReview} disabled={busy || (review.action === 'reject' && !remarks.trim())}>
                {busy ? 'Saving...' : review.action === 'approve' ? 'Approve & Issue Pass' : 'Reject Request'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

// ----------------------------------------------------------------- passes tab

function Passes({ notify, onShowPass, reloadKey }: { notify: Notify; onShowPass: (p: Pass) => void; reloadKey: number }) {
  const [rows, setRows] = useState<Pass[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [revoke, setRevoke] = useState<Pass | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    try {
      setRows((await apiRequest<{ data: Pass[] }>(`/api/visitors/passes?${params}`)).data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load QR passes.');
    }
  }, [search, status]);

  const version = useTopicVersion(['visitors', 'parking']);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load, reloadKey, version]);

  const submitRevoke = async () => {
    if (!revoke) return;
    setBusy(true);
    setRevokeError('');
    try {
      const r = await apiRequest<{ message: string }>(`/api/visitors/passes/${revoke.qr_pass_id}/revoke`, { method: 'POST', body: { reason: reason.trim() } });
      setRevoke(null);
      notify(r.message);
      load();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'The pass could not be revoked.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="p-5 border-b border-slate-50 space-y-2">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by visitor, plate, or pass code...">
          <Select value={status} onChange={e => setStatus(e.target.value)} aria-label="Pass status">
            <option value="">All passes</option>
            {(Object.keys(PASS_LABEL) as PassStatus[]).map(s => <option key={s} value={s}>{PASS_LABEL[s]}</option>)}
          </Select>
        </SearchBar>
        <p className="text-xs text-slate-400">Legacy passes were created before visitor approval was required. They are kept unchanged and can still be used to exit, but never to enter.</p>
      </div>
      {error && <div className="m-5"><ErrorBox message={error} /></div>}
      {rows === null && !error ? <p className="py-16 text-center text-sm text-slate-400">Loading QR passes...</p> : (
        <Table
          columns={[
            { key: 'visitor', label: 'Visitor', render: (p: Pass) => <div><p className="font-medium">{p.visitor_name ?? '—'}</p><p className="font-mono text-[11px] text-slate-400">{p.pass_code.slice(0, 8)}…</p></div> },
            { key: 'vehicle', label: 'Vehicle', render: (p: Pass) => <span className="font-mono font-bold text-[#080677]">{p.plate_number ?? '—'}</span> },
            { key: 'valid', label: 'Valid (Manila)', render: (p: Pass) => <span className="text-xs">{window_(p.valid_from, p.valid_until)}</span> },
            { key: 'uses', label: 'Uses', render: (p: Pass) => `${p.use_count} / ${p.max_uses}` },
            { key: 'request', label: 'Request', render: (p: Pass) => p.request_id ? `#${p.request_id}` : <span className="text-xs text-amber-700">none</span> },
            { key: 'status', label: 'Status', render: (p: Pass) => (
              <div><Badge variant={PASS_BADGE[p.status]}>{PASS_LABEL[p.status]}</Badge>{p.revoke_reason && <p className="text-[10px] text-slate-500 mt-1 max-w-[180px]">{p.revoke_reason}</p>}</div>
            )},
            { key: 'actions', label: 'Actions', render: (p: Pass) => (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onShowPass(p)}>View</Button>
                {['active', 'scheduled'].includes(p.status) && (
                  <Button size="sm" variant="danger" onClick={() => { setRevoke(p); setReason(''); setRevokeError(''); }}><Ban size={12} /> Revoke</Button>
                )}
              </div>
            )},
          ]}
          data={rows ?? []}
        />
      )}

      <Modal open={!!revoke} onClose={() => !busy && setRevoke(null)} title="Revoke Visitor QR Pass" size="sm">
        {revoke && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{revoke.visitor_name} · <span className="font-mono">{revoke.plate_number}</span>. A revoked pass can no longer be used to enter. A visitor already inside can still exit.</p>
            <Input label="Reason *" value={reason} onChange={e => setReason(e.target.value)} disabled={busy} />
            {revokeError && <ErrorBox message={revokeError} />}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setRevoke(null)} disabled={busy}>Cancel</Button>
              <Button variant="danger" onClick={submitRevoke} disabled={busy || !reason.trim()}>{busy ? 'Revoking...' : 'Revoke Pass'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

// ----------------------------------------------------------------- verification tab

function Verification({ notify }: { notify: Notify }) {
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Lookup | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [gateResult, setGateResult] = useState<{ status: string; message: string; slot_code?: string | null } | null>(null);

  const lookup = async (value = code) => {
    if (!value.trim()) { setError('Enter or scan a Visitor QR pass code.'); return; }
    setBusy(true);
    setError('');
    try {
      setFound(await apiRequest<Lookup>(`/api/visitors/passes/lookup?code=${encodeURIComponent(value.trim())}`));
    } catch (err) {
      setFound(null);
      setError(err instanceof Error ? err.message : 'The pass could not be checked.');
    } finally {
      setBusy(false);
    }
  };

  const record = async (direction: 'entry' | 'exit') => {
    if (!found) return;
    setBusy(true);
    try {
      const r = await apiRequest<{ status: string; message: string; slot_code?: string | null }>(`/api/parking/${direction}`, { method: 'POST', body: { qr_pass_code: found.pass_code } });
      setGateResult(r);
      notify(r.message, ['granted', 'completed'].includes(r.status) ? 'success' : 'error');
      await lookup(found.pass_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The gate request failed.');
    } finally {
      setBusy(false);
    }
  };

  const ok = found?.entry_allowed;

  return (
    <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-5">
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-bold text-[#080677] text-lg">Visitor Pass Verification</h3>
          <p className="text-sm text-slate-500">Enter the pass code (or scan it with a keyboard-style scanner). The check uses the same rules as the gate.</p>
        </div>
        <Input label="Pass code" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') lookup(); }} disabled={busy} placeholder="e.g. 45109880-5ced-457e-…" />
        <div className="flex gap-2">
          <Button onClick={() => lookup()} disabled={busy}><Search size={14} /> Check Pass</Button>
          <Button variant="outline" onClick={() => { setCode(''); setFound(null); setError(''); setGateResult(null); }} disabled={busy}>Clear</Button>
        </div>
        {error && <ErrorBox message={error} />}
        {found && (
          <div className={`rounded-xl border p-4 space-y-2 text-sm ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <p className={`font-bold ${ok ? 'text-green-700' : 'text-red-700'}`}>{ok ? 'Valid for entry' : found.inside ? 'Vehicle is inside' : 'Not valid for entry'}</p>
            {found.entry_problem && <p className={found.inside ? 'text-slate-700' : 'text-red-700'}>{found.entry_problem}</p>}
            {found.inside && <p className="text-slate-600">Parked at <span className="font-mono font-semibold">{found.inside.slot_code ?? '—'}</span> since {formatCampusDateTime(found.inside.entry_datetime)}.</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="success" onClick={() => record('entry')} disabled={busy || !ok}><LogIn size={14} /> Record Entry</Button>
              <Button size="sm" onClick={() => record('exit')} disabled={busy || !found.inside}><LogOut size={14} /> Record Exit</Button>
            </div>
          </div>
        )}
        {gateResult && (
          <div className="rounded-xl border border-slate-200 p-4 text-sm">
            {gateResult.slot_code && gateResult.status === 'granted' && <p className="text-3xl font-bold text-[#080677] mb-1">{gateResult.slot_code}</p>}
            <p>{gateResult.message}</p>
          </div>
        )}
      </Card>
      <div>{found ? <PassCard pass={found} /> : <Card className="p-8 text-center text-sm text-slate-400 h-full flex items-center justify-center">Pass details appear here.</Card>}</div>
    </div>
  );
}

// ----------------------------------------------------------------- page

export default function VisitorQR() {
  const { pathname } = useLocation();
  const [tab, setTab] = useState('Visitor Requests');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPass, setShowPass] = useState<Pass | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { setTab(pathname.endsWith('/qr-verify') ? 'QR Verification' : 'Visitor Requests'); }, [pathname]);

  const { refreshNow } = useLiveSync();
  // Every successful action is followed by a notice: also tell other open screens to refresh.
  const notify: Notify = (message, type = 'success') => {
    refreshNow();
    setToast({ message, type });
    setTimeout(() => setToast(null), type === 'error' ? 6000 : 3500);
  };

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader backToDashboard title="Visitor QR Access" subtitle="Visitor requests, approval, and QR passes. Visitors enter and exit with their QR pass; campus users use RFID."
        action={<Button onClick={() => setShowForm(true)}><Plus size={16} /> New Visitor Request</Button>}
      />
      <Tabs tabs={['Visitor Requests', 'QR Passes', 'QR Verification']} active={tab} onChange={setTab} />

      {tab === 'Visitor Requests' && <Requests notify={notify} onShowPass={setShowPass} reloadKey={reloadKey} onChanged={() => setReloadKey(k => k + 1)} />}
      {tab === 'QR Passes' && <Passes notify={notify} onShowPass={setShowPass} reloadKey={reloadKey} />}
      {tab === 'QR Verification' && <Verification notify={notify} />}

      <RequestForm open={showForm} onClose={() => setShowForm(false)} onSaved={message => { setShowForm(false); notify(message); setReloadKey(k => k + 1); setTab('Visitor Requests'); }} />

      <Modal open={!!showPass} onClose={() => setShowPass(null)} title="Visitor QR Pass" size="sm">
        {showPass && <PassCard pass={showPass} />}
      </Modal>
    </div>
  );
}
