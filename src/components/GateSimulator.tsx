import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, QrCode, LogIn, LogOut, FlaskConical, RefreshCw } from 'lucide-react';
import { Card, Button, Badge, Select, Input } from './ui';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useLiveSync } from '../lib/liveSync';

// Development-only stand-in for the RFID reader and QR scanner at the shared
// Main Entrance / Exit. The backend (/api/dev/simulator) answers 404 unless the
// simulator is enabled for this tester and the app is not in production; every
// scan is processed by the real gate logic and saved like a device scan.

interface SimCredential { credential: string; holder: string | null; plate_number: string | null; user_type?: string; status?: string; inside: boolean }
interface SimStatus { enabled: boolean; gate: string; rfid: SimCredential[]; qr: SimCredential[] }
interface ScanResult { status: string; message: string; slot_code?: string | null; parking_area?: string | null }

/** Whether the simulator is available to the signed-in user (null while checking). */
export function useSimulatorAvailable(enabled = true) {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!enabled) { setAvailable(false); return; }
    setAvailable(null);
    apiRequest<SimStatus>('/api/dev/simulator')
      .then(() => { if (!cancelled) setAvailable(true); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return available;
}

export default function GateSimulator({ onScanned }: { onScanned?: () => void }) {
  const [status, setStatus] = useState<SimStatus | null>(null);
  const [error, setError] = useState('');
  const [device, setDevice] = useState<'rfid' | 'qr'>('rfid');
  const [credential, setCredential] = useState('');
  const [busy, setBusy] = useState(false);
  const { refreshNow } = useLiveSync();
  const [log, setLog] = useState<(ScanResult & { at: string; device: string; direction: string; credential: string })[]>([]);

  const load = useCallback(async () => {
    try {
      setStatus(await apiRequest<SimStatus>('/api/dev/simulator'));
      setError('');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'The gate simulator is not enabled for your account.' : err instanceof Error ? err.message : 'Unable to load the simulator.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const scan = async (direction: 'in' | 'out') => {
    if (!credential.trim()) { setError(device === 'rfid' ? 'Choose or type an RFID tag UID.' : 'Choose or type a QR pass code.'); return; }
    setBusy(true);
    setError('');
    try {
      const r = await apiRequest<ScanResult>('/api/dev/simulator/scan', { method: 'POST', body: { device, direction, credential: credential.trim() } });
      setLog(l => [{ ...r, at: new Date().toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' }), device, direction, credential: credential.trim() }, ...l].slice(0, 10));
      await load();
      onScanned?.();
      // Let every open screen pick up the new gate event right away.
      refreshNow();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The scan could not be processed.');
    } finally {
      setBusy(false);
    }
  };

  const options = status ? (device === 'rfid' ? status.rfid : status.qr) : [];
  const tone = (s: string) => (['granted', 'completed'].includes(s) ? 'success' : s === 'denied' ? 'danger' : 'warning');

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <FlaskConical size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold">Development gate simulator</p>
          <p>Stands in for the RFID reader and QR scanner at the Main Entrance / Exit until hardware is connected. Scans use the real access rules and are saved to the development database (marked "simulator"). It is unavailable in production.</p>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      {status && (
        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="p-5 space-y-4">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Device">
              {([['rfid', 'RFID reader', <CreditCard key="r" size={14} />], ['qr', 'QR scanner', <QrCode key="q" size={14} />]] as const).map(([d, label, icon]) => (
                <button key={d} type="button" onClick={() => { setDevice(d); setCredential(''); }} aria-pressed={device === d}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 ${device === d ? 'bg-[#080677] text-white' : 'text-slate-600 hover:bg-blue-50'}`}>
                  {icon} {label}
                </button>
              ))}
            </div>
            <Select label={device === 'rfid' ? 'Registered RFID tags' : 'Visitor QR passes'} value={options.some(o => o.credential === credential) ? credential : ''}
              onChange={e => setCredential(e.target.value)} disabled={busy}>
              <option value="">Choose a credential…</option>
              {options.map(o => (
                <option key={o.credential} value={o.credential}>
                  {device === 'rfid' ? o.credential : `${o.credential.slice(0, 8)}…`} · {o.holder ?? '—'} · {o.plate_number ?? 'no vehicle'}{o.status ? ` · ${o.status}` : ''}{o.inside ? ' · inside' : ''}
                </option>
              ))}
            </Select>
            <Input label={device === 'rfid' ? 'Tag UID (or type an unknown one to test a denial)' : 'Pass code'} value={credential} onChange={e => setCredential(e.target.value)} disabled={busy} />
            <div className="flex flex-wrap gap-2">
              <Button variant="success" onClick={() => scan('in')} disabled={busy}><LogIn size={14} /> Scan at entry</Button>
              <Button onClick={() => scan('out')} disabled={busy}><LogOut size={14} /> Scan at exit</Button>
              <Button variant="ghost" onClick={load} disabled={busy}><RefreshCw size={14} /> Refresh</Button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-slate-700 mb-3">Scan results (this session)</h3>
            {log.length === 0 ? <p className="text-sm text-slate-400">No scans yet.</p> : (
              <ul className="space-y-2">
                {log.map((r, i) => (
                  <li key={i} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant={tone(r.status)}>{r.status}</Badge>
                      <span className="text-xs text-slate-400">{r.at} · {r.device.toUpperCase()} · {r.direction === 'in' ? 'entry' : 'exit'}</span>
                      {r.slot_code && <span className="ml-auto font-mono font-bold text-[#080677]">{r.slot_code}</span>}
                    </div>
                    <p className="text-slate-600">{r.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
