import React, { Component, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { ZoomControls, slotLabel, slotNumber, type MapData, type MapGeometry, type MapSlot } from './ParkingMap';
import ParkingScene3D, {
  arrowShape, bayAxis, before, bodyColor, carSize, isMotorcycle, layoutSlots, motoSize, offset, plantTrees, rect,
  type SceneSlot, type TrayPanel,
} from './ParkingScene3D';
import type { Point } from './usePanZoom';

// WebGL (Three.js) view of the DYCI parking layout.
//
// World axes: x = drawing x, z = drawing y (south, towards the camera), y up.
// One unit is one drawing px (about 0.2 m), so every bay keeps the position,
// size and diagonal orientation measured from the DYCI drawing. A fixed
// elevated perspective camera looks north; the user can pan and zoom but not
// rotate. Slots, vehicles and the gate are clickable meshes driven by the
// live /api/parking/map data. Without WebGL the SVG view is shown instead.

// ----------------------------------------------------------------- constants

const ELEVATION = THREE.MathUtils.degToRad(50);
const FOV = 34;
const VIEW_DIR = new THREE.Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION));

const PAVE = 0.8; // asphalt top
const TINT = PAVE + 0.03; // status-coloured stall floor
const PAINT = PAVE + 0.06; // white lines and painted text
const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

const STATUS = {
  available: { color: '#22C55E', opacity: 0.78 },
  occupied: { color: '#EF4444', opacity: 0.8 },
  maintenance: { color: '#A3A9B3', opacity: 0.88 },
} as const;

// ----------------------------------------------------------------- helpers

const v3 = ([x, y]: Point, h = 0) => new THREE.Vector3(x, h, y);

/** Extruded slab from a drawing polygon; caps use world-space UVs. */
function slab(points: Point[], bottom: number, top: number) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, -y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bottom, 0);
  return geo;
}

/** Flat polygon lying on the ground at height h. */
function flat(points: Point[], h: number) {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, -y))));
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, h, 0);
  return geo;
}

/** Collects painted marks (lines, dashes, arrows) into one mesh. */
class Paint {
  private pos: number[] = [];
  constructor(private h: number) {}

  poly(points: Point[]) {
    const tris = THREE.ShapeUtils.triangulateShape(points.map(([x, y]) => new THREE.Vector2(x, y)), []);
    for (const t of tris) for (const i of t) this.pos.push(points[i][0], this.h, points[i][1]);
    return this;
  }

  line(a: Point, b: Point, w: number) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-(b[1] - a[1]) / len) * (w / 2), ny = ((b[0] - a[0]) / len) * (w / 2);
    return this.poly([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
  }

  outline(points: Point[], w: number, closed = true) {
    const n = closed ? points.length : points.length - 1;
    for (let i = 0; i < n; i++) this.line(points[i], points[(i + 1) % points.length], w);
    return this;
  }

  dashed(points: Point[], w: number, dash: number, gap: number, closed = false) {
    const pts = closed ? [...points, points[0]] : points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = 0; d < len; d += dash + gap) {
        const e = Math.min(len, d + dash);
        this.line([a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len], [a[0] + ((b[0] - a[0]) * e) / len, a[1] + ((b[1] - a[1]) * e) / len], w);
      }
    }
    return this;
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.computeVertexNormals();
    return geo;
  }
}

function noiseTexture(base: string, speckle: string[], scale: number) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = speckle[i % speckle.length];
    ctx.globalAlpha = 0.18 + rand() * 0.25;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 1.6, 1 + rand() * 1.6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / scale, 1 / scale);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Canvas-drawn label texture (cached by key). Returns the texture and its aspect ratio. */
const textures = new Map<string, { map: THREE.CanvasTexture; aspect: number }>();

function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const hit = textures.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  draw(ctx);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const entry = { map, aspect: w / h };
  textures.set(key, entry);
  return entry;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** White number painted on the asphalt. */
function paintedText(text: string, color = '#FFFFFF') {
  ctx_measure.font = `800 64px ${FONT}`;
  const w = Math.ceil(ctx_measure.measureText(text).width) + 16;
  return canvasTexture(`paint:${text}:${color}`, w, 72, ctx => {
    ctx.font = `800 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(15,23,42,0.55)';
    ctx.strokeText(text, w / 2, 38);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, 38);
  });
}

const ctx_measure = (typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null) as CanvasRenderingContext2D;

/** Rounded badge with one or two lines of text. */
function badge(lines: string[], bg: string, opts: { fg?: string; sub?: string; border?: string; size?: number; icon?: string } = {}) {
  const size = opts.size ?? 30;
  ctx_measure.font = `800 ${size}px ${FONT}`;
  const main = ctx_measure.measureText(lines[0]).width;
  ctx_measure.font = `600 ${size * 0.62}px ${FONT}`;
  const second = lines[1] ? ctx_measure.measureText(lines[1]).width : 0;
  const iconW = opts.icon ? size * 1.5 : 0;
  const w = Math.ceil(Math.max(main, second) + iconW + size * 0.9);
  const h = Math.ceil(size * (lines[1] ? 2.05 : 1.45));
  return canvasTexture(`badge:${lines.join('|')}:${bg}:${opts.icon ?? ''}:${size}`, w, h, ctx => {
    roundRect(ctx, 2, 2, w - 4, h - 4, size * 0.32);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = opts.border ?? '#FFFFFF';
    ctx.stroke();
    let x = size * 0.45;
    if (opts.icon) {
      roundRect(ctx, x, (h - size * 1.15) / 2, size * 1.15, size * 1.15, size * 0.22);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.fillStyle = bg;
      ctx.font = `900 ${size * 0.95}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.icon, x + size * 0.575, h / 2 + 1);
      x += iconW;
    }
    ctx.textAlign = opts.icon ? 'left' : 'center';
    ctx.textBaseline = 'middle';
    const cx = opts.icon ? x : w / 2;
    ctx.fillStyle = opts.fg ?? '#FFFFFF';
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.fillText(lines[0], cx, lines[1] ? h * 0.36 : h / 2 + 1);
    if (lines[1]) {
      ctx.fillStyle = opts.sub ?? 'rgba(255,255,255,0.8)';
      ctx.font = `600 ${size * 0.62}px ${FONT}`;
      ctx.fillText(lines[1], cx, h * 0.74);
    }
  });
}

// ----------------------------------------------------------------- shared geometry & materials

const BOX = new THREE.BoxGeometry(1, 1, 1);
const WHEEL = new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2);
const CONE = new THREE.ConeGeometry(1, 1, 16);
const TRUNK = new THREE.CylinderGeometry(0.45, 0.6, 1, 6);
const CANOPY = new THREE.IcosahedronGeometry(1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

const mat = (() => {
  const cache = new Map<string, THREE.Material>();
  return (key: string, make: () => THREE.Material) => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key)!;
  };
})();

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  mat(`std:${color}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra }));

const paintMat = (color: string, opacity = 1) =>
  mat(`paint:${color}:${opacity}`, () => new THREE.MeshStandardMaterial({
    color, roughness: 0.9, transparent: opacity < 1, opacity, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false,
  }));

// ----------------------------------------------------------------- models

function Box({ size, at, color, extra, cast = true }: { size: [number, number, number]; at: [number, number, number]; color: string; extra?: THREE.MeshStandardMaterialParameters; cast?: boolean }) {
  return <mesh geometry={BOX} material={std(color, extra)} position={at} scale={size} castShadow={cast} receiveShadow />;
}

function Car({ s }: { s: SceneSlot }) {
  const { deg } = bayAxis(s);
  const { L, W } = carSize(s);
  const color = bodyColor(s.occupant!.plate_number);
  const paint = { metalness: 0.45, roughness: 0.35 };
  return (
    <group position={[s.gx, PAVE, s.gy]} rotation-y={-THREE.MathUtils.degToRad(deg)}>
      {[[-0.3, -1], [0.3, -1], [-0.3, 1], [0.3, 1]].map(([u, side], i) => (
        <mesh key={i} geometry={WHEEL} material={std('#111827', { roughness: 0.9 })} position={[u * L, 1.25, side * (W / 2 - 0.5)]} scale={[1.25, 1.25, 1.1]} castShadow />
      ))}
      <Box size={[L, 2.6, W]} at={[0, 2.5, 0]} color={color} extra={paint} />
      <Box size={[L * 0.96, 0.5, W * 0.96]} at={[0, 1.15, 0]} color="#1F2937" />
      <Box size={[L * 0.54, 2.2, W * 0.86]} at={[-L * 0.06, 4.9, 0]} color="#1E293B" extra={{ metalness: 0.6, roughness: 0.15 }} />
      <Box size={[L * 0.4, 0.45, W * 0.78]} at={[-L * 0.06, 6.2, 0]} color={color} extra={paint} />
      {[-0.3, 0.3].map(v => (
        <React.Fragment key={v}>
          <Box size={[0.3, 0.7, W * 0.2]} at={[L / 2, 2.9, v * W]} color="#FEF3C7" extra={{ emissive: '#FEF3C7', emissiveIntensity: 0.6 }} cast={false} />
          <Box size={[0.3, 0.7, W * 0.2]} at={[-L / 2, 2.9, v * W]} color="#DC2626" extra={{ emissive: '#B91C1C', emissiveIntensity: 0.5 }} cast={false} />
        </React.Fragment>
      ))}
    </group>
  );
}

function Motorcycle({ s }: { s: SceneSlot }) {
  const { deg } = bayAxis(s);
  const { L, W } = motoSize(s);
  const color = bodyColor(s.occupant!.plate_number);
  return (
    <group position={[s.gx, PAVE, s.gy]} rotation-y={-THREE.MathUtils.degToRad(deg)}>
      {[-0.36, 0.36].map(u => (
        <mesh key={u} geometry={WHEEL} material={std('#111827', { roughness: 0.9 })} position={[u * L, 1.35, 0]} scale={[1.35, 1.35, W * 0.4]} castShadow />
      ))}
      <Box size={[L * 0.62, 1.6, W * 0.7]} at={[0, 2.5, 0]} color={color} extra={{ metalness: 0.4, roughness: 0.35 }} />
      <Box size={[L * 0.36, 0.7, W * 0.62]} at={[-L * 0.06, 3.65, 0]} color="#1F2937" />
      <Box size={[0.5, 0.4, W * 1.9]} at={[L * 0.28, 4.6, 0]} color="#475569" />
      <Box size={[0.5, 1.6, 0.5]} at={[L * 0.3, 3.8, 0]} color="#475569" />
    </group>
  );
}

/** Traffic cone at the far end of a slot under maintenance. */
function Cone({ s }: { s: SceneSlot }) {
  const { deg, long } = bayAxis(s);
  const [x, z] = offset([s.gx, s.gy], deg, -long * 0.3);
  return (
    <group position={[x, PAVE, z]}>
      <Box size={[3, 0.4, 3]} at={[0, 0.2, 0]} color="#EA580C" />
      <mesh geometry={CONE} material={std('#F97316')} position={[0, 2.4, 0]} scale={[1.25, 4, 1.25]} castShadow />
      <mesh geometry={CONE} material={std('#FFFFFF')} position={[0, 2.75, 0]} scale={[0.86, 1.1, 0.86]} />
    </group>
  );
}

function Tree({ at, r, base = 0 }: { at: Point; r: number; base?: number }) {
  const tint = ['#2F6B3A', '#3B7D45', '#356F3E'][Math.round(at[0] + at[1]) % 3];
  return (
    <group position={[at[0], base, at[1]]}>
      <mesh geometry={TRUNK} material={std('#6B4F2E')} position={[0, 2.2, 0]} scale={[1, 4.4, 1]} castShadow />
      <mesh geometry={CANOPY} material={std(tint, { flatShading: true, roughness: 0.85 })} position={[0, 4.4 + r * 0.8, 0]} scale={[r, r * 0.95, r]} castShadow receiveShadow />
      <mesh geometry={CANOPY} material={std('#4C9A55', { flatShading: true, roughness: 0.85 })} position={[-r * 0.3, 4.6 + r * 1.25, -r * 0.2]} scale={r * 0.55} castShadow />
    </group>
  );
}

function Shrub({ at, r, base }: { at: Point; r: number; base: number }) {
  return <mesh geometry={CANOPY} material={std('#3F8A49', { flatShading: true })} position={[at[0], base + r * 0.6, at[1]]} scale={[r, r * 0.7, r]} castShadow receiveShadow />;
}

/** A label that always faces the camera. `h` is its height in world units. */
function Billboard({ tex, at, h, order = 10 }: { tex: { map: THREE.Texture; aspect: number }; at: [number, number, number]; h: number; order?: number }) {
  return (
    <sprite position={at} scale={[h * tex.aspect, h, 1]} renderOrder={order}>
      <spriteMaterial map={tex.map} depthTest={false} transparent />
    </sprite>
  );
}

/** Text painted flat on the ground; `deg` rotates it on the ground. */
function GroundText({ text, at, h, deg = 0, color, opacity = 1 }: { text: string; at: Point; h: number; deg?: number; color?: string; opacity?: number }) {
  const tex = paintedText(text, color);
  return (
    <mesh geometry={PLANE} position={[at[0], PAINT + 0.02, at[1]]} rotation-y={-THREE.MathUtils.degToRad(deg)} scale={[h * tex.aspect, 1, h]} renderOrder={2}>
      <meshBasicMaterial map={tex.map} transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} toneMapped={false} />
    </mesh>
  );
}

/** Trees and shrubs scattered over the landscaped ground inside the site, clear of paving, pads, signs and the gate. */
function groveTrees(g: MapGeometry, trays: TrayPanel[]): { at: Point; r: number }[] {
  if (!g.site) return [];
  const site = g.site.polygon;
  const paved = [...(g.connector ? [g.connector.polygon] : []), ...g.areas.map(a => a.polygon), g.road.polygon, ...trays.map(t => t.footprint)];
  const box = bbox(site);
  const out: { at: Point; r: number }[] = [];
  for (let x = box.min.x; x < box.max.x; x += 19) {
    for (let y = box.min.y; y < box.max.y; y += 17) {
      const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      const p: Point = [x + (h - 0.5) * 8, y + ((h * 7) % 1 - 0.5) * 8];
      if (!pointIn(p, site) || edgeDistance(p, site) < 12) continue;
      if (paved.some(q => pointIn(p, q) || edgeDistance(p, q) < 9)) continue;
      if (Math.hypot(p[0] - g.gate.at[0], p[1] - g.gate.at[1]) < 34) continue;
      if (g.areas.some(a => a.sign_at && Math.hypot(p[0] - a.sign_at[0], p[1] - a.sign_at[1]) < 18)) continue;
      out.push({ at: p, r: 3.4 + h * 1.6 });
    }
  }
  return out;
}

function pointIn([x, y]: Point, points: Point[]) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function edgeDistance(p: Point, points: Point[]) {
  let best = Infinity;
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  });
  return best;
}

// ----------------------------------------------------------------- static site

const Site = memo(function Site({ g, trays, onGate, gateOnline }: { g: MapGeometry; trays: TrayPanel[]; onGate: (e: ThreeEvent<MouseEvent>) => void; gateOnline: boolean }) {
  const parts = useMemo(() => {
    const asphalt = noiseTexture('#30353E', ['#1F242B', '#454B55', '#3A4049'], 40);
    const grass = noiseTexture('#7FB262', ['#6A9C50', '#93C477', '#5E8E46'], 30);
    const paved = [...(g.connector ? [g.connector.polygon] : []), ...g.areas.map(a => a.polygon), g.road.polygon];

    const white = new Paint(PAINT);
    const faint = new Paint(PAINT);
    const yellow = new Paint(PAINT);
    const amber = new Paint(PAINT);
    const blue = new Paint(PAINT + 0.04);

    for (const l of g.lanes) {
      const pts = l.reverse ? [...l.points].reverse() : l.points;
      const end = pts[pts.length - 1];
      if (l.kind === 'to_area') {
        const tail = before(pts, 7);
        blue.dashed([...pts.slice(0, -1), tail], 1.5, 3, 2).poly(arrowShape(tail, end, 1.5, 5.5, 5.5));
        continue;
      }
      if (l.kind === 'lane') faint.dashed(pts, 0.6, 4, 3);
      white.poly(arrowShape(before(pts, 9), end));
      const len = Math.hypot(end[0] - pts[0][0], end[1] - pts[0][1]);
      if (l.kind === 'lane' && len > 60) {
        const mid: Point = [(pts[0][0] + end[0]) / 2, (pts[0][1] + end[1]) / 2];
        white.poly(arrowShape([mid[0] - ((end[0] - pts[0][0]) / len) * 9, mid[1] - ((end[1] - pts[0][1]) / len) * 9], mid));
      }
    }
    for (const a of g.areas) faint.dashed(a.polygon, 0.55, 5, 2.5, true);
    yellow.outline(g.road.polygon, 0.6);
    const [p0, p1, p2, p3] = g.road.polygon;
    yellow.dashed([offset([(p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2], g.gate.angle, 14), [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]], 0.55, 4, 3);
    white.poly(arrowShape(offset(g.gate.at, g.gate.angle, 10, -5.2), offset(g.gate.at, g.gate.angle, 24, -5.2), 1.5, 4.6, 4.6));
    for (const t of trays) amber.dashed(t.footprint, 0.6, 2, 1.4, true);

    return {
      asphalt, grass, paved,
      white: white.build(), faint: faint.build(), yellow: yellow.build(), amber: amber.build(), blue: blue.build(),
      site: g.site ? slab(g.site.polygon, -4, 0) : null,
      pavedGeo: paved.map(p => slab(p, -0.5, PAVE)),
      trayGeo: trays.map(t => slab(t.footprint, -0.5, PAVE)),
      islands: (g.islands ?? []).map(i => ({ geo: slab(i.polygon, PAVE, PAVE + 0.9), polygon: i.polygon })),
    };
  }, [g, trays]);

  const asphaltTop = useMemo(() => new THREE.MeshStandardMaterial({ map: parts.asphalt, roughness: 0.95, color: '#FFFFFF' }), [parts.asphalt]);
  const grassTop = useMemo(() => new THREE.MeshStandardMaterial({ map: parts.grass, roughness: 1 }), [parts.grass]);
  const curb = std('#C7CED8', { roughness: 0.9 });
  const soil = std('#5B7F43', { roughness: 1 });

  const trees = useMemo(() => [...plantTrees(g, trays), ...groveTrees(g, trays)], [g, trays]);
  const gateAt = g.gate.at, roadDeg = g.gate.angle;

  return (
    <group>
      {parts.site && <mesh geometry={parts.site} material={[grassTop, soil]} receiveShadow />}
      {parts.pavedGeo.map((geo, i) => <mesh key={i} geometry={geo} material={[asphaltTop, curb]} receiveShadow />)}
      {parts.trayGeo.map((geo, i) => <mesh key={`t${i}`} geometry={geo} material={[asphaltTop, curb]} receiveShadow />)}
      <mesh geometry={parts.white} material={paintMat('#F8FAFC', 0.95)} receiveShadow />
      <mesh geometry={parts.faint} material={paintMat('#F8FAFC', 0.5)} />
      <mesh geometry={parts.yellow} material={paintMat('#FACC15')} />
      <mesh geometry={parts.amber} material={paintMat('#F59E0B')} />
      <mesh geometry={parts.blue} material={paintMat('#2563EB')} />

      <GroundText text={g.road.label} at={g.road.label_at} h={5} deg={g.road.label_angle} />
      <GroundText text="IN" at={offset(gateAt, roadDeg, 31, -5.2)} h={3.6} deg={roadDeg} />
      <GroundText text="OUT" at={offset(gateAt, roadDeg, 14, 5.2)} h={3.6} deg={roadDeg} />

      {parts.islands.map((island, i) => {
        const c = island.polygon.reduce<Point>(([x, y], p) => [x + p[0] / island.polygon.length, y + p[1] / island.polygon.length], [0, 0]);
        return (
          <group key={`is${i}`}>
            <mesh geometry={island.geo} material={[grassTop, curb]} receiveShadow castShadow />
            {island.polygon.map((p, k) => {
              const q: Point = [p[0] + (c[0] - p[0]) * 0.45, p[1] + (c[1] - p[1]) * 0.45];
              return <Shrub key={k} at={q} r={2.3} base={PAVE + 0.9} />;
            })}
            <Tree at={[c[0], c[1] - 18]} r={4.4} base={PAVE + 0.9} />
            <Tree at={[c[0] + 4, c[1] + 18]} r={4} base={PAVE + 0.9} />
          </group>
        );
      })}

      {trees.map((t, i) => <Tree key={i} at={t.at} r={t.r} />)}
      {trees.filter((_, i) => i % 2 === 0).map((t, i) => (
        <Shrub key={`sh${i}`} at={[t.at[0] + 6, t.at[1] + 2]} r={1.8} base={0} />
      ))}

      <Gate g={g} onGate={onGate} online={gateOnline} />
    </group>
  );
});

/** The single shared Main Entrance / Exit: canopy, guard house, readers and a boom per lane. */
function Gate({ g, onGate, online }: { g: MapGeometry; onGate: (e: ThreeEvent<MouseEvent>) => void; online: boolean }) {
  const [x, z] = g.gate.at;
  const light = online ? '#22C55E' : '#F59E0B';
  return (
    <group position={[x, PAVE, z]} rotation-y={-THREE.MathUtils.degToRad(g.gate.angle)} onClick={onGate}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      {/* Guard house beside the north lane */}
      <Box size={[9, 9, 7.5]} at={[0, 4.5 - PAVE, -22]} color="#F1F5F9" />
      <Box size={[9.2, 2.4, 7.7]} at={[0, 6, -22]} color="#1E3A8A" extra={{ metalness: 0.5, roughness: 0.2 }} />
      <Box size={[11, 1.2, 9.5]} at={[0, 9.6 - PAVE, -22]} color="#080677" />
      {/* Median with RFID / QR readers */}
      <Box size={[16, 0.8, 2.4]} at={[2, 0.4, 0]} color="#E2E8F0" />
      {[-4, 6].map(u => (
        <group key={u}>
          <Box size={[1.4, 4.2, 1.4]} at={[u, 2.9, 0]} color="#1E3A8A" />
          <Box size={[1.5, 1.2, 1.5]} at={[u, 4.6, 0]} color="#2563EB" extra={{ emissive: '#1D4ED8', emissiveIntensity: 0.4 }} cast={false} />
        </group>
      ))}
      {/* Barriers: entry lane (north) and exit lane (south) */}
      {[[-1, -12.6, 1], [5, 12.6, -1]].map(([u, v, dir]) => (
        <group key={v}>
          <Box size={[2.4, 7, 2.4]} at={[u, 3.5, v]} color="#FACC15" />
          <mesh geometry={CANOPY} material={std(light, { emissive: light, emissiveIntensity: 1 })} position={[u, 7.3, v]} scale={0.7} />
          {Array.from({ length: 4 }, (_, k) => (
            <Box key={k} size={[0.8, 0.8, 2.65]} at={[u, 6.4, v + dir * (1.6 + 2.65 * k + 1.3)]} color={k % 2 ? '#FFFFFF' : '#DC2626'} />
          ))}
        </group>
      ))}
      {/* Canopy */}
      {[[-5, -15], [9, -15], [-5, 15], [9, 15]].map(([u, v]) => (
        <Box key={`${u}${v}`} size={[1.4, 15, 1.4]} at={[u, 7.5, v]} color="#CBD5E1" />
      ))}
      <Box size={[17, 0.8, 34]} at={[2, 16, 0]} color="#F1F5F9" extra={{ metalness: 0.2, roughness: 0.5 }} />
      <Box size={[17.6, 1.4, 34.6]} at={[2, 15, 0]} color="#1E3A8A" />
    </group>
  );
}

// ----------------------------------------------------------------- live slots

function Stall({ s, selected, onSelect }: { s: SceneSlot; selected: boolean; onSelect: (s: MapSlot, e: ThreeEvent<MouseEvent>) => void }) {
  const geo = useMemo(() => flat(rect(s.gx, s.gy, s.gw - 0.9, s.gh - 0.9, s.rot), TINT), [s.gx, s.gy, s.gw, s.gh, s.rot]);
  const st = STATUS[s.status];
  return (
    <mesh geometry={geo} receiveShadow onClick={e => onSelect(s, e)} name={slotLabel(s)}
      onPointerOver={e => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}>
      <meshStandardMaterial color={selected ? '#FACC15' : st.color} transparent opacity={selected ? 0.85 : st.opacity} roughness={0.85}
        polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} depthWrite={false} />
    </mesh>
  );
}

const Slots = memo(function Slots({ slots, extra, selectedId, closeUp, onSelect }: {
  slots: SceneSlot[];
  extra: MapData['extra_bays'];
  selectedId: number | null;
  closeUp: boolean;
  onSelect: (s: MapSlot, e: ThreeEvent<MouseEvent>) => void;
}) {
  // Stall lines, unconfirmed-location dashes, and painted stalls that are not PASS slots.
  const lines = useMemo(() => {
    const white = new Paint(PAINT);
    const faint = new Paint(PAINT);
    for (const s of slots) {
      white.outline(rect(s.gx, s.gy, s.gw, s.gh, s.rot), 0.5);
      if (s.status === 'occupied' && !s.occupant?.confirmed) white.dashed(rect(s.gx, s.gy, s.gw - 2.2, s.gh - 2.2, s.rot), 0.45, 1.4, 1, true);
    }
    for (const b of extra) {
      const r = rect(b.x, b.y, b.w, b.h, b.rotation);
      faint.outline(r, 0.45);
      if (b.kind === 'aisle') for (let k = 1; k < 6; k++) faint.line(r[0], [r[2][0] + (r[1][0] - r[2][0]) * (k / 6), r[2][1] + (r[1][1] - r[2][1]) * (k / 6)], 0.35);
    }
    return { white: white.build(), faint: faint.build() };
  }, [slots, extra]);

  return (
    <group>
      <mesh geometry={lines.white} material={paintMat('#FFFFFF')} />
      <mesh geometry={lines.faint} material={paintMat('#FFFFFF', 0.4)} />
      {slots.map(s => <Stall key={s.slot_id} s={s} selected={selectedId === s.slot_id} onSelect={onSelect} />)}

      {slots.map(s => {
        const label = slotNumber(s.slot_code);
        const short = Math.min(s.gw, s.gh);
        const h = Math.max(3, Math.min(s.area_code === 'MC' ? 4.4 : 6, short * 0.55));
        if (s.occupant) {
          const top = isMotorcycle(s) ? 7 : 9.5;
          const tex = badge(closeUp ? [label, s.occupant.plate_number] : [label], '#DC2626', { size: 30 });
          return <Billboard key={`n${s.slot_id}`} tex={tex} at={[s.gx, PAVE + top + h * 0.7, s.gy]} h={closeUp ? h * 1.6 : h * 1.15} />;
        }
        return (
          <React.Fragment key={`n${s.slot_id}`}>
            <GroundText text={label} at={s.accessible ? [s.gx, s.gy - h * 0.55] : [s.gx, s.gy]} h={h} />
            {s.accessible && (
              <GroundText text="♿" at={[s.gx, s.gy + h * 0.6]} h={h * 0.95} color="#BFDBFE" />
            )}
          </React.Fragment>
        );
      })}

      {slots.filter(s => s.incident).map(s => (
        <Billboard key={`i${s.slot_id}`} tex={badge(['!'], '#F59E0B', { size: 30 })} at={[s.gx + 4, PAVE + (s.occupant ? 16 : 7), s.gy]} h={3.6} order={11} />
      ))}

      {slots.map(s => (
        s.occupant
          ? <group key={`v${s.slot_id}`} onClick={e => onSelect(s, e)}>{isMotorcycle(s) ? <Motorcycle s={s} /> : <Car s={s} />}</group>
          : s.status === 'maintenance' ? <group key={`c${s.slot_id}`} onClick={e => onSelect(s, e)}><Cone s={s} /></group> : null
      ))}
    </group>
  );
});

/** Pulsing ring and bouncing pin on the highlighted slot; rings on recently changed slots. */
function Markers({ slots, highlight, recent }: { slots: SceneSlot[]; highlight: string | null; recent: Set<number> }) {
  const marked = slots.filter(s => s.slot_code === highlight || recent.has(s.slot_id));
  const rings = useMemo(() => marked.map(s => ({ s, geo: new Paint(PAINT + 0.1).outline(rect(s.gx, s.gy, s.gw + 3, s.gh + 3, s.rot), 1.1).build() })), [marked.map(s => s.slot_id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const pin = useMemo(() => canvasTexture('pin', 64, 80, ctx => {
    ctx.beginPath();
    ctx.moveTo(32, 78);
    ctx.bezierCurveTo(8, 50, 4, 38, 4, 30);
    ctx.arc(32, 30, 28, Math.PI, 0);
    ctx.bezierCurveTo(60, 38, 56, 50, 32, 78);
    ctx.fillStyle = '#2563EB';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(32, 30, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }), []);
  const group = useRef<THREE.Group>(null);
  const pinRef = useRef<THREE.Sprite>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    group.current?.children.forEach(c => {
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (m) m.opacity = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.6));
    });
    if (pinRef.current) pinRef.current.position.y = pinRef.current.userData.base + Math.abs(Math.sin(t * 2.2)) * 3;
  });

  const hl = slots.find(s => s.slot_code === highlight);
  return (
    <>
      <group ref={group}>
        {rings.map(({ s, geo }) => (
          <mesh key={s.slot_id} geometry={geo} renderOrder={3}>
            <meshBasicMaterial color={s.slot_code === highlight ? '#38BDF8' : '#FFFFFF'} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      {hl && (
        <sprite ref={pinRef} position={[hl.gx, 0, hl.gy]} userData={{ base: PAVE + (hl.occupant ? 22 : 12) }} scale={[8, 10, 1]} renderOrder={12}>
          <spriteMaterial map={pin.map} depthTest={false} transparent />
        </sprite>
      )}
    </>
  );
}

/** Area signs, gate sign, route and tray labels. */
function Signs({ g, areas, trays }: { g: MapGeometry; areas: { area_code: string; capacity: number; available: number }[]; trays: TrayPanel[] }) {
  return (
    <>
      {g.areas.map(a => {
        const at = a.sign_at ?? a.label_at;
        const st = areas.find(x => x.area_code === a.area);
        const title = a.area === 'MC' ? 'MOTORCYCLE PARKING' : a.area === 'CAR' ? 'CAR PARKING' : a.label;
        const tex = badge([title, st ? `${st.capacity} SLOTS · ${st.available} AVAILABLE` : ''], '#1D4ED8', { icon: 'P', size: 30 });
        return (
          <group key={a.area}>
            <Box size={[0.9, 12, 0.9]} at={[at[0], 6, at[1]]} color="#64748B" />
            <Billboard tex={tex} at={[at[0], 19, at[1]]} h={15} />
          </group>
        );
      })}
      <Billboard tex={badge([g.gate.label, 'Shared gate · RFID / Visitor QR'], '#080677', { size: 30 })} at={[g.gate.at[0] + 14, 36, g.gate.at[1] - 12]} h={17} />
      {g.lanes.filter(l => l.kind === 'to_area' && l.label && l.label_at).map((l, i) => (
        <Billboard key={i} tex={badge([l.label!], '#2563EB', { size: 26 })} at={[l.label_at![0], 6, l.label_at![1]]} h={6} />
      ))}
      {trays.map(t => (
        <Billboard key={t.area} tex={badge([`${t.title} · ${t.codes}`, t.note], '#FFFFFF', { fg: '#B45309', sub: '#64748B', border: '#F59E0B', size: 24 })}
          at={[(t.footprint[0][0] + t.footprint[1][0]) / 2, 9, t.footprint[0][1] - 2]} h={9} />
      ))}
    </>
  );
}

// ----------------------------------------------------------------- camera

export interface CameraApi { zoom: (f: number) => void; reset: () => void; focus: (box: THREE.Box2, minDistance?: number) => void }

function bbox(points: Point[]) {
  return new THREE.Box2().setFromPoints(points.map(([x, y]) => new THREE.Vector2(x, y)));
}

const CameraRig = React.forwardRef<CameraApi, { home: THREE.Box2; onCloseUp: (close: boolean) => void }>(function CameraRig({ home, onCloseUp }, ref) {
  const { camera, gl, size, invalidate } = useThree();
  const controls = useRef<MapControls | null>(null);
  const closeRef = useRef(false);

  const place = useCallback((target: THREE.Vector3, distance: number) => {
    const c = controls.current;
    if (!c) return;
    c.target.copy(target);
    camera.position.copy(target).addScaledVector(VIEW_DIR, distance);
    camera.lookAt(target);
    c.update();
    invalidate();
  }, [camera, invalidate]);

  /** Frame a ground box: project its corners through the real camera and refine. */
  const focus = useCallback((box: THREE.Box2, minDistance = 60) => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.aspect = size.width / Math.max(1, size.height);
    cam.updateProjectionMatrix();
    const centre = box.getCenter(new THREE.Vector2());
    const target = new THREE.Vector3(centre.x, 0, centre.y);
    const corners = [[box.min.x, box.min.y], [box.max.x, box.min.y], [box.max.x, box.max.y], [box.min.x, box.max.y]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    let distance = Math.max(minDistance, (box.max.x - box.min.x) / (2 * t * cam.aspect));
    for (let i = 0; i < 12; i++) {
      cam.position.copy(target).addScaledVector(VIEW_DIR, distance);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      const ndc = corners.map(p => p.clone().project(cam));
      const xs = ndc.map(p => p.x), ys = ndc.map(p => p.y);
      // Re-centre on the projected extent, then scale the distance to fill 97% of the view.
      const ox = (Math.max(...xs) + Math.min(...xs)) / 2, oy = (Math.max(...ys) + Math.min(...ys)) / 2;
      const spread = Math.max((Math.max(...xs) - Math.min(...xs)) / 2, (Math.max(...ys) - Math.min(...ys)) / 2);
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const forward = new THREE.Vector3(0, 0, -1);
      const halfW = distance * t * cam.aspect, halfH = distance * t;
      target.addScaledVector(right, ox * halfW).addScaledVector(forward, (oy * halfH) / Math.sin(ELEVATION));
      distance = Math.max(minDistance, distance * (spread / 0.97));
    }
    place(target, distance);
  }, [camera, place, size.width, size.height]);
  const reset = useCallback(() => focus(home), [focus, home]);

  useImperativeHandle(ref, () => ({
    zoom: f => {
      const c = controls.current;
      if (!c) return;
      const dist = camera.position.distanceTo(c.target) / f;
      place(c.target.clone(), THREE.MathUtils.clamp(dist, c.minDistance, c.maxDistance));
    },
    reset,
    focus,
  }), [camera, place, reset, focus]);

  useEffect(() => {
    const c = new MapControls(camera, gl.domElement);
    c.enableRotate = false;
    c.screenSpacePanning = false;
    c.enableDamping = true;
    c.dampingFactor = 0.14;
    c.zoomToCursor = true;
    c.minDistance = 45;
    c.maxDistance = 2200;
    const onChange = () => {
      invalidate();
      const close = camera.position.distanceTo(c.target) < 260;
      if (close !== closeRef.current) { closeRef.current = close; onCloseUp(close); }
    };
    c.addEventListener('change', onChange);
    controls.current = c;
    return () => { c.removeEventListener('change', onChange); c.dispose(); controls.current = null; };
  }, [camera, gl, invalidate, onCloseUp]);

  // Frame the whole site once the canvas has its real size, and when it changes.
  useEffect(() => { if (size.width > 0 && size.height > 0) reset(); }, [reset, size.width, size.height]);

  useFrame(() => controls.current?.update());
  return null;
});

// ----------------------------------------------------------------- component

class WebGLBoundary extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

type Props = {
  data: MapData & { areas?: { area_code: string; capacity: number; available: number }[] };
  highlight: string | null;
  selectedId: number | null;
  recent: Set<number>;
  gateOnline: boolean;
  onSelect: (slot: MapSlot) => void;
  onGate: () => void;
  focusArea: { code: string; key: number } | null;
};

export default function ParkingLot3D(props: Props) {
  const [supported] = useState(webglAvailable);
  const fallback = (
    <div className="space-y-2">
      <p className="text-xs text-amber-700">3D rendering (WebGL) is not available in this browser, so a simplified view is shown.</p>
      <ParkingScene3D {...props} />
    </div>
  );
  if (!supported) return fallback;
  return <WebGLBoundary fallback={fallback}><Lot {...props} /></WebGLBoundary>;
}

function Lot({ data, highlight, selectedId, recent, gateOnline, onSelect, onGate, focusArea }: Props) {
  // Static geometry only changes when the layout itself changes, not on every poll.
  const geometryKey = JSON.stringify(data.geometry);
  const g = useMemo(() => data.geometry, [geometryKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { slots, trays } = useMemo(() => layoutSlots(data), [data]);
  const stableTrays = useMemo(() => trays, [JSON.stringify(trays)]); // eslint-disable-line react-hooks/exhaustive-deps
  const [closeUp, setCloseUp] = useState(false);
  const rig = useRef<CameraApi>(null);

  // Default framing: the paved areas, road and slot pads (the planted border may crop slightly).
  const home = useMemo(() => bbox([...g.areas.flatMap(a => a.polygon), ...g.road.polygon, ...stableTrays.flatMap(t => t.footprint), g.gate.at]).expandByScalar(6), [g, stableTrays]);
  const areaBox = useCallback((code: string) => {
    const a = g.areas.find(x => x.area === code);
    const t = stableTrays.find(x => x.area === code);
    return a ? bbox([...a.polygon, ...(code === 'MC' && t ? t.footprint : [])]) : home;
  }, [g, stableTrays, home]);

  useEffect(() => {
    if (!focusArea) return;
    if (focusArea.code === 'ALL') rig.current?.reset();
    else rig.current?.focus(areaBox(focusArea.code).expandByScalar(8));
  }, [focusArea, areaBox]);

  useEffect(() => {
    const s = slots.find(x => x.slot_code === highlight);
    if (s) rig.current?.focus(new THREE.Box2(new THREE.Vector2(s.gx - 60, s.gy - 40), new THREE.Vector2(s.gx + 60, s.gy + 40)), 140);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);

  const onSelectRef = useRef(onSelect);
  const onGateRef = useRef(onGate);
  onSelectRef.current = onSelect;
  onGateRef.current = onGate;
  // Ignore the click that ends a drag.
  const select = useCallback((s: MapSlot, e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta <= 5) onSelectRef.current(s); }, []);
  const gate = useCallback((e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta <= 5) onGateRef.current(); }, []);

  // Animate (render every frame) only briefly: the highlight pin bounces for 15 s,
  // changed slots flash while marked. Otherwise frames are drawn on demand.
  const [highlightFresh, setHighlightFresh] = useState(false);
  useEffect(() => {
    if (!highlight) return;
    setHighlightFresh(true);
    const timer = setTimeout(() => setHighlightFresh(false), 15000);
    return () => clearTimeout(timer);
  }, [highlight]);
  const animate = (!!highlight && highlightFresh) || recent.size > 0;
  const center = home.getCenter(new THREE.Vector2());
  const sun = useMemo(() => {
    const light = new THREE.DirectionalLight('#FFF7E8', 2.4);
    light.position.set(center.x - 260, 520, center.y - 300);
    light.target.position.set(center.x, 0, center.y);
    light.castShadow = true;
    light.shadow.mapSize.set(4096, 4096);
    Object.assign(light.shadow.camera, { left: -460, right: 460, top: 460, bottom: -460, near: 50, far: 1600 });
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.6;
    light.shadow.radius = 3;
    return light;
  }, [center.x, center.y]);

  return (
    <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-gradient-to-b from-[#E6EDF5] to-[#D9E2EC]">
      <ZoomControls onZoomIn={() => rig.current?.zoom(1.4)} onZoomOut={() => rig.current?.zoom(1 / 1.4)} onReset={() => rig.current?.reset()} />
      {/* The lot is wide; size the view to it so the default framing fills the frame. */}
      <div className="w-full min-h-[360px] max-h-[680px]" style={{ aspectRatio: '2.45 / 1' }}>
      <Canvas
        className="cursor-grab active:cursor-grabbing"
        shadows="percentage"
        dpr={[1, 2]}
        frameloop={animate ? 'always' : 'demand'}
        camera={{ fov: FOV, near: 4, far: 6000, position: [center.x, 700, center.y + 500] }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
        aria-label="3D view of the DYCI parking layout. Drag to pan, scroll or pinch to zoom, select a slot for details."
        role="application"
      >
        <hemisphereLight args={['#F1F5FF', '#5B7F43', 0.9]} />
        <ambientLight intensity={0.25} />
        <primitive object={sun} />
        <primitive object={sun.target} />
        <CameraRig ref={rig} home={home} onCloseUp={setCloseUp} />
        <Site g={g} trays={stableTrays} onGate={gate} gateOnline={gateOnline} />
        <Slots slots={slots} extra={data.extra_bays} selectedId={selectedId} closeUp={closeUp} onSelect={select} />
        <Signs g={g} areas={data.areas ?? []} trays={stableTrays} />
        <Markers slots={slots} highlight={highlight} recent={recent} />
      </Canvas>
      </div>
    </div>
  );
}
