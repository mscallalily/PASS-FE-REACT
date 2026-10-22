import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowDownLeft, ArrowRight, Bell, Car, CheckCircle, Clock, CreditCard, FileCheck, LogIn, LogOut, MapPin, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { useLiveSync, useTopicVersion } from '../lib/liveSync';
import { formatCampusDate, formatCampusDateTime } from '../lib/datetime';
import { Badge, Button, Card, StatCard, statusBadge } from './ui';

type Session = { transaction_id: number; plate_number: string | null; ticket_number: string; slot_code: string | null; parking_area: string | null; entry_datetime: string; exit_datetime: string | null; duration_minutes: number | null; status: string; access_method: string; slot_confirmed: boolean };
type DashboardData = {
  summary: { today_entries: number; today_exits: number; total_sessions: number; vehicles: number; pending_vehicles: number; rejected_vehicles: number; pending_releases: number; unread_notifications: number };
  selected_vehicle: { vehicle_id: number; plate_number: string; make: string | null; model: string | null; year_model: number | null; vehicle_type: string; registration_status: string; authorization_status: string; rfid_assigned: boolean } | null;
  license: { verification_status: string; expiry_date: string | null; expired: boolean; license_status: string; driver_status: string } | null;
  active_sessions: Session[]; recent_sessions: Session[];
  notifications: { notification_id: number; title: string; body: string; is_read: boolean; created_at: string }[];
  campus_date: string; generated_at: string;
};
const linkClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#080677] focus:ring-offset-2';
const label = (value: string) => value.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

export default function PersonalDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(true), [revision, setRevision] = useState(0);
  const version = useTopicVersion(['parking', 'vehicles', 'notifications']);
  const { offline } = useLiveSync();
  // Also refresh dates/license expiry and vehicle changes when an older sync server has no vehicle marker.
  useEffect(() => {
    const wake = () => { if (document.visibilityState === 'visible') setRevision(n => n + 1); };
    const timer = window.setInterval(wake, 30000);
    window.addEventListener('focus', wake); document.addEventListener('visibilitychange', wake);
    return () => { clearInterval(timer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true);
    apiRequest<DashboardData>('/api/dashboard/mine', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setData(result); setError(''); } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load your dashboard.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [user?.id, version, revision]);

  const selected = data?.selected_vehicle, license = data?.license;
  const licenseReady = !!license && !license.expired && license.verification_status === 'verified' && license.license_status === 'valid' && license.driver_status === 'active';
  const licenseLabel = !license ? 'Not submitted' : license.expired ? 'Expired' : license.verification_status === 'verified' ? (licenseReady ? 'Verified' : 'Needs attention') : label(license.verification_status);
  const value = (n: number | undefined) => data ? n ?? 0 : '—';
  const steps: { title: string; detail: string; to: string }[] = [];
  if (data) {
    if (!license) steps.push({ title: 'Submit your driver’s license', detail: 'Start here before registering a vehicle.', to: '/app/drivers' });
    else if (!licenseReady) steps.push({ title: `Driver’s license · ${licenseLabel}`, detail: license.expired ? 'Update your expired license before your next trip.' : 'View the latest document decision and any required corrections.', to: '/app/drivers' });
    if (!data.summary.vehicles) steps.push({ title: 'Register your vehicle', detail: 'Add the vehicle details and a clear photo for staff review.', to: '/app/vehicles' });
    if (data.summary.pending_vehicles) steps.push({ title: `${data.summary.pending_vehicles} vehicle authorization${data.summary.pending_vehicles === 1 ? '' : 's'} pending`, detail: 'Your submission is waiting for PASS staff review.', to: '/app/vehicles/status' });
    if (data.summary.rejected_vehicles) steps.push({ title: 'Vehicle correction needed', detail: 'Review the reason and correct your vehicle submission.', to: '/app/vehicles/status' });
    if (selected && !['approved', 'pending', 'rejected'].includes(selected.authorization_status)) steps.push({ title: `Vehicle authorization · ${label(selected.authorization_status)}`, detail: 'Review your authorization status before your next trip.', to: '/app/vehicles/status' });
    if (selected && selected.registration_status !== 'registered') steps.push({ title: 'Vehicle registration needs attention', detail: 'Check your vehicle record with PASS staff.', to: '/app/vehicles' });
    if (data.summary.vehicles && !selected && !data.summary.pending_vehicles) steps.push({ title: 'Choose a vehicle for use', detail: 'Select an approved vehicle with an assigned RFID in My Vehicles.', to: '/app/vehicles' });
    if (selected && !selected.rfid_assigned) steps.push({ title: 'RFID assignment needs attention', detail: 'Check your RFID status and contact PASS staff for assignment.', to: '/app/vehicles/rfid-requests' });
    if (data.summary.pending_releases) steps.push({ title: 'Emergency release request pending', detail: 'Follow the staff decision for your current parking session.', to: '/app/vehicle-releases' });
  }

  return <div className="animate-fadein space-y-5 pb-2">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-bold text-[#080677]">My Dashboard</h1><p className="mt-1 text-sm text-slate-500">Hello, {user?.name?.split(' ')[0] || 'there'}. Here’s your latest parking activity.</p></div>
      <Button variant="outline" disabled={busy} onClick={() => setRevision(n => n + 1)}><RefreshCw size={15} className={busy ? 'animate-spin' : ''}/>{busy ? 'Updating…' : 'Refresh'}</Button>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{data ? 'Showing your last loaded records. ' : 'Unable to load your dashboard. '}{error}{!busy && <button onClick={() => setRevision(n => n + 1)} className="ml-2 min-h-11 font-semibold underline">Try again</button>}</div>}
    {offline && !error && data && <p role="status" className="text-xs text-amber-700">Connection lost. Your last loaded records are shown until PASS reconnects.</p>}
    {!data && busy && <p role="status" className="text-sm text-slate-500">Loading your vehicles and parking activity…</p>}

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard label="My entries today" value={value(data?.summary.today_entries)} icon={<LogIn size={19}/>} color="navy" sub="Your recorded arrivals"/>
      <StatCard label="My exits today" value={value(data?.summary.today_exits)} icon={<LogOut size={19}/>} color="sky" sub="Your completed departures"/>
      <StatCard label="My vehicles" value={value(data?.summary.vehicles)} icon={<Car size={19}/>} color="blue" sub={data ? `${data.summary.pending_vehicles} pending authorization` : undefined}/>
      <StatCard label="Unread updates" value={value(data?.summary.unread_notifications)} icon={<Bell size={19}/>} color="amber" sub="Your PASS notifications"/>
    </div>

    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="p-4 sm:p-5 xl:col-span-2">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold text-slate-700"><MapPin size={18} className="text-[#080677]"/>My parking status</h2>{data && <Badge variant={data.active_sessions.length ? 'info' : 'default'}>{data.active_sessions.length ? 'Currently inside' : 'Not parked'}</Badge>}</div>
        {!data ? <p className="text-sm text-slate-400">Your current parking status will appear here.</p> : data.active_sessions.length ? <div className="space-y-3">{data.active_sessions.map(session => <div key={session.transaction_id} className="rounded-xl border border-blue-100 bg-[#F4F7FB] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs text-slate-500">Vehicle inside</p><p className="mt-1 break-words font-mono text-2xl font-bold text-[#080677]">{session.plate_number || 'Vehicle on record'}</p><p className="mt-2 text-sm text-slate-600">{session.parking_area || 'Recorded parking area'}</p></div><div className="rounded-xl border border-blue-100 bg-white px-5 py-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Assigned slot</p><p className="mt-1 text-2xl font-bold text-[#080677]">{session.slot_code || 'Unassigned'}</p></div></div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500"><Clock size={14} className="mt-0.5 shrink-0"/>Entered {formatCampusDateTime(session.entry_datetime)}</p>
          {!session.slot_confirmed && <p className="mt-2 text-xs text-amber-700">Slot assigned; staff confirmation is pending.</p>}
        </div>)}<Link to="/app/my-history" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#2563EB]">View my parking records <ArrowRight size={14}/></Link></div> : <div className="flex flex-col gap-4 rounded-xl bg-[#F4F7FB] p-5 sm:flex-row sm:items-center"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#080677]"><Car size={24}/></div><div><h3 className="font-semibold text-slate-700">You have no active parking session</h3><p className="mt-1 text-sm leading-relaxed text-slate-500">Your vehicle and assigned slot appear here after a recorded entry at the gate.</p></div></div>}
      </Card>

      <Card className="p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><CreditCard size={18} className="text-[#080677]"/><h2 className="font-semibold text-slate-700">Selected vehicle</h2></div>
        {!data ? <p className="text-sm text-slate-400">Loading vehicle status…</p> : selected ? <><div className="flex flex-wrap items-center gap-2"><span className="break-all font-mono text-xl font-bold text-[#080677]">{selected.plate_number}</span><Badge variant={statusBadge(selected.authorization_status)}>{label(selected.authorization_status)}</Badge></div><p className="mt-2 text-sm text-slate-500">{[selected.year_model, selected.make, selected.model].filter(Boolean).join(' ') || selected.vehicle_type}</p><div className="mt-4 flex items-start gap-2 rounded-lg bg-[#F4F7FB] p-3 text-xs text-slate-600"><ShieldCheck size={16} className="shrink-0 text-[#080677]"/><span>{selected.rfid_assigned ? 'RFID assigned to this vehicle' : 'No current RFID assignment'}</span></div><p className="mt-3 text-xs leading-relaxed text-slate-400">One vehicle is selected for entry at a time. Switch vehicles after your parked vehicle exits.</p></> : <p className="text-sm leading-relaxed text-slate-500">{data.summary.vehicles ? 'No vehicle is selected for use. Open My Vehicles to check authorization and RFID assignment.' : 'No vehicle registered yet. Add your vehicle when you are ready.'}</p>}
        <Link to="/app/vehicles" className={`${linkClass} mt-4 w-full bg-[#080677] text-white hover:bg-[#0a0a99]`}><Car size={16}/>{data?.summary.vehicles ? 'Manage my vehicles' : 'My vehicles'}<ArrowRight size={14}/></Link>
      </Card>
    </div>

    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="p-4 sm:p-5 xl:col-span-2"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold text-slate-700"><Activity size={18} className="text-[#080677]"/>Recent parking activity</h2><Link to="/app/my-history" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[#2563EB]">View history <ArrowRight size={13}/></Link></div>
        {!data ? <p className="py-6 text-sm text-slate-400">Loading your recorded sessions…</p> : !data.recent_sessions.length ? <div className="rounded-xl bg-slate-50 px-5 py-8 text-center"><Activity size={25} className="mx-auto mb-3 text-slate-300"/><p className="text-sm font-medium text-slate-600">Your parking history starts here</p><p className="mt-1 text-xs text-slate-400">Your recorded entries and exits will appear after your first visit.</p></div> : <ul className="divide-y divide-slate-100">{data.recent_sessions.map(row => <li key={row.transaction_id} className="flex items-start gap-3 py-4"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]"><ArrowDownLeft size={17}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-words font-mono text-sm font-bold text-[#080677]">{row.plate_number || 'Vehicle on record'}</p><Badge variant={statusBadge(row.status)}>{row.status === 'active' ? 'Inside' : label(row.status)}</Badge></div><p className="mt-1 break-words text-xs text-slate-500">{row.parking_area || 'Parking session'}{row.slot_code ? ` · ${row.slot_code}` : ''}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Entry · {formatCampusDateTime(row.entry_datetime)}</p>{row.exit_datetime && <p className="mt-1 text-xs leading-relaxed text-slate-400">Exit · {formatCampusDateTime(row.exit_datetime)}{row.duration_minutes !== null ? ` · ${row.duration_minutes} min` : ''}</p>}</div></li>)}</ul>}
      </Card>

      <div className="min-w-0 space-y-5"><Card className="p-4 sm:p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-700"><FileCheck size={18} className="text-[#080677]"/>Driver &amp; requirements</h2><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-slate-500">Driver’s license</span><Badge variant={licenseReady ? 'success' : data ? 'warning' : 'default'}>{data ? licenseLabel : '—'}</Badge></div>{license?.expiry_date && <p className="mt-2 text-xs text-slate-400">Expiry · {formatCampusDate(license.expiry_date)}</p>}<Link to="/app/drivers" className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[#2563EB]">View license status <ArrowRight size={13}/></Link>
        {data && <div className="mt-3 border-t border-slate-100 pt-4">{steps.length ? <ul className="space-y-3">{steps.slice(0, 4).map(step => <li key={step.title}><Link to={step.to} className="group flex min-h-11 items-start gap-2 rounded-lg p-2 -mx-2 hover:bg-blue-50"><Clock size={14} className="mt-1 shrink-0 text-amber-600"/><div className="min-w-0"><p className="text-xs font-semibold text-slate-700 group-hover:text-[#080677]">{step.title}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{step.detail}</p></div><ArrowRight size={12} className="mt-1 ml-auto shrink-0 text-slate-400"/></Link></li>)}</ul> : <p className="flex items-start gap-2 text-xs leading-relaxed text-green-700"><CheckCircle size={16} className="shrink-0"/>No pending actions shown in your current records.</p>}</div>}
      </Card></div>
    </div>

    <Card className="p-4 sm:p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold text-slate-700"><Bell size={18} className="text-[#080677]"/>My latest updates</h2><Link to="/app/notifications" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[#2563EB]">All notifications <ArrowRight size={13}/></Link></div>{!data ? <p className="text-sm text-slate-400">Loading your updates…</p> : !data.notifications.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No notifications yet. Your account and parking updates will appear here.</p> : <ul className="grid gap-3 md:grid-cols-3">{data.notifications.map(note => <li key={note.notification_id} className={`min-w-0 rounded-xl border p-4 ${note.is_read ? 'border-slate-100 bg-white' : 'border-blue-100 bg-blue-50/50'}`}><p className="break-words text-sm font-semibold text-slate-700">{note.title}{!note.is_read && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[#2563EB]" aria-label="Unread"/>}</p><p className="mt-2 break-words text-xs leading-relaxed text-slate-500">{note.body}</p><p className="mt-3 text-[11px] text-slate-400">{formatCampusDateTime(note.created_at)}</p></li>)}</ul>}</Card>

    <div className="flex flex-col justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-xs text-slate-500"><MapPin size={15} className="shrink-0 text-[#080677]"/>Planning your next visit? Check the campus parking map.</div><Link to="/app/parking/availability" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold text-[#2563EB]">Parking availability <ArrowRight size={13}/></Link></div>
    {data && <p className="text-[11px] text-slate-400">Your records only · Updated {formatCampusDateTime(data.generated_at)} · Philippine time</p>}
  </div>;
}
