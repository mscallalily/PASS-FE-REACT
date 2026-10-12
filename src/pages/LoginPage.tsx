import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CampusPhoto, DyciLogo, GoldRule, PassMark } from '../components/Brand';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const DEMO_ACCOUNTS = [
    { label: 'Admin', email: 'admin@pass.edu' },
    { label: 'Parking Staff', email: 'parking@pass.edu' },
    { label: 'Student', email: 'student@pass.edu' },
    { label: 'Faculty', email: 'faculty@pass.edu' },
    { label: 'Employee', email: 'employee@pass.edu' },
    { label: 'Guest', email: 'guest@pass.edu' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    const result = login(email, password);
    setLoading(false);
    if (result.success) {
      if (result.role === 'guest') {
        navigate('/guest-dashboard');
      } else {
        navigate('/app/dashboard');
      }
    } else {
      setError('Invalid email or password. Use a demo account below.');
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-[#F4F7FB]">
      <CampusPhoto className="hidden lg:block">
        <div className="h-full flex flex-col justify-between p-10 text-white">
          <DyciLogo onDark className="h-14" />
          <div className="max-w-md">
            <GoldRule className="mb-5" />
            <h2 className="text-3xl font-bold leading-tight">Parking Access and Space Management System</h2>
            <p className="mt-3 text-[#96D1F2] text-sm leading-relaxed">
              Authorized campus vehicle access, parking occupancy and visitor passes for the Dr. Yanga&apos;s Colleges community.
            </p>
          </div>
          <p className="text-xs text-white/60">© {new Date().getFullYear()} Dr. Yanga&apos;s Colleges, Inc.</p>
        </div>
      </CampusPhoto>
      <div className="flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="lg:hidden flex justify-center mb-4"><PassMark size="xl" /></div>
          <h1 className="text-2xl font-bold text-[#080677]">Sign in to PASS</h1>
          <p className="text-slate-500 text-sm mt-1">Use your campus account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8">
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email or ID Number</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@university.edu"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="rounded" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm text-[#2563EB] hover:underline">Forgot password?</Link>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#080677] hover:bg-[#0a0a99] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? <><Loader size={18} className="animate-spin" /> Signing in...</> : <><LogIn size={18} /> Sign In</>}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center mb-3">Demo accounts (any password)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DEMO_ACCOUNTS.map(a => (
                <button
                  key={a.email}
                  onClick={() => setEmail(a.email)}
                  className="text-xs py-1.5 px-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-medium transition-colors text-center leading-tight"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#2563EB] font-semibold hover:underline">Create Account</Link>
        </p>
        <p className="text-center text-sm text-slate-400 mt-2">
          <Link to="/guest" className="hover:text-[#2563EB] transition-colors">Continue as Guest →</Link>
        </p>
        <p className="text-center text-xs text-slate-400 mt-4">
          <Link to="/" className="hover:text-[#2563EB]">← Back to Home</Link>
        </p>
      </div>
      </div>
    </div>
  );
}
