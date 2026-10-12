import React, { createContext, useContext, useState, ReactNode } from 'react';

// Prototype store for driver's license verification. Shared by the web app and the mobile preview
// so both show the same status. It lives in memory only (resets on refresh) — the real
// implementation must persist this server-side and let only authorized staff change the status.
export type LicenseStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';

export interface LicenseSubmission {
  owner: string;
  licenseNo: string;
  expiry: string;
  fileName: string;
  submittedAt: string;
}

interface LicenseContextType {
  status: LicenseStatus;
  submission: LicenseSubmission | null;
  rejectReason: string;
  submit: (s: LicenseSubmission) => void;
  review: (status: 'verified' | 'rejected', reason?: string) => void;
}

const LicenseContext = createContext<LicenseContextType | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus>('not_submitted');
  const [submission, setSubmission] = useState<LicenseSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const submit = (s: LicenseSubmission) => { setSubmission(s); setStatus('pending'); setRejectReason(''); };
  const review = (st: 'verified' | 'rejected', reason = '') => { setStatus(st); setRejectReason(st === 'rejected' ? reason : ''); };

  return <LicenseContext.Provider value={{ status, submission, rejectReason, submit, review }}>{children}</LicenseContext.Provider>;
}

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used inside LicenseProvider');
  return ctx;
}

export const LICENSE_STATUS_LABEL: Record<LicenseStatus, string> = {
  not_submitted: 'Not submitted',
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Needs correction',
};
