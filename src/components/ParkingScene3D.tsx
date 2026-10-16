import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePanZoom, type Point, type ViewBox } from './usePanZoom';
import { ZoomControls, slotFill, slotLabel, slotNumber, type MapBay, type MapData, type MapGeometry, type MapSlot } from './ParkingMap';

// 3D-style architectural view of the DYCI parking layout.
//
// The layout keeps the drawing's own coordinates (image px, y pointing
// "south") and is drawn through a fixed elevated orthographic camera looking
// north, so every bay keeps its position, row and diagonal orientation. The
// paved areas, the connecting lane and the IN/OUT road form one continuous
// asphalt surface on landscaped ground; stalls are painted with white lines
// and tinted by status; vehicles, trees and the gate are extruded models.
// Text is drawn upright so slot numbers stay readable at any zoom. It is plain
// SVG: no WebGL is needed and all 139 slots are ordinary DOM elements.

// ----------------------------------------------------------------- projection

const ELEVATION = (52 * Math.PI) / 180;
const SY = Math.sin(ELEVATION);
const SZ = Math.cos(ELEVATION);

/** World (x, y on the ground, z up) to screen. */
const P = (x: number, y: number, z = 0): Point => [x, y * SY - z * SZ];

const poly = (points: Point[]) => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const lifted = (points: Point[], z: number) => points.map(([x, y]) => P(x, y, z));

/** Ground-painted text: rotate on the ground, then project. */
const groundText = ([x, y]: Point, z: number, deg: number) => {
  const r = (deg * Math.PI) / 180;
  const [px, py] = P(x, y, z);
  return `matrix(${Math.cos(r)} ${SY * Math.sin(r)} ${-Math.sin(r)} ${SY * Math.cos(r)} ${px} ${py})`;
};

// Heights in drawing px (about 0.2 m each).
const GRASS = 1.6;
const PAVE = 2.6;
const ROAD = PAVE;

// ----------------------------------------------------------------- geometry

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** Rectangle footprint centred at (cx, cy); `along` follows the angle. */
export function rect(cx: number, cy: number, along: number, across: number, deg: number, chamfer = 0): Point[] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const a = along / 2, b = across / 2, k = Math.min(chamfer, a, b);
  const local: Point[] = k > 0
    ? [[-a + k, -b], [a - k, -b], [a, -b + k], [a, b - k], [a - k, b], [-a + k, b], [-a, b - k], [-a, -b + k]]
    : [[-a, -b], [a, -b], [a, b], [-a, b]];
  return local.map(([u, v]) => [cx + u * c - v * s, cy + u * s + v * c]);
}

/** Offset a point along an angle (deg) by `along` and across it by `across`. */
export function offset([x, y]: Point, deg: number, along: number, across = 0): Point {
  const r = (deg * Math.PI) / 180;
  return [x + along * Math.cos(r) - across * Math.sin(r), y + along * Math.sin(r) + across * Math.cos(r)];
}

function signedArea(points: Point[]) {
  let area = 0;
  points.forEach(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  });
  return area;
}

function inside([x, y]: Point, points: Point[]) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function distanceToPolygon(p: Point, points: Point[]) {
  let best = Infinity;
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  });
  return best;
}

type Face = { points: string; fill: string };

/**
 * Faces of a footprint extruded from z0 to z1: the walls facing the camera
 * (shaded by direction, light from the north-west) and the top.
 */
function prism(footprint: Point[], z0: number, z1: number, side: string): { walls: Face[]; top: string } {
  const area = signedArea(footprint);
  const walls: Face[] = [];
  footprint.forEach((a, i) => {
    const b = footprint[(i + 1) % footprint.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const [nx, ny] = area > 0 ? [dy / len, -dx / len] : [-dy / len, dx / len];
    if (ny <= 0.02) return; // faces away from the camera
    walls.push({ points: poly([P(a[0], a[1], z0), P(b[0], b[1], z0), P(b[0], b[1], z1), P(a[0], a[1], z1)]), fill: shade(side, 0.86 - 0.14 * nx) });
  });
  return { walls, top: poly(lifted(footprint, z1)) };
}

function Prism({ footprint, z0, z1, top, side, stroke, strokeWidth, dash }: {
  footprint: Point[]; z0: number; z1: number; top: string; side: string; stroke?: string; strokeWidth?: number; dash?: string;
}) {
  const p = prism(footprint, z0, z1, side);
  return (
    <>
      {p.walls.map((w, i) => <polygon key={i} points={w.points} fill={w.fill} />)}
      <polygon points={p.top} fill={top} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinejoin="round" />
    </>
  );
}

/** Painted arrow from a to b on the ground. */
export function arrowShape(a: Point, b: Point, shaft = 1.3, head = 4.2, headLen = 4.4): Point[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
  const nx = -uy, ny = ux;
  const hb: Point = [b[0] - ux * headLen, b[1] - uy * headLen];
  const side = (p: Point, w: number): Point => [p[0] + nx * w, p[1] + ny * w];
  return [side(a, shaft / 2), side(hb, shaft / 2), side(hb, head / 2), b, side(hb, -head / 2), side(hb, -shaft / 2), side(a, -shaft / 2)];
}

/** Point `back` px before the end of a polyline, along its last segment. */
export function before(points: Point[], back: number): Point {
  const end = points[points.length - 1], prev = points[points.length - 2];
  const len = Math.hypot(end[0] - prev[0], end[1] - prev[1]) || 1;
  return [end[0] - ((end[0] - prev[0]) / len) * back, end[1] - ((end[1] - prev[1]) / len) * back];
}

// ----------------------------------------------------------------- slots in the scene

export type SceneSlot = MapSlot & { gx: number; gy: number; gw: number; gh: number; rot: number; base: number; tray: boolean };

export interface TrayPanel { area: string; footprint: Point[]; titleAt: Point; title: string; note: string; codes: string }

/** Slots with their scene position: drawn bays, then the trays for unprinted slots. */
export function layoutSlots(data: MapData): { slots: SceneSlot[]; trays: TrayPanel[] } {
  const slots: SceneSlot[] = data.slots
    .filter(s => s.placed)
    .map(s => ({ ...s, gx: s.x!, gy: s.y!, gw: s.w!, gh: s.h!, rot: s.rotation, base: PAVE, tray: false }));
  const trays: TrayPanel[] = [];

  for (const t of data.geometry.trays ?? []) {
    const list = data.slots
      .filter(s => !s.placed && s.area_code === t.area)
      .sort((a, b) => a.slot_code.localeCompare(b.slot_code, undefined, { numeric: true }));
    if (!list.length) continue;

    const [bw, bh] = t.bay;
    const cols = Math.min(t.columns, list.length);
    const rows = Math.ceil(list.length / t.columns);
    const [ox, oy] = t.origin;
    const width = cols * bw + (cols - 1) * t.gap;
    const height = rows * bh + (rows - 1) * t.gap;

    list.forEach((s, i) => {
      slots.push({
        ...s,
        gx: ox + (i % t.columns) * (bw + t.gap) + bw / 2,
        gy: oy + Math.floor(i / t.columns) * (bh + t.gap) + bh / 2,
        gw: bw, gh: bh, rot: 0, base: PAVE, tray: true,
      });
    });

    const pad = 4;
    trays.push({
      area: t.area,
      footprint: [[ox - pad, oy - pad], [ox + width + pad, oy - pad], [ox + width + pad, oy + height + pad], [ox - pad, oy + height + pad]],
      titleAt: [ox - pad, oy - pad],
      title: t.title,
      note: t.note,
      codes: `${list[0].slot_code}${list.length > 1 ? ` – ${list[list.length - 1].slot_code}` : ''}`,
    });
  }

  return { slots, trays };
}

/** The vehicle's long axis follows the bay's longer side. */
export function bayAxis(s: SceneSlot) {
  return s.gh >= s.gw ? { deg: s.rot + 90, long: s.gh, short: s.gw } : { deg: s.rot, long: s.gw, short: s.gh };
}

const BODY_COLORS = ['#F8FAFC', '#CBD5E1', '#1E3A8A', '#2563EB', '#1F2937', '#0EA5E9', '#E5E7EB', '#FBBF24', '#94A3B8'];

export function bodyColor(plate: string) {
  let h = 0;
  for (const ch of plate) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BODY_COLORS[h % BODY_COLORS.length];
}

export const isMotorcycle = (s: SceneSlot) => s.area_code === 'MC' || /motor/i.test(s.occupant?.vehicle_type ?? '');

export function carSize(s: SceneSlot) {
  const { long, short } = bayAxis(s);
  const L = Math.min(long * 0.84, short * 2.4);
  return { L, W: Math.min(short * 0.72, L * 0.48) };
}

export function motoSize(s: SceneSlot) {
  const { long, short } = bayAxis(s);
  return { L: Math.min(long * 0.78, 11), W: Math.min(short * 0.34, 3) };
}

/** Height of what stands on a slot, for placing its label above it. */
function standingHeight(s: SceneSlot) {
  if (s.occupant) return isMotorcycle(s) ? 5.4 : 7.6;
  return 0;
}

function Car({ s }: { s: SceneSlot }) {
  const { deg } = bayAxis(s);
  const { L, W } = carSize(s);
  const z = s.base;
  const color = bodyColor(s.occupant!.plate_number);
  const c: Point = [s.gx, s.gy];
  const wheels = [[-0.3, -0.5], [0.3, -0.5], [-0.3, 0.5], [0.3, 0.5]]
    .map(([u, v]) => offset(c, deg, u * L, v * (W - 0.6)))
    .sort((a, b) => a[1] - b[1]);
  const cabin = offset(c, deg, -L * 0.06);
  const lights = (u: number, color: string) => [-0.3, 0.3].map(v => {
    const p = offset(c, deg, u * L, v * W);
    return <Prism key={`${u}${v}`} footprint={rect(p[0], p[1], 0.7, W * 0.22, deg)} z0={z + 2.4} z1={z + 3.6} top={color} side={color} />;
  });
  return (
    <g pointerEvents="none">
      {wheels.map((p, i) => <Prism key={i} footprint={rect(p[0], p[1], 3.2, 1.6, deg)} z0={z} z1={z + 2} top="#111827" side="#111827" />)}
      <Prism footprint={rect(c[0], c[1], L, W, deg, 1.8)} z0={z + 1} z1={z + 4.2} top={color} side={color} stroke="rgba(15,23,42,0.35)" strokeWidth={0.25} />
      {lights(0.49, '#FEF3C7')}
      {lights(-0.49, '#DC2626')}
      <Prism footprint={rect(cabin[0], cabin[1], L * 0.54, W * 0.86, deg, 1.4)} z0={z + 4.2} z1={z + 6.6} top="#1E293B" side="#334155" />
      <Prism footprint={rect(cabin[0] , cabin[1], L * 0.38, W * 0.74, deg, 1)} z0={z + 6.6} z1={z + 7.2} top={shade(color, 1.05)} side={shade(color, 0.8)} stroke="rgba(15,23,42,0.3)" strokeWidth={0.2} />
    </g>
  );
}

function Motorcycle({ s }: { s: SceneSlot }) {
  const { deg } = bayAxis(s);
  const { L, W } = motoSize(s);
  const z = s.base;
  const color = bodyColor(s.occupant!.plate_number);
  const c: Point = [s.gx, s.gy];
  const back = offset(c, deg, -L * 0.36), front = offset(c, deg, L * 0.36);
  const bar = offset(c, deg, L * 0.27);
  return (
    <g pointerEvents="none">
      <Prism footprint={rect(back[0], back[1], 2.8, W * 0.45, deg)} z0={z} z1={z + 2.8} top="#111827" side="#111827" />
      <Prism footprint={rect(c[0], c[1], L * 0.62, W * 0.75, deg, 0.6)} z0={z + 1.6} z1={z + 3.6} top={color} side={color} stroke="rgba(15,23,42,0.4)" strokeWidth={0.2} />
      <Prism footprint={rect(...offset(c, deg, -L * 0.06), L * 0.36, W * 0.62, deg, 0.5)} z0={z + 3.6} z1={z + 4.6} top="#1F2937" side="#1F2937" />
      <Prism footprint={rect(bar[0], bar[1], 0.7, W * 1.8, deg)} z0={z + 4.6} z1={z + 5.3} top="#475569" side="#334155" />
      <Prism footprint={rect(front[0], front[1], 2.8, W * 0.45, deg)} z0={z} z1={z + 2.8} top="#111827" side="#111827" />
    </g>
  );
}

/** Traffic cone at the far end of a slot under maintenance (the number stays painted in the stall). */
function Cone({ s }: { s: SceneSlot }) {
  const z = s.base;
  const { deg, long } = bayAxis(s);
  const [cx, cy] = offset([s.gx, s.gy], deg, -long * 0.32);
  return (
    <g pointerEvents="none">
      <Prism footprint={rect(cx, cy, 3.4, 3.4, s.rot)} z0={z} z1={z + 0.5} top="#EA580C" side="#C2410C" />
      <Prism footprint={rect(cx, cy, 2.2, 2.2, s.rot)} z0={z + 0.5} z1={z + 2} top="#F97316" side="#EA580C" />
      <Prism footprint={rect(cx, cy, 1.6, 1.6, s.rot)} z0={z + 2} z1={z + 3} top="#FFFFFF" side="#E2E8F0" />
      <Prism footprint={rect(cx, cy, 1.1, 1.1, s.rot)} z0={z + 3} z1={z + 4.2} top="#F97316" side="#EA580C" />
    </g>
  );
}

function Tree({ at, r }: { at: Point; r: number }) {
  const [gx, gy] = P(at[0] + r * 0.7, at[1] + r * 0.5, GRASS);
  const [cx, cy] = P(at[0], at[1], GRASS + 4 + r);
  const [tx, ty] = P(at[0], at[1], GRASS);
  return (
    <g pointerEvents="none">
      <ellipse cx={gx} cy={gy} rx={r * 1.1} ry={r * 0.75} fill="#14532D" opacity={0.28} />
      <line x1={tx} y1={ty} x2={cx} y2={cy} stroke="#6B4F2E" strokeWidth={0.9} />
      <circle cx={cx} cy={cy} r={r} fill="#2F6B3A" />
      <circle cx={cx - r * 0.25} cy={cy - r * 0.3} r={r * 0.68} fill="#3F8A49" />
      <circle cx={cx - r * 0.38} cy={cy - r * 0.48} r={r * 0.32} fill="#64B06A" />
    </g>
  );
}

// ----------------------------------------------------------------- scene

type SceneProps = {
  data: MapData;
  slots: SceneSlot[];
  trays: TrayPanel[];
  trees: { at: Point; r: number }[];
  highlight: string | null;
  selectedId: number | null;
  recent: Set<number>;
  showPlates: boolean;
  gateOnline: boolean;
  onSelect: (s: MapSlot) => void;
  onGate: () => void;
};

const ASPHALT = '#2E343F';
const STALL_TINT = { available: 0.6, occupied: 0.62, maintenance: 0.75 } as const;

/** Everything inside the SVG. Memoised so panning only changes the viewBox. */
const Scene = memo(function Scene({ data, slots, trays, trees, highlight, selectedId, recent, showPlates, gateOnline, onSelect, onGate }: SceneProps) {
  const g: MapGeometry = data.geometry;
  const keyActivate = (s: MapSlot) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s); }
  };

  const paved = [...(g.connector ? [g.connector.polygon] : []), ...g.areas.map(a => a.polygon), g.road.polygon];
  const pavedPrisms = paved.map(p => prism(p, GRASS, PAVE, '#AEB8C6'));

  // Gate: canopy over the road, a median with the RFID / QR readers, a boom
  // per lane (entry north, exit south) and the guard house.
  const gateAt = g.gate.at;
  const roadDeg = g.gate.angle;
  const across = roadDeg + 90;
  const pillar = (u: number, v: number) => offset(gateAt, roadDeg, u, v);
  const booth = offset(gateAt, roadDeg, 0, -22);
  const gateTop = P(...offset(gateAt, roadDeg, 2), ROAD + 30);
  const gateLabel = P(g.gate.label_at[0], g.gate.label_at[1], 0);
  const roadCentre: [Point, Point] = [
    [(g.road.polygon[0][0] + g.road.polygon[3][0]) / 2, (g.road.polygon[0][1] + g.road.polygon[3][1]) / 2],
    [(g.road.polygon[1][0] + g.road.polygon[2][0]) / 2, (g.road.polygon[1][1] + g.road.polygon[2][1]) / 2],
  ];
  const centreStart = offset(roadCentre[0], roadDeg, 14);

  const gateModel = (
    <g key="gate" role="button" tabIndex={0} aria-label={`${g.gate.label}: shared by cars and motorcycles. Record an entry or exit.`}
      onClick={onGate} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGate(); } }}
      className="cursor-pointer outline-none hover:brightness-110">
      <title>{`${g.gate.label} — shared gate for cars and motorcycles (RFID, Visitor QR, plate)`}</title>
      {/* Guard house */}
      <Prism footprint={rect(booth[0], booth[1], 9, 7.5, roadDeg)} z0={GRASS} z1={GRASS + 9} top="#F1F5F9" side="#E2E8F0" />
      <Prism footprint={rect(booth[0], booth[1], 11, 9.5, roadDeg)} z0={GRASS + 9} z1={GRASS + 10.4} top="#080677" side="#080677" />
      {/* Median with readers */}
      <Prism footprint={rect(...offset(gateAt, roadDeg, 2), 16, 2.2, roadDeg)} z0={ROAD} z1={ROAD + 0.8} top="#E2E8F0" side="#94A3B8" />
      {[-4, 6].map(u => {
        const p = offset(gateAt, roadDeg, u);
        return <Prism key={u} footprint={rect(p[0], p[1], 1.4, 1.4, roadDeg)} z0={ROAD + 0.8} z1={ROAD + 5} top="#2563EB" side="#1E3A8A" />;
      })}
      {/* Gantry post (north) */}
      <Prism footprint={rect(...pillar(2, -14.5), 1.6, 1.6, roadDeg)} z0={ROAD} z1={ROAD + 14} top="#CBD5E1" side="#94A3B8" />
      {/* Booms: entry lane (north) and exit lane (south) */}
      {[[-12, -1.4], [12, 1.4]].map(([from, to], b) => Array.from({ length: 4 }, (_, k) => {
        const v = from + ((to - from) * (k + 0.5)) / 4;
        const p = offset(gateAt, roadDeg, b ? 5 : -1, v);
        return <Prism key={`b${b}${k}`} footprint={rect(p[0], p[1], Math.abs(to - from) / 4, 0.8, across)} z0={ROAD + 6} z1={ROAD + 6.9} top={k % 2 ? '#FFFFFF' : '#DC2626'} side={k % 2 ? '#CBD5E1' : '#991B1B'} />;
      }))}
      {[[-1, -12.6], [5, 12.6]].map(([u, v]) => <Prism key={`h${v}`} footprint={rect(...pillar(u, v), 2.4, 2.4, roadDeg)} z0={ROAD} z1={ROAD + 7.4} top="#FACC15" side="#CA8A04" />)}
      {/* Gantry post (south), beam and the access sign */}
      <Prism footprint={rect(...pillar(2, 14.5), 1.6, 1.6, roadDeg)} z0={ROAD} z1={ROAD + 14} top="#CBD5E1" side="#94A3B8" />
      <Prism footprint={rect(...pillar(2, 0), 1.6, 30.6, roadDeg)} z0={ROAD + 12.6} z1={ROAD + 14.2} top="#1E1B8F" side="#080677" />
      {(() => {
        const [sx, sy] = P(...pillar(2, 0), ROAD + 14.2);
        return (
          <g transform={`translate(${sx} ${sy - 5})`}>
            <rect x={-15} y={-8.6} width={30} height={8} rx={1.5} fill="#2563EB" stroke="#FFFFFF" strokeWidth={0.5} />
            <text x={0} y={-5.9} textAnchor="middle" dominantBaseline="middle" fontSize={2.9} fontWeight={800} fill="#FFFFFF">RFID · VISITOR QR</text>
            <text x={0} y={-2.6} textAnchor="middle" dominantBaseline="middle" fontSize={2.3} fill="#DBEAFE">ENTRY / EXIT</text>
          </g>
        );
      })()}
      {[pillar(-1, -12.6), pillar(5, 12.6)].map((p, i) => (
        <circle key={i} cx={P(p[0], p[1], ROAD + 7.4)[0]} cy={P(p[0], p[1], ROAD + 7.4)[1]} r={1} fill={gateOnline ? '#22C55E' : '#F59E0B'} stroke="#FFFFFF" strokeWidth={0.3} />
      ))}
    </g>
  );

  // Everything that stands up, drawn far to near.
  const standing: { y: number; node: React.ReactNode }[] = [
    { y: gateAt[1], node: gateModel },
    ...trees.map((t, i) => ({ y: t.at[1], node: <Tree key={`tree-${i}`} at={t.at} r={t.r} /> })),
    ...slots.filter(s => s.occupant || s.status === 'maintenance').map(s => ({
      y: s.gy,
      node: (
        <g key={`v-${s.slot_id}`} onClick={() => onSelect(s)} className="cursor-pointer">
          {!s.occupant ? <Cone s={s} /> : isMotorcycle(s) ? <Motorcycle s={s} /> : <Car s={s} />}
        </g>
      ),
    })),
    ...(g.islands ?? []).flatMap((island, i) => {
      const [cx, cy] = island.polygon.reduce(([x, y], p) => [x + p[0] / island.polygon.length, y + p[1] / island.polygon.length], [0, 0]);
      return [{ y: cy, node: <Tree key={`it-${i}`} at={[cx, cy]} r={4.6} /> }];
    }),
  ].sort((a, b) => a.y - b.y);

  return (
    <>
      <defs>
        <linearGradient id="p3d-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EEF2F7" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="p3d-grass" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="760" y2="320">
          <stop offset="0" stopColor="#9CC97A" />
          <stop offset="1" stopColor="#7DB061" />
        </linearGradient>
        <linearGradient id="p3d-asphalt" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="760" y2="300">
          <stop offset="0" stopColor="#3A414D" />
          <stop offset="0.55" stopColor={ASPHALT} />
          <stop offset="1" stopColor="#262B34" />
        </linearGradient>
        <linearGradient id="p3d-sign" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <pattern id="p3d-grid" width="20" height={20 * SY} patternUnits="userSpaceOnUse">
          <path d={`M20 0H0V${20 * SY}`} fill="none" stroke="#D5DDE7" strokeWidth="0.3" />
        </pattern>
        <pattern id="p3d-hatch" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="2.2" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect x={-500} y={-500} width={2000} height={1500} fill="url(#p3d-ground)" />
      <rect x={-500} y={-500} width={2000} height={1500} fill="url(#p3d-grid)" />

      {/* Landscaped campus ground */}
      {g.site && (
        <>
          <polygon points={poly(g.site.polygon.map(([x, y]) => P(x + 4, y + 6)))} fill="#0F172A" opacity={0.1} />
          <Prism footprint={g.site.polygon} z0={0} z1={GRASS} top="url(#p3d-grass)" side="#6B8F4E" />
        </>
      )}

      {/* One continuous paved surface: walls first, then every top */}
      {pavedPrisms.flatMap((p, i) => p.walls.map((w, j) => <polygon key={`pw-${i}-${j}`} points={w.points} fill={w.fill} />))}
      {pavedPrisms.map((p, i) => <polygon key={`pt-${i}`} points={p.top} fill="url(#p3d-asphalt)" stroke="url(#p3d-asphalt)" strokeWidth={0.6} />)}
      {/* Painted boundary of each area, so they read as separate areas */}
      {g.areas.map(a => (
        <polygon key={`edge-${a.area}`} points={poly(lifted(a.polygon, PAVE))} fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={0.6} strokeDasharray="5 2.5" pointerEvents="none" />
      ))}

      {/* IN/OUT road markings */}
      <polygon points={poly(lifted(g.road.polygon, ROAD))} fill="none" stroke="#FACC15" strokeWidth={0.6} pointerEvents="none" />
      <line x1={P(...centreStart, ROAD)[0]} y1={P(...centreStart, ROAD)[1]} x2={P(...roadCentre[1], ROAD)[0]} y2={P(...roadCentre[1], ROAD)[1]}
        stroke="#FACC15" strokeWidth={0.55} strokeDasharray="4 3" />
      <text transform={groundText(g.road.label_at, ROAD, g.road.label_angle)} textAnchor="middle" dominantBaseline="middle"
        fontSize={4.6} fontWeight={800} fill="#FFFFFF" fillOpacity={0.85} letterSpacing={0.6}>{g.road.label}</text>
      {/* Entry (north lane) and exit (south lane) at the gate */}
      {/* (the exit lane already has its arrow from the road markings) */}
      {[
        { arrow: [offset(gateAt, roadDeg, 10, -5.2), offset(gateAt, roadDeg, 24, -5.2)] as [Point, Point], word: 'IN', at: offset(gateAt, roadDeg, 31, -5.2) },
        { arrow: null, word: 'OUT', at: offset(gateAt, roadDeg, 14, 5.2) },
      ].map(m => (
        <g key={m.word} pointerEvents="none">
          {m.arrow && <polygon points={poly(lifted(arrowShape(m.arrow[0], m.arrow[1], 1.5, 4.6, 4.6), ROAD))} fill="#FFFFFF" />}
          <text transform={groundText(m.at, ROAD, roadDeg)} textAnchor="middle" dominantBaseline="middle" fontSize={3.6} fontWeight={800} fill="#FFFFFF">{m.word}</text>
        </g>
      ))}

      {/* Planted islands */}
      {(g.islands ?? []).map((island, i) => (
        <g key={`island-${i}`} pointerEvents="none">
          <Prism footprint={island.polygon} z0={PAVE} z1={PAVE + 0.9} top="#7DB061" side="#CBD5E1" stroke="#E2E8F0" strokeWidth={0.7} />
          {island.polygon.map((p, k) => {
            const next = island.polygon[(k + 1) % island.polygon.length];
            const mid: Point = [(p[0] * 2 + next[0]) / 3, (p[1] * 2 + next[1]) / 3];
            const [cx, cy] = island.polygon.reduce(([x, y], q) => [x + q[0] / island.polygon.length, y + q[1] / island.polygon.length], [0, 0]);
            const s: Point = [mid[0] + (cx - mid[0]) * 0.35, mid[1] + (cy - mid[1]) * 0.35];
            const [sx, sy] = P(s[0], s[1], PAVE + 2.2);
            return <circle key={k} cx={sx} cy={sy} r={2.2} fill="#3F8A49" stroke="#2F6B3A" strokeWidth={0.3} />;
          })}
        </g>
      ))}

      {/* Pads for slots not printed on the drawing */}
      {trays.map(t => {
        const [tx, ty] = P(t.titleAt[0], t.titleAt[1], PAVE);
        const label = `${t.title} · ${t.codes}`;
        const w = Math.max(label.length * 2.15, t.note.length * 1.62) + 6;
        return (
          <g key={`tray-${t.area}`}>
            <Prism footprint={t.footprint} z0={GRASS} z1={PAVE} top="url(#p3d-asphalt)" side="#AEB8C6" stroke="#F59E0B" strokeWidth={0.6} dash="2 1.4" />
            <g transform={`translate(${tx} ${ty - 14})`}>
              <rect width={w} height={11} rx={2} fill="#FFFFFF" stroke="#F59E0B" strokeWidth={0.5} />
              <text x={3} y={4.6} fontSize={3.6} fontWeight={800} fill="#B45309">{label}</text>
              <text x={3} y={8.9} fontSize={2.8} fill="#64748B">{t.note}</text>
            </g>
          </g>
        );
      })}

      {/* Lane markings and one-way arrows */}
      {g.lanes.filter(l => l.kind !== 'to_area').map((l, i) => {
        const pts = l.reverse ? [...l.points].reverse() : l.points;
        const end = pts[pts.length - 1];
        const len = Math.hypot(end[0] - pts[0][0], end[1] - pts[0][1]);
        const mid: Point = [(pts[0][0] + end[0]) / 2, (pts[0][1] + end[1]) / 2];
        const midTail: Point = [mid[0] - (end[0] - pts[0][0]) / len * 9, mid[1] - (end[1] - pts[0][1]) / len * 9];
        return (
          <g key={`lane-${i}`} pointerEvents="none">
            {l.kind === 'lane' && <polyline points={poly(lifted(pts, PAVE))} fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={0.6} strokeDasharray="4 3" />}
            <polygon points={poly(lifted(arrowShape(before(pts, 9), end), PAVE))} fill="#FFFFFF" opacity={0.9} />
            {l.kind === 'lane' && len > 60 && <polygon points={poly(lifted(arrowShape(midTail, mid), PAVE))} fill="#FFFFFF" opacity={0.75} />}
          </g>
        );
      })}

      {/* Painted stalls that are not PASS slots (duplicates, beyond capacity) */}
      {data.extra_bays.map((b: MapBay, i) => (
        <g key={`bay-${i}`}>
          <title>{b.note ?? 'Painted stall, not a PASS slot'}</title>
          <polygon points={poly(lifted(rect(b.x, b.y, b.w, b.h, b.rotation), PAVE))}
            fill={b.kind === 'aisle' ? 'url(#p3d-hatch)' : 'rgba(255,255,255,0.03)'}
            stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={0.4} />
        </g>
      ))}

      {/* PASS stalls: white lines, floor tinted by status */}
      {slots.map(s => {
        const c = slotFill(s);
        const selected = selectedId === s.slot_id;
        const [cx, cy] = P(s.gx, s.gy, PAVE);
        return (
          <g key={`stall-${s.slot_id}`} role="button" tabIndex={0} aria-label={slotLabel(s)}
            onClick={() => onSelect(s)} onKeyDown={keyActivate(s)}
            className="cursor-pointer outline-none hover:brightness-125 focus-visible:brightness-150">
            <title>{slotLabel(s)}</title>
            <polygon points={poly(lifted(rect(s.gx, s.gy, s.gw - 1, s.gh - 1, s.rot), PAVE))} fill={c.fill} fillOpacity={STALL_TINT[s.status]} />
            <polygon points={poly(lifted(rect(s.gx, s.gy, s.gw, s.gh, s.rot), PAVE))} fill="none"
              stroke={selected ? '#FACC15' : '#FFFFFF'} strokeWidth={selected ? 1.1 : 0.45} />
            {c.dash && <polygon points={poly(lifted(rect(s.gx, s.gy, s.gw - 2, s.gh - 2, s.rot), PAVE))} fill="none" stroke="#FFFFFF" strokeWidth={0.5} strokeDasharray={c.dash} />}
            {s.accessible && !s.occupant && (
              <g pointerEvents="none">
                <rect x={cx - 4} y={cy - 0.5} width={8} height={6.4} rx={1} fill="#2563EB" />
                <text x={cx} y={cy + 2.8} textAnchor="middle" dominantBaseline="central" fontSize={5} fill="#FFFFFF">♿</text>
              </g>
            )}
          </g>
        );
      })}

      {/* Ground shadows of vehicles */}
      <g opacity={0.35} pointerEvents="none">
        {slots.filter(s => s.occupant).map(s => {
          const { deg } = bayAxis(s);
          const { L, W } = isMotorcycle(s) ? motoSize(s) : carSize(s);
          return <polygon key={`vs-${s.slot_id}`} points={poly(lifted(rect(s.gx + 1.8, s.gy + 1.6, L, W + 0.8, deg, 1.5), s.base))} fill="#020617" />;
        })}
      </g>

      {/* Routes from the shared gate to each area */}
      {g.lanes.filter(l => l.kind === 'to_area').map((l, i) => {
        const z = PAVE + 0.3;
        const tail = before(l.points, 7);
        const line = poly(lifted(l.points.slice(0, -1).concat([tail]), z));
        return (
          <g key={`route-${i}`} pointerEvents="none">
            <polyline points={line} fill="none" stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={line} fill="none" stroke="#2563EB" strokeWidth={1.4} strokeDasharray="3 1.8" strokeLinecap="round" strokeLinejoin="round" />
            <polygon points={poly(lifted(arrowShape(tail, l.points[l.points.length - 1], 1.4, 5, 5), z))} fill="#2563EB" stroke="#FFFFFF" strokeWidth={0.5} />
          </g>
        );
      })}

      {/* Standing models: gate, trees, vehicles, cones */}
      {standing.map(o => o.node)}

      {/* Route labels */}
      {g.lanes.filter(l => l.kind === 'to_area' && l.label && l.label_at).map((l, i) => {
        const [x, y] = P(l.label_at![0], l.label_at![1], PAVE);
        const w = l.label!.length * 2.6 + 6;
        return (
          <g key={`rl-${i}`} transform={`translate(${x} ${y})`} pointerEvents="none">
            <rect x={0} y={-5} width={w} height={7} rx={3.5} fill="#2563EB" stroke="#FFFFFF" strokeWidth={0.5} />
            <text x={w / 2} y={-1.4} textAnchor="middle" dominantBaseline="middle" fontSize={4} fontWeight={800} fill="#FFFFFF">{l.label}</text>
          </g>
        );
      })}

      {/* Slot numbers: painted in the stall, or on a pin above what stands there */}
      {slots.map(s => {
        const c = slotFill(s);
        const short = Math.min(s.gw, s.gh);
        const fs = Math.max(3, Math.min(s.area_code === 'MC' ? 4.6 : 6.4, short * 0.58));
        const lift = standingHeight(s);
        const [x, y] = P(s.gx, s.gy, s.base + (lift ? lift + 1.2 : 0.1));
        const label = slotNumber(s.slot_code);
        const plate = showPlates && s.occupant ? s.occupant.plate_number : null;
        const w = Math.max(label.length * fs * 0.62 + 2.4, plate ? plate.length * fs * 0.32 + 2 : 0);
        const h = fs + (plate ? fs * 0.6 : 0) + 1.2;
        const pinned = !!s.occupant;
        const dy = s.accessible && !pinned ? -fs * 0.55 : 0;
        return (
          <g key={`l-${s.slot_id}`} onClick={() => onSelect(s)} className="cursor-pointer">
            {pinned ? (
              <>
                <rect x={x - w / 2} y={y - h + 0.6} width={w} height={h} rx={1.4} fill="#DC2626" stroke="#FFFFFF" strokeWidth={0.35} />
                <text x={x} y={y - h + 0.6 + fs * 0.55 + 0.6} textAnchor="middle" dominantBaseline="central" fontSize={fs * 0.9} fontWeight={800} fill="#FFFFFF">{label}</text>
                {plate && <text x={x} y={y - 0.5 - fs * 0.25} textAnchor="middle" dominantBaseline="central" fontSize={fs * 0.48} fontWeight={600} fill="#FEE2E2">{plate}</text>}
              </>
            ) : (
              <text x={x} y={y + dy} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={800} fill={c.text}
                stroke="#0F172A" strokeOpacity={0.55} strokeWidth={0.8} paintOrder="stroke">{label}</text>
            )}
            {s.incident && (
              <g transform={`translate(${x + w / 2 + 0.5} ${y - (pinned ? h : fs * 0.6)})`}>
                <circle r={2.5} fill="#F59E0B" stroke="#FFFFFF" strokeWidth={0.45} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={3.4} fontWeight={900} fill="#FFFFFF">!</text>
              </g>
            )}
          </g>
        );
      })}

      {/* Blue parking area signs, on the landscaped ground beside each area */}
      {g.areas.map(a => {
        const stats = (data as MapData & { areas?: { area_code: string; capacity: number; available: number }[] }).areas?.find(x => x.area_code === a.area);
        const at = a.sign_at ?? a.label_at;
        const [bx, by] = P(at[0], at[1], GRASS);
        const [, top] = P(at[0], at[1], GRASS + 10);
        const title = a.area === 'MC' ? 'MOTORCYCLE PARKING' : a.area === 'CAR' ? 'CAR PARKING' : a.label;
        const sub = stats ? `${stats.capacity} SLOTS · ${stats.available} AVAILABLE` : '';
        const w = Math.max(title.length * 3.15, sub.length * 2.2) + 17;
        return (
          <g key={`sign-${a.area}`} pointerEvents="none">
            <ellipse cx={bx + 2} cy={by + 0.6} rx={3} ry={1.2} fill="#0F172A" opacity={0.25} />
            <line x1={bx} y1={by} x2={bx} y2={top} stroke="#64748B" strokeWidth={1} />
            <g transform={`translate(${bx - w / 2} ${top - 15})`}>
              <rect width={w} height={16} rx={3} fill="url(#p3d-sign)" stroke="#FFFFFF" strokeWidth={0.7} />
              <rect x={3} y={3} width={10} height={10} rx={2} fill="#FFFFFF" />
              <text x={8} y={8.4} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontWeight={900} fill="#1D4ED8">P</text>
              <text x={16} y={7} fontSize={5} fontWeight={800} fill="#FFFFFF">{title}</text>
              {sub && <text x={16} y={12.6} fontSize={3.4} fontWeight={600} fill="#BFDBFE">{sub}</text>}
            </g>
          </g>
        );
      })}

      {/* Highlighted (just assigned) and recently changed slots */}
      {slots.filter(s => s.slot_code === highlight || recent.has(s.slot_id)).map(s => {
        const ring = poly(lifted(rect(s.gx, s.gy, s.gw + 3, s.gh + 3, s.rot), s.base));
        const isHighlight = s.slot_code === highlight;
        const [px, py] = P(s.gx, s.gy, s.base + standingHeight(s) + 1.2);
        const pinY = py - Math.min(s.gw, s.gh) * 0.58 - 4;
        return (
          <g key={`hl-${s.slot_id}`} pointerEvents="none">
            <polygon points={ring} fill="none" stroke={isHighlight ? '#38BDF8' : '#FFFFFF'} strokeWidth={isHighlight ? 1.4 : 1}>
              <animate attributeName="opacity" values="1;0.15;1" dur="1.2s" repeatCount={isHighlight ? 'indefinite' : '4'} />
            </polygon>
            {isHighlight && (
              <g transform={`translate(${px} ${pinY})`}>
                <animateTransform attributeName="transform" type="translate" values={`${px} ${pinY};${px} ${pinY - 2.5};${px} ${pinY}`} dur="1.4s" repeatCount="indefinite" />
                <path d="M0 0 C-4 -5 -5 -7 -5 -9.5 A5 5 0 1 1 5 -9.5 C5 -7 4 -5 0 0 Z" fill="#2563EB" stroke="#FFFFFF" strokeWidth={0.6} />
                <circle cx={0} cy={-9.5} r={2} fill="#FFFFFF" />
              </g>
            )}
          </g>
        );
      })}

      {/* Gate label */}
      <g onClick={onGate} className="cursor-pointer">
        <line x1={gateTop[0]} y1={gateTop[1]} x2={gateLabel[0] - 6} y2={gateLabel[1] + 9} stroke="#080677" strokeWidth={0.6} />
        <g transform={`translate(${gateLabel[0]} ${gateLabel[1]})`}>
          <rect x={-6} y={-8} width={122} height={22} rx={4} fill="#080677" stroke="#FFFFFF" strokeWidth={0.6} />
          <text x={0} y={1} fontSize={6.5} fontWeight={800} fill="#FFFFFF">{g.gate.label}</text>
          <text x={0} y={9} fontSize={4} fill="#BFDBFE">{g.gate.sublabel} · RFID / Visitor QR</text>
          <circle cx={109} cy={-2} r={1.8} fill={gateOnline ? '#22C55E' : '#F59E0B'} />
        </g>
      </g>
    </>
  );
});

// ----------------------------------------------------------------- component

function bounds(points: Point[], pad: number): ViewBox {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  return [x, y, Math.max(...xs) + pad - x, Math.max(...ys) + pad - y];
}

/** Trees along the inside of the landscaped ground, clear of paving, pads and the gate. */
export function plantTrees(g: MapGeometry, trays: TrayPanel[]): { at: Point; r: number }[] {
  if (!g.site) return [];
  const site = g.site.polygon;
  const paved = [...(g.connector ? [g.connector.polygon] : []), ...g.areas.map(a => a.polygon), g.road.polygon, ...trays.map(t => t.footprint)];
  const outward = signedArea(site) > 0 ? 1 : -1;
  const trees: { at: Point; r: number }[] = [];

  site.forEach((a, i) => {
    const b = site[(i + 1) % site.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    // Inward normal (opposite of the outward one used by prism()).
    const nx = -uy * outward, ny = ux * outward;
    for (let d = 8; d < len - 6; d += 17) {
      const p: Point = [a[0] + ux * d + nx * 6, a[1] + uy * d + ny * 6];
      if (!inside(p, site)) continue;
      if (paved.some(q => inside(p, q) || distanceToPolygon(p, q) < 6)) continue;
      if (Math.hypot(p[0] - g.gate.at[0], p[1] - g.gate.at[1]) < 32) continue;
      if (g.areas.some(ar => ar.sign_at && Math.hypot(p[0] - ar.sign_at[0], p[1] - ar.sign_at[1]) < 16)) continue;
      trees.push({ at: p, r: 3.6 + ((i * 7 + Math.round(d)) % 5) * 0.35 });
    }
  });
  return trees;
}

export default function ParkingScene3D({ data, highlight, selectedId, recent, gateOnline, onSelect, onGate, focusArea }: {
  data: MapData;
  highlight: string | null;
  selectedId: number | null;
  recent: Set<number>;
  gateOnline: boolean;
  onSelect: (slot: MapSlot) => void;
  onGate: () => void;
  focusArea: { code: string; key: number } | null;
}) {
  const g = data.geometry;
  const { slots, trays } = useMemo(() => layoutSlots(data), [data]);
  const trees = useMemo(() => plantTrees(g, trays), [g, trays]);

  // Projected outline of each area (with its pad and sign), and of the whole site.
  const areaBoxes = useMemo(() => {
    const boxes: Record<string, ViewBox> = {};
    for (const a of g.areas) {
      const tray = trays.find(t => t.area === a.area);
      boxes[a.area] = bounds([
        ...lifted(a.polygon, 0), ...lifted(a.polygon, PAVE),
        ...(tray ? lifted(tray.footprint, 0).map(([x, y]) => [x, y - 14] as Point) : []),
      ], 10);
    }
    return boxes;
  }, [g.areas, trays]);

  const home = useMemo<ViewBox>(() => {
    const label = P(g.gate.label_at[0], g.gate.label_at[1]);
    return bounds([
      ...lifted(g.site?.polygon ?? g.areas.flatMap(a => a.polygon), 0),
      ...lifted(g.road.polygon, 0),
      ...trays.flatMap(t => lifted(t.footprint, 0)),
      [label[0] - 8, label[1] - 10], [label[0] + 118, label[1] + 16],
    ], 8);
  }, [g, trays]);

  const svgRef = useRef<SVGSVGElement>(null);
  const { view, zoomScale, zoomCenter, focus, reset, suppressClick, handlers } = usePanZoom(svgRef, home);

  useEffect(() => {
    if (focusArea) focusArea.code === 'ALL' ? reset() : focus(areaBoxes[focusArea.code] ?? home);
  }, [focusArea, areaBoxes, home, focus, reset]);

  // Bring a newly highlighted slot into view.
  useEffect(() => {
    const s = slots.find(x => x.slot_code === highlight);
    if (s) {
      const [x, y] = P(s.gx, s.gy, s.base);
      focus([x - 75, y - 50, 150, 90]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);

  // Stable handlers so the memoised scene does not re-render while panning.
  const onSelectRef = useRef(onSelect);
  const onGateRef = useRef(onGate);
  onSelectRef.current = onSelect;
  onGateRef.current = onGate;
  const select = useCallback((s: MapSlot) => { if (!suppressClick.current) onSelectRef.current(s); }, [suppressClick]);
  const gate = useCallback(() => { if (!suppressClick.current) onGateRef.current(); }, [suppressClick]);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-[#EEF2F7] overflow-hidden">
      <ZoomControls onZoomIn={() => zoomCenter(1.4)} onZoomOut={() => zoomCenter(1 / 1.4)} onReset={reset} />
      <svg
        ref={svgRef}
        viewBox={view.join(' ')}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-[min(72vh,660px)] min-h-[340px] select-none cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none', fontFamily: 'inherit' }}
        {...handlers}
        role="application"
        aria-label="3D view of the DYCI parking layout. Drag to pan, scroll or pinch to zoom, select a slot for details."
      >
        <Scene data={data} slots={slots} trays={trays} trees={trees} highlight={highlight} selectedId={selectedId} recent={recent}
          showPlates={zoomScale >= 2.2} gateOnline={gateOnline} onSelect={select} onGate={gate} />
      </svg>
    </div>
  );
}
