import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DyciLogo } from '../components/Brand';
import { Shield, CarFront, ClipboardList, LogOut, Info, CheckCircle2, Clock3, AlertCircle, QrCode, Bell, User, History, Plus, X, Maximize2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal, Button } from '../components/ui';
import QrCodeImage from '../components/QrCode';
import { apiRequest, ApiError } from '../lib/apiClient';
import { useTopicVersion } from '../lib/liveSync';
import { CAMPUS_TIMEZONE, formatCampusDateTime } from '../lib/datetime';

// Guest (visitor) portal. Everything shown comes from the guest's own records
// in MySQL via /api/guest/*: profile, vehicles, visitor parking requests, the
// Visitor QR passes an Administrator issued, visits, and notifications.

type Section = 'overview' | 'request' | 'vehicles' | 'passes' | 'visits' | 'notifications' | 'profile';
type PassStatus = 'active' | 'scheduled' | 'used' | 'expired' | 'revoked' | 'legacy';

interface Pass {
  qr_pass_id: number;
  pass_code: string;
  status: PassStatus;
  request_id: number | null;
  visitor_name: string | null;
  plate_number: string | null;
  vehicle_type: string | null;
  valid_from: string | null;
  valid_until: string | null;
  use_count: number;
  max_uses: number;
  revoke_reason: string | null;
}

interface GuestRequest {
  request_id: number;
  request_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  purpose: string | null;
  valid_from: string | null;
  valid_until: string | null;
  window_ended: boolean;
  created_at: string | null;
  reviewed_at: string | null;
  review_remarks: string | null;
  plate_number: string | null;
  vehicle_type: string | null;
  area_name: string | null;
  pass: Pass | null;
}

interface Vehicle { vehicle_id: number; plate_number: string; make: string | null; model: string | null; color: string | null; type_name: string; area_name: string | null; inside: boolean }
interface VehicleType { vehicle_type_id: number; type_name: string; area_name: string }
interface Visit { transaction_id: number; ticket_number: string; status: string; plate_number: string; slot_code: string | null; area_name: string | null; entry_datetime: string | null; exit_datetime: string | null; duration_minutes: number | null }
interface Notice { notification_id: number; title: string; body: string; is_read: boolean; created_at: string | null }
interface Profile { user_code: string; email: string; full_name: string; contact_number: string | null; affiliation: string | null; member_since: string | null }

const PASS_LABEL: Record<PassStatus, string> = { active: 'Active', scheduled: 'Not valid yet', used: 'Used', expired: 'Expired', revoked: 'Revoked', legacy: 'Not valid for entry' };
const PASS_TONE: Record<PassStatus, string> = {
  active: 'bg-green-100 text-green-700', scheduled: 'bg-blue-100 text-blue-700', used: 'bg-slate-100 text-slate-600',
  expired: 'bg-red-100 text-red-700', revoked: 'bg-red-100 text-red-700', legacy: 'bg-amber-100 text-amber-700',
};
const REQUEST_LABEL = { pending: 'Pending approval', approved: 'Approved', rejected: 'Not approved', cancelled: 'Cancelled', expired: 'Expired' } as const;

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Shield size={15} /> },
  { id: 'request', label: 'New Request', icon: <ClipboardList size={15} /> },
  { id: 'passes', label: 'My QR Passes', icon: <QrCode size={15} /> },
  { id: 'vehicles', label: 'My Vehicles', icon: <CarFront size={15} /> },
  { id: 'visits', label: 'Visit History', icon: <History size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { id: 'profile', label: 'Profile', icon: <User size={15} /> },
];

/** Today's date in campus time, for the date picker minimum. */
function campusToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CAMPUS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const inputBase = 'w-full rounded-xl border px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white';
const inputClass = (error?: string) => `${inputBase} ${error ? 'border-red-400' : 'border-slate-200'}`;

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-600 mt-1">{message}</p> : null;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7 ${className}`}>{children}</section>;
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">{icon}</div>
      <div><h2 className="text-lg font-bold text-[#080677]">{title}</h2>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div>
    </div>
  );
}

// ----------------------------------------------------------------- QR pass views

function PassCard({ pass, onOpen }: { pass: Pass; onOpen: () => void }) {
  const usable = pass.status === 'active' || pass.status === 'scheduled';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="bg-gradient-to-br from-[#080677] to-[#2563EB] text-white p-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-blue-200">PASS — Visitor QR Access Pass</p>
          <p className="text-lg font-bold mt-1">{pass.plate_number ?? '—'}</p>
          <p className="text-xs text-blue-200">{pass.vehicle_type}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PASS_TONE[pass.status]}`}>{PASS_LABEL[pass.status]}</span>
      </div>
      <div className="p-5 flex flex-col sm:flex-row gap-5 items-center">
        <button type="button" onClick={onOpen} className={`shrink-0 ${usable ? '' : 'opacity-40'}`} aria-label="Open QR pass full screen">
          <QrCodeImage value={pass.pass_code} size={160} />
        </button>
        <div className="text-sm space-y-1.5 w-full">
          <p><span className="text-slate-500">Valid from:</span> <span className="font-medium">{formatCampusDateTime(pass.valid_from)}</span></p>
          <p><span className="text-slate-500">Valid until:</span> <span className="font-medium">{formatCampusDateTime(pass.valid_until)}</span></p>
          <p><span className="text-slate-500">Uses:</span> <span className="font-medium">{pass.use_count} of {pass.max_uses}</span> <span className="text-xs text-slate-400">(one entry, one exit)</span></p>
          {pass.revoke_reason && <p className="text-red-600">Revoked: {pass.revoke_reason}</p>}
          <Button size="sm" variant={usable ? 'primary' : 'outline'} onClick={onOpen}><Maximize2 size={14} /> Show at the gate</Button>
        </div>
      </div>
    </div>
  );
}

/** Full-screen pass for showing on a phone at the Main Entrance / Exit. */
function FullScreenPass({ pass, name, onClose }: { pass: Pass; name: string; onClose: () => void }) {
  const usable = pass.status === 'active' || pass.status === 'scheduled';
  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col items-center overflow-y-auto p-5" role="dialog" aria-modal="true" aria-label="Visitor QR pass">
      <div className="w-full max-w-sm flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><DyciLogo className="h-8" /><span className="font-bold text-[#080677]">PASS</span></div>
        <button type="button" onClick={onClose} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center" aria-label="Close"><X size={20} /></button>
      </div>
      <p className="text-xs uppercase tracking-wide text-slate-500">Visitor QR Access Pass</p>
      <h2 className="text-2xl font-bold text-[#080677] text-center">{name}</h2>
      <p className="font-mono text-lg font-bold text-slate-700">{pass.plate_number}</p>
      <span className={`mt-2 text-sm font-semibold px-3 py-1 rounded-full ${PASS_TONE[pass.status]}`}>{PASS_LABEL[pass.status]}</span>
      <div className={`my-5 p-3 rounded-2xl border-4 ${usable ? 'border-green-400' : 'border-slate-200 opacity-40'}`}>
        <QrCodeImage value={pass.pass_code} size={Math.min(320, Math.round((typeof window !== 'undefined' ? window.innerWidth : 360) * 0.75))} />
      </div>
      <div className="w-full max-w-sm text-sm space-y-1.5 rounded-xl bg-slate-50 p-4">
        <p className="flex justify-between gap-3"><span className="text-slate-500">Valid from</span><span className="font-medium text-right">{formatCampusDateTime(pass.valid_from)}</span></p>
        <p className="flex justify-between gap-3"><span className="text-slate-500">Valid until</span><span className="font-medium text-right">{formatCampusDateTime(pass.valid_until)}</span></p>
        <p className="flex justify-between gap-3"><span className="text-slate-500">Uses</span><span className="font-medium">{pass.use_count} of {pass.max_uses}</span></p>
        <p className="pt-2 text-[11px] text-slate-400 break-all">Pass code: {pass.pass_code}</p>
      </div>
      <p className="text-xs text-slate-500 text-center mt-4 max-w-sm">Show this QR code at the Main Entrance / Exit for one entry and one exit. Turn up your screen brightness if the scanner cannot read it.</p>
    </div>
  );
}

// ----------------------------------------------------------------- page

export default function GuestDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutModal, setLogoutModal] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [requests, setRequests] = useState<GuestRequest[] | null>(null);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState('');
  const [flash, setFlash] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [openPass, setOpenPass] = useState<Pass | null>(null);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setFlash({ message, type });
    setTimeout(() => setFlash(null), type === 'error' ? 6000 : 4000);
  };

  const load = useCallback(async () => {
    try {
      const [r, p, v, h, n, pr] = await Promise.all([
        apiRequest<{ data: GuestRequest[] }>('/api/guest/requests'),
        apiRequest<{ data: Pass[] }>('/api/guest/passes'),
        apiRequest<{ data: Vehicle[]; vehicle_types: VehicleType[] }>('/api/guest/vehicles'),
        apiRequest<{ data: Visit[] }>('/api/guest/visits'),
        apiRequest<{ data: Notice[]; unread_count: number }>('/api/notifications'),
        apiRequest<Profile>('/api/guest/profile'),
      ]);
      setRequests(r.data);
      setPasses(p.data);
      setVehicles(v.data);
      setTypes(v.vehicle_types);
      setVisits(h.data);
      setNotices(n.data);
      setUnread(n.unread_count);
      setProfile(pr);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load your account.');
    }
  }, []);

  // Pick up approvals, gate activity and notifications without a manual refresh:
  // reloads when the guest's own records change (shared refresh, lib/liveSync).
  const version = useTopicVersion(['visitors', 'parking', 'notifications']);
  useEffect(() => { load(); }, [load, version]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const latest = requests?.[0] ?? null;
  const usablePasses = passes.filter(p => p.status === 'active' || p.status === 'scheduled');
  const name = profile?.full_name || user?.name || 'Guest';

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-['Inter']">
      <header className="bg-[#080677] text-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><DyciLogo onDark className="h-9" /><span className="h-7 w-px bg-white/25" /><div><p className="font-bold text-sm">PASS</p><p className="text-[#96D1F2] text-xs">Guest Visitor Portal</p></div></div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSection('notifications')} className="relative text-blue-100 hover:text-white" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
              <Bell size={19} />{unread > 0 && <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">{unread}</span>}
            </button>
            <span className="hidden sm:inline text-xs bg-white/10 rounded-full px-3 py-1.5">Guest account</span>
            <button onClick={() => setLogoutModal(true)} className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white"><LogOut size={16} /> <span className="hidden sm:inline">Logout</span></button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-5"><p className="text-xs uppercase tracking-wider font-semibold text-blue-700 mb-2">Visitor parking access</p><h1 className="text-2xl sm:text-3xl font-bold text-[#080677]">Welcome, {name}</h1><p className="text-slate-600 mt-2 max-w-2xl">Register your vehicle, then submit a visitor parking request. Your QR pass appears here once an Administrator approves the request.</p></div>

        <nav className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0" aria-label="Guest sections">
          {SECTIONS.map(s => (
            <button key={s.id} type="button" onClick={() => setSection(s.id)} aria-current={section === s.id ? 'page' : undefined}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${section === s.id ? 'bg-[#080677] text-white border-[#080677]' : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50'}`}>
              {s.icon}{s.label}{s.id === 'notifications' && unread > 0 && <span className="ml-1 text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5">{unread}</span>}
            </button>
          ))}
        </nav>

        {flash && <div role="status" className={`mb-5 rounded-xl border p-4 text-sm ${flash.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{flash.message}</div>}
        {loadError && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>}

        {section === 'overview' && (
          <div className="space-y-6">
            {usablePasses.length > 0 && (
              <Card>
                <SectionTitle icon={<QrCode size={22} />} title="Your QR pass is ready" subtitle="Show it at the Main Entrance / Exit." />
                <div className="grid gap-4">{usablePasses.map(p => <PassCard key={p.qr_pass_id} pass={p} onOpen={() => setOpenPass(p)} />)}</div>
              </Card>
            )}
            {requests === null ? <Card><p className="text-sm text-slate-400">Loading your requests…</p></Card> : !latest ? (
              <div className="rounded-2xl border border-blue-200 bg-white p-4 sm:p-5 flex gap-3"><Info size={21} className="text-blue-700 shrink-0 mt-0.5" />
                <div><h2 className="font-semibold text-[#080677]">Approval is required</h2><p className="text-sm text-slate-600 mt-1">Your account alone does not authorize parking access. {vehicles.length ? 'Submit a visitor parking request to get started.' : 'Register your vehicle first, then submit a visitor parking request.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{!vehicles.length && <Button size="sm" onClick={() => setSection('vehicles')}><Plus size={14} /> Register vehicle</Button>}<Button size="sm" variant={vehicles.length ? 'primary' : 'outline'} onClick={() => setSection('request')}>New request</Button></div>
                </div>
              </div>
            ) : (
              <Card>
                <div className="flex items-start gap-3 mb-5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${latest.request_status === 'approved' ? 'bg-green-100 text-green-700' : latest.request_status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {latest.request_status === 'approved' ? <CheckCircle2 size={24} /> : latest.request_status === 'pending' ? <Clock3 size={24} /> : <AlertCircle size={24} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#080677]">Latest request #{latest.request_id}</h2>
                    <p className="text-sm text-slate-600 mt-1">Status: <span className={`font-semibold ${latest.request_status === 'approved' ? 'text-green-700' : latest.request_status === 'pending' ? 'text-amber-700' : 'text-red-700'}`}>{REQUEST_LABEL[latest.request_status]}</span></p>
                  </div>
                </div>
                {latest.request_status === 'pending' && <p className="text-sm text-slate-600 mb-5">An Administrator will review your request. No QR pass is issued until it is approved; you will be notified here.</p>}
                {latest.request_status === 'rejected' && latest.review_remarks && <p className="text-sm text-red-700 mb-5">Reason: {latest.review_remarks}</p>}
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-slate-500">Purpose</p><p className="font-medium text-slate-800 mt-1">{latest.purpose}</p></div>
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-slate-500">Vehicle</p><p className="font-medium text-slate-800 mt-1">{latest.vehicle_type} · {latest.plate_number}</p></div>
                  <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2"><p className="text-slate-500">Visit schedule (Manila time)</p><p className="font-medium text-slate-800 mt-1">{formatCampusDateTime(latest.valid_from)} – {formatCampusDateTime(latest.valid_until)}</p></div>
                </div>
              </Card>
            )}
            {requests && requests.length > 1 && (
              <Card>
                <h3 className="font-semibold text-[#080677] mb-3">Request history</h3>
                <ul className="divide-y divide-slate-100">
                  {requests.slice(1).map(r => (
                    <li key={r.request_id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>#{r.request_id} · {r.plate_number} · {formatCampusDateTime(r.valid_from)}</span>
                      <span className="font-medium text-slate-600">{REQUEST_LABEL[r.request_status]}{r.pass ? ` · pass ${PASS_LABEL[r.pass.status].toLowerCase()}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}

        {section === 'request' && <RequestForm vehicles={vehicles} onAddVehicle={() => setSection('vehicles')} onSubmitted={message => { notify(message); load(); setSection('overview'); }} />}
        {section === 'vehicles' && <Vehicles vehicles={vehicles} types={types} onAdded={message => { notify(message); load(); }} />}

        {section === 'passes' && (
          <Card>
            <SectionTitle icon={<QrCode size={22} />} title="My QR Passes" subtitle="Each pass allows one entry and one exit during the approved visit." />
            {passes.length === 0 ? <p className="text-sm text-slate-500">No QR pass yet. A pass is issued when an Administrator approves your visitor parking request.</p> : (
              <div className="grid gap-4">{passes.map(p => <PassCard key={p.qr_pass_id} pass={p} onOpen={() => setOpenPass(p)} />)}</div>
            )}
          </Card>
        )}

        {section === 'visits' && (
          <Card>
            <SectionTitle icon={<History size={22} />} title="Visit History" subtitle="Your parking visits recorded at the Main Entrance / Exit." />
            {visits.length === 0 ? <p className="text-sm text-slate-500">No parking visits yet.</p> : (
              <ul className="space-y-3">
                {visits.map(v => (
                  <li key={v.transaction_id} className="rounded-xl border border-slate-100 p-4 text-sm grid sm:grid-cols-4 gap-2">
                    <div><p className="text-slate-500 text-xs">Vehicle</p><p className="font-mono font-semibold text-[#080677]">{v.plate_number}</p></div>
                    <div><p className="text-slate-500 text-xs">Slot</p><p className="font-medium">{v.slot_code ?? '—'} · {v.area_name}</p></div>
                    <div><p className="text-slate-500 text-xs">Entry / Exit</p><p>{formatCampusDateTime(v.entry_datetime)}<br />{v.exit_datetime ? formatCampusDateTime(v.exit_datetime) : <span className="text-amber-700 font-medium">Still parked</span>}</p></div>
                    <div><p className="text-slate-500 text-xs">Status</p><p className="font-medium capitalize">{v.status === 'active' ? 'Parked' : v.status.replace('_', ' ')}{v.duration_minutes != null ? ` · ${Math.floor(v.duration_minutes / 60)}h ${v.duration_minutes % 60}m` : ''}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {section === 'notifications' && <Notifications notices={notices} onChanged={load} />}
        {section === 'profile' && profile && <ProfileForm profile={profile} onSaved={message => { notify(message); load(); }} />}
      </main>

      {openPass && <FullScreenPass pass={openPass} name={name} onClose={() => setOpenPass(null)} />}

      <Modal open={logoutModal} onClose={() => setLogoutModal(false)} title="Confirm Logout" size="sm"><p className="text-sm text-slate-600 mb-6">Are you sure you want to log out of PASS?</p><div className="flex gap-3 justify-end"><Button variant="outline" onClick={() => setLogoutModal(false)}>Cancel</Button><Button variant="danger" onClick={handleLogout}>Yes, Logout</Button></div></Modal>
    </div>
  );
}

// ----------------------------------------------------------------- request form

function RequestForm({ vehicles, onAddVehicle, onSubmitted }: { vehicles: Vehicle[]; onAddVehicle: () => void; onSubmitted: (message: string) => void }) {
  const empty = { vehicle_id: '', visit_date: '', arrival_time: '', departure_time: '', purpose: '', visiting: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => { if (!form.vehicle_id && vehicles.length === 1) setForm(f => ({ ...f, vehicle_id: String(vehicles[0].vehicle_id) })); }, [vehicles, form.vehicle_id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.vehicle_id) next.vehicle_id = 'Choose your vehicle.';
    if (!form.visit_date) next.visit_date = 'Please select your visit date.';
    if (!form.arrival_time) next.arrival_time = 'Please select your expected arrival time.';
    if (!form.departure_time) next.departure_time = 'Please select your expected departure time.';
    if (form.arrival_time && form.departure_time && form.departure_time <= form.arrival_time) next.departure_time = 'Departure must be after arrival.';
    if (!form.purpose.trim()) next.purpose = 'Please provide the reason for your visit.';
    if (!form.visiting.trim()) next.visiting = 'Please identify the person or office you will visit.';
    setErrors(next);
    setError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const r = await apiRequest<{ message: string }>('/api/guest/requests', { method: 'POST', body: { ...form, vehicle_id: Number(form.vehicle_id) } });
      setForm(empty);
      onSubmitted(r.message);
    } catch (err) {
      if (err instanceof ApiError) { setErrors(err.fieldErrors); setError(err.message); } else setError('The request could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  if (!vehicles.length) {
    return (
      <Card>
        <SectionTitle icon={<ClipboardList size={22} />} title="Visitor Parking Request" />
        <p className="text-sm text-slate-600 mb-4">Register the vehicle you will bring before submitting a request.</p>
        <Button onClick={onAddVehicle}><Plus size={14} /> Register vehicle</Button>
      </Card>
    );
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <SectionTitle icon={<ClipboardList size={22} />} title="Visitor Parking Request" subtitle="All fields are required. Times are Manila time." />
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1.5">Registered vehicle *</label>
            <select value={form.vehicle_id} onChange={set('vehicle_id')} className={inputClass(errors.vehicle_id)} disabled={busy}>
              <option value="">Choose your vehicle…</option>
              {vehicles.map(v => <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_number} · {v.type_name}{v.make ? ` · ${v.make} ${v.model ?? ''}` : ''}</option>)}
            </select><FieldError message={errors.vehicle_id} />
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Visit date *</label><input type="date" min={campusToday()} value={form.visit_date} onChange={set('visit_date')} className={inputClass(errors.visit_date)} disabled={busy} /><FieldError message={errors.visit_date} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Person / office to visit *</label><input value={form.visiting} onChange={set('visiting')} placeholder="Name or office" className={inputClass(errors.visiting)} disabled={busy} /><FieldError message={errors.visiting} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Expected arrival time *</label><input type="time" value={form.arrival_time} onChange={set('arrival_time')} className={inputClass(errors.arrival_time)} disabled={busy} /><FieldError message={errors.arrival_time} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Expected departure time *</label><input type="time" value={form.departure_time} onChange={set('departure_time')} className={inputClass(errors.departure_time)} disabled={busy} /><FieldError message={errors.departure_time} /></div>
          <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1.5">Reason for visiting campus *</label><textarea value={form.purpose} onChange={set('purpose')} rows={3} maxLength={150} placeholder="Explain the purpose of your visit" className={inputClass(errors.purpose)} disabled={busy} /><FieldError message={errors.purpose} /></div>
        </div>
        <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 flex gap-2"><AlertCircle size={18} className="text-slate-500 shrink-0 mt-0.5" /><p>Submitting sends your request to a PASS Administrator for review. It does not generate a QR pass or guarantee entry until it is approved.</p></div>
        {error && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3" role="alert">{error}</p>}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={() => { setForm(empty); setErrors({}); setError(''); }} className="px-5 py-3 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50" disabled={busy}>Clear form</button>
          <button type="submit" disabled={busy} className="px-5 py-3 rounded-xl bg-[#080677] hover:bg-blue-900 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Submitting…' : 'Submit for Approval'}</button>
        </div>
      </Card>
    </form>
  );
}

// ----------------------------------------------------------------- vehicles

function Vehicles({ vehicles, types, onAdded }: { vehicles: Vehicle[]; types: VehicleType[]; onAdded: (message: string) => void }) {
  const empty = { plate_number: '', vehicle_type_id: '', make: '', model: '', color: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.plate_number.trim()) next.plate_number = 'Vehicle plate number is required.';
    if (!form.vehicle_type_id) next.vehicle_type_id = 'Please select a vehicle type.';
    setErrors(next);
    setError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const r = await apiRequest<{ message: string }>('/api/guest/vehicles', { method: 'POST', body: { ...form, vehicle_type_id: Number(form.vehicle_type_id) } });
      setForm(empty);
      onAdded(r.message);
    } catch (err) {
      if (err instanceof ApiError) { setErrors(err.fieldErrors); setError(err.message); } else setError('The vehicle could not be registered.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle icon={<CarFront size={22} />} title="My Vehicles" subtitle="Vehicles you can choose when requesting visitor parking." />
        {vehicles.length === 0 ? <p className="text-sm text-slate-500">No vehicles registered yet.</p> : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {vehicles.map(v => (
              <li key={v.vehicle_id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-mono text-lg font-bold text-[#080677]">{v.plate_number}</p>
                <p className="text-sm text-slate-600">{v.type_name}{v.make ? ` · ${v.make} ${v.model ?? ''}` : ''}{v.color ? ` · ${v.color}` : ''}</p>
                <p className="text-xs text-slate-400 mt-1">Parks in: {v.area_name ?? '—'}{v.inside ? ' · currently inside' : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <form onSubmit={submit}>
        <Card>
          <h3 className="font-semibold text-[#080677] mb-4 flex items-center gap-2"><Plus size={16} /> Register a vehicle</h3>
          <div className="grid sm:grid-cols-2 gap-5">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Plate number *</label><input value={form.plate_number} onChange={set('plate_number')} placeholder="e.g. ABC 1234" className={inputClass(errors.plate_number)} disabled={busy} /><FieldError message={errors.plate_number} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Vehicle type *</label>
              <select value={form.vehicle_type_id} onChange={set('vehicle_type_id')} className={inputClass(errors.vehicle_type_id)} disabled={busy}>
                <option value="">Choose…</option>
                {types.map(t => <option key={t.vehicle_type_id} value={t.vehicle_type_id}>{t.type_name}</option>)}
              </select><FieldError message={errors.vehicle_type_id} />
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Make <span className="text-slate-400">(optional)</span></label><input value={form.make} onChange={set('make')} placeholder="e.g. Toyota" className={inputClass()} disabled={busy} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Model <span className="text-slate-400">(optional)</span></label><input value={form.model} onChange={set('model')} placeholder="e.g. Vios" className={inputClass()} disabled={busy} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Color <span className="text-slate-400">(optional)</span></label><input value={form.color} onChange={set('color')} className={inputClass()} disabled={busy} /></div>
          </div>
          {error && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3" role="alert">{error}</p>}
          <div className="mt-6 flex sm:justify-end"><button type="submit" disabled={busy} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#080677] hover:bg-blue-900 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Register Vehicle'}</button></div>
        </Card>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------- notifications

function Notifications({ notices, onChanged }: { notices: Notice[]; onChanged: () => void }) {
  const markAll = async () => { await apiRequest('/api/notifications/read-all', { method: 'POST' }).catch(() => {}); onChanged(); };
  const markOne = async (id: number) => { await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {}); onChanged(); };
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <SectionTitle icon={<Bell size={22} />} title="Notifications" subtitle="Updates about your visitor parking requests." />
        {notices.some(n => !n.is_read) && <Button size="sm" variant="ghost" onClick={markAll}>Mark all as read</Button>}
      </div>
      {notices.length === 0 ? <p className="text-sm text-slate-500">No notifications yet.</p> : (
        <ul className="space-y-3">
          {notices.map(n => (
            <li key={n.notification_id} className={`rounded-xl border p-4 ${n.is_read ? 'border-slate-100 bg-white' : 'border-blue-200 bg-blue-50/60'}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-[#080677] text-sm">{n.title}</p>
                <span className="text-[11px] text-slate-400 shrink-0">{formatCampusDateTime(n.created_at)}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{n.body}</p>
              {!n.is_read && <button type="button" onClick={() => markOne(n.notification_id)} className="mt-2 text-xs font-semibold text-blue-700 hover:underline">Mark as read</button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------- profile

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: (message: string) => void }) {
  const [form, setForm] = useState({ full_name: profile.full_name, contact_number: profile.contact_number ?? '', affiliation: profile.affiliation ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError('');
    try {
      const r = await apiRequest<{ message: string }>('/api/guest/profile', { method: 'PATCH', body: form });
      onSaved(r.message);
    } catch (err) {
      if (err instanceof ApiError) { setErrors(err.fieldErrors); setError(err.message); } else setError('Your profile could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card>
        <SectionTitle icon={<User size={22} />} title="Profile" subtitle={`Guest account ${profile.user_code}`} />
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1.5">Full name *</label><input value={form.full_name} onChange={set('full_name')} className={inputClass(errors.full_name)} disabled={busy} /><FieldError message={errors.full_name} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label><input value={profile.email} disabled className={`${inputClass()} bg-slate-50 text-slate-500`} /><p className="text-xs text-slate-400 mt-1">Your sign-in email cannot be changed here.</p></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Contact number *</label><input type="tel" value={form.contact_number} onChange={set('contact_number')} className={inputClass(errors.contact_number)} disabled={busy} /><FieldError message={errors.contact_number} /></div>
          <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1.5">Company / affiliation <span className="text-slate-400">(optional)</span></label><input value={form.affiliation} onChange={set('affiliation')} className={inputClass(errors.affiliation)} disabled={busy} /></div>
        </div>
        {error && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3" role="alert">{error}</p>}
        <div className="mt-6 flex sm:justify-end"><button type="submit" disabled={busy} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#080677] hover:bg-blue-900 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save Profile'}</button></div>
        <p className="text-xs text-slate-400 mt-4">Member since {formatCampusDateTime(profile.member_since)}</p>
      </Card>
    </form>
  );
}
