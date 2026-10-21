import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Badge, Button, Modal } from '../../components/ui';
import { apiRequest } from '../../lib/apiClient';
import { formatCampusDateTime } from '../../lib/datetime';
type Row = { transaction_id: number; ticket_number: string; plate_number: string; vehicle_type: string; parking_area: string; slot_code: string; entry_datetime: string; exit_datetime: string | null; duration_minutes: number | null; access_method: string; status: string };
export default function ParkingHistory() {
  const [rows, setRows] = useState<Row[]>([]), [selected, setSelected] = useState<Row | null>(null), [search, setSearch] = useState(''), [date, setDate] = useState(''), [page, setPage] = useState(1), [last, setLast] = useState(1), [total, setTotal] = useState(0), [busy, setBusy] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError('');
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ page: String(page), search }); if (date) { query.set('from', date); query.set('to', date); }
      apiRequest<{ data: Row[]; meta: { last_page: number; total: number } }>('/api/parking/history?' + query, { signal: controller.signal }).then(r => { setRows(r.data); setLast(r.meta.last_page); setTotal(r.meta.total); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, date, revision]);
  return <div className="max-w-4xl space-y-4 animate-fadein"><PageHeader title="My Parking History" subtitle="Your recorded entries, exits and parking sessions" />
    <Card><div className="p-4 flex flex-col sm:flex-row gap-3"><input aria-label="Search parking history" type="search" placeholder="Plate or transaction number" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="min-w-0 flex-1 border border-slate-200 p-3 rounded-xl text-sm" /><input aria-label="Entry date" type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} className="min-w-0 border border-slate-200 p-3 rounded-xl text-sm" /></div>
      {error ? <div role="alert" className="p-5 text-sm text-red-700">{error}<Button variant="outline" onClick={() => setRevision(v => v + 1)}>Retry</Button></div> : busy ? <p role="status" className="p-5 text-sm">Loading records…</p> : rows.length ? <div className="divide-y divide-slate-100">{rows.map(row => <button key={row.transaction_id} onClick={() => setSelected(row)} className="w-full p-4 flex flex-col sm:flex-row sm:items-center gap-2 text-left hover:bg-blue-50/50"><div className="flex-1 min-w-0"><span className="font-bold text-[#080677]">{row.plate_number}</span><p className="text-xs text-slate-500 mt-1 break-words">{formatCampusDateTime(row.entry_datetime)} · {row.parking_area} · {row.slot_code}</p></div><Badge variant={row.status === 'active' ? 'info' : 'success'}>{row.status}</Badge></button>)}</div> : <p className="p-8 text-center text-sm text-slate-500">No matching parking records.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm"><span>{total} records · Page {page} of {last}</span><div className="flex gap-2"><Button variant="outline" disabled={busy || page <= 1} onClick={() => setPage(v => v - 1)}>Previous</Button><Button variant="outline" disabled={busy || page >= last} onClick={() => setPage(v => v + 1)}>Next</Button></div></div>
    </Card><Modal open={!!selected} onClose={() => setSelected(null)} title="Transaction Details" size="sm">{selected && <dl className="space-y-3 text-sm">{[['Transaction', selected.ticket_number], ['Plate', selected.plate_number], ['Entry', formatCampusDateTime(selected.entry_datetime)], ['Exit', selected.exit_datetime ? formatCampusDateTime(selected.exit_datetime) : 'Ongoing'], ['Duration', selected.duration_minutes == null ? 'Ongoing' : selected.duration_minutes + ' min'], ['Slot', selected.slot_code], ['Access', selected.access_method]].map(([k, v]) => <div key={k} className="flex flex-col gap-1"><dt className="text-slate-500">{k}</dt><dd className="font-medium break-words">{v}</dd></div>)}</dl>}</Modal>
  </div>;
}
