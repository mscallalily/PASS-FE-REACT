import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { REGULAR_USER_ROLES, useAuth } from './AuthContext';
import { apiRequest, ApiError } from '../lib/apiClient';

// The signed-in regular user's driver's license submission, loaded from the
// Laravel API. Shared by the web app and the mobile preview so both show the
// same status. Only the server (automatic check or PASS staff) changes it.
export type LicenseStatus = 'not_submitted' | 'processing' | 'needs_correction' | 'pending_review' | 'verified';

export type LicenseType = 'student_permit' | 'non_professional' | 'professional' | 'international';

export interface LicenseRecord {
  license_id: number;
  license_number: string;
  license_type: LicenseType;
  expiry_date: string | null;
  original_file_name: string | null;
  has_file: boolean;
  submitted_at: string | null;
  verification_status: Exclude<LicenseStatus, 'not_submitted'>;
  verification_source: 'automatic' | 'staff' | null;
  verification_reason: string | null;
  checked_at: string | null;
  reviewed_at: string | null;
}

export interface LicenseSubmission {
  licenseNumber: string;
  licenseType: LicenseType;
  expiryDate: string;
  file: File;
}

export type SubmitResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors: Record<string, string> };

interface LicenseContextType {
  status: LicenseStatus;
  license: LicenseRecord | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  submit: (s: LicenseSubmission) => Promise<SubmitResult>;
  retry: () => Promise<SubmitResult>;
}

const LicenseContext = createContext<LicenseContextType | null>(null);

/** How often to re-check while the automatic document check is running. */
const PROCESSING_POLL_MS = 3000;

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const enabled = isAuthenticated && REGULAR_USER_ROLES.includes(user?.role ?? null);

  const [license, setLicense] = useState<LicenseRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    try {
      const result = await apiRequest<{ data: LicenseRecord | null }>('/api/licenses/mine');
      setLicense(result.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your driver\'s license status.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Load on sign-in; clear on sign-out so another account never sees this data.
  useEffect(() => {
    if (enabled) refresh();
    else {
      setLicense(null);
      setError('');
    }
  }, [enabled, user?.id, refresh]);

  // Follow the automatic check until it finishes.
  useEffect(() => {
    if (license?.verification_status !== 'processing') return;
    const timer = setInterval(refresh, PROCESSING_POLL_MS);
    return () => clearInterval(timer);
  }, [license?.verification_status, refresh]);

  // Pick up staff decisions when the user returns to the tab.
  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [enabled, refresh]);

  const submit = async (s: LicenseSubmission): Promise<SubmitResult> => {
    const form = new FormData();
    form.append('license_number', s.licenseNumber);
    form.append('license_type', s.licenseType);
    form.append('expiry_date', s.expiryDate);
    form.append('license_file', s.file);

    try {
      const result = await apiRequest<{ message: string; data: LicenseRecord }>('/api/licenses', { method: 'POST', body: form });
      setLicense(result.data);
      setError('');
      return { ok: true, message: result.message };
    } catch (err) {
      if (err instanceof ApiError) return { ok: false, message: err.message, fieldErrors: err.fieldErrors };
      return { ok: false, message: 'The license could not be submitted. Please try again.', fieldErrors: {} };
    }
  };

  const retry = async (): Promise<SubmitResult> => {
    if (!license) return { ok: false, message: 'No license submission is on file.', fieldErrors: {} };
    try {
      const result = await apiRequest<{ message: string; data: LicenseRecord }>(`/api/licenses/${license.license_id}/recheck`, { method: 'POST' });
      setLicense(result.data);
      setError('');
      return { ok: true, message: result.message };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'The check could not be restarted.', fieldErrors: {} };
    }
  };

  const status: LicenseStatus = license?.verification_status ?? 'not_submitted';

  return (
    <LicenseContext.Provider value={{ status, license, loading, error, refresh, submit, retry }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used inside LicenseProvider');
  return ctx;
}

export const LICENSE_STATUS_LABEL: Record<LicenseStatus, string> = {
  not_submitted: 'Not submitted',
  processing: 'Processing',
  needs_correction: 'Needs correction',
  pending_review: 'Review / retry needed',
  verified: 'Approved',
};

export const LICENSE_TYPE_LABEL: Record<LicenseType, string> = {
  non_professional: 'Non-Professional',
  professional: 'Professional',
  student_permit: 'Student Permit',
  international: 'International',
};

/** A submitted license that is not waiting on the user. */
export function licenseOnFile(status: LicenseStatus) {
  return status === 'processing' || status === 'pending_review' || status === 'verified';
}
