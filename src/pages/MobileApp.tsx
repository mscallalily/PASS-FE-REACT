import { DyciLogo, PassMark } from '../components/Brand';
import RegistrationForm from '../components/RegistrationForm';
import DriverLicenseVerification from '../components/DriverLicenseVerification';
import { useLicense, LICENSE_STATUS_LABEL } from '../context/LicenseContext';
import React, { useState } from 'react';
import {
  Shield, Home, ParkingSquare, Clock, Bell, User, QrCode, Car, ClipboardList,
  ChevronRight, LogOut, Smartphone, Eye, EyeOff, LogIn, UserPlus,
  CheckCircle, AlertTriangle, Info, MapPin, ArrowLeft, Settings,
  Activity, CreditCard, X, Menu, IdCard
} from 'lucide-react';
import { ZONE_CAPACITY, MOCK_RFID_EVENTS, MOCK_NOTIFS } from '../data/mock';

type MobileScreen = 'welcome' | 'login' | 'register' | 'home' | 'parking' | 'history' | 'notifications' | 'profile' | 'qr' | 'guest-home' | 'guest-request' | 'license';
type MobileRole = 'student' | 'faculty' | 'employee' | 'parking_staff' | 'guest' | null;

interface MobileUser { name: string; role: MobileRole; email: string; }

// Simulated mobile accounts (same as desktop)
const MOBILE_ACCOUNTS: Record<string, MobileUser> = {
  'student@pass.edu': { name: 'Maria Santos', role: 'student', email: 'student@pass.edu' },
  'faculty@pass.edu': { name: 'Juan dela Cruz', role: 'faculty', email: 'faculty@pass.edu' },
  'employee@pass.edu': { name: 'Ana Reyes', role: 'employee', email: 'employee@pass.edu' },
  'security@pass.edu': { name: 'Liza Gonzales', role: 'parking_staff', email: 'security@pass.edu' },
  'parking@pass.edu': { name: 'Liza Gonzales', role: 'parking_staff', email: 'parking@pass.edu' },
  'guest@pass.edu': { name: 'John Smith', role: 'guest', email: 'guest@pass.edu' },
};

function MobileFrame({ children, bg = 'bg-[#F4F7FB]' }: { children: React.ReactNode; bg?: string }) {
  return (
    <div className={`h-full ${bg} overflow-y-auto`} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {children}
    </div>
  );
}

function WelcomeScreen({ onLogin, onRegister, onGuest }: { onLogin: () => void; onRegister: () => void; onGuest: () => void }) {
  return (
    <MobileFrame bg="bg-[#080677]">
      <div className="flex flex-col items-center justify-center min-h-full px-8 py-12 text-white text-center">
        <div className="mb-5 bg-white rounded-full overflow-hidden shadow-lg"><PassMark size="xl" /></div>
        <h1 className="text-3xl font-bold mb-1">PASS</h1>
        <p className="text-blue-200 text-sm mb-2">Parking Access & Space Management</p>
        <p className="text-blue-300 text-xs mb-12">Mobile App</p>

        <div className="w-full space-y-3">
          <button onClick={onLogin}
            className="w-full py-4 bg-white text-[#080677] font-bold rounded-2xl hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center gap-2">
            <LogIn size={20} /> Sign In
          </button>
          <button onClick={onRegister}
            className="w-full py-4 bg-[#38BDF8]/20 border border-[#38BDF8]/30 text-white font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2">
            <UserPlus size={20} /> Create Account
          </button>
          <button onClick={onGuest}
            className="w-full py-3 text-blue-300 text-sm font-medium active:opacity-70 transition-opacity">
            Continue as Guest
          </button>
        </div>

        <p className="text-blue-400 text-xs mt-10 leading-relaxed max-w-xs">
          Sign in to access your parking dashboard, view slot availability, and manage your QR pass.
        </p>
      </div>
    </MobileFrame>
  );
}

function LoginScreen({ onBack, onSuccess }: { onBack: () => void; onSuccess: (user: MobileUser) => void }) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const DEMOS = [
    { label: 'Student', email: 'student@pass.edu' },
    { label: 'Faculty', email: 'faculty@pass.edu' },
    { label: 'Employee', email: 'employee@pass.edu' },
    { label: 'Parking Staff', email: 'parking@pass.edu' },
    { label: 'Guest', email: 'guest@pass.edu' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    const found = MOBILE_ACCOUNTS[email.toLowerCase()];
    if (found) {
      onSuccess(found);
    } else {
      setError('Invalid credentials. Try a demo account below.');
    }
  };

  return (
    <MobileFrame bg="bg-white">
      <div className="px-6 py-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#2563EB] text-sm mb-6 font-medium">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><PassMark size="xl" /></div>
          <h2 className="text-2xl font-bold text-[#080677]">Sign In</h2>
          <p className="text-slate-400 text-sm mt-1">PASS Mobile</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-5 flex gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />{error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Email or ID</label>
            <input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@university.edu"
              className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Password</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••"
                className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading || !email}
            className="w-full py-4 bg-[#2563EB] text-white font-bold rounded-xl disabled:opacity-50 active:scale-95 transition-all">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center mb-3">Demo accounts</p>
          <div className="grid grid-cols-4 gap-2">
            {DEMOS.map(d => (
              <button key={d.email} onClick={() => setEmail(d.email)}
                className="text-xs py-2 px-1 rounded-xl bg-blue-50 text-[#2563EB] font-medium text-center">
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}

function RegisterScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  // Same form, steps and validation as the web /register page.
  return (
    <MobileFrame bg="bg-white">
      <div className="px-6 py-8">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3"><PassMark size="lg" /></div>
          <h2 className="text-2xl font-bold text-[#080677]">Create Account</h2>
        </div>
        <RegistrationForm variant="mobile" onExit={onBack} onBackToLogin={onDone} />
      </div>
    </MobileFrame>
  );
}

// Role-based home screens
function HomeScreen({ user, onNavigate, onLogout }: { user: MobileUser; onNavigate: (s: MobileScreen) => void; onLogout: () => void }) {
  const isGuest = user.role === 'guest';
  const isParkingStaff = user.role === 'parking_staff';
  const { status: licenseStatus } = useLicense();

  if (isGuest) {
    return (
      <MobileFrame bg="bg-[#F4F7FB]">
        <div className="bg-[#080677] px-5 pt-8 pb-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-blue-300 text-sm">Welcome, Guest!</p>
              <h2 className="text-white font-bold text-xl">{user.name}</h2>
            </div>
            <div className="bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs px-2 py-1 rounded-full">Guest</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-3">
            <Info size={18} className="text-[#38BDF8]" />
            <p className="text-blue-200 text-xs leading-relaxed flex-1">Submit a visitor parking request with your visit purpose and vehicle details. A QR pass is available only after approval.</p>
          </div>
        </div>
        <div className="px-5 -mt-4 space-y-4">
          <button onClick={() => onNavigate('guest-request')} className="w-full bg-[#080677] text-white rounded-2xl p-5 flex items-center justify-between shadow-lg active:scale-95 transition-all">
            <div className="flex items-center gap-3">
              <ClipboardList size={28} />
              <div className="text-left"><p className="font-bold">Visitor Parking Request</p><p className="text-blue-200 text-xs">Submit details and check approval</p></div>
            </div>
            <ChevronRight size={20} />
          </button>
          <button onClick={() => onNavigate('parking')} className="w-full bg-white rounded-2xl p-5 flex items-center justify-between border border-blue-100 shadow-sm active:scale-95 transition-all">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><MapPin size={18} className="text-[#2563EB]" /></div>
              <div><p className="font-semibold text-slate-700">Parking Availability</p><p className="text-xs text-slate-400">View available slots</p></div>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>
        </div>
      </MobileFrame>
    );
  }

  if (isParkingStaff) {
    return (
      <MobileFrame bg="bg-[#F4F7FB]">
        <div className="bg-[#080677] px-5 pt-8 pb-10">
          <p className="text-blue-300 text-sm">Parking Staff</p>
          <h2 className="text-white font-bold text-xl">{user.name}</h2>
          <p className="text-blue-300 text-sm mt-1">Campus parking operations</p>
        </div>
        <div className="px-5 -mt-4 grid grid-cols-2 gap-3">
          {[
            { label: 'Vehicle Verify', icon: <Car size={22} />, color: 'bg-blue-600' },
            { label: 'Visitor QR', icon: <QrCode size={22} />, color: 'bg-green-600' },
            { label: 'Occupancy', icon: <ParkingSquare size={22} />, color: 'bg-amber-600' },
            { label: 'Access Records', icon: <Activity size={22} />, color: 'bg-slate-600' },
          ].map(a => (
            <button key={a.label} className={`${a.color} text-white rounded-2xl p-5 flex flex-col items-center gap-2 shadow active:scale-95 transition-all`}>
              {a.icon}
              <span className="text-sm font-semibold">{a.label}</span>
            </button>
          ))}
        </div>
        <div className="px-5 mt-4">
          <div className="bg-white rounded-2xl border border-blue-100 p-4">
            <p className="font-semibold text-slate-700 mb-3 text-sm">Today's Stats</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-2xl font-bold text-green-600">127</p><p className="text-xs text-slate-400">Entries</p></div>
              <div><p className="text-2xl font-bold text-blue-600">89</p><p className="text-xs text-slate-400">Exits</p></div>
              <div><p className="text-2xl font-bold text-red-600">3</p><p className="text-xs text-slate-400">Denied</p></div>
            </div>
          </div>
        </div>
      </MobileFrame>
    );
  }

  // Student/Faculty/Employee home
  return (
    <MobileFrame bg="bg-[#F4F7FB]">
      <div className="bg-[#080677] px-5 pt-8 pb-12">
        <div className="flex justify-between items-start mb-1">
          <div>
            <p className="text-blue-300 text-sm">Good morning</p>
            <h2 className="text-white font-bold text-xl">{user.name}</h2>
          </div>
          <button onClick={() => onNavigate('notifications')} className="relative p-2 bg-white/10 rounded-xl">
            <Bell size={18} className="text-white" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full" />
          </button>
        </div>
        <div className="bg-white/10 border border-white/20 rounded-2xl p-4 mt-4 flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs font-medium">Current Status</p>
            <p className="text-white font-bold">Not Parked</p>
          </div>
          <div className="text-right">
            <p className="text-blue-200 text-xs font-medium">Vehicle</p>
            <p className="text-white font-semibold font-mono">ABC-1234</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-5 space-y-3">
        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Availability', icon: <ParkingSquare size={20} />, color: 'bg-white', text: 'text-[#2563EB]', screen: 'parking' as MobileScreen },
            { label: 'History', icon: <Clock size={20} />, color: 'bg-white', text: 'text-green-600', screen: 'history' as MobileScreen },
            { label: 'Profile', icon: <User size={20} />, color: 'bg-white', text: 'text-purple-600', screen: 'profile' as MobileScreen },
          ].map(a => (
            <button key={a.label} onClick={() => onNavigate(a.screen)} className={`${a.color} border border-blue-100 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm active:scale-95 transition-all`}>
              <div className={a.text}>{a.icon}</div>
              <span className="text-xs font-semibold text-slate-600">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Driver's license verification status */}
        <button onClick={() => onNavigate('license')} className="w-full bg-white rounded-2xl border border-blue-100 p-4 shadow-sm flex items-center gap-3 text-left active:scale-95 transition-all">
          <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${licenseStatus === 'verified' ? 'bg-green-100 text-green-600' : licenseStatus === 'pending_review' || licenseStatus === 'processing' ? 'bg-amber-100 text-amber-600' : licenseStatus === 'needs_correction' ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-[#2563EB]'}`}><IdCard size={18} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-slate-700">Driver&apos;s License</span>
            <span className="block text-xs text-slate-500">{LICENSE_STATUS_LABEL[licenseStatus]}{licenseStatus === 'not_submitted' ? ' — tap to submit' : licenseStatus === 'needs_correction' ? ' — tap to resubmit' : ''}</span>
          </span>
          <ChevronRight size={16} className="text-slate-300 shrink-0" />
        </button>

        {/* Parking availability preview */}
        <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-slate-700 text-sm">Parking Available</p>
            <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />77 slots
            </span>
          </div>
          <div className="space-y-2.5">
            {ZONE_CAPACITY.slice(0, 3).map(z => {
              const free = z.capacity - z.occupied;
              return (
                <div key={z.zone} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-400 w-12">{z.zone}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${free < 5 ? 'bg-red-500' : free < 15 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${(free / z.capacity) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 w-8 text-right">{free}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
          <p className="font-semibold text-slate-700 text-sm mb-3">Recent Activity</p>
          <div className="space-y-2">
            {[{ date: 'Sep 1', entry: '7:32 AM', exit: '5:45 PM', duration: '10h 13m' }, { date: 'Aug 30', entry: '8:10 AM', exit: '6:00 PM', duration: '9h 50m' }].map((h, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50">
                <div><p className="text-sm font-medium text-slate-700">{h.date}</p><p className="text-xs text-slate-400">{h.entry} → {h.exit}</p></div>
                <span className="text-sm font-bold text-[#2563EB]">{h.duration}</span>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate('history')} className="text-xs text-[#2563EB] font-semibold mt-2">View all history →</button>
        </div>
      </div>
      <div className="h-24" />
    </MobileFrame>
  );
}

function ParkingScreen() {
  return (
    <MobileFrame bg="bg-[#F4F7FB]">
      <div className="px-5 pt-6 pb-4">
        <h2 className="text-xl font-bold text-[#080677]">Parking Availability</h2>
        <p className="text-sm text-slate-400">Live slot status</p>
      </div>

      <div className="mx-5 bg-[#080677] rounded-2xl p-5 text-white mb-5 shadow-lg">
        <p className="text-blue-200 text-xs font-medium">Total Available Now</p>
        <p className="text-5xl font-bold text-[#38BDF8]">77</p>
        <p className="text-blue-200 text-sm">of 180 total slots</p>
        <p className="text-xs text-blue-300 mt-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          Last updated just now
        </p>
      </div>

      <div className="px-5 space-y-3 mb-5">
        {ZONE_CAPACITY.map(z => {
          const free = z.capacity - z.occupied;
          const pct = (free / z.capacity) * 100;
          return (
            <div key={z.zone} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-slate-700">{z.zone}</p>
                <span className={`text-lg font-bold ${free < 5 ? 'text-red-500' : free < 15 ? 'text-amber-500' : 'text-green-500'}`}>{free} free</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${free < 5 ? 'bg-red-500' : free < 15 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                <span>{z.occupied} occupied</span>
                <span>{z.reserved} reserved</span>
                <span>{z.capacity} total</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 mb-5">
        <div className="bg-white rounded-2xl border border-blue-100 p-4">
          <p className="font-semibold text-slate-700 text-sm mb-3">Filter by Vehicle Type</p>
          <div className="flex gap-2 flex-wrap">
            {['All', 'Sedan', 'SUV', 'Motorcycle', 'Van'].map(t => (
              <button key={t} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${t === 'All' ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'border-slate-200 text-slate-500'}`}>{t}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-24" />
    </MobileFrame>
  );
}

function HistoryScreen() {
  const sessions = [
    { date: 'Sep 1, 2024', entry: '7:32 AM', exit: '5:45 PM', zone: 'Zone A', plate: 'ABC-1234', duration: '10h 13m', method: 'RFID' },
    { date: 'Aug 30, 2024', entry: '8:10 AM', exit: '6:00 PM', zone: 'Zone B', plate: 'ABC-1234', duration: '9h 50m', method: 'RFID' },
    { date: 'Aug 28, 2024', entry: '7:55 AM', exit: '4:30 PM', zone: 'Zone A', plate: 'ABC-1234', duration: '8h 35m', method: 'RFID' },
    { date: 'Aug 26, 2024', entry: '9:00 AM', exit: '3:00 PM', zone: 'Zone C', plate: 'ABC-1234', duration: '6h 00m', method: 'RFID' },
  ];

  return (
    <MobileFrame bg="bg-[#F4F7FB]">
      <div className="px-5 pt-6 pb-4">
        <h2 className="text-xl font-bold text-[#080677]">Parking History</h2>
        <p className="text-sm text-slate-400">ABC-1234 — Toyota Vios</p>
      </div>
      <div className="px-5 mb-4">
        <input type="search" placeholder="Search by date..." className="w-full bg-white border border-blue-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] shadow-sm" />
      </div>
      <div className="px-5 space-y-3">
        {sessions.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-slate-700">{s.date}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.zone} · {s.method}</p>
              </div>
              <span className="text-[#2563EB] font-bold text-sm">{s.duration}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs mt-3 text-slate-500">
              <div><p className="text-slate-300">Entry</p><p className="font-semibold text-slate-600">{s.entry}</p></div>
              <div><p className="text-slate-300">Exit</p><p className="font-semibold text-slate-600">{s.exit}</p></div>
              <div><p className="text-slate-300">Plate</p><p className="font-semibold font-mono text-[#080677]">{s.plate}</p></div>
            </div>
          </div>
        ))}
      </div>
      <div className="h-24" />
    </MobileFrame>
  );
}

function NotificationScreen() {
  const [notifs, setNotifs] = useState(MOCK_NOTIFS);
  const unread = notifs.filter(n => !n.read).length;

  return (
    <MobileFrame bg="bg-[#F4F7FB]">
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#080677]">Notifications</h2>
          {unread > 0 && <p className="text-sm text-slate-400">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button onClick={() => setNotifs(n => n.map(i => ({ ...i, read: true })))} className="text-xs text-[#2563EB] font-semibold">Mark all read</button>
        )}
      </div>
      <div className="px-5 space-y-3">
        {notifs.map(n => (
          <div key={n.id} onClick={() => setNotifs(ns => ns.map(i => i.id === n.id ? { ...i, read: true } : i))}
            className={`bg-white rounded-2xl border p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-all ${!n.read ? 'border-blue-300 bg-blue-50/30' : 'border-blue-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold ${n.read ? 'text-slate-500' : 'text-slate-800'}`}>{n.title}</p>
              {!n.read && <span className="w-2 h-2 bg-[#2563EB] rounded-full mt-1.5 shrink-0" />}
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.body}</p>
            <p className="text-xs text-slate-300 mt-2">{n.time}</p>
          </div>
        ))}
      </div>
      <div className="h-24" />
    </MobileFrame>
  );
}

type GuestRequestStatus = 'not_submitted' | 'pending' | 'approved';
type GuestRequestData = { reason: string; contactPerson: string; visitDate: string; arrivalTime: string; vehicleType: string; plate: string; makeModel: string };

function GuestRequestScreen({ status, setStatus, details, setDetails }: { status: GuestRequestStatus; setStatus: (s: GuestRequestStatus) => void; details: GuestRequestData | null; setDetails: (d: GuestRequestData) => void }) {
  const [form, setForm] = useState<GuestRequestData>({ reason: '', contactPerson: '', visitDate: '', arrivalTime: '', vehicleType: 'Motorcycle', plate: '', makeModel: '' });
  const [error, setError] = useState('');
  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200';
  const update = (key: keyof GuestRequestData, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  return <MobileFrame bg="bg-[#F4F7FB]">
    <div className="px-5 pt-6 pb-3"><h2 className="text-xl font-bold text-[#080677]">Visitor Parking Request</h2><p className="text-xs text-slate-500 mt-1">Vehicle details are required for every visitor parking request.</p></div>
    {status === 'not_submitted' ? <form className="px-5 pb-8 space-y-3" onSubmit={e => { e.preventDefault(); if (!form.reason.trim() || !form.contactPerson.trim() || !form.visitDate || !form.arrivalTime || !form.plate.trim() || !form.makeModel.trim()) { setError('Please complete all required fields.'); return; } setDetails(form); setStatus('pending'); setError(''); }}>
      <label className="block text-xs font-semibold text-slate-600">Reason for visiting *<textarea value={form.reason} onChange={e => update('reason', e.target.value)} className={`${field} mt-1`} rows={3} placeholder="Purpose of your campus visit" /></label>
      <label className="block text-xs font-semibold text-slate-600">Person / office to visit *<input value={form.contactPerson} onChange={e => update('contactPerson', e.target.value)} className={`${field} mt-1`} placeholder="Name or office" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-semibold text-slate-600">Visit date *<input type="date" min={new Date().toISOString().slice(0,10)} value={form.visitDate} onChange={e => update('visitDate', e.target.value)} className={`${field} mt-1`} /></label><label className="block text-xs font-semibold text-slate-600">Arrival time *<input type="time" value={form.arrivalTime} onChange={e => update('arrivalTime', e.target.value)} className={`${field} mt-1`} /></label></div>
      <div className="border-t border-slate-200 pt-3"><h3 className="font-bold text-sm text-[#080677] mb-3 flex items-center gap-2"><Car size={18}/> Vehicle Details</h3>
      <label className="block text-xs font-semibold text-slate-600">Vehicle type *<select value={form.vehicleType} onChange={e => update('vehicleType', e.target.value)} className={`${field} mt-1`}><option>Motorcycle</option><option>Car</option><option>Other</option></select></label>
      <label className="block text-xs font-semibold text-slate-600 mt-3">Plate number *<input value={form.plate} onChange={e => update('plate', e.target.value)} className={`${field} mt-1`} placeholder="e.g. ABC-1234" /></label>
      <label className="block text-xs font-semibold text-slate-600 mt-3">Vehicle make and model *<input value={form.makeModel} onChange={e => update('makeModel', e.target.value)} className={`${field} mt-1`} placeholder="e.g. Toyota Vios" /></label></div>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-3">Your request must be approved before a temporary visitor QR pass can be issued. This is a UI prototype; submissions are not sent to a real administrator.</p>
      <button type="submit" className="w-full rounded-xl bg-[#080677] text-white py-3.5 font-semibold text-sm">Submit for Approval</button>
    </form> : <div className="px-5 pb-8 space-y-3">
      <div className={`rounded-2xl p-4 border ${status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}><div className={`flex items-center gap-2 font-bold ${status === 'approved' ? 'text-green-800' : 'text-amber-800'}`}>{status === 'approved' ? <CheckCircle size={20}/> : <Clock size={20}/>} {status === 'approved' ? 'Request Approved' : 'Pending Approval'}</div><p className="text-xs mt-2 text-slate-600">{status === 'approved' ? 'Approved-state preview is shown below. The sample QR is not valid for entry.' : 'Your request is waiting for review. No visitor QR pass is available yet.'}</p></div>
      {details && <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 text-sm"><div><p className="text-xs text-slate-400">Reason for visit</p><p className="font-medium text-slate-700">{details.reason}</p></div><div><p className="text-xs text-slate-400">Person / office</p><p className="font-medium text-slate-700">{details.contactPerson}</p></div><div><p className="text-xs text-slate-400">Visit schedule</p><p className="font-medium text-slate-700">{details.visitDate} · {details.arrivalTime}</p></div><div><p className="text-xs text-slate-400">Registered vehicle</p><p className="font-medium text-slate-700">{details.vehicleType} · {details.makeModel} · {details.plate}</p></div></div>}
      {status === 'pending' && <button onClick={() => setStatus('approved')} className="w-full rounded-xl border border-green-600 text-green-700 bg-white py-3 text-sm font-semibold">Preview approved state (demo only)</button>}
      {status === 'approved' && <div className="bg-white rounded-2xl border border-green-200 p-4 text-center"><div className="mx-auto grid grid-cols-7 gap-1 w-fit p-3 border border-slate-100 rounded-xl">{Array.from({length:49}).map((_,i)=><span key={i} className={`w-4 h-4 rounded-[2px] ${[0,1,2,3,4,5,6,7,13,14,15,20,21,22,27,28,29,35,36,37,38,39,40,41,42,43,44,45,46,47,48,10,16,24,30,32].includes(i) ? 'bg-[#080677]' : 'bg-white border border-slate-100'}`}/>)}</div><p className="text-xs font-bold text-[#080677] mt-3">APPROVED STATE — DEMO QR PREVIEW</p><p className="text-[11px] text-slate-500 mt-1">Not scannable; backend-issued authorization required.</p></div>}
      <button onClick={() => { setStatus('not_submitted'); setDetails({ reason: '', contactPerson: '', visitDate: '', arrivalTime: '', vehicleType: 'Motorcycle', plate: '', makeModel: '' }); }} className="w-full py-3 text-sm text-slate-500">Reset demo request</button>
    </div>}
  </MobileFrame>;
}

function QRPassScreen({ user, guestStatus }: { user: MobileUser; guestStatus: GuestRequestStatus }) {
  const isGuest = user.role === 'guest';
  if (isGuest) return <MobileFrame bg="bg-[#F4F7FB]"><div className="px-5 pt-6 pb-5"><h2 className="text-xl font-bold text-[#080677]">Visitor QR Pass</h2><div className={`mt-4 rounded-2xl border p-5 ${guestStatus === 'approved' ? 'bg-green-50 border-green-200' : 'bg-white border-amber-200'}`}><div className={`flex items-center gap-2 font-bold ${guestStatus === 'approved' ? 'text-green-800' : 'text-amber-700'}`}>{guestStatus === 'approved' ? <CheckCircle size={20}/> : <Clock size={20}/>} {guestStatus === 'approved' ? 'Approved-state Preview' : guestStatus === 'pending' ? 'Request Pending' : 'No Approved Pass'}</div><p className="text-sm text-slate-600 mt-2">{guestStatus === 'approved' ? 'This is a non-scannable sample preview only. An actual pass must be issued by the connected approval system.' : guestStatus === 'pending' ? 'Your request is awaiting approval. No QR pass is available yet.' : 'Submit your visitor parking request first. A QR pass cannot be used before approval.'}</p>{guestStatus === 'approved' && <div className="mt-4 bg-white rounded-xl p-4 flex flex-col items-center"><div className="grid grid-cols-7 gap-1 p-2">{Array.from({length:49}).map((_,i)=><span key={i} className={`w-4 h-4 rounded-[2px] ${[0,1,2,3,4,5,6,7,13,14,15,20,21,22,27,28,29,35,36,37,38,39,40,41,42,43,44,45,46,47,48,10,16,24,30,32].includes(i) ? 'bg-[#080677]' : 'bg-white border border-slate-100'}`}/>)}</div><p className="text-[10px] font-bold text-[#080677] mt-2">DEMO ONLY — NOT VALID FOR ENTRY</p></div>}</div></div></MobileFrame>;
  return (
    <MobileFrame bg="bg-[#F4F7FB]">
      <div className="px-5 pt-6 pb-4">
        <h2 className="text-xl font-bold text-[#080677]">My QR Pass</h2>
        <p className="text-sm text-slate-400">Show at campus gate</p>
      </div>
      <div className="px-5">
        <div className="bg-[#080677] rounded-3xl p-6 text-white shadow-2xl">
          <div className="flex items-center gap-2 mb-5">
            <DyciLogo onDark className="h-6" />
            <div>
              <p className="text-xs text-blue-200 font-medium">PASS — {isGuest ? 'Visitor' : 'Campus'} QR Access Pass</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold">{user.name}</h2>
          <p className="text-blue-300 text-xs mt-0.5">{isGuest ? 'Guest Account' : `${user.role} — ${user.email}`}</p>
          <div className="my-6 bg-white rounded-2xl p-4 flex items-center justify-center">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 49 }).map((_, i) => (
                <div key={i} className={`w-5 h-5 rounded-sm ${[0,1,2,3,4,5,6,7,14,21,28,35,42,43,44,45,46,47,48,16,17,18,19,24,25].includes(i) ? 'bg-[#080677]' : 'bg-white'}`} />
              ))}
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-300">Valid Until</span>
              <span className="font-semibold">Today, 11:59 PM</span>
            </div>
            {!isGuest && (
              <div className="flex justify-between">
                <span className="text-blue-300">Vehicle</span>
                <span className="font-semibold font-mono">ABC-1234</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-blue-300">Access</span>
              <span className="font-semibold">{isGuest ? 'Visitor Zone' : 'All Zones'}</span>
            </div>
          </div>
          <p className="text-[10px] text-blue-400 text-center mt-5 border-t border-white/10 pt-4">
            Present this QR code at the campus entrance gate
          </p>
        </div>
        <button className="w-full mt-4 py-3.5 border border-[#2563EB] text-[#2563EB] font-semibold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
          <QrCode size={18} /> Refresh QR Pass
        </button>
      </div>
      <div className="h-24" />
    </MobileFrame>
  );
}

function ProfileScreen({ user, onLogout, onNavigate }: { user: MobileUser; onLogout: () => void; onNavigate: (s: MobileScreen) => void }) {
  const { status: licenseStatus } = useLicense();
  const roleLabel = user.role === 'parking_staff'
    ? 'Parking Staff'
    : user.role === 'guest'
      ? 'Guest / Visitor'
      : (user.role ?? "user").charAt(0).toUpperCase() + (user.role ?? "user").slice(1);

  // Show profile actions based on the signed-in user's role.
  const profileItems = user.role === 'parking_staff'
    ? [
        { label: 'Edit Profile', description: 'Update your staff contact details', icon: <User size={18} /> },
        { label: 'Notifications', description: 'View parking alerts and updates', icon: <Bell size={18} /> },
        { label: 'Settings', description: 'Manage app preferences', icon: <Settings size={18} /> },
      ]
    : user.role === 'guest'
      ? [
          { label: 'Edit Profile', description: 'Update your visitor details', icon: <User size={18} /> },
          { label: 'Visitor Parking Request', description: 'Review your visit request and vehicle details', icon: <ClipboardList size={18} /> },
          { label: 'Visitor Pass', description: 'Available only after request approval', icon: <QrCode size={18} /> },
          { label: 'Notifications', description: 'View request status and updates', icon: <Bell size={18} /> },
          { label: 'Settings', description: 'Manage app preferences', icon: <Settings size={18} /> },
        ]
      : [
          { label: 'Edit Profile', description: 'Update your account details', icon: <User size={18} /> },
          { label: "Driver's License", description: `Verification: ${LICENSE_STATUS_LABEL[licenseStatus]}`, icon: <IdCard size={18} />, screen: 'license' as MobileScreen },
          { label: 'My Vehicles', description: 'View and manage your registered vehicles', icon: <Car size={18} /> },
          { label: 'RFID Card', description: 'View your regular parking access card', icon: <CreditCard size={18} /> },
          { label: 'Notifications', description: 'View parking updates and alerts', icon: <Bell size={18} /> },
          { label: 'Settings', description: 'Manage app preferences', icon: <Settings size={18} /> },
        ];

  return (
    <MobileFrame bg="bg-[#F4F7FB]">
      <div className="bg-[#080677] px-5 pt-8 pb-12">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#38BDF8]/20 border-2 border-[#38BDF8]/30 flex items-center justify-center text-3xl font-bold text-white mb-3">
            {user.name[0]}
          </div>
          <h2 className="text-white font-bold text-xl">{user.name}</h2>
          <p className="text-blue-300 text-sm">{user.email}</p>
          <span className="mt-2 bg-[#38BDF8]/20 text-[#38BDF8] text-xs px-3 py-1 rounded-full font-medium">{roleLabel}</span>
          <p className="text-blue-100/80 text-xs mt-2">
            {user.role === 'parking_staff'
              ? 'Parking operations account'
              : user.role === 'guest'
                ? 'Temporary visitor account'
                : 'Regular PASS account'}
          </p>
        </div>
      </div>
      <div className="px-5 -mt-4 space-y-3 pb-5">
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
          {profileItems.map((item, i) => (
            <button
              key={item.label}
              type="button"
              onClick={() => (item as any).screen && onNavigate((item as any).screen)}
              className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-blue-50/50 active:bg-blue-50 transition-colors text-left ${i > 0 ? 'border-t border-slate-100' : ''}`}
            >
              <span className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">{item.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-700">{item.label}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{item.description}</span>
              </span>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 border border-red-200 text-red-600 font-semibold rounded-2xl active:scale-95 transition-all">
          <LogOut size={18} /> Sign Out
        </button>
      </div>
      <div className="h-24" />
    </MobileFrame>
  );
}

function LicenseScreen({ user, onBack }: { user: MobileUser; onBack: () => void }) {
  return (
    <MobileFrame bg="bg-[#F4F7FB]">
      <div className="px-5 pt-6 pb-24">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#2563EB] text-sm mb-4 font-medium"><ArrowLeft size={18} /> Back</button>
        <h2 className="text-xl font-bold text-[#080677] mb-1">Driver&apos;s License</h2>
        <p className="text-xs text-slate-500 mb-4">Required before you can register a vehicle. You can submit it even if you skipped the vehicle step at sign-up.</p>
        <DriverLicenseVerification variant="mobile" owner={user.name} />
      </div>
    </MobileFrame>
  );
}

// Bottom nav tabs based on role
function getNavItems(role: MobileRole) {
  if (role === 'parking_staff') {
    return [
      { key: 'home', label: 'Dashboard', icon: <Home size={22} /> },
      { key: 'parking', label: 'Parking', icon: <ParkingSquare size={22} /> },
      { key: 'notifications', label: 'Alerts', icon: <Bell size={22} /> },
      { key: 'profile', label: 'Profile', icon: <User size={22} /> },
    ];
  }
  if (role === 'guest') {
    return [
      { key: 'home', label: 'Home', icon: <Home size={22} /> },
      { key: 'qr', label: 'Visitor Pass', icon: <QrCode size={22} /> },
      { key: 'parking', label: 'Parking', icon: <ParkingSquare size={22} /> },
      { key: 'profile', label: 'Profile', icon: <User size={22} /> },
    ];
  }
  return [
    { key: 'home', label: 'Home', icon: <Home size={22} /> },
    { key: 'parking', label: 'Parking', icon: <ParkingSquare size={22} /> },
    { key: 'history', label: 'History', icon: <Clock size={22} /> },
    { key: 'notifications', label: 'Notifs', icon: <Bell size={22} /> },
    { key: 'profile', label: 'Profile', icon: <User size={22} /> },
  ];
}

export default function MobileApp() {
  const [authScreen, setAuthScreen] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [mobileUser, setMobileUser] = useState<MobileUser | null>(null);
  const [activeTab, setActiveTab] = useState<MobileScreen>('home');
  const [guestRequestStatus, setGuestRequestStatus] = useState<GuestRequestStatus>('not_submitted');
  const [guestRequestDetails, setGuestRequestDetails] = useState<GuestRequestData | null>(null);

  const handleLogin = (user: MobileUser) => {
    setMobileUser(user);
    setActiveTab('home');
  };

  const handleLogout = () => {
    setMobileUser(null);
    setGuestRequestStatus('not_submitted');
    setGuestRequestDetails(null);
    setAuthScreen('welcome');
  };

  const handleGuest = () => {
    setMobileUser({ name: 'Guest User', role: 'guest', email: 'guest@pass.edu' });
    setActiveTab('home');
  };

  const navItems = mobileUser ? getNavItems(mobileUser.role) : [];

  return (
    <div className="min-h-[100dvh] bg-slate-200 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-3 sm:mb-4">
          <a href="/" className="text-sm text-slate-600 hover:text-[#2563EB] inline-flex items-center justify-center gap-1.5 transition-colors">
            <ArrowLeft size={14} /> Back to PASS Web
          </a>
        </div>

        {/* Responsive phone preview: fits shorter screens and narrow browser windows */}
        <div className="relative mx-auto" style={{ width: 'min(375px, calc(100vw - 24px))' }}>
          <div className="bg-slate-800 rounded-[2.5rem] sm:rounded-[3rem] p-2 sm:p-3 shadow-2xl">
            <div className="bg-black rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col" style={{ height: 'min(780px, calc(100dvh - 112px))', minHeight: '420px' }}>
              <div className="bg-black flex shrink-0 items-center justify-between px-6 py-2 text-white text-xs">
                <span>9:41 AM</span>
                <div className="w-20 sm:w-28 h-5 bg-black rounded-full" />
                <div className="flex items-center gap-1 text-[10px]">
                  <span>●●●</span><span>WiFi</span><span>100%</span>
                </div>
              </div>

              <div className="bg-white flex-1 min-h-0 overflow-hidden">
                <div className="h-full min-h-0 overflow-hidden">
                  {!mobileUser && (
                    <div className="h-full min-h-0 overflow-y-auto">
                      {authScreen === 'welcome' && <WelcomeScreen onLogin={() => setAuthScreen('login')} onRegister={() => setAuthScreen('register')} onGuest={handleGuest} />}
                      {authScreen === 'login' && <LoginScreen onBack={() => setAuthScreen('welcome')} onSuccess={handleLogin} />}
                      {authScreen === 'register' && <RegisterScreen onBack={() => setAuthScreen('welcome')} onDone={() => setAuthScreen('login')} />}
                    </div>
                  )}

                  {mobileUser && (
                    <div className="h-full min-h-0 overflow-hidden">
                      {activeTab === 'home' && <HomeScreen user={mobileUser} onNavigate={tab => setActiveTab(tab)} onLogout={handleLogout} />}
                      {activeTab === 'guest-request' && mobileUser.role === 'guest' && <GuestRequestScreen status={guestRequestStatus} setStatus={setGuestRequestStatus} details={guestRequestDetails} setDetails={setGuestRequestDetails} />}
                      {activeTab === 'parking' && <ParkingScreen />}
                      {activeTab === 'history' && <HistoryScreen />}
                      {activeTab === 'notifications' && <NotificationScreen />}
                      {activeTab === 'qr' && <QRPassScreen user={mobileUser} guestStatus={guestRequestStatus} />}
                      {activeTab === 'license' && mobileUser.role !== 'guest' && mobileUser.role !== 'parking_staff' && <LicenseScreen user={mobileUser} onBack={() => setActiveTab('profile')} />}
                      {activeTab === 'profile' && <ProfileScreen user={mobileUser} onLogout={handleLogout} onNavigate={tab => setActiveTab(tab)} />}
                    </div>
                  )}
                </div>
              </div>

              {mobileUser && (
                <div className="bg-white border-t border-slate-100 flex shrink-0 items-center justify-around px-1 sm:px-2" style={{ height: '64px' }}>
                  {navItems.map(item => (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.key as MobileScreen)}
                      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all ${activeTab === item.key ? 'text-[#2563EB]' : 'text-slate-400'}`}
                    >
                      {item.icon}
                      <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-center mt-2">
            <div className="w-24 h-1 bg-slate-600 rounded-full" />
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-3">PASS Mobile — Simulated Web Preview</p>
      </div>
    </div>
  );
}
