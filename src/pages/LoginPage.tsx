
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CampusPhoto,
  DyciLogo,
  GoldRule,
  PassMark,
} from '../components/Brand';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password, remember);

      if (result.success) {
        if (result.role === 'guest') {
          navigate('/guest-dashboard');
        } else {
          navigate('/app/dashboard');
        }
      } else {
        setError('Unable to sign in. Please check your credentials.');
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to PASS. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-[#F4F7FB]">
      <CampusPhoto className="hidden lg:block">
        <div className="h-full flex flex-col justify-between p-10 text-white">
          <DyciLogo onDark className="h-14" />

          <div className="max-w-md">
            <GoldRule className="mb-5" />

            <h2 className="text-3xl font-bold leading-tight">
              Parking Access and Space Management System
            </h2>

            <p className="mt-3 text-[#96D1F2] text-sm leading-relaxed">
              Authorized campus vehicle access, parking occupancy and visitor
              passes for the Dr. Yanga&apos;s Colleges community.
            </p>
          </div>

          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} Dr. Yanga&apos;s Colleges, Inc.
          </p>
        </div>
      </CampusPhoto>

      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="lg:hidden flex justify-center mb-4">
              <PassMark size="xl" />
            </div>

            <h1 className="text-2xl font-bold text-[#080677]">
              Sign in to PASS
            </h1>

            <p className="text-slate-500 text-sm mt-1">
              Use your campus account
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Email or ID Number
                </label>

                <input
                  id="login-identifier"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@university.edu"
                  required
                  disabled={loading}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="login-password"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPwd((value) => !value)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    aria-pressed={showPwd}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded"
                  />
                  Remember me
                </label>

                <Link
                  to="/forgot-password"
                  className="text-sm text-[#2563EB] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#080677] hover:bg-[#0a0a99] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center">
                Sign in using your registered campus account.
              </p>
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-5">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="text-[#2563EB] font-semibold hover:underline"
            >
              Create Account
            </Link>
          </p>

          <p className="text-center text-sm text-slate-400 mt-2">
            <Link
              to="/guest"
              className="hover:text-[#2563EB] transition-colors"
            >
              Continue as Guest →
            </Link>
          </p>

          <p className="text-center text-xs text-slate-400 mt-4">
            <Link to="/" className="hover:text-[#2563EB]">
              ← Back to Home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
