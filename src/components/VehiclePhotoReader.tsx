import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ScanLine } from 'lucide-react';
import { apiRequest, ApiError } from '../lib/apiClient';
import { detectedCategory, detectVehicles, estimateVehicleColor, loadVehiclePhoto, vehicleCrop } from '../lib/vehiclePhotoAnalysis';
import type { VehicleDetection, VehicleSuggestions } from '../lib/vehiclePhotoAnalysis';

type PlateRead = { status: string; plate_number: string | null; candidates: { plate: string; confidence: number }[]; message: string };
export default function VehiclePhotoReader({ file, onApply, onBusyChange }: { file: File | null; onApply: (fields: VehicleSuggestions) => void; onBusyChange?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [detections, setDetections] = useState<VehicleDetection[]>([]), [selected, setSelected] = useState<number | null>(null);
  const [plate, setPlate] = useState(''), [plateRead, setPlateRead] = useState<PlateRead | null>(null), [color, setColor] = useState<string | null>(null), [ready, setReady] = useState(false), [cooldown, setCooldown] = useState(0);
  const photo = useRef<HTMLCanvasElement | null>(null), preview = useRef<HTMLCanvasElement | null>(null), sequence = useRef(0), controller = useRef<AbortController | null>(null), lock = useRef(false);
  useEffect(() => {
    sequence.current++; controller.current?.abort(); lock.current = false; setBusy(false); onBusyChange?.(false);
    photo.current = null; setReady(false); setDetections([]); setSelected(null); setPlate(''); setPlateRead(null); setColor(null); setError(''); setMessage('');
    return () => { sequence.current++; controller.current?.abort(); onBusyChange?.(false); };
  }, [file, onBusyChange]);
  useEffect(() => { if (!cooldown) return; const timer = window.setTimeout(() => setCooldown(v => Math.max(0, v - 1)), 1000); return () => window.clearTimeout(timer); }, [cooldown]);
  useEffect(() => {
    const canvas = preview.current, source = photo.current; if (!canvas || !source) return;
    canvas.width = source.width; canvas.height = source.height; const ctx = canvas.getContext('2d')!; ctx.drawImage(source, 0, 0);
    detections.forEach((d, i) => { ctx.strokeStyle = selected === i ? '#16a34a' : '#2563eb'; ctx.lineWidth = Math.max(3, source.width / 250); ctx.strokeRect(...d.bbox); ctx.font = `${Math.max(18, source.width / 50)}px sans-serif`; ctx.fillStyle = ctx.strokeStyle; ctx.fillText(`${i + 1}: ${d.class}`, d.bbox[0] + 5, Math.max(25, d.bbox[1] + 25)); });
  }, [ready, detections, selected]);
  const readPlate = async (index: number | null, list: VehicleDetection[], token: number) => {
    const source = photo.current; if (!source) return;
    const detection = index === null ? null : list[index]; setSelected(index); setColor(detection ? estimateVehicleColor(source, detection).color : null); setPlate(''); setPlateRead(null);
    const body = new FormData(); body.append('vehicle_photo', await vehicleCrop(source, detection));
    if (token !== sequence.current) return;
    const requestController = new AbortController(); controller.current = requestController;
    const timer = window.setTimeout(() => requestController.abort(), 65000);
    try {
      const result = await apiRequest<{ data: PlateRead }>('/api/vehicles/read-photo', { method: 'POST', body, signal: requestController.signal });
      if (token !== sequence.current) return;
      setPlateRead(result.data); setPlate(result.data.plate_number || ''); setMessage(result.data.message);
    } catch (e) {
      if (token !== sequence.current) return;
      if (e instanceof ApiError && e.retryAfterSeconds) setCooldown(e.retryAfterSeconds);
      setError(e instanceof Error ? e.message : 'The plate could not be read. Enter it manually.');
    } finally { window.clearTimeout(timer); }
  };
  const run = async () => {
    if (!file || lock.current || cooldown) return;
    lock.current = true; const token = ++sequence.current; setBusy(true); onBusyChange?.(true); setError(''); setMessage('Reading vehicle photo…'); setReady(false); setPlate(''); setPlateRead(null); setColor(null); setDetections([]); setSelected(null);
    try {
      const loaded = await loadVehiclePhoto(file); if (token !== sequence.current) return; photo.current = loaded;
      let list: VehicleDetection[] = [];
      try { list = await detectVehicles(photo.current); } catch { if (token === sequence.current) setError('Vehicle category reader is unavailable. You can still read the plate and enter the category and color manually.'); }
      if (token !== sequence.current) return;
      setDetections(list); setReady(true);
      if (list.length > 1) setMessage('More than one vehicle was found. Choose the vehicle to read.');
      else await readPlate(list.length ? 0 : null, list, token);
    } catch (e) { if (token === sequence.current) setError(e instanceof Error ? e.message : 'Photo could not be read.'); }
    finally { if (token === sequence.current) { lock.current = false; setBusy(false); onBusyChange?.(false); } }
  };
  const select = async (index: number) => {
    if (lock.current || cooldown) return; lock.current = true; const token = ++sequence.current; setBusy(true); onBusyChange?.(true); setError('');
    try { await readPlate(index, detections, token); } catch (e) { if (token === sequence.current) setError(e instanceof Error ? e.message : 'Unable to read this vehicle.'); } finally { if (token === sequence.current) { lock.current = false; setBusy(false); onBusyChange?.(false); } }
  };
  if (!file) return null;
  const detection = selected === null ? null : detections[selected]; const category = detectedCategory(detection);
  return <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
    <button type="button" disabled={busy || cooldown > 0} onClick={() => void run()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}{cooldown ? `Try again in ${cooldown}s` : busy ? 'Reading photo…' : 'Read vehicle photo'}</button>
    <p className="text-xs text-slate-500">Read the plate, estimated body color and car/motorcycle category. Review suggestions before applying; all fields stay editable.</p>
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}{error && <p role="alert" className="text-sm text-amber-800">{error}</p>}
    {ready && <canvas ref={preview} aria-label="Vehicle photo with detected vehicles" className="block max-h-72 w-full rounded-lg object-contain bg-white" />}
    {detections.length > 1 && <div className="flex flex-wrap gap-2">{detections.map((d, i) => <button type="button" key={i} disabled={busy || cooldown > 0} aria-pressed={selected === i} onClick={() => void select(i)} className={`min-h-11 rounded-lg border px-3 py-2 text-sm ${selected === i ? 'border-green-500 bg-green-50' : 'border-blue-200 bg-white'}`}>Vehicle {i + 1} · {d.class}</button>)}</div>}
    {ready && (detections.length <= 1 || selected !== null) && !busy && <>
      <dl className="grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Plate suggestion</dt><dd className="font-mono font-semibold break-all">{plate || 'Enter manually'}</dd></div><div><dt className="text-slate-500">Estimated color</dt><dd className="font-semibold">{color || 'Enter manually'}</dd></div><div><dt className="text-slate-500">Vehicle category</dt><dd className="font-semibold">{category === 'motorcycle' ? 'Motorcycle' : category === 'car' ? 'Car / four-wheel parking' : 'Confirm manually'}</dd></div></dl>
      {plateRead && plateRead.candidates.length > 0 && <div className="space-y-2"><p className="text-xs text-slate-500">Compare any plate candidate with the image before selecting it.</p><div className="flex flex-wrap gap-2">{plateRead.candidates.map(p => <button type="button" key={p.plate} aria-pressed={plate === p.plate} onClick={() => setPlate(p.plate)} className={`rounded-lg border px-3 py-2 font-mono text-sm ${plate === p.plate ? 'border-blue-500 bg-white' : 'border-slate-200'}`}>{p.plate}</button>)}</div></div>}
      <button type="button" disabled={!plate && !color && !category} onClick={() => { onApply({ ...(plate ? { plate_number: plate } : {}), ...(color ? { color } : {}), ...(category ? { category } : {}) }); setMessage('Suggestions applied. Confirm the plate, color and vehicle type before saving.'); }} className="min-h-11 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-[#2563EB] disabled:opacity-50">Use these suggestions</button>
      <p className="text-xs text-slate-500">Lighting, windows, wheels and decals can affect the color estimate. Choose the exact body style for a car. This does not approve a vehicle or assign RFID.</p>
    </>}
  </section>;
}
