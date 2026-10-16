import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, Card, Button, Input, StatCard } from '../../components/ui';
import { apiRequest } from '../../lib/apiClient';
import { formatCampusDateTime } from '../../lib/datetime';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download, Printer, Calendar, RefreshCw } from 'lucide-react';

type Event = { event_id: number; event_datetime: string; direction: string; access_method: string; auth_result: string; plate_number?: string | null; denial_reason?: string | null };
type Vehicle = { vehicle_id: number; vehicle_type: string };
function campusDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (key: string) => parts.find(p => p.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export default function Reports() {
  const today = campusDay(new Date().toISOString());
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState(today);
  const [range, setRange] = useState({ from: today, until: today });
  const [events, setEvents] = useState<Event[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeError, setRangeError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [activity, registrations] = await Promise.all([
        apiRequest<{ data: Event[] }>('/api/access-events?limit=500'),
        apiRequest<{ data: Vehicle[] }>('/api/vehicles/authorizations'),
      ]);
      if (!Array.isArray(activity.data) || !Array.isArray(registrations.data)) throw new Error('The server returned an unexpected report format.');
      setEvents(activity.data); setVehicles(registrations.data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load reports.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => events.filter(event => {
    const day = campusDay(event.event_datetime); return day >= range.from && day <= range.until;
  }), [events, range]);
  const entries = filtered.filter(e => e.direction === 'in' && e.auth_result === 'granted').length;
  const exits = filtered.filter(e => e.direction === 'out' && e.auth_result === 'granted').length;
  const denied = filtered.filter(e => e.auth_result === 'denied').length;
  const daily = Array.from(new Set(filtered.map(e => campusDay(e.event_datetime)))).sort().map(day => ({ day, entries: filtered.filter(e => campusDay(e.event_datetime) === day && e.direction === 'in' && e.auth_result === 'granted').length, exits: filtered.filter(e => campusDay(e.event_datetime) === day && e.direction === 'out' && e.auth_result === 'granted').length }));
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const matching = filtered.filter(e => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23' }).format(new Date(e.event_datetime))) === hour);
    return { hour: String(hour).padStart(2, '0') + ':00', entries: matching.filter(e => e.direction === 'in' && e.auth_result === 'granted').length, exits: matching.filter(e => e.direction === 'out' && e.auth_result === 'granted').length };
  });
  const counts = [...new Map(vehicles.map(v => [v.vehicle_id, v])).values()].reduce<Record<string, number>>((result, vehicle) => { const name = vehicle.vehicle_type || 'Other'; result[name] = (result[name] ?? 0) + 1; return result; }, {});
  function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!from || !until || from > until) { setRangeError('Choose a valid date range. The end date must be on or after the start date.'); return; }
    setRangeError(''); setRange({ from, until });
  }
  function download() {
    const rows = [['Event ID', 'Date and time (Manila)', 'Plate', 'Direction', 'Method', 'Result', 'Reason'], ...filtered.map(e => [e.event_id, formatCampusDateTime(e.event_datetime), e.plate_number, e.direction, e.access_method, e.auth_result, e.denial_reason])];
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `PASS-gate-activity-${range.from}-to-${range.until}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="space-y-5">
    <PageHeader title="Reports & Analytics" subtitle="Gate activity from PASS records, using Manila dates and times" action={<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={loading || !!error} onClick={() => window.print()}><Printer size={16}/> Print</Button><Button disabled={loading || !!error || !filtered.length} onClick={download}><Download size={16}/> Export CSV</Button></div>}/>
    <Card className="p-4 sm:p-5"><form onSubmit={generate} className="flex flex-wrap gap-4 items-end"><Input label="Date from (Manila)" aria-label="Date from (Manila)" type="date" required value={from} onChange={e => setFrom(e.target.value)}/><Input label="Date to (Manila)" aria-label="Date to (Manila)" type="date" required value={until} onChange={e => setUntil(e.target.value)}/><Button type="submit" disabled={loading}>Generate report</Button><Button variant="outline" disabled={loading} onClick={load}><RefreshCw size={16}/> Refresh records</Button></form>{rangeError && <p role="alert" className="mt-3 text-sm text-red-700">{rangeError}</p>}</Card>
    <p className="text-xs leading-relaxed text-slate-500">Gate activity uses the latest 500 access records. Older periods may be incomplete. Granted entries and exits are counted separately from denied scans. Registration counts below include all returned vehicle authorizations.</p>
    {loading && <p role="status" className="text-sm text-slate-500">Loading reports…</p>}
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : !loading && <>
      <p className="text-sm text-slate-600">Showing {filtered.length} records · {range.from} to {range.until}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><StatCard label="Granted entries" value={entries} icon={<Calendar size={18}/>}/><StatCard label="Granted exits" value={exits} color="sky" icon={<Calendar size={18}/>}/><StatCard label="Denied scans" value={denied} color="amber" icon={<Calendar size={18}/>}/><StatCard label="RFID scans" value={filtered.filter(e => e.access_method === 'rfid').length} color="green" icon={<Calendar size={18}/>}/></div>
      <div className="grid lg:grid-cols-2 gap-5"><Card className="p-4 sm:p-6"><h3 className="font-semibold text-slate-700 mb-4">Daily entry & exit activity</h3>{!daily.length ? <p className="text-sm text-slate-400 py-12">No access records in this range.</p> : <ResponsiveContainer width="100%" height={240}><BarChart data={daily}><XAxis dataKey="day" tick={{ fontSize: 10 }}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="entries" fill="#080677"/><Bar dataKey="exits" fill="#38BDF8"/></BarChart></ResponsiveContainer>}</Card><Card className="p-4 sm:p-6"><h3 className="font-semibold text-slate-700 mb-4">Registered vehicles by type</h3>{!vehicles.length ? <p className="text-sm text-slate-400">No registered vehicles.</p> : <dl className="space-y-3">{Object.entries(counts).map(([name, count]) => <div key={name} className="flex justify-between gap-3 border-b border-slate-100 pb-2 text-sm"><dt>{name}</dt><dd className="font-semibold text-[#080677]">{count}</dd></div>)}</dl>}</Card></div>
      <Card className="p-4 sm:p-6"><h3 className="font-semibold text-slate-700 mb-4">Activity by hour (Manila, selected dates)</h3><ResponsiveContainer width="100%" height={220}><LineChart data={hourly}><XAxis dataKey="hour" tick={{ fontSize: 10 }}/><YAxis allowDecimals={false}/><Tooltip/><Line dataKey="entries" stroke="#080677" dot={false}/><Line dataKey="exits" stroke="#38BDF8" dot={false}/></LineChart></ResponsiveContainer></Card>
    </>}
  </div>;
}
