import React, { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { Ruler } from 'lucide-react';
import ParkingMap, { withProposedLayout } from './ParkingMap';
import ParkingMeasurements from './ParkingMeasurements';
import type { ParkingLot3DProps } from './ParkingLot3D';

export const PARKING_VIEW_KEY = 'pass_parking_layout_view';
export type ParkingView = 'plan' | '3d';

/** The first visit uses the lightweight plan; keep an explicit saved preference. */
export function savedParkingView(): ParkingView {
  try { return localStorage.getItem(PARKING_VIEW_KEY) === '3d' ? '3d' : 'plan'; }
  catch { return 'plan'; }
}

function supports3D() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

class MapBoundary extends Component<{
  children: React.ReactNode;
  fallback: React.ReactNode;
  onUnavailable: () => void;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

type Renderer = typeof import('./ParkingLot3D')['default'];
type Props = ParkingLot3DProps & { onUsePlan: () => void };
type LoadState = 'pending' | 'slow' | 'ready' | 'unavailable' | 'failed';

/** Keep the SVG map and its slot actions usable while optional 3D code loads. */
export default function ParkingMapView({ onUsePlan, ...props }: Props) {
  const [Renderer, setRenderer] = useState<Renderer | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('pending');
  const [attempt, setAttempt] = useState(0);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const data = useMemo(() => withProposedLayout(props.data), [props.data]);
  const inventory = data.geometry.measurement_basis?.inventory;
  const unavailable = useCallback(() => setLoadState('failed'), []);
  const is3D = props.viewMode === '3d';

  useEffect(() => {
    if (!is3D) return;
    if (!supports3D()) { setLoadState('unavailable'); return; }
    if (Renderer) { setLoadState('ready'); return; }
    let active = true;
    setLoadState('pending');
    const timer = setTimeout(() => { if (active) setLoadState('slow'); }, 15000);
    // This import is only requested by the explicit 3D view. Rejected downloads
    // are handled locally, without resetting the user's session or gate forms.
    import('./ParkingLot3D').then(module => {
      if (!active) return;
      setRenderer(() => module.default);
      setLoadState('ready');
    }).catch(() => { if (active) setLoadState('failed'); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); };
    // Renderer is cached for this mounted workspace; retry and view changes
    // deliberately start a new effect, while polling data does not reload code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is3D, attempt]);

  const plan = <ParkingMap data={data} highlight={props.highlight} onSelect={props.onSelect}
    focusArea={props.focusArea} showMeasurements={showMeasurements} />;
  const failed = loadState === 'failed' || loadState === 'unavailable';

  return <div className="space-y-3 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-medium text-slate-500">Proposed campus parking layout</p>
      <button type="button" aria-pressed={showMeasurements} onClick={() => setShowMeasurements(value => !value)}
        className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold inline-flex items-center gap-2 ${showMeasurements ? 'border-[#080677] bg-blue-50 text-[#080677]' : 'border-slate-200 text-slate-600 hover:bg-blue-50'}`}>
        <Ruler size={16} />{showMeasurements ? 'Hide measurements' : 'Show measurements'}
      </button>
    </div>
    {inventory && <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
      <strong>Parking layout:</strong> {inventory.car_drawn} full-size proposed car bays. The {inventory.car_configured}-car inventory target is retained; {inventory.car_configured - inventory.car_drawn} positions still need a measured layout. Use Show measurements to see each bay’s width × length. Campus confirmation is pending.
    </div>}
    {showMeasurements && <p className="text-xs text-blue-800">Each proposed bay shows W (width) and L (length), in metres. Zoom in or open a slot for its size. Boundary angles and vehicle manoeuvres still require campus confirmation.</p>}
    {is3D && loadState !== 'ready' && <div role={failed ? 'alert' : 'status'} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
      <p>{loadState === 'unavailable' ? '3D is unavailable in this browser. The plan below remains usable.'
        : loadState === 'failed' ? 'The 3D view could not load or stopped rendering. The plan below remains usable.'
        : loadState === 'slow' ? '3D is taking longer to load. You can keep using the plan below.'
        : 'Loading 3D parking layout… You can use the plan while it loads.'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onUsePlan} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#080677]">Use plan view</button>
        {failed && <button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#080677]">Try 3D again</button>}
      </div>
    </div>}
    {is3D && Renderer && loadState === 'ready'
      ? <MapBoundary key={attempt} fallback={plan} onUnavailable={unavailable}>
        <Renderer {...props} data={data} showMeasurements={showMeasurements} onUnavailable={unavailable} />
      </MapBoundary>
      : plan}
    <ParkingMeasurements geometry={data.geometry} slots={data.slots} />
  </div>;
}
