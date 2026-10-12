import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup, CampusPhoto, DyciLogo, GoldRule } from '../components/Brand';
import { BRAND } from '../config/branding';
import { Shield, Car, Wifi, BarChart3, MapPin, Bell, ChevronRight, Smartphone, Users, ParkingSquare, CheckCircle, Phone, Mail, Globe } from 'lucide-react';

const FEATURES = [
  { icon: <Shield size={24} />, title: 'Secure RFID Access', desc: 'Manage RFID credentials for authorized campus vehicles and review recorded access results.' },
  { icon: <MapPin size={24} />, title: 'Live Parking Map', desc: 'Real-time parking slot availability with visual zone maps and instant updates.' },
  { icon: <Wifi size={24} />, title: 'QR Visitor Passes', desc: 'Generate temporary digital QR passes for campus visitors with time-limited access.' },
  { icon: <BarChart3 size={24} />, title: 'Analytics Dashboard', desc: 'Comprehensive reports and occupancy analytics for parking administrators.' },
  { icon: <Bell size={24} />, title: 'Smart Notifications', desc: 'Automated alerts for parking availability, violations, and access updates.' },
  { icon: <Smartphone size={24} />, title: 'Mobile Application', desc: 'Full-featured mobile app for checking availability, history, and QR passes on the go.' },
];

const STATS = [
  { label: 'Parking Slots', value: '180' },
  { label: 'Registered Vehicles', value: '320+' },
  { label: 'Daily Transactions', value: '400+' },
  { label: 'RFID Tags Active', value: '250+' },
];

const ZONE_DATA = [
  { zone: 'Zone A', available: 18, total: 50, color: 'bg-green-500' },
  { zone: 'Zone B', available: 2, total: 40, color: 'bg-red-500' },
  { zone: 'Zone C', available: 39, total: 60, color: 'bg-green-500' },
  { zone: 'Zone D', available: 18, total: 30, color: 'bg-amber-500' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-['Inter']">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-blue-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <BrandLockup />
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#features" className="hover:text-[#2563EB] transition-colors">Features</a>
            <a href="#parking" className="hover:text-[#2563EB] transition-colors">Parking Info</a>
            <a href="#about" className="hover:text-[#2563EB] transition-colors">About</a>
            <a href="#contact" className="hover:text-[#2563EB] transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors">Sign In</Link>
            <Link to="/register" className="px-4 py-2 text-sm font-medium bg-[#080677] text-white rounded-lg hover:bg-[#0a0a99] transition-colors">Register</Link>
            <Link
              to="/mobile"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#080677] text-white rounded-lg hover:bg-[#0F2E56] transition-colors"
            >
              <Smartphone size={15} />
              Mobile App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <CampusPhoto>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20 text-white">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <GoldRule className="mb-5" />
              <p className="text-[#96D1F2] text-sm font-medium mb-3">Dr. Yanga&apos;s Colleges, Inc.</p>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-5">
                Parking Access and Space Management System
              </h1>
              <p className="text-blue-100 text-lg leading-relaxed mb-8 max-w-lg">
                PASS supports DYCI parking access and space management with RFID credentials for regular users, parking availability, temporary visitor QR passes, and role-based administration.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/register" className="flex items-center gap-2 px-6 py-3 bg-[#96D1F2] text-[#080677] font-bold rounded-lg hover:bg-[#b4def6] transition-colors">
                  Register Now <ChevronRight size={18} />
                </Link>
                <Link to="/login" className="flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/30 text-white font-medium rounded-xl hover:bg-white/20 transition-colors">
                  Sign In
                </Link>
                <Link to="/guest" className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/20 text-blue-100 font-medium rounded-xl hover:bg-white/10 transition-colors text-sm">
                  Continue as Guest
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-3 h-3 bg-red-400 rounded-full" />
                    <div className="w-3 h-3 bg-amber-400 rounded-full" />
                    <div className="w-3 h-3 bg-green-400 rounded-full" />
                    <span className="text-xs text-white/60 ml-2">PASS Live Dashboard</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {STATS.map(s => (
                      <div key={s.label} className="bg-white/10 rounded-xl p-4">
                        <p className="text-2xl font-bold text-[#38BDF8]">{s.value}</p>
                        <p className="text-xs text-blue-200">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-200 mb-3">ZONE AVAILABILITY</p>
                    <div className="space-y-2.5">
                      {ZONE_DATA.map(z => (
                        <div key={z.zone}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-white/80">{z.zone}</span>
                            <span className="text-white font-medium">{z.available}/{z.total} free</span>
                          </div>
                          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div className={`h-full ${z.color} rounded-full`} style={{ width: `${(z.available / z.total) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 bg-white text-[#080677] px-4 py-2 rounded-lg shadow-lg text-xs font-semibold">
                  77 Slots Available Now
                </div>
              </div>
            </div>
          </div>
        </div>
      </CampusPhoto>

      {/* Features */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[#080677] mb-3">Everything You Need to Manage Campus Parking</h2>
            <p className="text-slate-500 max-w-xl mx-auto">PASS combines RFID access control, real-time monitoring, and digital visitor management in one integrated platform.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="p-6 bg-[#F4F7FB] rounded-2xl border border-blue-100 hover:border-[#2563EB] hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-[#2563EB]/10 text-[#2563EB] rounded-xl flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-[#080677] mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parking Availability Preview */}
      <section id="parking" className="py-20 bg-[#F4F7FB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-[#080677] mb-4">Real-Time Parking Availability</h2>
              <p className="text-slate-500 mb-6 leading-relaxed">Know before you go. PASS provides live updates on parking slot availability across all campus zones, visible on the web and mobile app.</p>
              <div className="space-y-4">
                {ZONE_DATA.map(z => (
                  <div key={z.zone} className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-slate-700">{z.zone}</span>
                      <span className={`text-sm font-bold ${z.available < 5 ? 'text-red-600' : z.available < 15 ? 'text-amber-600' : 'text-green-600'}`}>
                        {z.available} Available
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${z.color} rounded-full transition-all`} style={{ width: `${(z.available / z.total) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>{z.total - z.available} Occupied</span>
                      <span>{z.total} Total</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div id="about" className="bg-[#080677] rounded-3xl p-8 text-white">
              <Shield size={40} className="text-[#38BDF8] mb-5" />
              <h3 className="text-2xl font-bold mb-3">About PASS</h3>
              <p className="text-blue-100 leading-relaxed mb-5">
                The Parking Access and Space Management System (PASS) supports authorized vehicle access, parking occupancy monitoring and visitor access for Dr. Yanga's Colleges, Inc. students, faculty, employees and parking staff.
              </p>
              <ul className="space-y-3 text-blue-100 text-sm">
                {['Role-based access for all user types', 'RFID card and tag authentication', 'Real-time slot monitoring', 'Visitor QR pass generation', 'Complete audit trail and analytics'].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-[#38BDF8] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile App CTA */}
      <section className="py-16 bg-[#080677] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Smartphone size={48} className="mx-auto mb-5 text-[#38BDF8]" />
          <h2 className="text-3xl font-bold mb-3">PASS Mobile App</h2>
          <p className="text-blue-100 mb-8 max-w-lg mx-auto">Check parking availability, view your parking history and manage your profile from your phone.</p>
          <Link
            to="/mobile"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#96D1F2] hover:bg-[#b4def6] text-[#080677] font-bold rounded-lg transition-colors"
          >
            <Smartphone size={22} />
            Open Mobile App
          </Link>
          <p className="text-blue-200 text-xs mt-3">No download required — web-based mobile experience</p>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-[#080677] text-blue-100 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-10 mb-8">
            <div className="space-y-3">
              <DyciLogo onDark className="h-12" />
              <p className="text-sm leading-relaxed text-[#96D1F2]">Parking Access and Space Management System (PASS)</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Quick Links</h4>
              <div className="space-y-2 text-sm">
                <Link to="/login" className="block hover:text-white transition-colors">Sign In</Link>
                <Link to="/register" className="block hover:text-white transition-colors">Register</Link>
                <Link to="/guest" className="block hover:text-white transition-colors">Guest Access</Link>
                <Link to="/mobile" className="block hover:text-white transition-colors">Mobile App</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Institution</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><MapPin size={14} /> {BRAND.location}</div>
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
