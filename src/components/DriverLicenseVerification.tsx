import React, { useEffect, useRef, useState } from 'react';
import { IdCard, Clock, CheckCircle, AlertTriangle, Send, Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import FileUpload, { IMAGE_ACCEPT } from './FileUpload';
import DocumentAutofill, { type FieldFlag } from './DocumentAutofill';
import { fitPhotoForUpload } from '../lib/imagePrep';
import { LICENSE_STATUS_LABEL, useLicense } from '../context/LicenseContext';
import { campusDateKey, formatCampusDateTime } from '../lib/datetime';

const maskNo = (n: string) => (n.length > 4 ? `•••• ${n.slice(-4)}` : n);

const formatDateTime = (value: string | null) => formatCampusDateTime(value);

// Maps API field names to this form's fields.
const FIELD_MAP: Record<string, string> = {
  license_number: 'licenseNo',
  expiry_date: 'expiry',
  license_file: 'file',
};

/**
 * Driver's license submission, used by the web "Driver & License" tab and the mobile license screen.
 * Independent of vehicle registration: a user who answered "No" at sign-up can submit it here later.
 */
export default function DriverLicenseVerification({ variant = 'web' }: { variant?: 'web' | 'mobile'; owner?: string }) {
  const { status, license, error: loadError, submit, retry } = useLicense();
  const m = variant === 'mobile';
  const [editing, setEditing] = useState(false);
  const [licenseNo, setLicenseNo] = useState('');
  const [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [flags, setFlags] = useState<Record<string, FieldFlag>>({});
  // Fields the owner typed themselves are never replaced by a photo reading.
  const edited = useRef({ licenseNo: false, expiry: false });
  const submitLock = useRef(false);

  // A new photo replaces what the previous photo filled in.
  const choosePhoto = (f: File | null) => {
    setFile(f);
    setFlags({});
    setErrors(e => ({ ...e, file: '' }));
    if (!edited.current.licenseNo) setLicenseNo('');
    if (!edited.current.expiry) setExpiry('');
  };
  const applyReading = (fields: Record<string, string | number>, read: Record<string, FieldFlag>) => {
    if (!edited.current.licenseNo) setLicenseNo(fields.license_number ? String(fields.license_number) : '');
    if (!edited.current.expiry) setExpiry(fields.expiry_date ? String(fields.expiry_date) : '');
    setFlags(read);
  };
  const editField = (field: 'licenseNo' | 'expiry', value: string) => {
    edited.current[field] = true;
    (field === 'licenseNo' ? setLicenseNo : setExpiry)(value);
    setFlags(f => { const next = { ...f }; delete next[field === 'licenseNo' ? 'license_number' : 'expiry_date']; return next; });
  };
  const flagNote = (apiField: string) => flags[apiField] === 'missing'
    ? 'Not read from the photo. Enter it from your license, or retake the photo.'
    : flags[apiField] === 'low_confidence' ? 'Check this value against your license.' : '';
  useEffect(() => { if (!cooldown) return; const timer = window.setTimeout(() => setCooldown(v => Math.max(0, v - 1)), 1000); return () => window.clearTimeout(timer); }, [cooldown]);

  const renewalAvailable = status === 'verified' && license?.can_resubmit === true;
  const canSubmit = status !== 'processing' && (status !== 'verified' || renewalAvailable);
  const showForm = canSubmit && (status === 'not_submitted' || status === 'needs_correction' || editing);

  const handleSubmit = async () => {
    if (!canSubmit || submitLock.current || cooldown > 0) return;
    const e: Record<string, string> = {};
    if (!licenseNo.trim()) e.licenseNo = "Driver's license number is required";
    else if (!/^[A-Za-z]\d{2}[-\s]?\d{2}[-\s]?\d{6}$/.test(licenseNo.trim())) e.licenseNo = 'Use the LTO format, for example N01-23-456789';
    if (!expiry) e.expiry = 'Expiry date is required';
    else if (expiry < campusDateKey()) e.expiry = 'This license is already expired';
    if (!file) e.file = "Take or upload a photo of your driver's license";
    setErrors(e);
    setFormMessage('');
    if (Object.keys(e).length) return;

    submitLock.current = true;
    setSubmitting(true);
    const result = await submit({ licenseNumber: licenseNo.trim(), expiryDate: expiry, file: file! });
    setSubmitting(false);
    submitLock.current = false;

    if (!result.ok) {
      setCooldown(result.retryAfterSeconds ?? 0);
      const fieldErrors: Record<string, string> = {};
      for (const [field, message] of Object.entries(result.fieldErrors)) fieldErrors[FIELD_MAP[field] ?? field] = message;
      setErrors(fieldErrors);
      setFormMessage(Object.keys(fieldErrors).length ? '' : result.message);
      return;
    }

    setEditing(false); setLicenseNo(''); setExpiry(''); setFile(null); setErrors({}); setFlags({});
    edited.current = { licenseNo: false, expiry: false };
  };

  const returnedByCheck = status === 'needs_correction' && license?.verification_source === 'automatic';

  const tone = {
    not_submitted: { box: 'bg-slate-50 border-slate-200', text: 'text-slate-700', icon: <IdCard size={22} className="text-slate-500" />, msg: "No driver's license on file. Submit it to register a vehicle." },
    processing: { box: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: <Loader2 size={22} className="text-blue-600 animate-spin" />, msg: 'Checking your document. This usually takes a few seconds.' },
    pending_review: { box: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: <Clock size={22} className="text-amber-600" />, msg: license?.verification_source === 'staff' ? 'Your submission is awaiting a staff exception review.' : 'Some required document details could not be confirmed automatically. Your submission remains unapproved. Retry the check or contact PASS staff for review.' },
    verified: { box: 'bg-green-50 border-green-200', text: 'text-green-800', icon: <CheckCircle size={22} className="text-green-600" />, msg: license?.verification_source === 'automatic' ? 'Your license submission was approved automatically after the required OCR and document-consistency checks passed.' : 'PASS staff approved your license submission.' },
    needs_correction: {
      box: 'bg-red-50 border-red-200', text: 'text-red-800', icon: <AlertTriangle size={22} className="text-red-600" />,
      msg: returnedByCheck
        ? 'Your submission was automatically returned because it did not pass the document check. Please correct the following and resubmit:'
        : 'PASS staff returned your submission. Please correct the following and resubmit:',
    },
  }[status];

  const inputCls = (k: string, apiField?: string) =>
    `w-full border ${errors[k] ? 'border-red-400 bg-white' : apiField && flags[apiField] ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'} rounded-xl px-4 ${m ? 'py-3.5' : 'py-3'} text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]`;

  return (
    <div className={`space-y-4 ${m ? '' : 'max-w-2xl'}`}>
      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">Unable to load your license status: {loadError}</p>
      )}

      <div className={`rounded-2xl border p-4 ${tone.box}`}>
        <div className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5">{tone.icon}</span>
          <div className="min-w-0">
            <p className={`font-bold ${tone.text}`}>{renewalAvailable ? 'License renewal needed' : status === 'verified' && license?.verification_source === 'automatic' ? 'Approved automatically' : status === 'pending_review' && license?.verification_source !== 'staff' ? 'Automatic check needs review' : LICENSE_STATUS_LABEL[status]}</p>
            <p className={`text-sm mt-0.5 ${tone.text}`}>{renewalAvailable ? 'Your previous license has expired. Submit your renewed license for a new document check.' : tone.msg}</p>
            {status === 'needs_correction' && license?.verification_reason && (
              <ul className="mt-2 space-y-1 list-disc pl-5 text-sm text-red-800">
                {license.verification_reason.split('\n').filter(Boolean).map(reason => <li key={reason}>{reason}</li>)}
              </ul>
            )}
            {license && (
              <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                <p>License no.: <span className="font-mono font-semibold">{maskNo(license.license_number)}</span></p>
                <p>Expiry: <span className="font-semibold">{license.expiry_date ?? '—'}</span></p>
                {license.original_file_name && <p>File: <span className="font-semibold break-all">{license.original_file_name}</span></p>}
                <p>Submitted: {formatDateTime(license.submitted_at)}</p>
              </div>
            )}
          </div>
        </div>
        {status === 'pending_review' && license?.verification_source !== 'staff' && <div className="mt-3 space-y-2">
          <button type="button" disabled={retrying || cooldown > 0} onClick={async () => { if (retrying || cooldown) return; setRetrying(true); setRetryMessage(''); const result = await retry(); setRetryMessage(result.message); if (!result.ok) setCooldown(result.retryAfterSeconds ?? 0); setRetrying(false); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-[#2563EB] disabled:opacity-50">
            {retrying ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}{cooldown ? `Try again in ${cooldown}s` : retrying ? 'Checking…' : 'Retry automatic check'}
          </button>
          {retryMessage && <p role="status" className="text-sm text-slate-600">{retryMessage}</p>}
        </div>}
        {!showForm && canSubmit && (
          <button type="button" onClick={() => setEditing(true)} className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline">
            {renewalAvailable ? 'Submit renewed license' : 'Submit a different license'}
          </button>
        )}
      </div>

      {showForm && (
        <div className={`${m ? '' : 'bg-white border border-slate-100 rounded-2xl p-5'} space-y-4`}>
          <h3 className="font-semibold text-[#080677]">{status === 'needs_correction' ? 'Resubmit driver’s license' : 'Submit driver’s license'}</h3>
          <p className="text-sm text-slate-600">Start with a photo of the front of your license. The license number and expiry date are read from it for you to check.</p>
          <FileUpload label="1. Driver's License (front)" file={file} error={errors.file} accept={IMAGE_ACCEPT} capture preview disabled={submitting}
            prepare={fitPhotoForUpload} onChange={choosePhoto}
            onError={msg => setErrors(e => ({ ...e, file: msg }))} />
          <DocumentAutofill file={file} documentType="driver_license" onFields={applyReading} />
          {file && <>
            <p className="text-sm font-medium text-slate-700">2. Check the details</p>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">License Number</label>
              <input value={licenseNo} onChange={e => editField('licenseNo', e.target.value)} placeholder="N01-23-456789" className={inputCls('licenseNo', 'license_number')} disabled={submitting} />
              {errors.licenseNo ? <p className="text-xs text-red-500 mt-1">{errors.licenseNo}</p> : flagNote('license_number') && <p className="text-xs text-amber-700 mt-1">{flagNote('license_number')}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Expiry Date</label>
              <input type="date" value={expiry} onChange={e => editField('expiry', e.target.value)} className={inputCls('expiry', 'expiry_date')} disabled={submitting} />
              {errors.expiry ? <p className="text-xs text-red-500 mt-1">{errors.expiry}</p> : flagNote('expiry_date') && <p className="text-xs text-amber-700 mt-1">{flagNote('expiry_date')}</p>}
            </div>
          </>}
          <p className="text-xs text-slate-500">Photograph the full front of the license, flat and in focus; minor shadows or an imperfect background are fine. Your registered name, the license number and the expiry are checked again automatically when you submit.</p>
          {formMessage && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{formMessage}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleSubmit} disabled={submitting || cooldown > 0} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2563EB] text-white font-semibold hover:bg-[#1D4ED8] transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {cooldown ? `Try again in ${cooldown}s` : submitting ? 'Submitting...' : 'Submit for Verification'}
            </button>
            {editing && status !== 'needs_correction' && (
              <button type="button" onClick={() => setEditing(false)} disabled={submitting} className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">Cancel</button>
            )}
          </div>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} className="shrink-0 mt-0.5" />
        <span>Your document is stored privately and is only visible to you and authorized PASS staff. Automatic approval checks the document text and image consistency; it does not confirm authenticity with the LTO. Account approval, vehicle authorization and RFID assignment are separate.</span>
      </p>
    </div>
  );
}
