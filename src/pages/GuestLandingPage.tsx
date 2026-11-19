import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup, CampusPhoto, DyciLogo, GoldRule } from '../components/Brand';
import { BRAND } from '../config/branding';
import { Shield, Info, LogIn, UserPlus, ChevronRight, MapPin as Pin, Globe } from 'lucide-react';

const STEPS = [
  { step: '01', title: 'Register as Guest', desc: 'Create your guest account.' },
  { step: '02', title: 'Submit Parking Request', desc: 'Add your visit, vehicle and driver details.' },
  { step: '03', title: 'Wait for Approval', desc: 'Your QR pass appears after approval. Bring it with your license.' },
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
              Create an account, request a visit, and get your QR pass after approval.
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

      <section className="px-4 sm:px-6 py-8 bg-[#F4F7FB]">
        <div className="max-w-4xl mx-auto flex items-start gap-3 text-sm text-slate-600">
          <Shield size={22} className="shrink-0 text-[#080677]" />
          <p>Wait for approval before visiting. Parking is subject to availability; guest passes do not include RFID access or reserved spaces.</p>
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
