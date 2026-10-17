import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Map as MapIcon, RefreshCw, ParkingSquare } from 'lucide-react';
import { Button, Card, Modal, StatCard } from './ui';
import ParkingLot3D from './ParkingLot3D';
import type { MapData, MapSlot } from './ParkingMap';
import { apiRequest } from '../lib/apiClient';
import { POLL_MS } from '../lib/liveSync';
import { formatCampusDateTime } from '../lib/datetime';

interface Figures { capacity: number; occupied: number; available: number; maintenance: number }
interface AvailabilityMap extends MapData {
  areas: (Figures & { area_code: string; area_name: string })[];
  overall: Figures;
  generated_at: string;
}
const NO_CHANGES = new Set<number>();

/** Signed-in, read-only map. Its API never returns another person's identity or visit. */
export default function ParkingAvailabilityMap() {
  const [data, setData] = useState<AvailabilityMap | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'3d' | 'plan'>('3d');
  const [focus, setFocus] = useState<{ code: string; key: number } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const value = await apiRequest<AvailabilityMap>('/api/parking/availability-map');
      if (mounted.current) { setData(value); setError(''); }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Unable to load availability.');
    } finally { inFlight.current = false; }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const tick = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { mounted.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [refresh]);
  const selected = data?.slots.find(slot => slot.slot_id === selectedId);
  const choose = (slot: MapSlot) => setSelectedId(slot.slot_id);
  const unplaced = data?.slots.filter(slot => !slot.placed).length ?? 0;
  return <div className="space-y-5 min-w-0">
    {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {data ? 'Showing the last loaded availability. ' : ''}{error}
      <Button size="sm" variant="outline" onClick={refresh} className="mt-2"><RefreshCw size={14} />Try again</Button>
    </div>}
    {!data && !error && <div role="status"><Card className="p-10 text-center text-slate-500">Loading parking layout…</Card></div>}
    {data && <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Available" value={data.overall.available} icon={<ParkingSquare size={18} />} color="green" />
        <StatCard label="Occupied" value={data.overall.occupied} icon={<ParkingSquare size={18} />} color="blue" />
        <StatCard label="Configured Slots" value={data.overall.capacity} icon={<ParkingSquare size={18} />} color="sky" />
        <StatCard label="Maintenance" value={data.overall.maintenance} icon={<ParkingSquare size={18} />} color="amber" />
      </div>
      <Card className="p-3 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Map view" className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
            {(['3d', 'plan'] as const).map(mode => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${view === mode ? 'bg-[#080677] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>
              {mode === '3d' ? <Box size={16} /> : <MapIcon size={16} />}{mode === '3d' ? '3D View' : 'Plan View'}
            </button>)}
          </div>
          <Button size="sm" variant="outline" onClick={refresh} className="ml-auto"><RefreshCw size={14} />Refresh</Button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Focus parking area">
          {[{area_code: 'ALL', area_name: 'Whole site'}, ...data.areas].map(area => <button key={area.area_code} type="button" onClick={() => setFocus({ code: area.area_code, key: Date.now() })} className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-[#080677] hover:bg-blue-50">{area.area_name}</button>)}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
          {[['#22C55E', 'Available'], ['#EF4444', 'Occupied'], ['#9CA3AF', 'Maintenance'], ['#FFFFFF', 'Unassigned painted bay']].map(([color, label]) => <span key={label} className="flex items-center gap-2"><i className="h-3 w-3 rounded border border-slate-300" style={{background: color}} />{label}</span>)}
        </div>
        <ParkingLot3D data={data} viewMode={view} highlight={null} selectedId={selectedId} recent={NO_CHANGES} gateOnline={false} onSelect={choose} onGate={() => {}} focusArea={focus} />
        <p className="text-xs text-slate-500">Drag to move · pinch or use +/− to zoom · select a slot for availability.</p>
        <p className="text-xs text-slate-500">Counts follow the configured slot inventory and recorded entries/exits. The parking layout is a proposal; physical slot sensors are not connected. Availability does not reserve a space.</p>
        {unplaced > 0 && <p className="text-xs text-slate-500">Totals include {unplaced} configured slots awaiting map positions. Only mapped bays appear on this layout.</p>}
        <p className="text-xs text-slate-400">Updated {formatCampusDateTime(data.generated_at)} · Checks every {POLL_MS / 1000} seconds while visible</p>
      </Card>
      <div className="grid sm:grid-cols-2 gap-3">{data.areas.map(area => <Card key={area.area_code} className="p-4 flex items-center justify-between gap-3"><span className="text-sm font-semibold text-[#080677]">{area.area_name}</span><span className="text-sm text-slate-600"><strong className="text-green-700">{area.available}</strong> / {area.capacity} available</span></Card>)}</div>
    </>}
    <Modal open={!!selected} onClose={() => setSelectedId(null)} title={`Slot ${selected?.slot_code ?? ''}`} size="sm">
      {selected && <div className="space-y-3 text-sm"><p className="font-semibold text-[#080677]">{selected.area_name}</p><p className="capitalize">{selected.status}</p>{selected.accessible && <p>Accessible / PWD bay</p>}{data?.geometry.proposed_slot_codes?.includes(selected.slot_code) && <p className="text-amber-800">Proposed map position; campus confirmation is pending.</p>}<p className="text-slate-500">Availability can change before you arrive. Follow the parking staff’s directions.</p><Button onClick={() => setSelectedId(null)}>Close</Button></div>}
    </Modal>
  </div>;
}
