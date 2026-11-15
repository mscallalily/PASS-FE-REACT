import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, ApiError, getToken } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import { HARDWARE_PATH, hasHardwareAccess } from '../lib/hardwareLayout';
import { ageStationData, parseStationData, stationLabel, stationTone, type StationData } from '../lib/parkingStation';
import { formatCampusDateTime } from '../lib/datetime';

export default function ParkingStationPanel({ mode = 'status' }: { mode?: 'status' | 'setup' }) {
  const { user } = useAuth();
  if (!hasHardwareAccess(user?.role) || (user?.accountStatus && user.accountStatus !== 'active')) return null;
  return <StationWorkspace key={`${user?.id ?? ''}|${user?.role ?? ''}|${getToken() ?? ''}`} mode={mode} allowConfigure={user?.role === 'parking_staff'}/>;
}

function StationWorkspace({ mode, allowConfigure }: { mode: 'status' | 'setup'; allowConfigure: boolean }) {
  const [snapshot, setData] = useState<StationData | null>(null), [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(''), [saveError, setSaveError] = useState(''), [notice, setNotice] = useState('');
  const [channel, setChannel] = useState('1');
  const [readerId, setReaderId] = useState(''), [slotId, setSlotId] = useState(''), [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0), [visible, setVisible] = useState(!document.hidden);
  const [receivedAt, setReceivedAt] = useState<number | null>(null), [clock, setClock] = useState(performance.now());
  const data = snapshot && receivedAt !== null ? ageStationData(snapshot, clock - receivedAt) : null;
  const lock = useRef(false), mounted = useRef(true), read = useRef<AbortController | null>(null), write = useRef<AbortController | null>(null);
  const id = useId();
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; read.current?.abort(); write.current?.abort(); };
  }, []);
  useEffect(() => {
    const change = () => { setClock(performance.now()); setVisible(!document.hidden); };
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const tick = setInterval(() => setClock(performance.now()), 1000);
    return () => clearInterval(tick);
  }, [visible]);
  useEffect(() => {
    if (!visible || saving) return;
    let active = true, failures = 0, timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      const controller = new AbortController(); read.current = controller;
      const requestStartedAt = performance.now();
      setLoading(true); let retry = true;
      try {
        const result = parseStationData(await apiRequest<StationData>('/api/parking/slot-stations', { signal: controller.signal }));
        if (!active || controller.signal.aborted) return;
        const now = performance.now(); setData(result); setReceivedAt(requestStartedAt); setClock(now); setLoadError(''); failures = 0;
      } catch (e) {
        if (!active || controller.signal.aborted) return;
        setLoadError(e instanceof Error ? e.message : 'Cannot verify sensor status.'); failures++;
        if (e instanceof ApiError && [401, 403].includes(e.status)) { retry = false; setData(null); setReceivedAt(null); }
      } finally {
        if (active && !controller.signal.aborted) {
          setLoading(false);
          if (retry) timer = setTimeout(() => { void poll(); }, Math.min(30000, 3000 * 2 ** Math.min(failures, 4)));
        }
      }
    }
    void poll();
    return () => { active = false; read.current?.abort(); if (timer) clearTimeout(timer); };
  }, [revision, visible, saving]);
  const fresh = visible && receivedAt !== null && clock - receivedAt < 12000 && !loadError;
  const selectedReader = data?.readers.find(r => String(r.reader_id) === readerId);
  const slots = data?.slots.filter(s => selectedReader && (selectedReader.parking_area_id === null || Number(selectedReader.parking_area_id) === Number(s.parking_area_id)) && !data.data.some(bound => bound.slot_id === s.slot_id && (String(bound.reader_id) !== readerId || String(bound.sensor_channel) !== channel))) ?? [];
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || mode !== 'setup' || !allowConfigure || !data?.can_configure || !fresh) return;
    if (!selectedReader || !slots.some(s => String(s.slot_id) === slotId)) { setSaveError('Choose a reader and an available physical slot in its area.'); return; }
    lock.current = true; read.current?.abort(); setSaving(true); setSaveError(''); setNotice('');
    const controller = new AbortController(); write.current = controller;
    try {
      const result = await apiRequest<{ message: string }>('/api/parking/slot-stations', { method: 'POST', body: { reader_id: Number(readerId), sensor_channel: Number(channel), slot_id: Number(slotId) }, signal: controller.signal });
      if (typeof result.message !== 'string' || !result.message.trim()) throw new Error('The server response could not confirm the sensor configuration. Check the current mapping before trying again.');
      if (mounted.current && !controller.signal.aborted) { setNotice(result.message); setSlotId(''); }
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) setSaveError(e instanceof Error ? e.message : 'Could not confirm the sensor configuration. Check the current mapping before trying again.');
    } finally {
      lock.current = false; if (write.current === controller) write.current = null;
      if (mounted.current && !controller.signal.aborted) { setSaving(false); setRevision(v => v + 1); }
    }
  }
  async function configureServo(reader: number, enabled: boolean) {
    if (lock.current || !fresh || !allowConfigure || !data?.can_configure) return;
    lock.current = true; read.current?.abort(); setSaving(true); setSaveError(''); setNotice('');
    const controller = new AbortController(); write.current = controller;
    try {
      const result = await apiRequest<{ message: string }>('/api/parking/hardware-controllers', { method: 'POST', body: { reader_id: reader, servo_enabled: enabled }, signal: controller.signal });
      if (typeof result.message !== 'string' || !result.message.trim()) throw new Error('Configuration was not confirmed. Refresh hardware status before trying again.');
      if (mounted.current && !controller.signal.aborted) setNotice(result.message);
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) setSaveError(e instanceof Error ? e.message : 'Cannot confirm servo configuration.');
    } finally {
      lock.current = false; if (write.current === controller) write.current = null;
      if (mounted.current && !controller.signal.aborted) { setSaving(false); setRevision(v => v + 1); }
    }
  }
  const refresh = () => { if (!lock.current) setRevision(v => v + 1); };
  const health = <>
    {loading && !data && <p role="status" className="text-sm text-slate-500">Checking slot sensor…</p>}
    {loadError && <p role="alert" className="break-words text-sm text-red-700">{loadError} Latest readings cannot be verified.</p>}
    {data && !fresh && !loadError && <p role="status" className="text-sm text-amber-800">Latest readings cannot be verified. Refreshing sensor status…</p>}
  </>;
  if (mode === 'status') return <section aria-label="Slot sensor status" className="mb-4 min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><h2 className="text-sm font-semibold text-slate-800">Parking slot sensors</h2><Link to={HARDWARE_PATH} className="inline-flex min-h-11 items-center text-xs font-medium text-blue-800 underline">Hardware &amp; Station</Link></div>
    {health}
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{data?.data.map(s => <div key={s.station_id} className="min-w-0 break-words"><span className="font-semibold">CH{s.sensor_channel} · {s.slot_code}</span><span className={'ml-2 ' + stationTone(s, fresh)}>{stationLabel(s, fresh)}</span>{fresh && s.online && s.arrival_detected && <span role="status" className="ml-2 font-medium text-green-800">Arrival reported; verify vehicle.</span>}</div>)}</div>
    {data && data.data.length === 0 && <p className="text-sm text-slate-500">No sensor station configured.</p>}
    {loadError && <button type="button" onClick={refresh} disabled={loading} className="mt-2 min-h-11 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50">Retry sensor status</button>}
  </section>;
  return <section aria-label="Parking hardware station" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 sm:flex-1"><h2 className="font-semibold text-slate-900">Parking guidance &amp; integrated hardware</h2><p className="mt-1 text-sm text-slate-600">Approved gate entries send the assigned parking location to the OLED. Each of the four sensors monitors its own mapped physical slot.</p></div><span className="shrink-0 self-start rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Miniature gate controller</span></div>
    <div className="mt-3 space-y-2">{health}{notice && <p role="status" className="break-words text-sm text-green-800">{notice}</p>}{saveError && <p role="alert" className="break-words text-sm text-red-700">{saveError}</p>}</div>
    <button type="button" onClick={refresh} disabled={saving || loading} className="mt-3 min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">{loading ? 'Refreshing status…' : 'Refresh status'}</button>
    <div className="mt-4 space-y-3">{data?.controllers.map(c => <article key={c.reader_id} className="rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-800">{c.reader_code} · Gate controller</h3>
      <p className="mt-1 text-sm text-slate-600">{fresh && c.online ? 'Connected' : 'Offline / unverified'} · Servo {fresh && c.online ? c.servo_ready ? 'ready' : 'unavailable' : 'unverified'} · OLED {fresh && c.online ? c.oled_ready ? 'ready' : 'unavailable' : 'unverified'}</p>
      <p className="mt-1 text-sm">Gate sensor: {fresh && c.online ? c.gate_state : 'unknown'} · Last acknowledged position command: {c.gate_position}. Physical arm position is not measured.</p>
      <p className="mt-1 text-sm">New authorized OPENs: {fresh && c.ready ? 'enabled and ready' : c.servo_enabled ? 'waiting for healthy, reviewed, closed hardware' : 'disabled'}</p>
      {c.requires_review && <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Physical review required. At the gate PC, visually check the miniature gate. Once the gate sensor has been clear for 2.5 seconds, type C then Enter, check the arm, then type REVIEW. Do not repeat an uncertain entry.</p>}
      {allowConfigure && data.can_configure && <button type="button" onClick={() => void configureServo(c.reader_id, !c.servo_enabled)} disabled={saving || !fresh || !c.servo_enabled && (!c.online || !c.servo_ready || c.requires_review || c.firmware_profile !== 'integrated-v2' || c.gate_position !== 'closed' || c.gate_state === 'unknown' || data.data.filter(s => s.reader_id === c.reader_id).length !== 4)} className="mt-3 min-h-11 rounded-lg border border-slate-300 px-4 text-sm disabled:opacity-50">{c.servo_enabled ? 'Disable new servo approvals' : 'Enable miniature servo'}</button>}
    </article>)}</div>
    <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">{data?.data.map(s => <article key={s.station_id} className="min-w-0 break-words rounded-xl border border-slate-200 p-4">
      <h3 className="font-medium">{s.area_name} · {s.zone_name} · {s.slot_code}</h3><p className="mt-1 break-all text-xs text-slate-500">{s.reader_code} · Sensor channel {s.sensor_channel}</p>
      <p className={'mt-2 font-semibold ' + stationTone(s, fresh)}>{stationLabel(s, fresh)}</p>
      {s.assignment && <p className="mt-1 text-sm">Assigned vehicle: <strong>{s.assignment.plate_number}</strong></p>}
      {fresh && s.online && s.arrival_detected && <p role="status" className="mt-2 rounded-lg bg-green-50 p-2 text-sm text-green-800">Arrival detected at the assigned slot. Verify the vehicle identity.</p>}
      <p className="mt-2 text-xs text-slate-500">OLED: {fresh && s.online ? s.oled_ready ? 'Ready' : 'Unavailable' : 'Unverified'} · Distance: {fresh && s.online && s.distance_cm !== null ? `${s.distance_cm.toFixed(1)} cm` : '—'}</p>
      <p className="mt-1 text-xs text-slate-500">Last seen: {formatCampusDateTime(s.last_seen_at)}</p><p className="mt-1 text-xs text-slate-500">The sensor detects occupancy; staff verify the vehicle.</p>
    </article>)}</div>
    {data && data.data.length === 0 && <p className="mt-4 text-sm text-amber-800">No fixed sensor slot is configured yet.</p>}
    {allowConfigure && data?.can_configure ? <details className="mt-5 border-t border-slate-100 pt-3" open={data.data.length === 0}>
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-slate-700">Map sensor channels 1–4</summary>
      <form onSubmit={save} aria-label="Fixed sensor configuration" className="mt-3 grid min-w-0 items-end gap-4 md:grid-cols-2">
        <label htmlFor={id + '-reader'} className="block min-w-0 text-sm text-slate-600">Gate reader<select id={id + '-reader'} aria-label="Gate reader" required value={readerId} disabled={saving || !fresh} onChange={e => { setReaderId(e.target.value); setSlotId(''); setSaveError(''); }} className="mt-1 block min-h-11 w-full min-w-0 max-w-full truncate rounded-lg border border-slate-300 p-2 text-sm disabled:opacity-50"><option value="">Select reader</option>{data.readers.map(r => <option key={r.reader_id} value={r.reader_id}>{r.reader_code} · {r.gate_name}</option>)}</select></label>
        <label htmlFor={id + '-channel'} className="block min-w-0 text-sm text-slate-600">Sensor channel<select id={id + '-channel'} value={channel} disabled={saving || !fresh} onChange={e => { setChannel(e.target.value); setSlotId(''); setSaveError(''); }} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 p-2">{[1, 2, 3, 4].map(n => <option key={n} value={n}>Channel {n}</option>)}</select></label>
        <label htmlFor={id + '-slot'} className="block min-w-0 text-sm text-slate-600">Physical sensor slot<select id={id + '-slot'} aria-label="Physical sensor slot" required value={slotId} disabled={saving || !fresh || !selectedReader} onChange={e => { setSlotId(e.target.value); setSaveError(''); }} className="mt-1 block min-h-11 w-full min-w-0 max-w-full truncate rounded-lg border border-slate-300 p-2 text-sm disabled:opacity-50"><option value="">Select physical slot</option>{slots.map(s => <option key={s.slot_id} value={s.slot_id}>{s.area_name} · {s.zone_name} · {s.slot_code}</option>)}</select></label>
        <p className="text-xs leading-relaxed text-slate-500 md:col-span-2">Map each numbered sensor to a distinct slot in the gate area. Save all four channels before starting the integrated controller. Changing a mapping disables new servo approvals and requires a controller restart and physical review.</p>
        <button type="submit" disabled={saving || !fresh || !selectedReader || !slots.some(s => String(s.slot_id) === slotId)} className="min-h-11 w-full rounded-lg bg-[#080677] px-4 py-3 text-sm font-medium text-white disabled:opacity-50 md:w-fit">{saving ? 'Saving…' : 'Save sensor slot'}</button>
      </form>
    </details> : data && <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">This view is read-only. Parking Staff configure the physical sensor slot.</p>}
  </section>;
}
