import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/apiClient';

type Slot = { slot_id: number; slot_code: string; zone_name: string; area_name: string; parking_area_id: number };
type Reader = { reader_id: number; reader_code: string; gate_name: string; parking_area_id: number | null };
type Station = Slot & { station_id: number; reader_id: number; reader_code: string; online: boolean; oled_ready: boolean;
  display_state: 'available' | 'occupied' | 'unknown' | 'offline'; distance_cm: number | string | null;
  last_seen_at: string | null; arrival_detected: boolean;
  assignment: { transaction_id: number; plate_number: string; slot_confirmed_at: string | null } | null };
type Data = { data: Station[]; slots: Slot[]; readers: Reader[]; can_configure: boolean };

export default function ParkingStationPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [readerId, setReaderId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    const result = await apiRequest<Data>('/api/parking/slot-stations', { signal });
    if (signal?.aborted) return;
    setData(result); setError('');
    setReaderId(previous => previous || String(result.readers[0]?.reader_id ?? ''));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await load(controller.signal); }
      catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Cannot load sensor status.'); }
      finally { if (!controller.signal.aborted) timer = setTimeout(poll, 3000); }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load]);
  const selectedReader = data?.readers.find(r => String(r.reader_id) === readerId);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice(''); setError('');
    try {
      const result = await apiRequest<{ message: string }>('/api/parking/slot-stations', {
        method: 'POST', body: { reader_id: Number(readerId), slot_id: Number(slotId) },
      });
      setNotice(result.message); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Cannot save the sensor slot.'); }
    finally { setBusy(false); }
  };
  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Parking hardware station">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="font-semibold text-slate-900">Parking guidance &amp; slot sensor</h2>
        <p className="mt-1 text-sm text-slate-600">Approved gate entries send their assigned area, zone and slot to the OLED.</p></div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Servo disconnected</span>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} Latest readings cannot be verified.</p>}
    {notice && <p role="status" className="mt-3 text-sm text-green-700">{notice}</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {data?.data.map(station => <div key={station.station_id} className="rounded-xl border border-slate-200 p-4">
        <p className="font-medium">{station.area_name} · {station.zone_name} · {station.slot_code}</p>
        <p className="mt-1 text-xs text-slate-500">{station.reader_code}</p>
        <p className={`mt-2 font-semibold ${error || !station.online ? 'text-slate-500' : station.display_state === 'occupied' ? 'text-red-700' : station.display_state === 'available' ? 'text-green-700' : 'text-amber-700'}`}>
          {error ? 'Status unavailable' : station.display_state === 'occupied' ? 'Slot occupied' : station.display_state === 'available' ? 'Slot clear' : station.display_state === 'offline' ? 'Sensor offline' : 'Reading uncertain'}
        </p>
        {station.assignment && <p className="mt-1 text-sm">Assigned vehicle: <strong>{station.assignment.plate_number}</strong></p>}
        {!error && station.arrival_detected && <p role="status" className="mt-2 rounded-lg bg-green-50 p-2 text-sm text-green-800">Arrival detected at the assigned slot.</p>}
        <p className="mt-2 text-xs text-slate-500">OLED: {!error && station.online ? station.oled_ready ? 'Ready' : 'Unavailable' : 'Offline'}
          {' · '}Distance: {!error && station.online && station.distance_cm != null ? `${Number(station.distance_cm).toFixed(1)} cm` : '—'}</p>
        <p className="mt-1 text-xs text-slate-500">Sensor detects occupancy. Staff still verify the vehicle identity.</p>
      </div>)}
    </div>
    {data && data.data.length === 0 && <p className="mt-3 text-sm text-amber-700">Choose the physical slot for the sensor before starting the parking station.</p>}
    {data?.can_configure && <details className="mt-4 border-t border-slate-100 pt-3" open={data.data.length === 0}>
      <summary className="cursor-pointer text-sm font-medium text-slate-700">Configure fixed sensor slot</summary>
      <form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">Gate reader<select required value={readerId} onChange={e => { setReaderId(e.target.value); setSlotId(''); }} className="mt-1 block rounded-lg border border-slate-300 p-2 text-sm">
          <option value="">Select reader</option>{data.readers.map(r => <option key={r.reader_id} value={r.reader_id}>{r.reader_code} · {r.gate_name}</option>)}
        </select></label>
        <label className="text-xs text-slate-600">Slot where the sensor is installed<select required value={slotId} onChange={e => setSlotId(e.target.value)} className="mt-1 block max-w-full rounded-lg border border-slate-300 p-2 text-sm">
          <option value="">Select physical slot</option>{data.slots.filter(s => selectedReader && (selectedReader.parking_area_id == null || Number(selectedReader.parking_area_id) === Number(s.parking_area_id))).map(s => <option key={s.slot_id} value={s.slot_id}>{s.area_name} · {s.zone_name} · {s.slot_code}</option>)}
        </select></label>
        <button disabled={busy || !slotId || !readerId} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save sensor slot'}</button>
      </form>
      <p className="mt-2 text-xs text-slate-500">One sensor monitors one fixed slot. Keep it at this slot even when the OLED guides another vehicle elsewhere. Moving the sensor requires updating this setting and restarting the station.</p>
    </details>}
  </section>;
}
