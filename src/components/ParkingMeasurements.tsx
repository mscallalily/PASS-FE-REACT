import React from 'react';
import { ExternalLink, Ruler } from 'lucide-react';
import type { MapGeometry } from './ParkingMap';

function BayTemplate({ width, length, label }: { width: number; length: number; label: string }) {
  const scale = 20;
  const x = 47, y = 34, w = width * scale, h = length * scale;
  return <svg viewBox="0 0 180 178" className="w-full h-40" role="img" aria-label={`${label}: ${width.toFixed(2)} metres wide by ${length.toFixed(2)} metres long`}>
    <rect x={x} y={y} width={w} height={h} rx={3} fill="#EFF6FF" stroke="#080677" strokeWidth={1.4} />
    <path d={`M${x} 23H${x+w} M${x} 18V28 M${x+w} 18V28 M${x-13} ${y}V${y+h} M${x-18} ${y}H${x-8} M${x-18} ${y+h}H${x-8}`} stroke="#2563EB" strokeWidth={1} fill="none" />
    <text x={x+w/2} y={15} textAnchor="middle" fontSize={10} fill="#080677">{width.toFixed(2)} m</text>
    <text transform={`translate(20 ${y+h/2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="#080677">{length.toFixed(2)} m</text>
    <text x={x+w/2} y={y+h+18} textAnchor="middle" fontSize={9} fill="#64748B">Width × length</text>
  </svg>;
}

export default function ParkingMeasurements({ geometry }: { geometry: MapGeometry }) {
  const basis = geometry.measurement_basis;
  if (!basis) return null;
  const diagram = basis.scale === 'slot_diagram';
  return <details className="rounded-xl border border-slate-200 bg-white p-4 min-w-0">
    <summary className="cursor-pointer text-sm font-semibold text-[#080677] flex items-center gap-2"><Ruler size={16} />Measurements & design basis</summary>
    <div className="space-y-5 mt-4">
      <p className="text-sm text-slate-600">{basis.note}</p>
      {basis.inventory && <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><h3 className="text-sm font-bold text-[#080677]">Motorcycle proposal</h3><p className="my-2 text-2xl font-bold text-[#080677]">{basis.inventory.motorcycle_drawn} compact bays</p><p className="text-xs leading-relaxed text-slate-600">{basis.motorcycle_proposal}</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-bold text-amber-900">{diagram ? 'Complete car slot map' : 'Car fit still under review'}</h3><p className="my-2 text-2xl font-bold text-amber-900">{basis.inventory.car_drawn} {diagram ? 'mapped' : 'drawn'} / {basis.inventory.car_configured} configured</p><p className="text-xs leading-relaxed text-amber-900">{basis.car_proposal}</p></div>
      </div>}
      <div className="grid gap-3 sm:grid-cols-3">
        {basis.standards.map(standard => <div key={standard.type} className="min-w-0 rounded-xl border border-blue-100 bg-slate-50 p-3">
          <h3 className="text-xs font-bold text-[#080677]">{standard.label}</h3>
          <BayTemplate width={standard.width_m} length={standard.length_m} label={standard.label} />
          <p className="text-center font-bold text-sm text-[#080677]">{standard.width_m.toFixed(2)} × {standard.length_m.toFixed(2)} m</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{standard.basis}</p>
          <a href={standard.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-start gap-1 text-xs text-[#2563EB] underline break-words"><ExternalLink size={12} className="shrink-0 mt-0.5" />{standard.source}</a>
        </div>)}
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <p>{basis.pathway_note}</p>
        <p className="mt-2">Bay dimensions do not establish the required total number of accessible spaces, accessible routes, drainage, slope or turning clearance. Confirm these against the applicable rules and the campus plan before physical marking.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="min-w-0 space-y-4">
          <figure><a href={basis.source_image} target="_blank" rel="noopener noreferrer"><img src={basis.source_image} alt="Owner-supplied motorcycle parcel and separate access road" className="w-full rounded-xl border border-slate-200" loading="lazy" /></a><figcaption className="mt-2 text-xs text-slate-500">Motorcycle reference. Use the owner-reported 30.96 × 8.80 m parcel and separate 3.06 m road width. Intermediate ruler marks in this image are cumulative distances.</figcaption></figure>
          {basis.car_source_image && <figure><a href={basis.car_source_image} target="_blank" rel="noopener noreferrer"><img src={basis.car_source_image} alt="Owner-supplied irregular car parking boundary" className="w-full rounded-xl border border-slate-200" loading="lazy" /></a><figcaption className="mt-2 text-xs text-slate-500">Car reference. Boundary angles are estimated for this proposal; campus confirmation is pending.</figcaption></figure>}
        </div>
        <div className="min-w-0 space-y-5">
          <div><h3 className="text-sm font-semibold text-[#080677] mb-2">Owner-reported dimensions</h3><div className="space-y-2">{geometry.dimensions.filter(d => !d.id?.startsWith('C')).map(dimension => <div key={dimension.id} className="flex flex-wrap justify-between gap-2 text-xs border-b border-slate-100 pb-2"><span className="text-slate-600">{dimension.description}</span><span className="font-semibold text-slate-800">{dimension.text}</span></div>)}</div></div>
          {!!basis.car_edges_m?.length && <div><h3 className="text-sm font-semibold text-[#080677] mb-2">Car boundary · supplied sequence</h3><p className="text-xs text-slate-500 mb-3">C1 starts at the right edge, continuing around the notch and back along C8. This mapping is assumed from the image, not a survey.</p><div className="grid grid-cols-2 gap-x-4 gap-y-2">{basis.car_edges_m.map((length, index) => <div key={index} className="flex justify-between gap-2 text-xs border-b border-slate-100 pb-2"><span className="text-slate-600">C{index+1}</span><strong className="text-slate-800">{length.toFixed(2)} m</strong></div>)}</div></div>}
          <p className="text-xs leading-relaxed text-slate-600">{diagram ? 'The complete slot map uses schematic car symbols. Reference dimensions below are physical design references; they do not describe the symbol size. The Measured proposal view uses one scale for parcels, bays and aisles.' : 'The measured proposal uses the same scale for every parcel, bay and aisle. The retained inventory is not a certified physical capacity.'} Follow campus parking directions until the layout is checked on site.</p>
        </div>
      </div>
    </div>
  </details>;
}
