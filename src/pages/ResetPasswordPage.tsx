import { jsonFetch } from '../lib/http';

import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandLockup } from '../components/Brand';
import {
  LockKeyhole,
  Eye,
  EyeOff,
  Check,
  ArrowLeft,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!token || !email) {
      setError('This reset link is incomplete. Please request a new password reset link.');
      return;
    }

    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await jsonFetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          token,
          email,
          password,
          password_confirmation: confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const validationMessage = data.errors
          ? Object.values(data.errors).flat().join(' ')
          : data.message;

        throw new Error(
          validationMessage ||
            'Unable to reset your password. Please request a new link.'
        );
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to the server. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <BrandLockup />
          </div>
          <h1 className="text-xl font-bold text-[#080677]">Password Recovery</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8">
          {success ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Check size={36} className="text-green-600" />
              </div>

              <h2 className="font-semibold text-slate-800 mb-2">
                Password Reset Successful!
              </h2>

              <p className="text-sm text-slate-500 mb-8">
                Your password has been updated. You can now log in using your
                new password.
              </p>

              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full py-3 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1D4ED8] transition-colors"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mx-auto mb-5">
                <LockKeyhole size={28} className="text-[#2563EB]" />
              </div>

              <h2 className="font-semibold text-slate-800 text-center mb-2">
                Create New Password
              </h2>

              <p className="text-sm text-slate-500 text-center mb-6">
                Choose a new password for your PASS account.
              </p>

              {!token || !email ? (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm"
                >
                  This reset link is incomplete. Please request a new one.
                  <Link
                    to="/forgot-password"
                    className="block font-semibold underline mt-2"
                  >
                    Request a new reset link
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 text-center mb-5 break-words">
                    Resetting password for <strong>{email}</strong>
                  </p>

                  {error && (
                    <div
                      role="alert"
                      className="flex gap-2 items-start bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-5 text-sm"
                    >
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4 mb-5">
                      <div>
                        <label
                          htmlFor="new-password"
                          className="text-sm font-medium text-slate-700 block mb-1.5"
                        >
                          New Password
                        </label>

                        <div className="relative">
                          <input
                            id="new-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                            minLength={8}
                            maxLength={128}
                            required
                            disabled={loading}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:bg-slate-50"
                          />

                          <button
                            type="button"
                            onClick={() => setShowPassword((value) => !value)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="confirm-password"
                          className="text-sm font-medium text-slate-700 block mb-1.5"
                        >
                          Confirm New Password
                        </label>

                        <div className="relative">
                          <input
                            id="confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            placeholder="Re-enter your password"
                            autoComplete="new-password"
                            maxLength={128}
                            required
                            disabled={loading}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:bg-slate-50"
                          />

                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((value) => !value)}
                            aria-label={
                              showConfirmPassword ? 'Hide password' : 'Show password'
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                          >
                            {showConfirmPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                      </div>

                      {password && confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-red-600">
                          The passwords do not match.
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        password.length < 8 ||
                        password !== confirmPassword
                      }
                      className="w-full flex items-center justify-center gap-2 py-3 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
                    >
                      {loading && <LoaderCircle size={18} className="animate-spin" />}
                      {loading ? 'Resetting password...' : 'Reset Password'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        {!success && (
          <p className="text-center text-sm text-slate-400 mt-5">
            <Link
              to="/login"
              className="flex items-center justify-center gap-1 hover:text-[#2563EB]"
            >
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
