import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Badge, Button, Table, SearchBar, Select, Modal, StatCard, Tabs, Toast, Input } from '../../components/ui';
import { apiRequest } from '../../lib/apiClient';
import ParkingMap, { MapData, MapSlot, slotFill } from '../../components/ParkingMap';
import { ParkingSquare, Car, CheckCircle, Wrench, AlertTriangle, LogIn, LogOut, RefreshCw, MapPin } from 'lucide-react';
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

interface Overview {
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

const POLL_MS = 10000;

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

const METHOD_LABEL: Record<string, string> = { rfid: 'RFID', qr: 'QR', manual: 'Manual' };

const STATUS_BADGE: Record<TransactionRow['transaction_status'], 'warning' | 'success' | 'default' | 'danger'> = {
  active: 'warning',
  completed: 'success',
  force_closed: 'default',
  cancelled: 'danger',
};

/** Load data now and then every `interval` ms; returns a manual refresh. */
function usePolling<T>(load: () => Promise<T>, onData: (d: T) => void, onError: (m: string) => void, interval = POLL_MS) {
  const run = useCallback(async () => {
    try {
      onData(await load());
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to load data.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    run();
    const timer = setInterval(run, interval);
    return () => clearInterval(timer);
  }, [run, interval]);

  return run;
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
          <option value="rfid_tag_uid">RFID tag</option>
          <option value="qr_pass_code">Visitor QR pass code</option>
          <option value="plate_number">Plate number (manual)</option>
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
        <p className="text-xs text-slate-400">All vehicles use the shared Main Entrance / Exit gate.</p>
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
    return apiRequest<{ data: TransactionRow[] }>(`/api/parking/transactions?${params}`).then(r => r.data);
  }, [debounced, area, status, date]);

  const refresh = usePolling(load, setRows, setError);

  return (
    <Card>
      <div className="p-5 space-y-3 border-b border-slate-50">
        <div className="flex flex-wrap gap-2 justify-end">
          <Button size="sm" variant="success" onClick={() => setGate('entry')}><LogIn size={14} /> Record Entry</Button>
          <Button size="sm" variant="primary" onClick={() => setGate('exit')}><LogOut size={14} /> Record Exit</Button>
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by plate, driver, visitor, slot, or ticket...">
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
        </SearchBar>
      </div>
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
                <p className="text-xs text-slate-400">{t.party_type === 'visitor' ? 'Visitor' : t.owner_code}</p>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Capacity" value={o.capacity} icon={<ParkingSquare size={18} />} color="navy" />
        <StatCard label="Occupied" value={o.occupied} icon={<Car size={18} />} color="red" sub={`${o.occupancy_percent}% overall`} />
        <StatCard label="Available" value={o.available} icon={<CheckCircle size={18} />} color="green" />
        <StatCard label="Maintenance" value={o.maintenance} icon={<Wrench size={18} />} color="blue" />
      </div>

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
  areas: AreaStats[];
  ambiguities: string[];
  corrections: string[];
  gate: { gate_id: number; gate_code: string; gate_name: string; gate_status: string } | null;
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

  const load = useCallback(() => apiRequest<MapResponse>('/api/parking/map'), []);
  const refresh = usePolling(load, setData, setError);

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
    [{ background: '#EF4444' }, 'Occupied (confirmed)'],
    [{ background: '#FCA5A5', border: '1px dashed #DC2626' }, 'Assigned, not yet confirmed'],
    [{ background: '#9CA3AF' }, 'Maintenance / disabled'],
    [{ background: '#FFFFFF', border: '1px dashed #CBD5E1' }, 'Painted bay, not a PASS slot'],
  ];
  const unplaced = data?.slots.filter(s => !s.placed) ?? [];
  const others = activeVehicles.filter(t => t.transaction_id !== selected?.occupant?.transaction_id);
  const colors = selected ? slotFill(selected) : null;

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Map view">
            {[['ALL', 'Whole site'], ['MC', 'Motorcycle Parking'], ['CAR', 'Car Parking']].map(([code, label]) => (
              <button key={code} type="button" onClick={() => setFocus({ code, key: Date.now() })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${focus?.code === code || (!focus && code === 'ALL') ? 'bg-[#080677] text-white' : 'text-slate-600 hover:bg-blue-50'}`}>
                {label}
              </button>
            ))}
          </div>
          {data?.areas.map(a => (
            <span key={a.parking_area_id} className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{a.area_name}:</span>{' '}
              <span className="text-red-600 font-semibold">{a.occupied}</span> occupied ·{' '}
              <span className="text-green-600 font-semibold">{a.available}</span> available ·{' '}
              <span className="text-gray-500 font-semibold">{a.maintenance}</span> maintenance
            </span>
          ))}
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
            <ParkingMap data={data} highlight={highlight} focusArea={focus} onSelect={s => setSelectedId(s.slot_id)} />
            <p className="text-xs text-slate-400">Drag to pan · scroll, pinch or use the buttons to zoom · select a slot for details. {highlight && (
              <button type="button" className="text-[#2563EB] hover:underline" onClick={() => onHighlight(null)}>Clear highlight of {highlight}</button>
            )}</p>

            {unplaced.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
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
              </div>
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
              <p className="text-xs capitalize">{selected.status === 'occupied' && !selected.occupant?.confirmed ? 'Assigned · not yet confirmed' : selected.status}</p>
            </div>

            <div className="space-y-2">
              {[
                ['Parking area', selected.area_name],
                ['Map position', selected.placed ? 'Shown on the DYCI layout' : 'Not printed on the reference drawing'],
                ...(selected.occupant ? [
                  ['Vehicle', `${selected.occupant.plate_number}${selected.occupant.vehicle_type ? ` (${selected.occupant.vehicle_type})` : ''}`],
                  [selected.occupant.party_type === 'visitor' ? 'Visitor' : 'Owner', `${selected.occupant.party_name ?? '—'}${selected.occupant.owner_code ? ` · ${selected.occupant.owner_code}` : ''}`],
                  ['Entry time', formatDateTime(selected.occupant.entry_datetime)],
                  ['Access method', `${METHOD_LABEL[selected.occupant.access_method] ?? selected.occupant.access_method} · Main Entrance / Exit`],
                  ['Location', selected.occupant.confirmed ? `Confirmed ${formatDateTime(selected.occupant.confirmed_at)}` : 'Assigned at entry, not yet confirmed'],
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

  usePolling(load, ([availability, mine]) => { setData(availability); setSessions(mine.data); setUpdated(new Date()); }, setError, 30000);

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
        <p className="text-xs text-blue-300 mt-3">Last updated: {updated ? updated.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '—'}</p>
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
  const [tab, setTab] = useState(isRegularUser ? 'Availability' : 'Entry & Exit Records');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  // Slot to highlight on the parking map (e.g. the one just assigned at the gate).
  const [highlight, setHighlight] = useState<string | null>(null);

  useEffect(() => {
    if (pathname.endsWith('/layout')) setTab('Parking Layout');
    else if (pathname.endsWith('/occupancy')) setTab('Occupancy Monitor');
    else if (pathname.endsWith('/availability')) setTab('Availability');
    else setTab('Entry & Exit Records');
  }, [pathname]);

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
        title={isRegularUser ? 'Parking Information' : 'Parking Operations'}
        subtitle={isRegularUser ? 'View current campus parking availability' : 'Review access records, occupancy, and the parking layout'}
        action={!isRegularUser ? <Button size="sm" variant="ghost" onClick={refreshOverview}><RefreshCw size={14} /> Refresh</Button> : undefined}
      />
      <Tabs tabs={isRegularUser ? ['Availability'] : ['Entry & Exit Records', 'Occupancy Monitor', 'Parking Layout']} active={tab} onChange={setTab} />

      {tab === 'Entry & Exit Records' && !isRegularUser && (
        <EntryExitRecords areas={areas} notify={notify} onShowOnMap={code => { setHighlight(code); setTab('Parking Layout'); }} />
      )}
      {tab === 'Occupancy Monitor' && !isRegularUser && <OccupancyMonitor overview={overview} error={overviewError} />}
      {tab === 'Parking Layout' && !isRegularUser && <ParkingLayout notify={notify} highlight={highlight} onHighlight={setHighlight} />}
      {tab === 'Availability' && <Availability />}
    </div>
  );
}
