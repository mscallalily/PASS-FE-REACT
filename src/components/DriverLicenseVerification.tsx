import React, { useState } from 'react';
import { IdCard, Clock, CheckCircle, AlertTriangle, Send, Loader2, ShieldCheck } from 'lucide-react';
import FileUpload from './FileUpload';
import { LICENSE_STATUS_LABEL, LICENSE_TYPE_LABEL, LicenseType, useLicense } from '../context/LicenseContext';
import { formatCampusDateTime } from '../lib/datetime';

const maskNo = (n: string) => (n.length > 4 ? `•••• ${n.slice(-4)}` : n);

const formatDateTime = (value: string | null) => formatCampusDateTime(value);

// Maps API field names to this form's fields.
const FIELD_MAP: Record<string, string> = {
  license_number: 'licenseNo',
  license_type: 'licenseType',
  expiry_date: 'expiry',
  license_file: 'file',
};

/**
 * Driver's license submission, used by the web "Driver & License" tab and the mobile license screen.
 * Independent of vehicle registration: a user who answered "No" at sign-up can submit it here later.
 */
export default function DriverLicenseVerification({ variant = 'web' }: { variant?: 'web' | 'mobile'; owner?: string }) {
  const { status, license, error: loadError, submit } = useLicense();
  const m = variant === 'mobile';
  const [editing, setEditing] = useState(false);
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseType, setLicenseType] = useState<LicenseType>('non_professional');
  const [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState('');

  const showForm = status === 'not_submitted' || status === 'needs_correction' || (editing && status !== 'processing');

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!licenseNo.trim()) e.licenseNo = "Driver's license number is required";
    else if (!/^[A-Za-z]\d{2}[-\s]?\d{2}[-\s]?\d{6}$/.test(licenseNo.trim())) e.licenseNo = 'Use the LTO format, for example N01-23-456789';
    if (!expiry) e.expiry = 'Expiry date is required';
    else if (new Date(expiry) < new Date(new Date().toDateString())) e.expiry = 'This license is already expired';
    if (!file) e.file = "Upload a photo or scan of your driver's license";
    setErrors(e);
    setFormMessage('');
    if (Object.keys(e).length) return;

    setSubmitting(true);
    const result = await submit({ licenseNumber: licenseNo.trim(), licenseType, expiryDate: expiry, file: file! });
    setSubmitting(false);

    if (!result.ok) {
      const fieldErrors: Record<string, string> = {};
      for (const [field, message] of Object.entries(result.fieldErrors)) fieldErrors[FIELD_MAP[field] ?? field] = message;
      setErrors(fieldErrors);
      setFormMessage(Object.keys(fieldErrors).length ? '' : result.message);
      return;
    }

    setEditing(false); setLicenseNo(''); setExpiry(''); setFile(null); setErrors({});
  };

  const returnedByCheck = status === 'needs_correction' && license?.verification_source === 'automatic';

  const tone = {
    not_submitted: { box: 'bg-slate-50 border-slate-200', text: 'text-slate-700', icon: <IdCard size={22} className="text-slate-500" />, msg: "No driver's license on file. Submit it to register a vehicle." },
    processing: { box: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: <Loader2 size={22} className="text-blue-600 animate-spin" />, msg: 'Checking your document. This usually takes a few seconds.' },
    pending_review: { box: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: <Clock size={22} className="text-amber-600" />, msg: 'Your submission is waiting for review by PASS staff. Pending review does not mean the automatic document check passed.' },
    verified: { box: 'bg-green-50 border-green-200', text: 'text-green-800', icon: <CheckCircle size={22} className="text-green-600" />, msg: 'Your driver’s license has been verified by PASS staff.' },
    needs_correction: {
      box: 'bg-red-50 border-red-200', text: 'text-red-800', icon: <AlertTriangle size={22} className="text-red-600" />,
      msg: returnedByCheck
        ? 'Your submission was automatically returned because it did not pass the document check. Please correct the following and resubmit:'
        : 'PASS staff returned your submission. Please correct the following and resubmit:',
    },
  }[status];

  const inputCls = (k: string) =>
    `w-full border ${errors[k] ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 ${m ? 'py-3.5' : 'py-3'} text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white`;

  return (
    <div className={`space-y-4 ${m ? '' : 'max-w-2xl'}`}>
      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">Unable to load your license status: {loadError}</p>
      )}

      <div className={`rounded-2xl border p-4 ${tone.box}`}>
        <div className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5">{tone.icon}</span>
          <div className="min-w-0">
            <p className={`font-bold ${tone.text}`}>{LICENSE_STATUS_LABEL[status]}</p>
            <p className={`text-sm mt-0.5 ${tone.text}`}>{tone.msg}</p>
            {status === 'needs_correction' && license?.verification_reason && (
              <ul className="mt-2 space-y-1 list-disc pl-5 text-sm text-red-800">
                {license.verification_reason.split('\n').filter(Boolean).map(reason => <li key={reason}>{reason}</li>)}
              </ul>
            )}
            {license && (
              <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                <p>License no.: <span className="font-mono font-semibold">{maskNo(license.license_number)}</span></p>
                <p>Type: <span className="font-semibold">{LICENSE_TYPE_LABEL[license.license_type] ?? license.license_type}</span></p>
                <p>Expiry: <span className="font-semibold">{license.expiry_date ?? '—'}</span></p>
                {license.original_file_name && <p>File: <span className="font-semibold break-all">{license.original_file_name}</span></p>}
                <p>Submitted: {formatDateTime(license.submitted_at)}</p>
              </div>
            )}
          </div>
        </div>
        {!showForm && status !== 'processing' && (
          <button type="button" onClick={() => setEditing(true)} className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline">
            Submit a different license
          </button>
        )}
      </div>

      {showForm && (
        <div className={`${m ? '' : 'bg-white border border-slate-100 rounded-2xl p-5'} space-y-4`}>
          <h3 className="font-semibold text-[#080677]">{status === 'needs_correction' ? 'Resubmit driver’s license' : 'Submit driver’s license'}</h3>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">License Number</label>
            <input value={licenseNo} onChange={e => setLicenseNo(e.target.value)} placeholder="N01-23-456789" className={inputCls('licenseNo')} disabled={submitting} />
            {errors.licenseNo && <p className="text-xs text-red-500 mt-1">{errors.licenseNo}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">License Type</label>
            <select value={licenseType} onChange={e => setLicenseType(e.target.value as LicenseType)} className={inputCls('licenseType')} disabled={submitting}>
              {(Object.keys(LICENSE_TYPE_LABEL) as LicenseType[]).map(t => <option key={t} value={t}>{LICENSE_TYPE_LABEL[t]}</option>)}
            </select>
            {errors.licenseType && <p className="text-xs text-red-500 mt-1">{errors.licenseType}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Expiry Date</label>
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className={inputCls('expiry')} disabled={submitting} />
            {errors.expiry && <p className="text-xs text-red-500 mt-1">{errors.expiry}</p>}
          </div>
          <FileUpload label="Driver's License (front)" file={file} error={errors.file}
            onChange={f => { setFile(f); setErrors(e => ({ ...e, file: '' })); }}
            onError={msg => setErrors(e => ({ ...e, file: msg }))} />
          
          <p className="text-xs text-slate-500">Use a clear, well-lit photo or scan of the front side with all text readable. The name must match your registered name.</p>
          {formMessage && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{formMessage}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2563EB] text-white font-semibold hover:bg-[#1D4ED8] transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {submitting ? 'Submitting...' : 'Submit for Verification'}
            </button>
            {editing && status !== 'needs_correction' && (
              <button type="button" onClick={() => setEditing(false)} disabled={submitting} className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">Cancel</button>
            )}
          </div>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} className="shrink-0 mt-0.5" />
        <span>Your document is stored privately and is only visible to you and authorized PASS staff. The automatic check is a preliminary validation; it does not confirm authenticity with the LTO. Verification by PASS staff does not by itself authorize a vehicle or assign an RFID.</span>
      </p>
    </div>
  );
}
