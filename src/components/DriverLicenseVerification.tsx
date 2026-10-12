import React, { useState } from 'react';
import { IdCard, Clock, CheckCircle, AlertTriangle, Send } from 'lucide-react';
import FileUpload from './FileUpload';
import { LICENSE_STATUS_LABEL, useLicense } from '../context/LicenseContext';

const maskNo = (n: string) => (n.length > 4 ? `•••• ${n.slice(-4)}` : n);

/**
 * Driver's license verification, used by the web "Driver & License" tab and the mobile license screen.
 * Independent of vehicle registration: a user who answered "No" at sign-up can submit it here later.
 */
export default function DriverLicenseVerification({ variant = 'web', owner }: { variant?: 'web' | 'mobile'; owner: string }) {
  const { status, submission, rejectReason, submit } = useLicense();
  const m = variant === 'mobile';
  const [editing, setEditing] = useState(false);
  const [licenseNo, setLicenseNo] = useState('');
  const [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showForm = status === 'not_submitted' || status === 'rejected' || editing;

  const handleSubmit = () => {
    const e: Record<string, string> = {};
    if (!licenseNo.trim()) e.licenseNo = "Driver's license number is required";
    if (!expiry) e.expiry = 'Expiry date is required';
    else if (new Date(expiry) < new Date(new Date().toDateString())) e.expiry = 'This license is already expired';
    if (!file) e.file = "Upload a photo or scan of your driver's license";
    setErrors(e);
    if (Object.keys(e).length) return;
    submit({ owner, licenseNo: licenseNo.trim(), expiry, fileName: file!.name, submittedAt: new Date().toLocaleString() });
    setEditing(false); setLicenseNo(''); setExpiry(''); setFile(null);
  };

  const tone = {
    not_submitted: { box: 'bg-slate-50 border-slate-200', text: 'text-slate-700', icon: <IdCard size={22} className="text-slate-500" />, msg: "No driver's license on file. Submit it to register a vehicle." },
    pending: { box: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: <Clock size={22} className="text-amber-600" />, msg: 'Your license is waiting for review by PASS staff.' },
    verified: { box: 'bg-green-50 border-green-200', text: 'text-green-800', icon: <CheckCircle size={22} className="text-green-600" />, msg: 'Your driver’s license has been verified.' },
    rejected: { box: 'bg-red-50 border-red-200', text: 'text-red-800', icon: <AlertTriangle size={22} className="text-red-600" />, msg: rejectReason || 'Your submission needs correction. Please resubmit a clearer copy.' },
  }[status];

  const inputCls = (k: string) =>
    `w-full border ${errors[k] ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 ${m ? 'py-3.5' : 'py-3'} text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white`;

  return (
    <div className={`space-y-4 ${m ? '' : 'max-w-2xl'}`}>
      <div className={`rounded-2xl border p-4 ${tone.box}`}>
        <div className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5">{tone.icon}</span>
          <div className="min-w-0">
            <p className={`font-bold ${tone.text}`}>{LICENSE_STATUS_LABEL[status]}</p>
            <p className={`text-sm mt-0.5 ${tone.text}`}>{tone.msg}</p>
            {submission && status !== 'not_submitted' && (
              <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                <p>License no.: <span className="font-mono font-semibold">{maskNo(submission.licenseNo)}</span></p>
                <p>Expiry: <span className="font-semibold">{submission.expiry}</span></p>
                <p>File: <span className="font-semibold break-all">{submission.fileName}</span></p>
                <p>Submitted: {submission.submittedAt}</p>
              </div>
            )}
          </div>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setEditing(true)} className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline">
            Submit a different license
          </button>
        )}
      </div>

      {showForm && (
        <div className={`${m ? '' : 'bg-white border border-slate-100 rounded-2xl p-5'} space-y-4`}>
          <h3 className="font-semibold text-[#080677]">{status === 'rejected' ? 'Resubmit driver’s license' : 'Submit driver’s license'}</h3>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">License Number</label>
            <input value={licenseNo} onChange={e => setLicenseNo(e.target.value)} placeholder="N01-23-456789" className={inputCls('licenseNo')} />
            {errors.licenseNo && <p className="text-xs text-red-500 mt-1">{errors.licenseNo}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Expiry Date</label>
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className={inputCls('expiry')} />
            {errors.expiry && <p className="text-xs text-red-500 mt-1">{errors.expiry}</p>}
          </div>
          <FileUpload label="Driver's License (front)" file={file} error={errors.file}
            onChange={f => { setFile(f); setErrors(e => ({ ...e, file: '' })); }}
            onError={msg => setErrors(e => ({ ...e, file: msg }))} />
          <div className="flex gap-3">
            <button type="button" onClick={handleSubmit} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2563EB] text-white font-semibold hover:bg-[#1D4ED8] transition-colors text-sm">
              <Send size={16} /> Submit for Verification
            </button>
            {editing && status !== 'rejected' && (
              <button type="button" onClick={() => setEditing(false)} className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">Cancel</button>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">Prototype: submissions are kept in this session only and are not sent to a server. Verification must be done by authorized PASS staff once the backend is connected.</p>
    </div>
  );
}
