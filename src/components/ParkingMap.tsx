import React, { useEffect, useMemo, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { usePanZoom, type Point, type ViewBox } from './usePanZoom';

// ----------------------------------------------------------------------------- types

export interface MapSlot {
  slot_id: number;
  slot_code: string;
  parking_area_id: number;
  area_code: string;
  area_name: string;
  slot_status: 'available' | 'maintenance' | 'disabled';
  status: 'available' | 'occupied' | 'maintenance';
  placed: boolean;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  rotation: number;
  /** Accessible (PWD) slot. */
  accessible?: boolean;
  occupant: null | {
    transaction_id: number;
    plate_number: string;
    vehicle_type: string | null;
    party_type: 'user' | 'visitor' | null;
    party_name: string | null;
    owner_code: string | null;
    access_method: string;
    entry_datetime: string | null;
    confirmed: boolean;
    confirmed_at: string | null;
  };
  incident: null | {
    violation_id: number;
    plate_number: string | null;
    assigned_slot: string | null;
    observed_slot: string | null;
    violation_status: string;
    role: 'observed_here' | 'assigned_here';
  };
}

export interface MapBay {
  area: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  label: string;
  kind: 'unbound' | 'pwd' | 'aisle';
  note: string | null;
}

/** Where slots that are not printed on the drawing are shown, per area. */
export interface MapTray {
  area: string;
  origin: Point;
  columns: number;
  bay: [number, number];
  gap: number;
  title: string;
  note: string;
}

export interface MapGeometry {
  areas: { area: string; polygon: Point[]; label: string; label_at: Point; label_angle: number; sign_at?: Point }[];
  /** Paved lane joining the IN/OUT road and both areas. */
  connector?: { polygon: Point[] };
  /** Landscaped ground around the facility, and planted islands. */
  site?: { polygon: Point[] };
  islands?: { polygon: Point[] }[];
  road: { polygon: Point[]; label: string; label_at: Point; label_angle: number };
  gate: { at: Point; angle: number; label: string; sublabel: string; label_at: Point };
  lanes: { points: Point[]; kind: 'road_in' | 'road_out' | 'to_area' | 'lane'; reverse?: boolean; label?: string; label_at?: Point; label_angle?: number }[];
  dimensions: { text: string; at: Point; angle: number }[];
  trays?: MapTray[];
}

export interface MapData {
  view_box: [number, number, number, number];
  geometry: MapGeometry;
  slots: MapSlot[];
  extra_bays: MapBay[];
}

// ----------------------------------------------------------------------------- helpers

const FOCUS: Record<string, ViewBox> = {
  MC: [50, 18, 340, 270],
  CAR: [300, 20, 460, 320],
};

/** Keep text close to upright: rotate along the bay's long axis. */
function textAngle(rotation: number, w: number, h: number) {
  let angle = h > w ? rotation - 90 : rotation;
  while (angle > 90) angle -= 180;
  while (angle < -90) angle += 180;
  return angle;
}

/**
 * Status colours: Available green, Occupied red, Maintenance/disabled gray.
 * An occupied slot whose location staff have not yet confirmed keeps the red
 * fill and gets a dashed outline.
 */
export function slotFill(slot: MapSlot) {
  if (slot.status === 'maintenance') return { fill: '#9CA3AF', stroke: '#6B7280', side: '#6B7280', dash: undefined, text: '#FFFFFF' };
  if (slot.status === 'occupied') {
    return { fill: '#EF4444', stroke: slot.occupant?.confirmed ? '#B91C1C' : '#FFFFFF', side: '#B91C1C', dash: slot.occupant?.confirmed ? undefined : '1.2 0.8', text: '#FFFFFF' };
  }
  return { fill: '#22C55E', stroke: '#15803D', side: '#15803D', dash: undefined, text: '#FFFFFF' };
}

export const slotNumber = (code: string) => String(Number(code.split('-')[1] ?? code));

export function slotLabel(slot: MapSlot) {
  const state = slot.status === 'occupied'
    ? `occupied by ${slot.occupant?.plate_number}${slot.occupant?.confirmed ? '' : ' (location not yet confirmed)'}`
    : slot.status;
  return `Slot ${slot.slot_code}${slot.accessible ? ' (accessible / PWD)' : ''}, ${slot.area_name}, ${state}${slot.incident ? ', wrong-slot report' : ''}`;
}

export function ZoomControls({ onZoomIn, onZoomOut, onReset, children }: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
      {[
        { icon: <ZoomIn size={16} />, label: 'Zoom in', onClick: onZoomIn },
        { icon: <ZoomOut size={16} />, label: 'Zoom out', onClick: onZoomOut },
        { icon: <Maximize2 size={16} />, label: 'Show whole site', onClick: onReset },
      ].map(b => (
        <button key={b.label} type="button" onClick={b.onClick} aria-label={b.label} title={b.label}
          className="w-9 h-9 rounded-lg bg-white/95 border border-slate-200 shadow-sm flex items-center justify-center text-[#080677] hover:bg-blue-50">
          {b.icon}
        </button>
      ))}
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------------- component

/** Flat 2D plan of the DYCI layout; also the fallback for the 3D-style view. */
export default function ParkingMap({ data, highlight, onSelect, focusArea }: {
  data: MapData;
  highlight?: string | null;
  onSelect: (slot: MapSlot) => void;
  focusArea?: { code: string; key: number } | null;
}) {
  const home = useMemo<ViewBox>(() => [...data.view_box] as ViewBox, [data.view_box]);
  const svgRef = useRef<SVGSVGElement>(null);
  const { view, zoomScale, zoomCenter, focus, reset, suppressClick, handlers } = usePanZoom(svgRef, home);

  // Focus a parking area on request.
  useEffect(() => {
    if (focusArea) focusArea.code === 'ALL' ? reset() : focus(FOCUS[focusArea.code] ?? home);
  }, [focusArea, home, focus, reset]);

  // Bring a newly highlighted slot into view.
  useEffect(() => {
    const slot = data.slots.find(s => s.slot_code === highlight && s.placed);
    if (slot && slot.x !== null && slot.y !== null) focus([slot.x - 70, slot.y - 45, 140, 90]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);

  const select = (slot: MapSlot) => {
    if (suppressClick.current) return;
    onSelect(slot);
  };

  const g = data.geometry;
  const pts = (p: Point[]) => p.map(([x, y]) => `${x},${y}`).join(' ');
  const showPlates = zoomScale >= 2.4;

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-[#F8FAFC] overflow-hidden">
      <ZoomControls onZoomIn={() => zoomCenter(1.4)} onZoomOut={() => zoomCenter(1 / 1.4)} onReset={reset} />

      <svg
        ref={svgRef}
        viewBox={view.join(' ')}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-[min(70vh,640px)] min-h-[320px] select-none cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        {...handlers}
        role="application"
        aria-label="DYCI parking layout plan. Drag to pan, scroll or pinch to zoom, select a slot for details."
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#475569" />
          </marker>
          <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#2563EB" />
          </marker>
          <pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="2" stroke="#94A3B8" strokeWidth="0.6" />
          </pattern>
        </defs>

        <rect x={-500} y={-500} width={2000} height={1500} fill="#F8FAFC" />

        {g.connector && <polygon points={pts(g.connector.polygon)} fill="#F1F5F9" stroke="#CBD5E1" strokeWidth={0.5} />}

        {/* Parking areas */}
        {g.areas.map(a => (
          <g key={a.area}>
            <polygon points={pts(a.polygon)} fill={a.area === 'CAR' ? '#EEF2FF' : '#ECFEFF'} stroke="#1E293B" strokeWidth={1.4} strokeLinejoin="round" />
            <polygon points={pts(a.polygon)} fill="none" stroke="#FFFFFF" strokeWidth={0.5} strokeLinejoin="round" />
          </g>
        ))}

        {/* Shared IN/OUT road */}
        <polygon points={pts(g.road.polygon)} fill="#FACC15" stroke="#A16207" strokeWidth={0.6} />
        <text transform={`translate(${g.road.label_at[0]} ${g.road.label_at[1]}) rotate(${g.road.label_angle})`}
          textAnchor="middle" dominantBaseline="middle" fontSize={5.5} fontWeight={700} fill="#713F12">{g.road.label}</text>

        {/* Lanes and direction arrows */}
        {g.lanes.map((l, i) => {
          const blue = l.kind === 'to_area';
          return (
            <g key={i}>
              <polyline points={pts(l.points)} fill="none"
                stroke={blue ? '#2563EB' : l.kind.startsWith('road') ? '#713F12' : '#94A3B8'}
                strokeWidth={blue ? 1.2 : 0.8}
                strokeDasharray={blue ? '3 2' : l.kind === 'lane' ? '4 3' : undefined}
                markerEnd={l.reverse ? undefined : `url(#${blue ? 'arrow-blue' : 'arrow'})`}
                markerStart={l.reverse ? `url(#${blue ? 'arrow-blue' : 'arrow'})` : undefined} />
              {l.label && l.label_at && (
                <text transform={`translate(${l.label_at[0]} ${l.label_at[1]}) rotate(${l.label_angle ?? 0})`} fontSize={5} fontWeight={700}
                  fill="#1D4ED8" stroke="#FFFFFF" strokeWidth={1.4} paintOrder="stroke">{l.label}</text>
              )}
            </g>
          );
        })}

        {/* Area titles and dimensions */}
        {g.areas.map(a => (
          <text key={a.area} transform={`translate(${a.label_at[0]} ${a.label_at[1]}) rotate(${a.label_angle})`}
            textAnchor="middle" fontSize={6.5} fontWeight={800} fill="#080677" stroke="#FFFFFF" strokeWidth={1.6} paintOrder="stroke">{a.label}</text>
        ))}
        {g.dimensions.map(d => (
          <text key={d.text} transform={`translate(${d.at[0]} ${d.at[1]}) rotate(${d.angle})`}
            textAnchor="middle" fontSize={5} fill="#94A3B8">{d.text}</text>
        ))}

        {/* Painted bays that are not PASS slots */}
        {data.extra_bays.map((b, i) => (
          <g key={`bay-${i}`} transform={`translate(${b.x} ${b.y}) rotate(${b.rotation})`}>
            <title>{b.note ?? 'Not a PASS slot'}</title>
            <rect x={-b.w / 2} y={-b.h / 2} width={b.w} height={b.h}
              fill={b.kind === 'aisle' ? 'url(#hatch)' : '#FFFFFF'}
              stroke={b.kind === 'pwd' ? '#2563EB' : '#CBD5E1'} strokeWidth={0.4}
              strokeDasharray={b.kind === 'unbound' ? '1.5 1' : undefined} />
            {b.kind !== 'aisle' && (
              <text transform={`rotate(${textAngle(b.rotation, b.w, b.h) - b.rotation})`} textAnchor="middle" dominantBaseline="central"
                fontSize={b.kind === 'pwd' ? 6 : Math.min(4, Math.min(b.w, b.h) * 0.5)} fill={b.kind === 'pwd' ? '#2563EB' : '#CBD5E1'}>
                {b.kind === 'pwd' ? '♿' : b.label}
              </text>
            )}
          </g>
        ))}

        {/* PASS slots */}
        {data.slots.filter(s => s.placed).map(s => {
          const c = slotFill(s);
          const w = s.w!, h = s.h!;
          const angle = textAngle(s.rotation, w, h) - s.rotation;
          const short = Math.min(w, h);
          const highlighted = highlight === s.slot_code;
          return (
            <g key={s.slot_id} transform={`translate(${s.x} ${s.y}) rotate(${s.rotation})`}
              role="button" tabIndex={0} aria-label={slotLabel(s)}
              onClick={() => select(s)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s); } }}
              className="cursor-pointer focus:outline-none [&:focus>rect.slot]:stroke-[#080677] [&:focus>rect.slot]:stroke-[1.2] hover:opacity-85">
              <title>{slotLabel(s)}</title>
              {highlighted && (
                <rect x={-w / 2 - 2} y={-h / 2 - 2} width={w + 4} height={h + 4} rx={1.5} fill="none" stroke="#2563EB" strokeWidth={1.4}>
                  <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" />
                </rect>
              )}
              <rect className="slot" x={-w / 2} y={-h / 2} width={w} height={h} rx={0.6}
                fill={c.fill} stroke={c.stroke} strokeWidth={0.5} strokeDasharray={c.dash} />
              <text transform={`rotate(${angle})`} textAnchor="middle" dominantBaseline="central"
                fontSize={Math.min(5, short * 0.62)} fontWeight={700} fill={c.text} pointerEvents="none">
                {s.accessible ? `♿ ${slotNumber(s.slot_code)}` : slotNumber(s.slot_code)}
              </text>
              {showPlates && s.occupant && short >= 9 && (
                <text transform={`rotate(${angle}) translate(0 ${Math.min(5, short * 0.62) * 0.95})`} textAnchor="middle" dominantBaseline="central"
                  fontSize={2.3} fill={c.text} pointerEvents="none">{s.occupant.plate_number}</text>
              )}
              {s.incident && (
                <g transform={`rotate(${-s.rotation}) translate(${Math.max(w, h) / 2 - 1} ${-Math.min(w, h) / 2})`} pointerEvents="none">
                  <circle r={2.4} fill="#F59E0B" stroke="#FFFFFF" strokeWidth={0.4} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={3.2} fontWeight={800} fill="#FFFFFF">!</text>
                </g>
              )}
            </g>
          );
        })}

        {/* The single shared Main Entrance / Exit */}
        <g>
          <line x1={g.gate.at[0]} y1={g.gate.at[1]} x2={g.gate.label_at[0] - 6} y2={g.gate.label_at[1] + 8} stroke="#080677" strokeWidth={0.6} />
          <g transform={`translate(${g.gate.at[0]} ${g.gate.at[1]}) rotate(${g.gate.angle + 90})`}>
            <rect x={-13} y={-2} width={26} height={4} rx={1} fill="#080677" />
            <circle cx={-13} cy={0} r={2.2} fill="#16A34A" />
            <circle cx={13} cy={0} r={2.2} fill="#16A34A" />
          </g>
          <g transform={`translate(${g.gate.label_at[0]} ${g.gate.label_at[1]})`}>
            <rect x={-6} y={-8} width={118} height={21} rx={3} fill="#080677" />
            <text x={0} y={1} fontSize={6.5} fontWeight={800} fill="#FFFFFF">{g.gate.label}</text>
            <text x={0} y={9} fontSize={4.2} fill="#BFDBFE">{g.gate.sublabel}</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
