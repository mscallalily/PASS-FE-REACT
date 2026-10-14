import React, { useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';

export const MAX_FILE_MB = 5;
const ACCEPT = 'image/png,image/jpeg,application/pdf';

export function validateFile(f: File): string | null {
  if (!['image/png', 'image/jpeg', 'application/pdf'].includes(f.type)) return 'Upload a JPG, PNG or PDF file';
  if (f.size > MAX_FILE_MB * 1024 * 1024) return `File must be ${MAX_FILE_MB} MB or smaller`;
  return null;
}

/** Shared document upload field (school ID, driver's license). Validates type and size before upload. */
export default function FileUpload({ label, file, error, onChange, onError }: {
  label: string;
  file: File | null;
  error?: string;
  onChange: (f: File | null) => void;
  onError: (msg: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = validateFile(f);
    if (problem) onError(problem);
    else onChange(f);
  };
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1.5">{label}</label>
      <input ref={ref} type="file" accept={ACCEPT} className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {file ? (
        <div className="flex items-center gap-3 border border-green-200 bg-green-50 rounded-xl px-4 py-3">
          <FileText size={18} className="text-green-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-slate-400 hover:text-red-500" aria-label="Remove file"><X size={16} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className={`w-full flex flex-col items-center gap-1.5 border-2 border-dashed ${error ? 'border-red-400' : 'border-slate-300'} rounded-xl px-4 py-6 text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors`}>
          <Upload size={20} />
          <span className="text-sm font-medium">Tap to upload</span>
          <span className="text-xs text-slate-400">JPG, PNG or PDF · up to {MAX_FILE_MB} MB</span>
        </button>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
