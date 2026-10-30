import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Badge, Table, SearchBar, StatCard, Input, Button } from './ui';
import { apiRequest } from '../lib/apiClient';
import { useTopicVersion } from '../lib/liveSync';
import { formatCampusDateTime } from '../lib/datetime';
import { Package, Link2, BadgeCheck, Ban, Clock, ScanLine } from 'lucide-react';

// Admin RFID inventory. Stickers are read with the existing USB reader, which types
// one 24-character EPC followed by Enter (the same frame the gate reader window
// accepts, tools/rfid/scan-core.js). Assignment to new eligible registrations is
// automatic on the backend; physical issuance is confirmed here by Admin.

type InventoryStatus = 'available' | 'assigned' | 'issued' | 'lost' | 'damaged' | 'revoked';

interface Assignment {
  assignment_id: number;
  vehicle_id: number | null;
  assignment_status: string;
  assignment_source: string | null;
  assigned_at: string | null;
  issued_at: string | null;
  issued_by: string | null;
  unassigned_at: string | null;
  plate_number: string | null;
  user_code: string | null;
  user_type: string | null;
  user_name: string | null;
}

interface InventoryItem {
  rfid_id: number;
  tag_uid: string;
  status: InventoryStatus;
  inventory_source: 'reader' | 'manual' | null;
  inventory_registered_at: string | null;
  registered_by: string | null;
  current: Assignment | null;
  history: Assignment[];
}

interface PendingVehicle { vehicle_id: number; plate_number: string; owner_name: string; user_code: string; user_type: string; rfid_requested_at: string | null }
interface InventoryResponse { data: InventoryItem[]; summary: Record<InventoryStatus | 'total' | 'pending_vehicles', number>; pending: PendingVehicle[] }

const STATUS: Record<InventoryStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  available: { label: 'Available', variant: 'default' },
  assigned: { label: 'Assigned · not issued', variant: 'warning' },
  issued: { label: 'Issued', variant: 'success' },
  lost: { label: 'Lost', variant: 'danger' },
  damaged: { label: 'Damaged', variant: 'danger' },
  revoked: { label: 'Revoked', variant: 'danger' },
};
const INITIAL_STICKERS = 10;
const READER_FRAME = /^[A-F0-9]{24}$/;
const MANUAL_UID = /^[A-F0-9]{8,50}$/;
const normalize = (raw: string) => raw.replace(/[\s:-]+/g, '').toUpperCase();

function ErrorBox({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{message}</div>;
}

function Owner({ a }: { a: Assignment }) {
  return (
    <div className="min-w-0">
      <p className="font-mono font-bold text-[#080677]">{a.plate_number ?? '—'}</p>
      <p className="text-xs text-slate-500 break-words">{a.user_name || a.user_code}{a.user_type ? ` · ${a.user_type}` : ''}</p>
    </div>
  );
}

export default function RfidInventoryPanel() {
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [listening, setListening] = useState(false);
  const [read, setRead] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualUid, setManualUid] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const seen = useRef(new Map<string, number>());

  const version = useTopicVersion(['vehicles']);
  const load = useCallback(async () => {
    try { setData(await apiRequest<InventoryResponse>('/api/rfid/inventory')); setLoadError(''); }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Unable to load the RFID inventory.'); }
  }, []);
  useEffect(() => { load(); }, [load, revision, version]);

  function startScanning() {
    setError(''); setMessage(''); setRead(null); setListening(true);
    requestAnimationFrame(() => field.current?.focus());
  }

  function onReaderKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const tag = normalize(event.currentTarget.value);
    event.currentTarget.value = '';
    if (!READER_FRAME.test(tag)) { setError('Incomplete scan. Present one sticker so the reader sends its full 24-character EPC.'); return; }
    // A held sticker is read repeatedly; ignore the same EPC for 3 seconds after its last read.
    const now = performance.now(); const last = seen.current.get(tag); seen.current.set(tag, now);
    if (last !== undefined && now - last < 3000) return;
    setError('');
    setMessage('');
    setRead(tag);
  }

  async function register(uid: string, source: 'reader' | 'manual') {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await apiRequest<{ message: string }>('/api/rfid/inventory', { method: 'POST', body: { tag_uid: uid, source } });
      setMessage(r.message); setRead(null); setManualUid(''); setRevision(v => v + 1);
      if (source === 'reader') requestAnimationFrame(() => field.current?.focus());
    } catch (e) { setError(e instanceof Error ? e.message : 'The sticker was not registered.'); }
    finally { setBusy(false); }
  }

  async function issue(item: InventoryItem) {
    const a = item.current;
    if (!a || busy || !window.confirm(`Confirm that sticker ${item.tag_uid} was physically handed to ${a.user_name || a.user_code} for ${a.plate_number}?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await apiRequest<{ message: string }>(`/api/rfid/inventory/${item.rfid_id}/issue`, { method: 'POST' });
      setMessage(r.message); setRevision(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'The hand-over was not recorded.'); }
    finally { setBusy(false); }
  }

  async function retire(item: InventoryItem, status: 'lost' | 'damaged') {
    if (busy) return;
    const linked = item.current?.plate_number;
    if (!window.confirm(`Mark sticker ${item.tag_uid} as ${status}? Future scans of it will be denied.${linked ? ` Its assignment to ${linked} ends; the history is kept.` : ''}`)) return;
    const replace = !!linked && window.confirm(`Give ${linked} a replacement sticker from the inventory? Choose Cancel if the vehicle should not receive a new sticker.`);
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await apiRequest<{ message: string }>(`/api/rfid/inventory/${item.rfid_id}/retire`, { method: 'POST', body: { status, replace } });
      setMessage(r.message); setRevision(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'The sticker status was not changed.'); }
    finally { setBusy(false); }
  }

  const items = data?.data ?? [];
  const s = data?.summary;
  const q = search.trim().toLowerCase();
  const filtered = items.filter(i => !q || [i.tag_uid, i.current?.plate_number, i.current?.user_code, i.current?.user_name].some(v => v?.toLowerCase().includes(q)));
  const known = read ? items.find(i => i.tag_uid === read) : undefined;
  const manualValue = normalize(manualUid);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Available" value={s?.available ?? '—'} icon={<Package size={18} />} color="navy" sub={s ? `${s.total} registered · goal ${INITIAL_STICKERS}` : undefined} />
        <StatCard label="Assigned, not issued" value={s?.assigned ?? '—'} icon={<Link2 size={18} />} color="blue" sub="hand over to the owner" />
        <StatCard label="Issued" value={s?.issued ?? '—'} icon={<BadgeCheck size={18} />} color="green" />
        <StatCard label="Lost / damaged / revoked" value={s ? s.lost + s.damaged + s.revoked : '—'} icon={<Ban size={18} />} color="red" />
        <StatCard label="Pending RFID Assignment" value={s?.pending_vehicles ?? '—'} icon={<Clock size={18} />} color="blue" sub="approved, waiting for a sticker" />
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-[#080677]">Register a physical sticker</h3>
          <p className="mt-1 text-sm text-slate-600">Uses the connected USB RFID reader. Keep only one sticker in range. If the gate reader window (127.0.0.1:8787) is open, pause it first: the reader types into whichever window is focused.</p>
        </div>
        {!manual && <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="rfid-inventory-scan" className="block text-sm font-medium text-slate-700 mb-1">Reader input</label>
              <input id="rfid-inventory-scan" ref={field} onKeyDown={onReaderKey} onFocus={() => setListening(true)} onBlur={() => setListening(false)}
                autoComplete="off" spellCheck={false} disabled={busy} aria-describedby="rfid-inventory-scan-help"
                placeholder={listening ? 'Listening… present one sticker' : 'Press Start scanning, then present a sticker'}
                className={`w-full min-h-11 rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#080677] ${listening ? 'border-[#080677] bg-[#F4F7FB]' : 'border-slate-300'}`} />
            </div>
            <Button onClick={startScanning} disabled={busy}><ScanLine size={16} className="mr-2 inline" />{listening ? 'Listening…' : 'Start scanning'}</Button>
          </div>
          <p id="rfid-inventory-scan-help" className="text-xs text-slate-500">Scanning pauses when this field loses focus. Repeated reads of a held sticker are ignored.</p>
          {read && <div className="rounded-xl border border-slate-200 p-4 space-y-3" aria-live="polite">
            <div><p className="text-xs uppercase tracking-wide text-slate-400">EPC read from the sticker</p><p className="mt-1 break-all font-mono text-lg font-bold text-[#080677]">{read}</p></div>
            {known ? <p className="text-sm text-red-600">Already in the inventory ({STATUS[known.status].label}). It was not changed.</p>
              : <div className="flex flex-wrap gap-2"><Button onClick={() => register(read, 'reader')} disabled={busy}>{busy ? 'Registering…' : 'Register sticker'}</Button><Button variant="outline" onClick={() => { setRead(null); field.current?.focus(); }} disabled={busy}>Discard</Button></div>}
          </div>}
        </div>}
        {manual && <div className="space-y-3">
          <Input label="Sticker UID (typed by hand)" value={manualUid} onChange={e => setManualUid(e.target.value)} maxLength={80} disabled={busy} placeholder="Hexadecimal UID exactly as read from the sticker" />
          <p className="text-xs text-amber-700">Only for a real sticker that cannot be read here. The record is marked as manually entered. Never enter an invented UID.</p>
          <Button onClick={() => register(manualValue, 'manual')} disabled={busy || !MANUAL_UID.test(manualValue)}>{busy ? 'Registering…' : 'Register typed UID'}</Button>
        </div>}
        <button type="button" className="text-xs font-medium text-[#080677] underline" onClick={() => { setManual(m => !m); setRead(null); setError(''); }}>{manual ? 'Use the USB reader instead' : 'Reader unavailable? Enter a real UID by hand'}</button>
        {error && <ErrorBox message={error} />}
        {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      </Card>

      {!!data?.pending.length && <Card className="p-5 space-y-3">
        <div><h3 className="font-semibold text-[#080677]">Pending RFID Assignment</h3><p className="mt-1 text-sm text-slate-600">Approved new registrations with no sticker available. The next registered sticker goes to the earliest one automatically.</p></div>
        <Table columns={[
          { key: 'plate', label: 'Vehicle', render: (v: PendingVehicle) => <span className="font-mono font-bold text-[#080677]">{v.plate_number}</span> },
          { key: 'owner', label: 'Owner', render: (v: PendingVehicle) => <span className="text-sm">{v.owner_name || v.user_code} <span className="text-xs text-slate-400">· {v.user_type}</span></span> },
          { key: 'since', label: 'Registered', render: (v: PendingVehicle) => <span className="text-xs text-slate-500">{formatCampusDateTime(v.rfid_requested_at)}</span> },
        ]} data={data.pending} />
      </Card>}

      <Card>
        <div className="px-5 pt-5 pb-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by UID, plate, or user..." />
          <p className="text-xs text-slate-400 mt-2">Available → Assigned (automatic, after a new registration is approved) → Issued (Admin confirms the hand-over). An assigned sticker is denied at the gate until it is issued.</p>
        </div>
        {loadError && <div className="mx-5 mb-4"><ErrorBox message={loadError} /></div>}
        {!data && !loadError ? <p className="py-16 text-center text-sm text-slate-400">Loading RFID inventory...</p> : data && !items.length ? (
          <p className="px-5 pb-8 text-sm text-slate-500">No stickers registered yet. Scan the first of the {INITIAL_STICKERS} physical stickers above.</p>
        ) : (
          <Table
            columns={[
              { key: 'uid', label: 'Sticker UID', render: (i: InventoryItem) => (
                <div className="min-w-0"><span className="font-mono text-xs font-bold text-[#080677] break-all">{i.tag_uid}</span>
                  <p className="text-[10px] text-slate-400">{i.inventory_source === 'manual' ? 'Entered by hand' : 'Read by USB reader'}</p></div>
              )},
              { key: 'status', label: 'Status', render: (i: InventoryItem) => <Badge variant={STATUS[i.status].variant}>{STATUS[i.status].label}</Badge> },
              { key: 'vehicle', label: 'Vehicle & Owner', render: (i: InventoryItem) => i.current ? <Owner a={i.current} /> : <span className="text-slate-300 italic">None</span> },
              { key: 'registered', label: 'Registered', render: (i: InventoryItem) => <div className="text-xs text-slate-500"><p>{formatCampusDateTime(i.inventory_registered_at)}</p>{i.registered_by && <p className="text-[10px] text-slate-400">by {i.registered_by}</p>}</div> },
              { key: 'assigned', label: 'Assigned / Issued', render: (i: InventoryItem) => i.current ? (
                <div className="text-xs text-slate-500"><p>Assigned {formatCampusDateTime(i.current.assigned_at)}</p>
                  <p className={i.current.issued_at ? 'text-green-700' : 'text-amber-700'}>{i.current.issued_at ? `Issued ${formatCampusDateTime(i.current.issued_at)}${i.current.issued_by ? ` by ${i.current.issued_by}` : ''}` : 'Not issued yet'}</p></div>
              ) : <span className="text-slate-300">—</span> },
              { key: 'actions', label: 'Actions', render: (i: InventoryItem) => (
                <div className="flex flex-wrap gap-2">
                  {i.status === 'assigned' && <Button size="sm" disabled={busy} onClick={() => issue(i)}>Confirm hand-over</Button>}
                  {['available', 'assigned', 'issued'].includes(i.status) && <>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => retire(i, 'lost')}>Lost</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => retire(i, 'damaged')}>Damaged</Button>
                  </>}
                  {!!i.history.length && <Button size="sm" variant="outline" onClick={() => setOpen(o => o === i.rfid_id ? null : i.rfid_id)}>{open === i.rfid_id ? 'Hide history' : `History (${i.history.length})`}</Button>}
                  {open === i.rfid_id && <ul className="w-full space-y-1 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                    {i.history.map(h => <li key={h.assignment_id}><span className="font-mono font-semibold">{h.plate_number ?? '—'}</span> · {h.user_code} · {h.assignment_status} · assigned {formatCampusDateTime(h.assigned_at)}{h.issued_at ? ` · issued ${formatCampusDateTime(h.issued_at)} by ${h.issued_by ?? '—'}` : ''}{h.unassigned_at ? ` · ended ${formatCampusDateTime(h.unassigned_at)}` : ''}</li>)}
                  </ul>}
                </div>
              )},
            ]}
            data={filtered}
          />
        )}
      </Card>
    </div>
  );
}
