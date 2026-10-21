import React, { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { formatCampusDateTime } from '../lib/datetime';
import ParkingMap, { type MapData } from './ParkingMap';
import { Button, Modal } from './ui';

type Layout = MapData & { title: string; generated_at: string };
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function save(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function svgFor(data: Layout) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(<ParkingMap data={data} onSelect={() => {}} showMeasurements />);
  const parsed = new DOMParser().parseFromString(markup, 'text/html'), svg = parsed.querySelector('svg[role="application"]');
  if (!svg) throw new Error('The layout could not be prepared.');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.setAttribute('width', '1590'); svg.setAttribute('height', '850');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'DYCI PASS parking layout with numbered bays and measurements');
  svg.removeAttribute('class'); svg.removeAttribute('style');
  // Neutral printed outlines cannot be mistaken for live slot availability.
  svg.querySelectorAll('[tabindex]').forEach(el => el.removeAttribute('tabindex'));
  svg.querySelectorAll('rect.slot').forEach(el => { el.setAttribute('fill', '#EFF6FF'); el.setAttribute('stroke', '#080677'); });
  svg.querySelectorAll('g[role="button"] text').forEach(el => el.setAttribute('fill', '#080677'));
  return new XMLSerializer().serializeToString(svg);
}
export default function ParkingLayoutExport() {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [data, setData] = useState<Layout | null>(null), [svg, setSvg] = useState('');
  const prepare = async () => {
    setOpen(true); setBusy(true); setError(''); setData(null); setSvg('');
    try { const d = await apiRequest<Layout>('/api/admin/parking-layout/export'); const s = await svgFor(d); setData(d); setSvg(s); }
    catch (e) { setError(e instanceof Error ? e.message : 'The layout could not be prepared.'); }
    finally { setBusy(false); }
  };
  const print = () => {
    if (!data || !svg) return;
    const w = window.open('', '_blank'); if (!w) { setError('Allow this site to open the print window, then try again.'); return; }
    const placed = data.slots.filter(s => s.placed), unmapped = data.slots.filter(s => !s.placed);
    const counts = ['CAR', 'MC'].map(code => `${placed.filter(s => s.area_code === code).length} ${code === 'CAR' ? 'car' : 'motorcycle'} bays`).join(' · ');
    const groups = [{ label: 'Car bays', codes: placed.filter(s => s.area_code === 'CAR').map(s => s.slot_code), size: '2.50 × 5.00 m' }, { label: 'Motorcycle bays', codes: placed.filter(s => s.area_code === 'MC').map(s => s.slot_code), size: '1.00 × 2.00 m' }];
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>PASS Parking Layout</title><style>@page{size:A3 landscape;margin:12mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#0f172a;margin:0}h1{color:#080677;font-size:22px;margin:0 0 6px}.meta{color:#475569;margin:6px 0 12px}.actions{display:flex;gap:8px;margin:14px 0}button{padding:12px 18px;border:1px solid #080677;border-radius:6px;background:#080677;color:white;cursor:pointer}.map svg{width:100%;height:auto;max-height:205mm;display:block}.note{font-size:11px;line-height:1.5;color:#475569}.schedule{break-before:page;padding-top:4mm}table{border-collapse:collapse;width:100%;margin:14px 0}th,td{padding:9px;border:1px solid #cbd5e1;text-align:left}td{word-break:break-word}tr{break-inside:avoid}@media print{.actions{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="actions"><button onclick="window.print()">Print / Save as PDF</button><button onclick="window.close()">Close</button></div><h1>${escape(data.title)}</h1><p class="meta">${escape(counts)} · Generated ${escape(formatCampusDateTime(data.generated_at))}</p><div class="map">${svg}</div><p class="note">Proposed layout · dimensions in metres · shared entry/exit 3.06 m · car access aisles 4.50 m. Slot labels and geometry match the application. Layout only: no live occupancy or personal information is included. Car slot prefix: C-; motorcycle prefix: M-. Boundary C1–C6 markers are measurements, not slot IDs. Boundary bearings and vehicle turning clearance require campus confirmation before physical marking. Print size A3 landscape; browser scaling does not establish a survey scale.</p><section class="schedule"><h1>Bay measurements & numbering</h1><p class="meta">${escape(data.title)} · ${escape(formatCampusDateTime(data.generated_at))}</p><table><thead><tr><th>Area</th><th>Slot numbers</th><th>Clear bay width × length</th></tr></thead><tbody>${groups.map(g => `<tr><th>${escape(g.label)}</th><td>${escape(g.codes.join(', '))}</td><td>${escape(g.size)}</td></tr>`).join('')}</tbody></table><p class="note">Configured inventory: ${data.slots.length}. Mapped bays: ${placed.length}. ${unmapped.length ? `Retained without a proposed physical position: ${escape(unmapped.map(s => s.slot_code).join(', '))}. These records are not drawn as extra parking spaces.` : ''}</p><table><thead><tr><th>Car boundary</th><th>Reported length</th></tr></thead><tbody>${(data.geometry.measurement_basis?.car_edges_m || []).map((n, i) => `<tr><td>C${i + 1}</td><td>${n.toFixed(2)} m</td></tr>`).join('')}</tbody></table><p class="note">Motorcycle parcel: 30.96 × 8.80 m. Independent bay proposal; no tandem parking. Coordinate ordering changes do not rename transaction records or change configured capacity.</p></section></body></html>`);
    w.document.close(); w.opener = null; w.focus();
  };
  return <><Button size="sm" variant="outline" onClick={prepare}><Printer size={15} />Export / Print layout</Button><Modal open={open} onClose={() => setOpen(false)} title="Export Parking Layout" size="xl"><div className="space-y-4"><p className="text-sm text-slate-600">Full plan with slot numbers and measurements. Download a vector SVG or open the A3 print layout and choose Save as PDF.</p>{busy && <p role="status" className="text-sm text-slate-500">Preparing layout…</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{svg && <img alt="Print preview of the complete parking layout" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} className="w-full rounded-xl border border-slate-200 bg-slate-50" />}<div className="flex flex-wrap gap-3"><Button disabled={!svg || busy} onClick={print}><Printer size={15} />Print / Save as PDF</Button><Button disabled={!svg || busy} variant="outline" onClick={() => save(svg, 'PASS-parking-layout.svg', 'image/svg+xml;charset=utf-8')}><Download size={15} />Download SVG</Button>{error && <Button variant="outline" disabled={busy} onClick={prepare}>Retry</Button>}</div></div></Modal></>;
}
