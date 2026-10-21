import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup, CampusPhoto, DyciLogo, GoldRule } from '../components/Brand';
import { BRAND } from '../config/branding';
import { Shield, MapPin, Clock, QrCode, Info, LogIn, UserPlus, Car, ChevronRight, CreditCard, Lock, MapPin as Pin, Globe } from 'lucide-react';

const AVAILABLE = [
  { icon: <MapPin size={24} />, title: 'Visitor Parking Request', desc: 'Submit your visit purpose, schedule, and required vehicle details for review.' },
  { icon: <QrCode size={24} />, title: 'Visitor QR Pass After Approval', desc: 'A temporary QR pass is available only after your request is approved.' },
  { icon: <Clock size={24} />, title: 'Request Status', desc: 'Check whether your visitor request is pending, approved, or rejected.' },
];

const NOT_INCLUDED = [
  { icon: <Car size={20} />, title: 'Vehicle Registration', desc: 'Permanent vehicle registration is for students, faculty and employees.' },
  { icon: <CreditCard size={20} />, title: 'RFID Access', desc: 'Persistent RFID access and campus vehicle privileges.' },
  { icon: <Lock size={20} />, title: 'Reserved Parking', desc: 'Reserved or designated parking zones.' },
];

const STEPS = [
  { step: '01', title: 'Register as Guest', desc: 'Create a guest account with your name and contact info. No institutional ID required.' },
  { step: '02', title: 'Submit Parking Request', desc: 'Provide your reason for visiting, visit schedule, and required vehicle details.' },
  { step: '03', title: 'Wait for Approval', desc: 'After approval, a temporary visitor QR pass may be issued for the approved visit.' },
];

export default function GuestLandingPage() {
  return (
    <div className="min-h-screen bg-white font-['Inter']">
      {/* Nav — same as home page */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-blue-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/"><BrandLockup /></Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors">Sign In</Link>
            <Link to="/register" className="px-4 py-2 text-sm font-medium bg-[#080677] text-white rounded-lg hover:bg-[#0a0a99] transition-colors">Register</Link>
          </div>
        </div>
      </nav>

      {/* Hero — same campus-photo hero as home page */}
      <CampusPhoto>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20 text-white">
          <div className="max-w-2xl">
            <GoldRule className="mb-5" />
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-[#96D1F2] px-3 py-1.5 rounded-full text-xs font-medium mb-4">
              <Info size={14} /> Guest / Visitor Access
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-5">Visiting the DYCI campus?</h1>
            <p className="text-blue-100 text-lg leading-relaxed mb-8">
              Register as a guest and submit a visitor parking request. A temporary QR pass is issued only after your request is approved.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register/guest" className="flex items-center gap-2 px-6 py-3 bg-[#96D1F2] text-[#080677] font-bold rounded-lg hover:bg-[#b4def6] transition-colors">
                <UserPlus size={18} /> Register as Guest <ChevronRight size={18} />
              </Link>
              <Link to="/login" className="flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/30 text-white font-medium rounded-xl hover:bg-white/20 transition-colors">
                <LogIn size={18} /> Sign In
              </Link>
            </div>
            <p className="text-xs text-blue-200 mt-5">
              Student, faculty or employee?{' '}
              <Link to="/register" className="text-[#96D1F2] font-medium hover:underline">Register with your institutional ID →</Link>
            </p>
          </div>
        </div>
      </CampusPhoto>

      {/* What guests can do */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[#080677] mb-3">What Guest Access Includes</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Guest accounts are for short, approved campus visits.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {AVAILABLE.map(f => (
              <div key={f.title} className="p-6 bg-[#F4F7FB] rounded-2xl border border-blue-100 hover:border-[#2563EB] hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-[#2563EB]/10 text-[#2563EB] rounded-xl flex items-center justify-center mb-4">{f.icon}</div>
                <h3 className="font-semibold text-[#080677] mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Notice + not included */}
      <section className="py-20 bg-[#F4F7FB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-start">
          <div className="bg-[#080677] rounded-3xl p-8 text-white">
            <Shield size={40} className="text-[#38BDF8] mb-5" />
            <h3 className="text-2xl font-bold mb-3">Guest Account Notice</h3>
            <p className="text-blue-100 leading-relaxed">
              Guests must create a PASS Guest account and submit a visitor parking request with the visit purpose, schedule, and required vehicle details. Creating an account does not automatically authorize parking entry.
            </p>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-[#080677] mb-4">Not included for guests</h3>
            <div className="space-y-4">
              {NOT_INCLUDED.map(n => (
                <div key={n.title} className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">{n.icon}</div>
                  <div>
                    <p className="font-semibold text-slate-700 text-sm">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-[#080677] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold mb-10">How Guest Access Works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map(s => (
              <div key={s.step} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-[#38BDF8]/20 border border-[#38BDF8]/30 text-[#38BDF8] font-bold text-xl flex items-center justify-center mb-4">{s.step}</div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-blue-100 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <Link to="/register/guest" className="mt-10 inline-flex items-center gap-2 px-6 py-3 bg-[#96D1F2] hover:bg-[#b4def6] text-[#080677] font-bold rounded-lg transition-colors">
            <UserPlus size={20} /> Get Started — Register as Guest
          </Link>
        </div>
      </section>

      {/* Footer — same as home page */}
      <footer className="bg-[#080677] text-blue-100 py-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-10 mb-8">
            <div className="space-y-3">
              <DyciLogo onDark className="h-12" />
              <p className="text-sm leading-relaxed text-[#96D1F2]">Parking Access and Space Management System (PASS)</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Quick Links</h4>
              <div className="space-y-2 text-sm">
                <Link to="/" className="block hover:text-white transition-colors">Home</Link>
                <Link to="/login" className="block hover:text-white transition-colors">Sign In</Link>
                <Link to="/register" className="block hover:text-white transition-colors">Register</Link>
                <Link to="/mobile" className="block hover:text-white transition-colors">Mobile Access</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Institution</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Pin size={14} /> {BRAND.location}</div>
                <a href={BRAND.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white"><Globe size={14} /> dyci.edu.ph</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center text-xs text-blue-300">
            © {new Date().getFullYear()} Dr. Yanga&apos;s Colleges, Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
