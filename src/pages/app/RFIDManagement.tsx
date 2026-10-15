import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Badge, Table, SearchBar, Tabs, StatCard, Select, Input, Button } from '../../components/ui';
import { apiRequest } from '../../lib/apiClient';
import { useTopicVersion, useLiveSync } from '../../lib/liveSync';
import { formatCampusDateTime } from '../../lib/datetime';
import GateSimulator, { useSimulatorAvailable } from '../../components/GateSimulator';
import { XCircle, LogIn, LogOut, ShieldCheck } from 'lucide-react';

// Gate access records and RFID credentials, from access_events, rfid_tags and
// rfid_assignments (read-only). Entries and exits are written only by the gate
// (staff gate screen, RFID reader, or the development simulator).

interface AccessEvent {
  event_id: number;
  event_datetime: string | null;
  direction: 'in' | 'out';
  access_method: 'rfid' | 'qr' | 'manual';
  auth_result: 'granted' | 'denied';
  denial_reason: string | null;
  gate_name: string | null;
  plate_number: string | null;
  vehicle_type: string | null;
  party_type: 'user' | 'visitor' | null;
  party_name: string | null;
  user_code: string | null;
  user_type: string | null;
  rfid_tag: string | null;
  rfid_assignment_id: number | null;
  rfid_assignment_status: string | null;
  rfid_holder_code: string | null;
  qr_pass_code: string | null;
  presented_credential: string | null;
  staff_override: boolean;
  source: 'staff_gate' | 'reader' | 'simulator' | null;
  processed_by: string | null;
  transaction_id: number | null;
}

interface RfidCredential {
  rfid_id: number;
  tag_uid: string;
  tag_type: string;
  tag_status: string;
  assignment_id: number | null;
  assignment_status: string | null;
  assigned_at: string | null;
  valid_until: string | null;
  expired: boolean;
  user_code: string | null;
  user_type: string | null;
  user_name: string | null;
  plate_number: string | null;
  last_used: string | null;
}

const METHOD_LABEL = { rfid: 'RFID', qr: 'Visitor QR', manual: 'Plate (staff override)' } as const;
const SOURCE_LABEL = { staff_gate: 'Staff gate screen', reader: 'RFID reader', simulator: 'Simulator' } as const;

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{message}</div>;
}

function AccessRecords({ reloadKey }: { reloadKey: number }) {
  const [rows, setRows] = useState<AccessEvent[] | null>(null);
  const [today, setToday] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [method, setMethod] = useState('rfid');
  const [direction, setDirection] = useState('');
  const [result, setResult] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (method) params.set('method', method);
    if (direction) params.set('direction', direction);
    if (result) params.set('result', result);
    if (date) params.set('date', date);
    if (debounced.trim()) params.set('search', debounced.trim());
    try {
      const r = await apiRequest<{ data: AccessEvent[]; today: Record<string, number> }>(`/api/access-events?${params}`);
      setRows(r.data);
      setToday(r.today);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load access records.');
    }
  }, [method, direction, result, date, debounced]);

  // Reload when filters change and whenever gate records change (shared refresh).
  const version = useTopicVersion(['parking']);
  useEffect(() => { load(); }, [load, reloadKey, version]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Entries Today" value={today?.entries ?? '—'} icon={<LogIn size={18} />} color="green" sub="granted at the gate" />
        <StatCard label="Exits Today" value={today?.exits ?? '—'} icon={<LogOut size={18} />} color="blue" />
        <StatCard label="Denied Today" value={today?.denied ?? '—'} icon={<XCircle size={18} />} color="red" />
        <StatCard label="RFID Scans Today" value={today?.rfid ?? '—'} icon={<ShieldCheck size={18} />} color="navy" sub={today ? `${today.qr} QR · ${today.staff_override} staff override` : undefined} />
      </div>

      <Card>
        <div className="px-5 pt-5 pb-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by plate, name, user ID, RFID tag, or denial reason...">
            <Select value={method} onChange={e => setMethod(e.target.value)} aria-label="Credential">
              <option value="rfid">RFID only</option>
              <option value="qr">Visitor QR only</option>
              <option value="manual">Staff overrides only</option>
              <option value="">All credentials</option>
            </Select>
            <Select value={direction} onChange={e => setDirection(e.target.value)} aria-label="Direction">
              <option value="">Entry and exit</option>
              <option value="in">Entry</option>
              <option value="out">Exit</option>
            </Select>
            <Select value={result} onChange={e => setResult(e.target.value)} aria-label="Result">
              <option value="">All results</option>
              <option value="granted">Granted</option>
              <option value="denied">Denied</option>
            </Select>
            <Select value={date} onChange={e => setDate(e.target.value)} aria-label="Date">
              <option value="">All dates</option>
              <option value="today">Today</option>
            </Select>
          </SearchBar>
          <p className="text-xs text-slate-400 mt-2">Students, faculty and employees enter and exit with RFID. Times are Manila time. Updates automatically within a few seconds of a new gate event.</p>
        </div>
        {error && <div className="mx-5 mb-4"><ErrorBox message={`Unable to load access records: ${error}`} /></div>}
        {rows === null && !error ? <p className="py-16 text-center text-sm text-slate-400">Loading access records...</p> : (
          <Table
            columns={[
              { key: 'time', label: 'Date & Time', render: (e: AccessEvent) => (
                <div>
                  <p className="text-sm whitespace-nowrap">{formatCampusDateTime(e.event_datetime)}</p>
                  <p className="text-[10px] text-slate-400">#{e.event_id}{e.source ? ` · ${SOURCE_LABEL[e.source]}` : ''}</p>
                </div>
              )},
              { key: 'dir', label: 'Gate', render: (e: AccessEvent) => (
                <div>
                  <Badge variant={e.direction === 'in' ? 'info' : 'default'}>{e.direction === 'in' ? 'Entry' : 'Exit'}</Badge>
                  <p className="text-[10px] text-slate-400 mt-1">{e.gate_name ?? '—'}</p>
                </div>
              )},
              { key: 'user', label: 'Registered User', render: (e: AccessEvent) => e.party_type ? (
                <div>
                  <p>{e.party_name ?? '—'}</p>
                  <p className="text-xs text-slate-400">{e.party_type === 'visitor' ? 'Visitor' : `${e.user_code ?? ''}${e.user_type ? ` · ${e.user_type}` : ''}`}</p>
                </div>
              ) : <span className="text-xs text-slate-400">Not identified</span> },
              { key: 'vehicle', label: 'Vehicle', render: (e: AccessEvent) => e.plate_number ? (
                <div>
                  <span className="font-mono font-bold text-[#080677]">{e.plate_number}</span>
                  {e.vehicle_type && <p className="text-xs text-slate-400">{e.vehicle_type}</p>}
                </div>
              ) : <span className="text-slate-300">—</span> },
              { key: 'credential', label: 'Credential', render: (e: AccessEvent) => (
                <div>
                  <p className="text-xs font-medium">{METHOD_LABEL[e.access_method]}</p>
                  {e.rfid_tag ? (
                    <p className="font-mono text-[11px] text-slate-500">{e.rfid_tag}{e.rfid_assignment_id ? ` · assignment #${e.rfid_assignment_id}` : ''}</p>
                  ) : e.qr_pass_code ? (
                    <p className="font-mono text-[11px] text-slate-500">{e.qr_pass_code.slice(0, 8)}…</p>
                  ) : e.presented_credential ? (
                    <p className="font-mono text-[11px] text-slate-500">{e.presented_credential}</p>
                  ) : null}
                  {e.rfid_holder_code && e.rfid_holder_code !== e.user_code && <p className="text-[10px] text-slate-400">held by {e.rfid_holder_code}</p>}
                </div>
              )},
              { key: 'result', label: 'Result', render: (e: AccessEvent) => (
                <div className="max-w-[260px]">
                  <Badge variant={e.auth_result === 'granted' ? 'success' : 'danger'}>{e.auth_result}</Badge>
                  {e.denial_reason && <p className="text-xs text-red-600 mt-1">{e.denial_reason}</p>}
                  {e.transaction_id && <p className="text-[10px] text-slate-400 mt-1">Parking transaction #{e.transaction_id}</p>}
                </div>
              )},
              { key: 'by', label: 'Recorded By', render: (e: AccessEvent) => <span className="text-xs text-slate-500">{e.processed_by ?? (e.source === 'reader' ? 'RFID reader' : '—')}</span> },
            ]}
            data={rows ?? []}
          />
        )}
      </Card>
    </div>
  );
}

function RfidCredentials() {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; owner: string; authorizationStatus?: string; rfid?: string | null }[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [tagUid, setTagUid] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    apiRequest<{ vehicles: typeof vehicles }>('/api/vehicles').then(r => {
      if (!cancelled) setVehicles(r.vehicles.filter(v => v.authorizationStatus === 'approved' && !v.rfid));
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Cannot load vehicles.'); });
    return () => { cancelled = true; };
  }, [admin, revision]);

  async function assign() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await apiRequest<{ message: string }>('/api/rfid/assignments', { method: 'POST', body: { vehicle_id: Number(vehicleId), tag_uid: tagUid.trim(), valid_until: validUntil || null } });
      setMessage(r.message); setVehicleId(''); setTagUid(''); setValidUntil(''); setRevision(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Assignment failed.'); }
    finally { setBusy(false); }
  }

  async function revoke(row: RfidCredential) {
    if (!row.assignment_id || busy || !window.confirm(`Revoke RFID ${row.tag_uid}? Future entry will be denied.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await apiRequest<{ message: string }>(`/api/rfid/assignments/${row.assignment_id}/revoke`, { method: 'PATCH' });
      setMessage(r.message); setRevision(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Revocation failed.'); }
    finally { setBusy(false); }
  }

  const [rows, setRows] = useState<RfidCredential[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ data: RfidCredential[] }>('/api/rfid/assignments').then(r => { if (!cancelled) setRows(r.data); }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load RFID tags.'); });
    return () => { cancelled = true; };
  }, [revision]);

  const q = search.toLowerCase();
  const filtered = (rows ?? []).filter(r => !q || [r.tag_uid, r.user_code, r.user_name, r.plate_number].some(v => v?.toLowerCase().includes(q)));

  return (
    <Card>
      {admin && <div className="m-5 space-y-3 rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">Assign RFID to approved vehicle</h3>
        <Select label="Vehicle" value={vehicleId} onChange={e => setVehicleId(e.target.value)} disabled={busy}>
          <option value="">Select an approved vehicle</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.owner}</option>)}
        </Select>
        <Input label="Tag UID" placeholder="For local simulator: TEST-ABC4321-001" maxLength={50} value={tagUid} onChange={e => setTagUid(e.target.value)} disabled={busy} />
        <Input label="Valid until (optional)" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} disabled={busy} />
        <p className="text-xs text-slate-500">For hardware, enter the exact UID read from the issued tag. Assignment does not record parking entry.</p>
        <Button onClick={assign} disabled={busy || !vehicleId || !tagUid.trim()}>{busy ? 'Saving…' : 'Assign RFID'}</Button>
      </div>}
      {message && <p role="status" className="mx-5 mb-3 text-sm text-green-700">{message}</p>}
      <div className="px-5 pt-5 pb-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by tag, user, or plate..." />
        <p className="text-xs text-slate-400 mt-2">Issued RFID tags and their current assignment. Administrators can assign a new or available tag to an approved vehicle and revoke active assignments.</p>
      </div>
      {error && <div className="mx-5 mb-4"><ErrorBox message={error} /></div>}
      {rows === null && !error ? <p className="py-16 text-center text-sm text-slate-400">Loading RFID tags...</p> : (
        <Table
          columns={[
            { key: 'tag', label: 'RFID Tag', render: (r: RfidCredential) => (
              <div><span className="font-mono font-bold text-[#080677]">{r.tag_uid}</span><p className="text-xs text-slate-400 capitalize">{r.tag_type}</p></div>
            )},
            { key: 'user', label: 'Assigned User', render: (r: RfidCredential) => r.user_code
              ? <div><p>{r.user_name ?? r.user_code}</p><p className="text-xs text-slate-400">{r.user_code} · {r.user_type}</p></div>
              : <span className="text-slate-300 italic">Unassigned</span> },
            { key: 'vehicle', label: 'Vehicle', render: (r: RfidCredential) => r.plate_number ? <span className="font-mono">{r.plate_number}</span> : '—' },
            { key: 'assigned', label: 'Assigned', render: (r: RfidCredential) => formatCampusDateTime(r.assigned_at) },
            { key: 'valid', label: 'Valid Until', render: (r: RfidCredential) => <span className={r.expired ? 'text-red-600 font-medium' : ''}>{r.valid_until ?? 'No end date'}</span> },
            { key: 'status', label: 'Status', render: (r: RfidCredential) => (
              <div className="space-y-1">
                <Badge variant={r.tag_status === 'assigned' ? 'success' : r.tag_status === 'available' ? 'default' : 'danger'}>{r.tag_status}</Badge>
                {r.assignment_status && r.assignment_status !== 'active' && <p className="text-[10px] text-slate-400">assignment {r.assignment_status}</p>}
              </div>
            )},
            ...(admin ? [{ key: 'actions', label: 'Actions', render: (r: RfidCredential) => r.assignment_status === 'active' ? <Button size="sm" variant="danger" disabled={busy} onClick={() => revoke(r)}>Revoke</Button> : null }] : []),
            { key: 'last', label: 'Last Used', render: (r: RfidCredential) => <span className="text-xs text-slate-500">{formatCampusDateTime(r.last_used)}</span> },
          ]}
          data={filtered}
        />
      )}
    </Card>
  );
}

export default function RFIDManagement() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const simulator = useSimulatorAvailable();
  const [tab, setTab] = useState('Access Records');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setTab(pathname.endsWith('/monitor') || user?.role !== 'admin' ? 'Access Records' : 'RFID Credentials');
  }, [pathname, user?.role]);

  const tabs = ['Access Records', 'RFID Credentials', ...(simulator ? ['Gate Simulator'] : [])];

  return (
    <div className="animate-fadein">
      <PageHeader backToDashboard title="RFID Access Records" subtitle="Entry and exit records at the shared Main Entrance / Exit, from the PASS database" />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'Access Records' && <AccessRecords reloadKey={reloadKey} />}
      {tab === 'RFID Credentials' && <RfidCredentials />}
      {tab === 'Gate Simulator' && simulator && <GateSimulator onScanned={() => setReloadKey(k => k + 1)} />}
    </div>
  );
}
