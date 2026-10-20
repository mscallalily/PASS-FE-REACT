import { jsonFetch } from '../lib/http';
import React, { useCallback, useEffect, useRef, useState } from 'react';

type VehicleType = 'motorcycle' | 'car';
type ParkingSlot = {
  slot_code: string;
  vehicle_type: VehicleType;
  slot_number: number;
  is_occupied: boolean;
  updated_at: string | null;
};
type ParkingResponse = {
  mode: string;
  slots: ParkingSlot[];
  summary: { total: number; occupied: number; available: number };
};
type SlotPosition = {
  type: VehicleType;
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
};

// Coordinates match the 1672 x 941 empty 3D background image.
// The illustrated parking bays are not perfectly numbered (AI-created art),
// so these are best-fit interactive positions. API IDs remain authoritative.
const SLOT_POSITIONS: SlotPosition[] = (() => {
  const result: SlotPosition[] = [];

  function row(
    type: VehicleType, first: number, count: number,
    x1: number, y1: number, x2: number, y2: number,
    width: number, height: number, angle: number,
  ) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      result.push({
        type,
        number: first + i,
        x: x1 + (x2 - x1) * t,
        y: y1 + (y2 - y1) * t,
        width, height, angle,
      });
    }
  }

  // 22 motorcycle bays beside the main entrance road.
  row('motorcycle', 1, 22, 104, 329, 629, 210, 22, 46, -14);

  // Three interior motorcycle banks. Each is visually two-sided.
  // Split the 62 other simulated slots across the 3 banks so hotspots
  // stay INSIDE the printed parking boundaries rather than the driveways.
  row('motorcycle', 23, 14, 208, 411, 247, 678, 48, 18, -11);
  row('motorcycle', 37, 7, 260, 402, 309, 675, 47, 17, -11);

  row('motorcycle', 44, 14, 392, 377, 454, 677, 48, 18, -11);
  row('motorcycle', 58, 7, 450, 374, 501, 666, 47, 17, -11);

  row('motorcycle', 65, 14, 574, 337, 651, 659, 48, 18, -11);
  row('motorcycle', 79, 6, 616, 333, 696, 647, 47, 17, -11);

  // Car section: the first three illustrated rows (21 + 21 + 13).
  // The artwork includes extra numbered bays beyond C-55; the API has
  // only 55 car slots, so those extra illustrated spaces stay inactive.
  row('car', 1, 21, 811, 166, 1532, 331, 34, 62, 12);
  row('car', 22, 21, 807, 297, 1483, 469, 37, 65, 14);
  row('car', 43, 13, 854, 450, 1354, 597, 39, 67, 16);

  return result;
})();

function VehicleDrawing({ type, w, h }: { type: VehicleType; w: number; h: number }) {
  if (type === 'car') {
    return (
      <g pointerEvents="none">
        <rect x={-w * 0.32} y={-h * 0.36} width={w * 0.64} height={h * 0.72}
          rx="5" fill="#21486e" stroke="#dbeafe" strokeWidth="1.5" />
        <rect x={-w * 0.23} y={-h * 0.16} width={w * 0.46} height={h * 0.29}
          rx="3" fill="#93c5fd" />
        <path d={`M ${-w * 0.23} ${h * 0.2} H ${w * 0.23}`} stroke="#e2e8f0" strokeWidth="2" />
      </g>
    );
  }
  return (
    <g pointerEvents="none">
      <ellipse rx={w * 0.27} ry={h * 0.4} fill="#0f172a" />
      <rect x={-w * 0.14} y={-h * 0.2} width={w * 0.28} height={h * 0.38}
        rx="3" fill="#60a5fa" />
      <path d={`M ${-w * 0.28} ${-h * 0.25} H ${w * 0.28}`} stroke="white" strokeWidth="2" />
    </g>
  );
}

function InteractiveMap({
  slots, updating, onToggle,
}: {
  slots: ParkingSlot[];
  updating: string | null;
  onToggle: (slot: ParkingSlot) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const byKey = new Map(slots.map(s => [`${s.vehicle_type}-${s.slot_number}`, s]));

  return (
    <svg viewBox="0 0 1672 941" className="block h-auto w-full"
      role="group" aria-label="Interactive 3D parking layout, simulation mode">
      <image href="/parking-layout-empty.png" x="0" y="0" width="1672" height="941" />
      {SLOT_POSITIONS.map(p => {
        const slot = byKey.get(`${p.type}-${p.number}`);
        if (!slot) return null;
        const occupied = slot.is_occupied;
        const disabled = updating !== null;
        const isHovered = hovered === slot.slot_code;
        return (
          <g key={`${p.type}-${p.number}`}
            transform={`translate(${p.x} ${p.y}) rotate(${p.angle})`}
            role="button" tabIndex={disabled ? -1 : 0}
            aria-label={`${slot.slot_code}: ${occupied ? 'Occupied' : 'Available'}. Click to toggle.`}
            aria-disabled={disabled}
            onMouseEnter={() => setHovered(slot.slot_code)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(slot.slot_code)}
            onBlur={() => setHovered(null)}
            onClick={() => { if (!disabled) onToggle(slot); }}
            onKeyDown={e => {
              if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault(); onToggle(slot);
              }
            }}
            className={disabled ? 'cursor-wait' : 'cursor-pointer'}>
            <title>{slot.slot_code}: {occupied ? 'Occupied' : 'Available'} — click to toggle</title>
            <rect x={-p.width / 2} y={-p.height / 2} width={p.width} height={p.height}
              rx="2" fill={occupied ? '#dc2626' : '#16a34a'}
              fillOpacity={occupied ? 0.3 : isHovered ? 0.16 : 0.008}
              stroke={updating === slot.slot_code ? '#fbbf24' : occupied ? '#fca5a5' : '#22c55e'}
              strokeOpacity={occupied || isHovered ? 0.95 : 0.12}
              strokeWidth={occupied || isHovered ? 2.5 : 1.2} />
            {occupied && <VehicleDrawing type={p.type} w={p.width} h={p.height} />}
          </g>
        );
      })}
    </svg>
  );
}

export default function ParkingSlotLayout() {
  const [data, setData] = useState<ParkingResponse | null>(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const saving = useRef(false);

  const loadSlots = useCallback(async () => {
    const token = localStorage.getItem('pass_auth_token') || sessionStorage.getItem('pass_auth_token');
    if (!token) { setError('No login token found. Please log in again.'); return; }
    try {
      const response = await jsonFetch('/api/admin/parking/slots', {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Unable to load slots (${response.status})`);
      const result: ParkingResponse = await response.json();
      setData(result);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to fetch parking slots.');
    }
  }, []);

  useEffect(() => {
    void loadSlots();
    const timer = window.setInterval(() => {
      if (!saving.current) void loadSlots();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [loadSlots]);

  async function toggleSlot(slot: ParkingSlot) {
    if (saving.current) return;
    saving.current = true;
    setUpdating(slot.slot_code);
    const token = localStorage.getItem('pass_auth_token') || sessionStorage.getItem('pass_auth_token');
    try {
      const response = await jsonFetch('/api/admin/parking/slots', {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vehicle_type: slot.vehicle_type,
          slot_number: slot.slot_number,
          is_occupied: !slot.is_occupied,
        }),
      });
      if (!response.ok) throw new Error(`Failed to update ${slot.slot_code} (${response.status})`);
      await loadSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update slot.');
    } finally {
      saving.current = false;
      setUpdating(null);
    }
  }

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-700">Live Parking Slot Layout</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">Simulation Mode</span>
          <button type="button" onClick={() => setExpanded(!expanded)}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50">
            {expanded ? 'Close' : 'Expand map'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {([
          ['Total', data?.summary.total, 'bg-blue-50 text-blue-700'],
          ['Available', data?.summary.available, 'bg-green-50 text-green-700'],
          ['Occupied', data?.summary.occupied, 'bg-red-50 text-red-700'],
        ] as const).map(([label, value, style]) => (
          <div key={label} className={`rounded-lg p-3 ${style}`}>
            <p className="text-xs opacity-75">{label}</p>
            <p className="text-xl font-bold">{value ?? '...'}</p>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      {!data ? (
        <p className="text-sm text-slate-500">Loading parking slots...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div style={{ minWidth: expanded ? 1050 : undefined }}>
            <InteractiveMap slots={data.slots} updating={updating} onToggle={slot => void toggleSlot(slot)} />
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400">
        Hover to highlight a slot · Red = occupied (vehicle shown) · Empty = available (no vehicle) · Click a slot to simulate arrival/departure · Refreshes every 3 seconds.
      </p>
    </div>
  );

  return expanded ? (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/75 p-3 md:p-8"
      role="dialog" aria-modal="true" aria-label="Expanded parking layout">
      <div className="mx-auto max-w-[1550px] rounded-2xl bg-white p-4 md:p-6">{content}</div>
    </div>
  ) : content;
}
