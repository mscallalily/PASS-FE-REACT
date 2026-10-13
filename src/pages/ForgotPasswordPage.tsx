
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup } from '../components/Brand';
import { Mail, Check, ArrowLeft, AlertCircle, LoaderCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSent(false);

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(data.message || 'Too many requests. Please wait before trying again.');
        }

        if (response.status === 422) {
          const validationMessage = data.errors
            ? Object.values(data.errors).flat().join(' ')
            : data.message;

          throw new Error(
            validationMessage || 'Please check your email address and try again.'
          );
        }

        throw new Error(data.message || 'Unable to process your request. Please try again.');
      }

      setSent(true);
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
          {sent ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Check size={36} className="text-green-600" />
              </div>

              <h2 className="font-semibold text-slate-800 mb-2">
                Check Your Email
              </h2>

              <p className="text-sm text-slate-500 mb-4">
                If an account exists for that email address, a password reset
                link will be sent. Follow the link to create a new password.
              </p>

              <p className="text-sm font-semibold text-[#2563EB] break-words mb-6">
                {email}
              </p>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setError('');
                }}
                className="text-sm font-medium text-[#2563EB] hover:underline"
              >
                Try another email
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mx-auto mb-5">
                <Mail size={28} className="text-[#2563EB]" />
              </div>

              <h2 className="font-semibold text-slate-800 text-center mb-2">
                Forgot your password?
              </h2>

              <p className="text-sm text-slate-500 text-center mb-6">
                Enter your registered email address. If your account is found,
                you can receive a link to reset your password.
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
                <div className="mb-5">
                  <label
                    htmlFor="reset-email"
                    className="text-sm font-medium text-slate-700 block mb-1.5"
                  >
                    Email Address
                  </label>

                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your registered email"
                    autoComplete="email"
                    required
                    maxLength={255}
                    disabled={loading}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:bg-slate-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!email.trim() || loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
                >
                  {loading && <LoaderCircle size={18} className="animate-spin" />}
                  {loading ? 'Sending reset link...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-400 mt-5">
          <Link
            to="/login"
            className="flex items-center justify-center gap-1 hover:text-[#2563EB]"
          >
            <ArrowLeft size={14} /> Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
