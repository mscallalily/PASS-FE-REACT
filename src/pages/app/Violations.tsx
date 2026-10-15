import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader, Card, Badge, Button, Table, SearchBar, Modal, Toast, StatCard, Input, Select } from '../../components/ui';
import { apiRequest } from '../../lib/apiClient';
import { AlertTriangle, Plus, Check } from 'lucide-react';

type ViolationStatus = 'open' | 'under_review' | 'resolved' | 'dismissed' | 'escalated';

interface ViolationRow {
  violation_id: number;
  occurred_at: string | null;
  description: string | null;
  violation_status: ViolationStatus;
  resolved_at: string | null;
  resolution_remarks: string | null;
  violation_code: string;
  violation_name: string;
  plate_number: string | null;
  observed_slot: string | null;
  assigned_slot: string | null;
  parking_area: string | null;
  transaction_status: string | null;
  reported_by: string | null;
  resolved_by: string | null;
  party_name: string | null;
  is_slot_incident: boolean;
}

interface ViolationType { violation_code: string; violation_name: string }

const STATUS_VARIANT: Record<ViolationStatus, 'danger' | 'warning' | 'success' | 'default' | 'purple'> = {
  open: 'danger',
  under_review: 'warning',
  resolved: 'success',
  dismissed: 'default',
  escalated: 'purple',
};

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

const location = (v: ViolationRow) => v.is_slot_incident
  ? `Assigned ${v.assigned_slot ?? '—'} → found at ${v.observed_slot ?? '—'}`
  : [v.observed_slot, v.parking_area].filter(Boolean).join(' · ') || '—';

export default function Violations() {
  const [rows, setRows] = useState<ViolationRow[] | null>(null);
  const [stats, setStats] = useState({ total: 0, open: 0, under_review: 0, resolved: 0, dismissed: 0 });
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<ViolationRow | null>(null);
  const [remarks, setRemarks] = useState('');
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [showRecord, setShowRecord] = useState(false);
  const [types, setTypes] = useState<ViolationType[]>([]);
  const [form, setForm] = useState({ plate_number: '', violation_code: '', slot_code: '', description: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), type === 'error' ? 6000 : 3500);
  };

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      const r = await apiRequest<{ data: ViolationRow[]; stats: typeof stats }>(`/api/violations?${params}`);
      setRows(r.data);
      setStats(r.stats);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load violations.');
    }
  }, [search, status]);

  useEffect(() => {
    const first = setTimeout(load, 300);
    const timer = setInterval(load, 15000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  useEffect(() => {
    apiRequest<{ data: ViolationType[] }>('/api/violation-types').then(r => setTypes(r.data)).catch(() => setTypes([]));
  }, []);

  const open = (v: ViolationRow) => {
    setSelected(v);
    setRemarks('');
    setResolution('');
    setActionError('');
  };

  const act = async (action: 'acknowledge' | 'resolve' | 'dismiss') => {
    if (!selected) return;
    setBusy(true);
    setActionError('');
    try {
      const r = await apiRequest<{ message: string }>(`/api/violations/${selected.violation_id}`, {
        method: 'PATCH',
        body: { action, remarks: remarks.trim() || null, resolution: action === 'resolve' && resolution ? resolution : null },
      });
      showToast(r.message);
      setSelected(null);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The violation could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const record = async () => {
    setBusy(true);
    setFormErrors({});
    try {
      const r = await apiRequest<{ message: string }>('/api/violations', {
        method: 'POST',
        body: { ...form, slot_code: form.slot_code.trim() || null },
      });
      showToast(r.message);
      setShowRecord(false);
      setForm({ plate_number: '', violation_code: '', slot_code: '', description: '' });
      load();
    } catch (err) {
      const fieldErrors = (err as { fieldErrors?: Record<string, string> }).fieldErrors ?? {};
      setFormErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: err instanceof Error ? err.message : 'The violation could not be recorded.' });
    } finally {
      setBusy(false);
    }
  };

  const slotType = ['WRONG_SLOT', 'WRONG_AREA'].includes(form.violation_code);
  const active = selected && ['open', 'under_review', 'escalated'].includes(selected.violation_status);

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader backToDashboard title="Parking Violations" subtitle="Manage parking incidents and violation records"
        action={<Button onClick={() => { setShowRecord(true); setFormErrors({}); }}><Plus size={16} /> Record Violation</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Violations" value={stats.total} icon={<AlertTriangle size={18} />} color="red" />
        <StatCard label="Open" value={stats.open} icon={<AlertTriangle size={18} />} color="red" />
        <StatCard label="Under Review" value={stats.under_review} icon={<AlertTriangle size={18} />} color="amber" />
        <StatCard label="Resolved" value={stats.resolved} icon={<Check size={18} />} color="green" sub={stats.dismissed ? `${stats.dismissed} dismissed` : undefined} />
      </div>

      <Card>
        <div className="p-5 border-b border-slate-50">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by plate, driver, slot, or violation type...">
            <Select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </Select>
          </SearchBar>
        </div>
        {error && (
          <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">Unable to load violations: {error}</p>
          </div>
        )}
        {rows === null && !error ? (
          <p className="py-16 text-center text-sm text-slate-400">Loading violations...</p>
        ) : (
          <Table
            columns={[
              { key: 'id', label: 'ID', render: (v: ViolationRow) => <span className="font-mono text-xs">#{v.violation_id}</span> },
              { key: 'plate', label: 'Plate', render: (v: ViolationRow) => <span className="font-mono font-bold text-[#080677]">{v.plate_number ?? '—'}</span> },
              { key: 'driver', label: 'Driver / Visitor', render: (v: ViolationRow) => v.party_name ?? '—' },
              { key: 'type', label: 'Violation Type', render: (v: ViolationRow) => <span className="text-red-700 font-medium text-xs">{v.violation_name}</span> },
              { key: 'location', label: 'Location', render: (v: ViolationRow) => <span className="text-xs">{location(v)}</span> },
              { key: 'datetime', label: 'Date & Time', render: (v: ViolationRow) => <span className="text-xs">{formatDateTime(v.occurred_at)}</span> },
              { key: 'reportedBy', label: 'Reported By', render: (v: ViolationRow) => v.reported_by ?? '—' },
              { key: 'status', label: 'Status', render: (v: ViolationRow) => <Badge variant={STATUS_VARIANT[v.violation_status]}>{v.violation_status.replace('_', ' ')}</Badge> },
              { key: 'actions', label: 'Actions', render: (v: ViolationRow) => <Button size="sm" variant="ghost" onClick={() => open(v)}>View</Button> },
            ]}
            data={rows ?? []}
            onRowClick={open}
          />
        )}
      </Card>

      {/* Violation Detail Modal */}
      <Modal open={!!selected} onClose={() => !busy && setSelected(null)} title="Violation Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700">{selected.violation_name}</p>
                <p className="text-xs text-red-500 mt-0.5">{selected.description}</p>
              </div>
            </div>
            {[
              ['Violation ID', `#${selected.violation_id}`],
              ['Plate Number', selected.plate_number ?? '—'],
              ['Driver / Visitor', selected.party_name ?? '—'],
              ['Location', location(selected)],
              ['Date & Time', formatDateTime(selected.occurred_at)],
              ['Reported By', selected.reported_by ?? '—'],
              ['Status', selected.violation_status.replace('_', ' ')],
              ...(selected.resolved_at ? [['Closed', `${formatDateTime(selected.resolved_at)} by ${selected.resolved_by ?? '—'}`], ['Remarks', selected.resolution_remarks ?? '—']] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4 text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-400 w-28 shrink-0">{k}</span>
                <span className="font-medium text-slate-700">{v}</span>
              </div>
            ))}

            {active && (
              <>
                {selected.is_slot_incident && selected.transaction_status === 'active' && (
                  <Select label="When resolving, also fix the slot record" value={resolution} onChange={e => setResolution(e.target.value)} disabled={busy}>
                    <option value="">No slot change</option>
                    <option value="relocated">Vehicle moved back to its assigned slot ({selected.assigned_slot})</option>
                    <option value="reassigned">Reassign the vehicle to the slot it is in ({selected.observed_slot})</option>
                  </Select>
                )}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Remarks</p>
                  <textarea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} maxLength={255} disabled={busy}
                    placeholder="Investigation notes (required to dismiss)..."
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
                </div>
                {actionError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-600">{actionError}</p></div>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  {selected.violation_status === 'open' && <Button variant="secondary" onClick={() => act('acknowledge')} disabled={busy}>Acknowledge</Button>}
                  <Button variant="success" onClick={() => act('resolve')} disabled={busy}>Mark Resolved</Button>
                  <Button variant="danger" onClick={() => act('dismiss')} disabled={busy || !remarks.trim()}>Dismiss</Button>
                  <Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>Close</Button>
                </div>
              </>
            )}
            {!active && <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>}
          </div>
        )}
      </Modal>

      {/* Record Violation Modal */}
      <Modal open={showRecord} onClose={() => !busy && setShowRecord(false)} title="Record Violation" size="md">
        <div className="space-y-4">
          <Input label="Vehicle Plate Number" placeholder="ABC 1234" value={form.plate_number} error={formErrors.plate_number}
            onChange={e => setForm(f => ({ ...f, plate_number: e.target.value }))} disabled={busy} />
          <Select label="Violation Type" value={form.violation_code} onChange={e => setForm(f => ({ ...f, violation_code: e.target.value }))} disabled={busy}>
            <option value="">Select a violation type</option>
            {types.map(t => <option key={t.violation_code} value={t.violation_code}>{t.violation_name}</option>)}
          </Select>
          {formErrors.violation_code && <p className="text-xs text-red-500 -mt-3">{formErrors.violation_code}</p>}
          <Input label={slotType ? 'Slot where the vehicle is parked' : 'Slot (optional)'} placeholder="e.g. C-08" value={form.slot_code} error={formErrors.slot_code}
            onChange={e => setForm(f => ({ ...f, slot_code: e.target.value }))} disabled={busy} />
          {slotType && <p className="text-xs text-slate-500 -mt-2">The slot is compared with the vehicle's assigned slot; a mismatch alerts Parking Staff.</p>}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Notes</label>
            <textarea rows={3} placeholder="Describe the violation..." value={form.description} disabled={busy}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
            {formErrors.description && <p className="text-xs text-red-500 mt-1">{formErrors.description}</p>}
          </div>
          {formErrors.form && <div className="rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-600">{formErrors.form}</p></div>}
          <div className="flex gap-3 pt-2">
            <Button onClick={record} disabled={busy}>{busy ? 'Saving...' : 'Record Violation'}</Button>
            <Button variant="outline" onClick={() => setShowRecord(false)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
