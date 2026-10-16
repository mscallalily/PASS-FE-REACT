import { PAGE_SECTIONS, selectedSection, sectionPath } from '../../lib/pageSections';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Badge, Button, Table, SearchBar, Select, Modal, StatCard, Toast, Input } from '../../components/ui';
import { apiRequest } from '../../lib/apiClient';
import { CAMPUS_TIMEZONE, formatCampusDateTime } from '../../lib/datetime';
import { useLiveLoad, useLiveSync, POLL_MS, type Topic } from '../../lib/liveSync';
import { MapData, MapSlot, slotFill } from '../../components/ParkingMap';
import ParkingLot3D from '../../components/ParkingLot3D';
import ParkingAvailabilityMap from '../../components/ParkingAvailabilityMap';
import { ParkingSquare, Car, CheckCircle, Wrench, AlertTriangle, LogIn, LogOut, RefreshCw, MapPin, Box, Map as MapIcon, Bike, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// ----------------------------------------------------------------------------- types

interface AreaStats {
  parking_area_id: number;
  area_code: string;
  area_name: string;
  capacity: number;
  occupied: number;
  confirmed?: number;
  awaiting_confirmation?: number;
  maintenance: number;
  available: number;
  occupancy_percent: number;
}

/** Vehicles inside, from active parking transactions (server: ParkingStats::inside). */
interface Inside {
  total: number;
  cars: number;
  motorcycles: number;
  visitors: number;
  awaiting_confirmation: number;
  with_slot: number;
  distinct_slots: number;
  consistent: boolean;
}

interface Overview {
  inside?: Inside;
  areas: AreaStats[];
  overall: Omit<AreaStats, 'parking_area_id' | 'area_code' | 'area_name'>;
  hourly: { hour: string; total: number; areas: Record<number, number> }[];
  open_incidents: number;
}

interface TransactionRow {
  transaction_id: number;
  ticket_number: string;
  plate_number: string;
  vehicle_type: string | null;
  party_type: 'user' | 'visitor';
  party_name: string | null;
  owner_code: string | null;
  user_category: 'student' | 'faculty' | 'employee' | 'visitor' | string | null;
  slot_id: number | null;
  slot_code: string | null;
  parking_area: string | null;
  entry_datetime: string | null;
  exit_datetime: string | null;
  duration: string;
  access_method: 'rfid' | 'qr' | 'manual';
  transaction_status: 'active' | 'completed' | 'force_closed' | 'cancelled';
  slot_confirmed: boolean;
  open_incident_id: number | null;
}

interface GateResult {
  status: 'granted' | 'denied' | 'already_inside' | 'completed' | 'not_inside' | 'not_found';
  message: string;
  slot_code?: string | null;
  parking_area?: string | null;
}

type ToastState = { message: string; type: 'success' | 'error' } | null;

// ----------------------------------------------------------------------------- helpers

const formatDateTime = (iso: string | null) => formatCampusDateTime(iso);

const METHOD_LABEL: Record<string, string> = { rfid: 'RFID', qr: 'Visitor QR', manual: 'Staff override' };

/** Whether vehicles inside, active parking transactions and held slots agree. */
function Reconciliation({ inside }: { inside?: Inside }) {
  if (!inside) return null;
  return inside.consistent ? (
    <p className="text-xs text-slate-500 flex items-center gap-1.5"><CheckCircle size={13} className="text-green-600" />
      Records agree: {inside.total} vehicle{inside.total === 1 ? '' : 's'} inside = {inside.total} active parking transaction{inside.total === 1 ? '' : 's'} = {inside.distinct_slots} distinct slot{inside.distinct_slots === 1 ? '' : 's'} held.
      {inside.awaiting_confirmation > 0 && `  ${inside.awaiting_confirmation} assigned slot(s) are not yet confirmed by staff but stay unavailable.`}
    </p>
  ) : (
    <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertTriangle size={13} />
      Records do not agree: {inside.total} active transactions, {inside.with_slot} with a slot, {inside.distinct_slots} distinct slots. Check Entry &amp; Exit Records.
    </p>
  );
}

const STATUS_BADGE: Record<TransactionRow['transaction_status'], 'warning' | 'success' | 'default' | 'danger'> = {
  active: 'warning',
  completed: 'success',
  force_closed: 'default',
  cancelled: 'danger',
};

/**
 * Load data now, and again whenever one of `topics` changes anywhere (shared
 * refresh, see lib/liveSync). The returned function reloads this data and
 * asks every other open screen to check for changes, for use after an action.
 */
function usePolling<T>(load: () => Promise<T>, onData: (d: T) => void, onError: (m: string) => void, topics: Topic[] = ['parking', 'violations']) {
  const run = useLiveLoad(load, topics, onData, onError);
  const { refreshNow } = useLiveSync();

  return useCallback(() => { void run(); refreshNow(); }, [run, refreshNow]);
}
function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}

// ------------------------------------------------------------------- gate operation

function GateModal({ open, direction, onClose, onDone, onShowOnMap }: {
  open: boolean;
  direction: 'entry' | 'exit';
  onClose: () => void;
  onDone: (result: GateResult) => void;
  onShowOnMap?: (slotCode: string) => void;
}) {
  const [method, setMethod] = useState<'rfid_tag_uid' | 'qr_pass_code' | 'plate_number'>('rfid_tag_uid');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GateResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setValue(''); setResult(null); setError(''); }
  }, [open, direction]);

  const submit = async () => {
    if (!value.trim()) { setError('Enter a value to identify the vehicle.'); return; }
    setBusy(true);
    setError('');
    try {
      const r = await apiRequest<GateResult>(`/api/parking/${direction}`, { method: 'POST', body: { [method]: value.trim() } });
      setResult(r);
      setValue('');
      onDone(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const tone = !result ? '' : ['granted', 'completed'].includes(result.status)
    ? 'border-green-200 bg-green-50 text-green-800'
    : result.status === 'denied' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <Modal open={open} onClose={onClose} title={direction === 'entry' ? 'Record Vehicle Entry' : 'Record Vehicle Exit'} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {direction === 'entry'
            ? 'The vehicle is checked against its authorization; if allowed, an available slot in the correct parking area is assigned.'
            : 'The active parking session is closed and its slot becomes available.'}
        </p>
        <Select label="Identify vehicle by" value={method} onChange={e => setMethod(e.target.value as typeof method)} disabled={busy}>
          <option value="rfid_tag_uid">RFID tag (students, faculty, employees)</option>
          <option value="qr_pass_code">Visitor QR pass code (visitors)</option>
          <option value="plate_number">Plate number (Parking Staff override)</option>
        </Select>
        <Input
          label={method === 'rfid_tag_uid' ? 'RFID tag UID' : method === 'qr_pass_code' ? 'QR pass code' : 'Plate number'}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          disabled={busy}
          autoFocus
        />
        {error && <ErrorBox message={error} />}
        {result && (
          <div className={`rounded-xl border p-4 ${tone}`}>
            {result.status === 'granted' && result.slot_code && (
              <div className="text-center mb-2">
                <p className="text-xs uppercase tracking-wide opacity-80">Assigned slot</p>
                <p className="text-4xl font-bold">{result.slot_code}</p>
                <p className="text-xs opacity-80">{result.parking_area}</p>
              </div>
            )}
            <p className="text-sm font-medium">{result.message}</p>
            {onShowOnMap && result.slot_code && ['granted', 'already_inside'].includes(result.status) && (
              <button type="button" onClick={() => onShowOnMap(result.slot_code!)} className="mt-2 text-sm font-semibold text-[#2563EB] hover:underline">
                Show slot {result.slot_code} on the parking map →
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-slate-400">
          All vehicles use the shared Main Entrance / Exit gate. Campus users must use RFID and visitors their QR pass; a plate number is recorded as a Parking Staff override.
          Campus users also need a verified driver's license.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
          <Button variant={direction === 'entry' ? 'success' : 'primary'} onClick={submit} disabled={busy}>
            {busy ? 'Processing...' : direction === 'entry' ? 'Record Entry' : 'Record Exit'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------- observed slot report

function ReportSlotModal({ transaction, presetSlot, onClose, onDone }: {
  transaction: { transaction_id: number; plate_number: string; slot_code: string | null } | null;
  presetSlot?: string;
  onClose: () => void;
  onDone: (message: string, type: 'success' | 'error') => void;
}) {
  const [slotCode, setSlotCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setSlotCode(presetSlot ?? ''); setError(''); }, [transaction, presetSlot]);

  const submit = async () => {
    if (!transaction || !slotCode.trim()) { setError('Enter the slot where the vehicle is actually parked.'); return; }
    setBusy(true);
    setError('');
    try {
      const r = await apiRequest<{ status: string; message: string }>(`/api/parking/transactions/${transaction.transaction_id}/observed-slot`, {
        method: 'POST',
        body: { slot_code: slotCode.trim().toUpperCase() },
      });
      onDone(r.message, r.status === 'incident' || r.status === 'updated' ? 'error' : 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The report could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!transaction} onClose={() => !busy && onClose()} title="Report Actual Parking Slot" size="sm">
      {transaction && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <span className="font-mono font-bold text-[#080677]">{transaction.plate_number}</span> is assigned to{' '}
            <span className="font-semibold">{transaction.slot_code ?? 'no slot'}</span>. Enter the slot where you see the vehicle.
            The same slot confirms the assignment; a different slot records a wrong-slot incident and alerts Parking Staff.
          </p>
          <Input label="Observed slot" placeholder="e.g. C-08 or M-15" value={slotCode} onChange={e => setSlotCode(e.target.value)} disabled={busy} autoFocus />
          {error && <ErrorBox message={error} />}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Submit Report'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------- entry & exit records

interface DeniedEvent {
  event_id: number;
  event_datetime: string | null;
  direction: 'in' | 'out';
  access_method: 'rfid' | 'qr' | 'manual';
  denial_reason: string | null;
  plate_number: string | null;
  party_name: string | null;
  party_type: 'user' | 'visitor' | null;
  user_type: string | null;
  rfid_tag: string | null;
  qr_pass_code: string | null;
  presented_credential: string | null;
  source: string | null;
}

/** Denied gate attempts (access_events). They never create a parking transaction. */
function DeniedAttempts() {
  const [rows, setRows] = useState<DeniedEvent[] | null>(null);
  const [error, setError] = useState('');
  const [date, setDate] = useState('today');

  const load = useCallback(() => {
    const params = new URLSearchParams({ result: 'denied' });
    if (date) params.set('date', date);
    return apiRequest<{ data: DeniedEvent[] }>(`/api/access-events?${params}`).then(r => r.data);
  }, [date]);

  usePolling(load, setRows, setError, ['parking']);

  return (
    <div>
      <div className="px-5 pt-4 flex flex-wrap items-center gap-3">
        <Select value={date} onChange={e => setDate(e.target.value)} aria-label="Date">
          <option value="today">Today</option>
          <option value="">All dates</option>
        </Select>
        <p className="text-xs text-slate-400">Refused at the Main Entrance / Exit. No slot was assigned and no parking transaction was created.</p>
      </div>
      {error && <div className="mx-5 mt-4"><ErrorBox message={`Unable to load denied attempts: ${error}`} /></div>}
      {rows === null && !error ? <p className="py-16 text-center text-sm text-slate-400">Loading denied attempts...</p> : (
        <Table
          columns={[
            { key: 'time', label: 'Date & Time', render: (e: DeniedEvent) => <div><p className="text-sm whitespace-nowrap">{formatDateTime(e.event_datetime)}</p><p className="text-[10px] text-slate-400">#{e.event_id}</p></div> },
            { key: 'dir', label: 'Gate', render: (e: DeniedEvent) => <Badge variant={e.direction === 'in' ? 'info' : 'default'}>{e.direction === 'in' ? 'Entry' : 'Exit'}</Badge> },
            { key: 'vehicle', label: 'Vehicle', render: (e: DeniedEvent) => e.plate_number ? <span className="font-mono font-bold text-[#080677]">{e.plate_number}</span> : <span className="text-xs text-slate-400">Not identified</span> },
            { key: 'who', label: 'Driver / Visitor', render: (e: DeniedEvent) => e.party_type ? <div><p>{e.party_name ?? '—'}</p><p className="text-xs text-slate-400 capitalize">{e.party_type === 'visitor' ? 'Visitor' : e.user_type}</p></div> : '—' },
            { key: 'cred', label: 'Credential', render: (e: DeniedEvent) => (
              <div><p className="text-xs font-medium">{METHOD_LABEL[e.access_method]}</p>
                <p className="font-mono text-[11px] text-slate-500">{e.rfid_tag ?? (e.qr_pass_code ? `${e.qr_pass_code.slice(0, 8)}…` : e.presented_credential)}</p></div>
            )},
            { key: 'reason', label: 'Reason', render: (e: DeniedEvent) => <span className="text-sm text-red-600">{e.denial_reason}</span> },
          ]}
          data={rows ?? []}
        />
      )}
    </div>
  );
}

function EntryExitRecords({ areas, notify, onShowOnMap }: {
  areas: AreaStats[];
  notify: (m: string, t?: 'success' | 'error') => void;
  onShowOnMap: (slotCode: string) => void;
}) {
  const [rows, setRows] = useState<TransactionRow[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [method, setMethod] = useState('');
  const [category, setCategory] = useState('');
  const [view, setView] = useState<'transactions' | 'denied'>('transactions');
  const [gate, setGate] = useState<'entry' | 'exit' | null>(null);
  const [reportFor, setReportFor] = useState<TransactionRow | null>(null);
  const [debounced, setDebounced] = useState('');

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (debounced.trim()) params.set('search', debounced.trim());
    if (area) params.set('area', area);
    if (status) params.set('status', status);
    if (date) params.set('date', date);
    if (method) params.set('method', method);
    if (category) params.set('category', category);
    return apiRequest<{ data: TransactionRow[] }>(`/api/parking/transactions?${params}`).then(r => r.data);
  }, [debounced, area, status, date, method, category]);

  const refresh = usePolling(load, setRows, setError);

  return (
    <Card>
      <div className="p-5 space-y-3 border-b border-slate-50">
        <div className="flex flex-wrap gap-2 justify-end">
          <Button size="sm" variant="success" onClick={() => setGate('entry')}><LogIn size={14} /> Record Entry</Button>
          <Button size="sm" variant="primary" onClick={() => setGate('exit')}><LogOut size={14} /> Record Exit</Button>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Records">
          {([['transactions', 'Parking transactions'], ['denied', 'Denied gate attempts']] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${view === v ? 'bg-[#080677] text-white' : 'text-slate-600 hover:bg-blue-50'}`}>{label}</button>
          ))}
        </div>
        {view === 'transactions' && <SearchBar value={search} onChange={setSearch} placeholder="Search by plate, driver, visitor, slot, or ticket...">
          <Select value={area} onChange={e => setArea(e.target.value)}>
            <option value="">All Areas</option>
            {areas.map(a => <option key={a.parking_area_id} value={a.parking_area_id}>{a.area_name}</option>)}
          </Select>
          <Select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Parked (active)</option>
            <option value="completed">Completed</option>
          </Select>
          <Select value={date} onChange={e => setDate(e.target.value)}>
            <option value="">All Dates</option>
            <option value="today">Today</option>
          </Select>
          <Select value={method} onChange={e => setMethod(e.target.value)} aria-label="Access method">
            <option value="">All Methods</option>
            <option value="rfid">RFID</option>
            <option value="qr">Visitor QR</option>
            <option value="manual">Staff override</option>
          </Select>
          <Select value={category} onChange={e => setCategory(e.target.value)} aria-label="User category">
            <option value="">All Users</option>
            <option value="student">Students</option>
            <option value="faculty">Faculty</option>
            <option value="employee">Employees</option>
            <option value="visitor">Visitors</option>
          </Select>
        </SearchBar>}
      </div>
      {view === 'denied' && <DeniedAttempts />}
      {view === 'transactions' && <>
      {error && <div className="mx-5 mt-4"><ErrorBox message={`Unable to load parking transactions: ${error}`} /></div>}
      {rows === null && !error ? (
        <p className="py-16 text-center text-sm text-slate-400">Loading parking transactions...</p>
      ) : (
        <Table
          columns={[
            { key: 'id', label: 'Txn ID', render: (t: TransactionRow) => (
              <div>
                <span className="font-mono text-xs text-slate-500">#{t.transaction_id}</span>
                <p className="font-mono text-[10px] text-slate-400">{t.ticket_number}</p>
              </div>
            )},
            { key: 'plate', label: 'Plate', render: (t: TransactionRow) => (
              <div>
                <span className="font-mono font-bold text-[#080677]">{t.plate_number}</span>
                {t.vehicle_type && <p className="text-xs text-slate-400">{t.vehicle_type}</p>}
              </div>
            )},
            { key: 'party', label: 'Driver / Visitor', render: (t: TransactionRow) => (
              <div>
                <p>{t.party_name ?? '—'}</p>
                <p className="text-xs text-slate-400">{t.party_type === 'visitor' ? 'Visitor' : <><span className="capitalize">{t.user_category ?? 'User'}</span>{t.owner_code ? ` · ${t.owner_code}` : ''}</>}</p>
              </div>
            )},
            { key: 'slot', label: 'Slot', render: (t: TransactionRow) => (
              <div>
                <span className="font-mono font-semibold">{t.slot_code ?? '—'}</span>
                {t.transaction_status === 'active' && !t.slot_confirmed && <p className="text-[10px] text-amber-600">Not yet confirmed</p>}
                {t.open_incident_id && <p className="text-[10px] font-semibold text-red-600 flex items-center gap-1"><AlertTriangle size={10} /> Wrong-slot report</p>}
              </div>
            )},
            { key: 'area', label: 'Area', render: (t: TransactionRow) => t.parking_area ?? '—' },
            { key: 'entry', label: 'Entry', render: (t: TransactionRow) => formatDateTime(t.entry_datetime) },
            { key: 'exit', label: 'Exit', render: (t: TransactionRow) => formatDateTime(t.exit_datetime) },
            { key: 'duration', label: 'Duration', render: (t: TransactionRow) => (
              <span className={t.transaction_status === 'active' ? 'text-amber-600 font-semibold' : ''}>
                {t.duration}{t.transaction_status === 'active' && ' (parked)'}
              </span>
            )},
            { key: 'method', label: 'Method', render: (t: TransactionRow) => METHOD_LABEL[t.access_method] ?? t.access_method },
            { key: 'status', label: 'Status', render: (t: TransactionRow) => (
              <Badge variant={STATUS_BADGE[t.transaction_status]}>{t.transaction_status === 'active' ? 'parked' : t.transaction_status.replace('_', ' ')}</Badge>
            )},
            { key: 'actions', label: 'Actions', render: (t: TransactionRow) => t.transaction_status === 'active'
              ? <Button size="sm" variant="ghost" onClick={() => setReportFor(t)}><MapPin size={14} /> Report slot</Button>
              : <span className="text-xs text-slate-300">—</span> },
          ]}
          data={rows ?? []}
        />
      )}
      </>}

      <GateModal open={!!gate} direction={gate ?? 'entry'} onClose={() => setGate(null)} onDone={() => refresh()}
        onShowOnMap={code => { setGate(null); onShowOnMap(code); }} />
      <ReportSlotModal
        transaction={reportFor}
        onClose={() => setReportFor(null)}
        onDone={(message, type) => { setReportFor(null); notify(message, type); refresh(); }}
      />
    </Card>
  );
}

// ------------------------------------------------------------- occupancy monitor

const AREA_COLORS = ['#2563EB', '#F59E0B', '#10B981', '#8B5CF6'];

function AreaCard({ area }: { area: AreaStats }) {
  const pct = area.occupancy_percent;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700">{area.area_name}</h3>
        <span className="text-2xl font-bold text-[#080677]">{pct}%</span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex mb-4">
        <div className="h-full bg-red-500" style={{ width: `${(area.occupied / area.capacity) * 100}%` }} />
        <div className="h-full bg-gray-400" style={{ width: `${(area.maintenance / area.capacity) * 100}%` }} />
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[['Capacity', area.capacity, 'text-slate-700'], ['Occupied', area.occupied, 'text-red-600'], ['Available', area.available, 'text-green-600'], ['Maintenance', area.maintenance, 'text-gray-500']].map(([label, value, cls]) => (
          <div key={label as string}>
            <p className={`text-xl font-bold ${cls}`}>{value}</p>
            <p className="text-[11px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      {!!area.awaiting_confirmation && (
        <p className="mt-3 text-xs text-amber-600">{area.awaiting_confirmation} assigned slot(s) not yet confirmed by staff.</p>
      )}
    </Card>
  );
}

function OccupancyMonitor({ overview, error }: { overview: Overview | null; error: string }) {
  const navigate = useNavigate();

  if (!overview) {
    return error ? <ErrorBox message={`Unable to load occupancy: ${error}`} /> : <p className="py-16 text-center text-sm text-slate-400">Loading occupancy...</p>;
  }

  const o = overview.overall;
  const pie = [
    { name: 'Occupied', value: o.occupied, color: '#EF4444' },
    { name: 'Available', value: o.available, color: '#10B981' },
    { name: 'Maintenance', value: o.maintenance, color: '#9CA3AF' },
  ];
  const hourly = overview.hourly.map(h => ({
    hour: h.hour,
    ...Object.fromEntries(overview.areas.map(a => [a.area_name, h.areas[a.parking_area_id] ?? 0])),
  }));

  return (
    <div className="space-y-6">
      {error && <ErrorBox message={`Showing the last loaded figures. ${error}`} />}
      {overview.open_incidents > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <p className="flex-1 min-w-[200px] text-sm text-amber-800">{overview.open_incidents} unresolved wrong-slot incident(s) need attention.</p>
          <Button size="sm" variant="outline" onClick={() => navigate('/app/violations')}>Open Violations</Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Capacity" value={o.capacity} icon={<ParkingSquare size={18} />} color="navy" sub="55 car · 84 motorcycle" />
        <StatCard label="Vehicles Inside" value={overview.inside?.total ?? o.occupied} icon={<Car size={18} />} color="sky"
          sub={overview.inside ? `${overview.inside.cars} cars · ${overview.inside.motorcycles} motorcycles` : undefined} />
        <StatCard label="Occupied Slots" value={o.occupied} icon={<Car size={18} />} color="red" sub={`${o.occupancy_percent}% overall`} />
        <StatCard label="Available" value={o.available} icon={<CheckCircle size={18} />} color="green" />
        <StatCard label="Maintenance" value={o.maintenance} icon={<Wrench size={18} />} color="blue" />
      </div>

      <Reconciliation inside={overview.inside} />

      <div className="grid lg:grid-cols-2 gap-6">
        {overview.areas.map(a => <AreaCard key={a.parking_area_id} area={a} />)}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 flex flex-col items-center">
          <h3 className="font-semibold text-slate-700 mb-5 self-start">Current Occupancy</h3>
          <PieChart width={220} height={220}>
            <Pie data={pie} cx={110} cy={110} innerRadius={65} outerRadius={100} paddingAngle={2} dataKey="value">
              {pie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
          </PieChart>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {pie.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-slate-500">{d.name}: <strong className="text-slate-700">{d.value}</strong></span>
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <span className="text-4xl font-bold text-[#080677]">{o.occupancy_percent}%</span>
            <p className="text-sm text-slate-400">Overall Occupancy · {o.occupied} of {o.capacity} slots</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-1">Vehicles Parked by Hour (Today)</h3>
          <p className="text-xs text-slate-400 mb-4">Vehicles present at any time during each hour.</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourly}>
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {overview.areas.map((a, i) => (
                <Bar key={a.parking_area_id} dataKey={a.area_name} stackId="areas" fill={AREA_COLORS[i % AREA_COLORS.length]} radius={i === overview.areas.length - 1 ? [4, 4, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- parking layout

interface MapResponse extends MapData {
  inside?: Inside;
  areas: AreaStats[];
  overall: Overview['overall'];
  ambiguities: string[];
  corrections: string[];
  gate: { gate_id: number; gate_code: string; gate_name: string; gate_status: string } | null;
}

/**
 * Live occupancy below the parking layout, from the same /api/parking/map
 * response as the 3D view (so the figures always match what is drawn).
 */
function OccupancyPanel({ areas, overall, inside }: { areas: AreaStats[]; overall: Overview['overall']; inside?: Inside }) {
  const cards = [
    ...['MC', 'CAR'].flatMap(code => areas.filter(a => a.area_code === code)).map(a => ({
      key: a.area_code,
      title: a.area_code === 'MC' ? 'Motorcycle Parking' : a.area_code === 'CAR' ? 'Car Parking' : a.area_name,
      icon: a.area_code === 'MC' ? <Bike size={18} /> : <Car size={18} />,
      stats: a,
    })),
    { key: 'ALL', title: 'Overall Parking', icon: <Layers size={18} />, stats: overall },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
      {cards.map(({ key, title, icon, stats }) => {
        const pct = (n: number) => (stats.capacity ? (n / stats.capacity) * 100 : 0);
        const sumOk = stats.available + stats.occupied + stats.maintenance === stats.capacity;
        return (
          <div key={key} className={`min-w-0 rounded-2xl border p-3 sm:p-4 space-y-3 ${key === 'ALL' ? 'border-[#080677]/15 bg-gradient-to-br from-[#080677]/[0.04] to-[#2563EB]/[0.06]' : 'border-slate-100 bg-white'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">{icon}</div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#080677] truncate">{title}</p>
                <p className="text-xs text-slate-400">{stats.capacity} total slots</p>
              </div>
              <span className="ml-auto text-right">
                <span className="block text-lg font-bold text-[#080677] leading-tight">{stats.occupancy_percent}%</span>
                <span className="block text-[10px] text-slate-400">occupied</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {([['Available', stats.available, 'text-green-600 bg-green-50'], ['Occupied', stats.occupied, 'text-red-600 bg-red-50'], ['Maintenance', stats.maintenance, 'text-gray-600 bg-gray-100']] as const).map(([label, value, tone]) => (
                <div key={label} className={`rounded-xl py-2 ${tone}`}>
                  <p className="text-xl font-bold leading-tight">{value}</p>
                  <p className="text-[10px] font-medium opacity-80 break-words">{label}</p>
                </div>
              ))}
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex" role="img"
              aria-label={`${stats.available} available, ${stats.occupied} occupied, ${stats.maintenance} under maintenance of ${stats.capacity}`}>
              <div className="h-full bg-green-500" style={{ width: `${pct(stats.available)}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${pct(stats.occupied)}%` }} />
              <div className="h-full bg-gray-400" style={{ width: `${pct(stats.maintenance)}%` }} />
            </div>
            <p className="text-xs text-slate-600">
              {key === 'ALL' ? 'Vehicles inside' : key === 'MC' ? 'Motorcycles inside' : 'Cars inside'}: <strong>{key === 'ALL' ? (inside?.total ?? stats.occupied) : stats.occupied}</strong>
              {!!stats.awaiting_confirmation && <span className="text-amber-700"> · {stats.awaiting_confirmation} not yet confirmed</span>}
            </p>
            {!sumOk && <p className="text-[11px] text-amber-600">Counts do not add up to capacity; refresh to reload.</p>}
          </div>
        );
      })}
    </div>
  );
}

const VIEW_KEY = 'pass_parking_layout_view';

function savedView(): '3d' | 'plan' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'plan' ? 'plan' : '3d';
  } catch {
    return '3d';
  }
}

/** Slots whose status or occupant changed between two polls. */
function changedSlots(previous: MapSlot[] | undefined, next: MapSlot[]) {
  if (!previous) return new Set<number>();
  const before = new Map(previous.map(s => [s.slot_id, `${s.status}:${s.occupant?.transaction_id ?? ''}`]));
  return new Set(next.filter(s => before.has(s.slot_id) && before.get(s.slot_id) !== `${s.status}:${s.occupant?.transaction_id ?? ''}`).map(s => s.slot_id));
}

function ParkingLayout({ notify, highlight, onHighlight }: {
  notify: (m: string, t?: 'success' | 'error') => void;
  highlight: string | null;
  onHighlight: (slotCode: string | null) => void;
}) {
  const [data, setData] = useState<MapResponse | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ code: string; key: number } | null>(null);
  const [gate, setGate] = useState<'entry' | 'exit' | null>(null);
  const [reportFor, setReportFor] = useState<{ transaction_id: number; plate_number: string; slot_code: string | null } | null>(null);
  const [activeVehicles, setActiveVehicles] = useState<TransactionRow[]>([]);
  const [otherTxn, setOtherTxn] = useState('');
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'3d' | 'plan'>(savedView);
  const [gateMenu, setGateMenu] = useState(false);
  const [recent, setRecent] = useState<Set<number>>(() => new Set());
  const previous = useRef<MapSlot[] | undefined>(undefined);

  const load = useCallback(() => apiRequest<MapResponse>('/api/parking/map'), []);
  const onData = useCallback((d: MapResponse) => {
    setRecent(changedSlots(previous.current, d.slots));
    previous.current = d.slots;
    setData(d);
  }, []);
  const refresh = usePolling(load, onData, setError);

  // Changed slots flash briefly. Clear them afterwards: the map only reloads when
  // something changes, and while slots are marked the 3D view renders every frame.
  useEffect(() => {
    if (recent.size === 0) return;
    const timer = setTimeout(() => setRecent(new Set()), 5000);
    return () => clearTimeout(timer);
  }, [recent]);

  const chooseView = (v: '3d' | 'plan') => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* preference only */ }
  };

  const selected = data?.slots.find(s => s.slot_id === selectedId) ?? null;

  useEffect(() => {
    setOtherTxn('');
    setMaintenanceReason('');
    if (selectedId !== null) {
      apiRequest<{ data: TransactionRow[] }>('/api/parking/transactions?status=active')
        .then(r => setActiveVehicles(r.data))
        .catch(() => setActiveVehicles([]));
    }
  }, [selectedId]);

  const report = async (transactionId: number, slotId: number) => {
    setBusy(true);
    try {
      const r = await apiRequest<{ status: string; message: string }>(`/api/parking/transactions/${transactionId}/observed-slot`, { method: 'POST', body: { slot_id: slotId } });
      notify(r.message, r.status === 'incident' || r.status === 'updated' ? 'error' : 'success');
      setSelectedId(null);
      refresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'The report could not be saved.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const setSlotStatus = async (slot: MapSlot, slotStatus: 'available' | 'maintenance') => {
    setBusy(true);
    try {
      const r = await apiRequest<{ message: string }>(`/api/parking/slots/${slot.slot_id}`, { method: 'PATCH', body: { slot_status: slotStatus, reason: maintenanceReason.trim() || null } });
      notify(r.message);
      setSelectedId(null);
      refresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'The slot could not be updated.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const legend: [React.CSSProperties, string][] = [
    [{ background: '#22C55E' }, 'Available'],
    [{ background: '#EF4444' }, 'Occupied'],
    [{ background: '#9CA3AF' }, 'Maintenance / disabled'],
    [{ background: '#EF4444', outline: '1.5px dashed #FFFFFF', outlineOffset: -3 }, 'Occupied, location not yet confirmed'],
    [{ background: '#FFFFFF', border: '1px dashed #94A3B8' }, 'Painted bay, not a PASS slot'],
  ];
  const unplaced = data?.slots.filter(s => !s.placed) ?? [];
  const others = activeVehicles.filter(t => t.transaction_id !== selected?.occupant?.transaction_id);
  const colors = selected ? slotFill(selected) : null;
  const gateOnline = (data?.gate?.gate_status ?? 'online') === 'online';
  const segment = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${active ? 'bg-[#080677] text-white' : 'text-slate-600 hover:bg-blue-50'}`;

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Map style">
            <button type="button" onClick={() => chooseView('3d')} className={segment(view === '3d')} aria-pressed={view === '3d'}><Box size={13} /> 3D view</button>
            <button type="button" onClick={() => chooseView('plan')} className={segment(view === 'plan')} aria-pressed={view === 'plan'}><MapIcon size={13} /> Plan view</button>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Map area">
            {[['ALL', 'Whole site'], ['MC', 'Motorcycle Parking'], ['CAR', 'Car Parking']].map(([code, label]) => (
              <button key={code} type="button" onClick={() => setFocus({ code, key: Date.now() })}
                className={segment(focus?.code === code || (!focus && code === 'ALL'))}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="success" onClick={() => setGate('entry')}><LogIn size={14} /> Record Entry</Button>
            <Button size="sm" variant="primary" onClick={() => setGate('exit')}><LogOut size={14} /> Record Exit</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium">
          {legend.map(([style, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={style} />
              <span className="text-slate-500">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5"><AlertTriangle size={12} className="text-amber-500" /><span className="text-slate-500">Wrong-slot report</span></div>
        </div>

        {error && <ErrorBox message={data ? `Showing the last loaded map. ${error}` : `Unable to load the parking map: ${error}`} />}

        {!data ? (
          !error && <p className="py-16 text-center text-sm text-slate-400">Loading parking map...</p>
        ) : (
          <>
            <ParkingLot3D viewMode={view} data={data} highlight={highlight} selectedId={selectedId} recent={recent} gateOnline={gateOnline}
              focusArea={focus} onSelect={s => setSelectedId(s.slot_id)} onGate={() => setGateMenu(true)} />
            <p className="text-xs text-slate-400">
              Drag to pan · scroll, pinch or use the buttons to zoom · select a slot for details{view === '3d' ? ' · select the Main Entrance / Exit to record an entry or exit' : ''}. Updates automatically: checks for changes every {POLL_MS / 1000} seconds while this tab is open.{' '}
              {highlight && (
                <button type="button" className="text-[#2563EB] hover:underline" onClick={() => onHighlight(null)}>Clear highlight of {highlight}</button>
              )}
            </p>

            <OccupancyPanel areas={data.areas} overall={data.overall} inside={data.inside} />
            <Reconciliation inside={data.inside} />

            {unplaced.length > 0 && (
              <details className="rounded-xl border border-slate-200 p-4 space-y-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">Unmapped slot inventory ({unplaced.length})</summary>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Slots not shown on the reference drawing ({unplaced.length})</p>
                  <p className="text-xs text-amber-700">These PASS slots exist and are tracked, but the DYCI layout drawing does not print their position. They are assigned only after all mapped bays in their area are taken. Verify their physical location before use.</p>
                </div>
                {data.areas.map(a => {
                  const list = unplaced.filter(s => s.parking_area_id === a.parking_area_id);
                  if (!list.length) return null;
                  return (
                    <div key={a.parking_area_id}>
                      <p className="text-xs font-medium text-slate-600 mb-1.5">{a.area_name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map(s => {
                          const c = slotFill(s);
                          return (
                            <button key={s.slot_id} type="button" onClick={() => setSelectedId(s.slot_id)}
                              title={`${s.slot_code} — ${s.status}${s.occupant ? ` — ${s.occupant.plate_number}` : ''}`}
                              className={`px-2 py-1 rounded-md text-[11px] font-bold border hover:scale-105 transition-transform ${highlight === s.slot_code ? 'ring-2 ring-[#2563EB]' : ''}`}
                              style={{ background: c.fill, color: c.text, borderColor: c.stroke, borderStyle: c.dash ? 'dashed' : 'solid' }}>
                              {s.slot_code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </details>
            )}

            <details className="rounded-xl border border-slate-100 p-4 text-sm">
              <summary className="cursor-pointer font-medium text-slate-600">About this map: how the reference drawing was interpreted</summary>
              <ul className="mt-3 list-disc pl-5 space-y-1 text-slate-500 text-xs">
                {data.ambiguities.map(a => <li key={a}>{a}</li>)}
              </ul>
              {data.corrections.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium text-slate-600">Misprints read as the missing number:</p>
                  <ul className="mt-1 list-disc pl-5 space-y-0.5 text-slate-500 text-xs">
                    {data.corrections.map(c => <li key={c}>{c}</li>)}
                  </ul>
                </>
              )}
            </details>
          </>
        )}
      </Card>

      <Modal open={!!selected} onClose={() => !busy && setSelectedId(null)} title={`Slot ${selected?.slot_code ?? ''}`} size="sm">
        {selected && colors && (
          <div className="space-y-4">
            <div className="w-full h-20 rounded-xl flex flex-col items-center justify-center"
              style={{ background: colors.fill, color: colors.text, border: `2px ${colors.dash ? 'dashed' : 'solid'} ${colors.stroke}` }}>
              <p className="font-bold text-2xl">{selected.slot_code}</p>
              <p className="text-xs capitalize">{selected.status === 'occupied' && !selected.occupant?.confirmed ? 'Occupied · location not yet confirmed' : selected.status}</p>
            </div>

            <div className="space-y-2">
              {[
                ['Slot number', selected.slot_code],
                ['Parking area', selected.area_name],
                ['Slot status', selected.status === 'occupied' ? 'Occupied' : selected.status === 'maintenance' ? 'Maintenance / disabled' : 'Available'],
                ...(selected.accessible ? [['Slot type', 'Accessible (PWD)']] : []),
                ['Map position', data?.geometry.proposed_slot_codes?.includes(selected.slot_code) ? 'Proposed west-bank position · campus confirmation pending' : selected.placed ? 'Mapped on the schematic layout' : 'Not printed on the reference drawing'],
                ...(selected.occupant ? [
                  ['Plate number', selected.occupant.plate_number],
                  ['Vehicle type', selected.occupant.vehicle_type ?? '—'],
                  [selected.occupant.party_type === 'visitor' ? 'Visitor' : 'Owner', `${selected.occupant.party_name ?? '—'}${selected.occupant.owner_code ? ` · ${selected.occupant.owner_code}` : ''}`],
                  ['Entry time', formatDateTime(selected.occupant.entry_datetime)],
                  ['Access method', `${METHOD_LABEL[selected.occupant.access_method] ?? selected.occupant.access_method} · Main Entrance / Exit`],
                  ['Parking transaction', `#${selected.occupant.transaction_id} · active (vehicle inside)`],
                  ['Assigned slot', selected.slot_code],
                  ['Actual slot', selected.incident?.role === 'assigned_here' && selected.incident.observed_slot
                    ? `Reported at ${selected.incident.observed_slot}`
                    : selected.occupant.confirmed ? `Confirmed here · ${formatDateTime(selected.occupant.confirmed_at)}` : 'Not yet confirmed by staff'],
                ] : []),
                ...(selected.incident?.role === 'observed_here' ? [
                  ['Vehicle reported here', selected.incident.plate_number ?? '—'],
                  ['Its assigned slot', selected.incident.assigned_slot ?? '—'],
                ] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 text-sm border-b border-slate-50 pb-2">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-right">{v}</span>
                </div>
              ))}
            </div>

            {selected.incident && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold flex items-center gap-1"><AlertTriangle size={14} /> Wrong-slot incident ({selected.incident.violation_status.replace('_', ' ')})</p>
                <p>{selected.incident.plate_number} is assigned to {selected.incident.assigned_slot} but was reported at {selected.incident.observed_slot}.</p>
              </div>
            )}

            {selected.status !== 'maintenance' && (
              <div className="space-y-2 pt-1">
                {selected.occupant && !selected.occupant.confirmed && (
                  <Button size="sm" variant="success" className="w-full justify-center" disabled={busy}
                    onClick={() => report(selected.occupant!.transaction_id, selected.slot_id)}>
                    <CheckCircle size={14} /> Confirm {selected.occupant.plate_number} is parked here
                  </Button>
                )}
                {selected.occupant && (
                  <Button size="sm" variant="outline" className="w-full justify-center" disabled={busy}
                    onClick={() => setReportFor({ transaction_id: selected.occupant!.transaction_id, plate_number: selected.occupant!.plate_number, slot_code: selected.slot_code })}>
                    <MapPin size={14} /> {selected.occupant.plate_number} is parked elsewhere
                  </Button>
                )}
                <div className="rounded-lg border border-slate-100 p-3 space-y-2">
                  <p className="text-xs font-medium text-slate-600">Report a different vehicle parked in {selected.slot_code}</p>
                  <div className="flex gap-2">
                    <select value={otherTxn} onChange={e => setOtherTxn(e.target.value)} disabled={busy} aria-label="Parked vehicle"
                      className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                      <option value="">Select a parked vehicle…</option>
                      {others.map(t => <option key={t.transaction_id} value={t.transaction_id}>{t.plate_number} (assigned {t.slot_code ?? '—'})</option>)}
                    </select>
                    <Button size="sm" variant="danger" disabled={busy || !otherTxn} onClick={() => report(Number(otherTxn), selected.slot_id)}>Report</Button>
                  </div>
                </div>
              </div>
            )}

            {!selected.occupant && (
              selected.status === 'maintenance' ? (
                <Button size="sm" variant="success" className="w-full justify-center" disabled={busy} onClick={() => setSlotStatus(selected, 'available')}>
                  <CheckCircle size={14} /> Return slot to service
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input label="Maintenance reason (optional)" value={maintenanceReason} onChange={e => setMaintenanceReason(e.target.value)} disabled={busy} />
                  <Button size="sm" variant="secondary" className="w-full justify-center" disabled={busy} onClick={() => setSlotStatus(selected, 'maintenance')}>
                    <Wrench size={14} /> Mark slot as under maintenance
                  </Button>
                </div>
              )
            )}

            <Button size="sm" variant="outline" onClick={() => setSelectedId(null)} disabled={busy}>Close</Button>
          </div>
        )}
      </Modal>

      <ReportSlotModal
        transaction={reportFor}
        onClose={() => setReportFor(null)}
        onDone={(message, type) => { setReportFor(null); setSelectedId(null); notify(message, type); refresh(); }}
      />

      <Modal open={gateMenu} onClose={() => setGateMenu(false)} title={data?.gate?.gate_name ?? 'Main Entrance / Exit'} size="sm">
        <div className="space-y-4">
          <div className="space-y-2">
            {[
              ['Gate', `${data?.gate?.gate_code ?? 'MAIN-GATE'} · shared by cars and motorcycles`],
              ['Status', data?.gate ? data.gate.gate_status : 'Not configured'],
              ['Accepted credentials', 'RFID (campus users) · Visitor QR (visitors) · Plate number (staff override)'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-right">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">After entering, cars follow the blue route to the Car Parking Area and motorcycles to the Motorcycle Parking Area. A slot in the correct area is assigned automatically.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="success" className="justify-center" onClick={() => { setGateMenu(false); setGate('entry'); }}><LogIn size={14} /> Record Entry</Button>
            <Button variant="primary" className="justify-center" onClick={() => { setGateMenu(false); setGate('exit'); }}><LogOut size={14} /> Record Exit</Button>
          </div>
        </div>
      </Modal>

      <GateModal open={!!gate} direction={gate ?? 'entry'} onClose={() => setGate(null)}
        onDone={r => {
          refresh();
          if (r.slot_code && ['granted', 'already_inside'].includes(r.status)) onHighlight(r.slot_code);
        }} />
    </div>
  );
}

// ------------------------------------------------------- regular user availability

function Availability() {
  const [data, setData] = useState<{ areas: AreaStats[]; overall: Overview['overall'] } | null>(null);
  const [sessions, setSessions] = useState<{ transaction_id: number; plate_number: string; slot_code: string | null; parking_area: string | null; entry_datetime: string | null }[]>([]);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(() => Promise.all([
    apiRequest<{ areas: AreaStats[]; overall: Overview['overall'] }>('/api/parking/availability'),
    apiRequest<{ data: typeof sessions }>('/api/parking/my-session'),
  ]), []);

  usePolling(load, ([availability, mine]) => { setData(availability); setSessions(mine.data); setUpdated(new Date()); }, setError, ['parking']);

  if (!data) return error ? <ErrorBox message={`Unable to load parking availability: ${error}`} /> : <p className="py-16 text-center text-sm text-slate-400">Loading availability...</p>;

  return (
    <div className="space-y-5">
      {error && <ErrorBox message={`Showing the last loaded figures. ${error}`} />}
      {sessions.map(s => (
        <Card key={s.transaction_id} className="p-5 flex flex-wrap items-center gap-4 border-[#2563EB]/30">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/10 flex items-center justify-center"><Car size={26} className="text-[#2563EB]" /></div>
          <div className="flex-1 min-w-[180px]">
            <p className="text-sm text-slate-500">Your vehicle <span className="font-mono font-bold text-[#080677]">{s.plate_number}</span> is parked at</p>
            <p className="text-2xl font-bold text-[#080677]">{s.slot_code ?? '—'} <span className="text-base font-medium text-slate-500">· {s.parking_area}</span></p>
            <p className="text-xs text-slate-400">Since {formatDateTime(s.entry_datetime)}</p>
          </div>
        </Card>
      ))}
      <div className="bg-gradient-to-r from-[#080677] to-[#2563EB] rounded-2xl p-8 text-white text-center">
        <p className="text-blue-200 font-medium mb-2">Available Parking Spaces Right Now</p>
        <p className="text-7xl font-bold text-[#38BDF8]">{data.overall.available}</p>
        <p className="text-blue-200 mt-2">of {data.overall.capacity} total slots</p>
        <p className="text-xs text-blue-300 mt-3">Last updated: {updated ? updated.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: CAMPUS_TIMEZONE }) : '—'}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {data.areas.map(a => {
          const pct = a.capacity ? (a.available / a.capacity) * 100 : 0;
          const tone = pct < 10 ? ['text-red-500', 'bg-red-500'] : pct < 25 ? ['text-amber-500', 'bg-amber-500'] : ['text-green-500', 'bg-green-500'];
          return (
            <Card key={a.parking_area_id} className="p-5 text-center">
              <p className="font-bold text-[#080677] text-lg">{a.area_name}</p>
              <p className={`text-3xl font-bold mt-2 ${tone[0]}`}>{a.available}</p>
              <p className="text-xs text-slate-400">available of {a.capacity}</p>
              <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${tone[1]}`} style={{ width: `${pct}%` }} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------- page

export default function ParkingOperations() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isRegularUser = ['student', 'faculty', 'employee'].includes(user?.role ?? '');
  const navigate = useNavigate();
  const tab = selectedSection(PAGE_SECTIONS.parking, pathname, isRegularUser ? 'Availability' : 'Entry & Exit Records');
  const setTab = (label: string) => navigate(sectionPath(PAGE_SECTIONS.parking, label));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  // Slot to highlight on the parking map (e.g. the one just assigned at the gate).
  const [highlight, setHighlight] = useState<string | null>(null);



  const loadOverview = useCallback(
    () => (isRegularUser ? Promise.resolve(null) : apiRequest<Overview>('/api/parking/overview')),
    [isRegularUser]
  );
  const refreshOverview = usePolling(loadOverview, d => { if (d) setOverview(d); }, setOverviewError);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), type === 'error' ? 6000 : 3500);
    refreshOverview();
  };

  const areas = overview?.areas ?? [];

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader backToDashboard
        title={isRegularUser ? 'Parking Information' : tab}
        subtitle={isRegularUser ? 'View current campus parking availability' : 'Review access records, occupancy, and the parking layout'}
        action={!isRegularUser ? <Button size="sm" variant="ghost" onClick={refreshOverview}><RefreshCw size={14} /> Refresh</Button> : undefined}
      />


      {tab === 'Entry & Exit Records' && !isRegularUser && (
        <EntryExitRecords areas={areas} notify={notify} onShowOnMap={code => { setHighlight(code); setTab('Parking Layout'); }} />
      )}
      {tab === 'Occupancy Monitor' && !isRegularUser && <OccupancyMonitor overview={overview} error={overviewError} />}
      {tab === 'Parking Layout' && (isRegularUser ? <ParkingAvailabilityMap /> : <ParkingLayout notify={notify} highlight={highlight} onHighlight={setHighlight} />)}
      {tab === 'Availability' && <Availability />}
    </div>
  );
}
