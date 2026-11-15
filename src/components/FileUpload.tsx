import React, { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Camera, RefreshCw } from 'lucide-react';

export const MAX_FILE_MB = 5;
const ACCEPT = 'image/png,image/jpeg,application/pdf';
export const IMAGE_ACCEPT = 'image/png,image/jpeg';

export function validateFile(f: File, accept = ACCEPT): string | null {
  if (!accept.split(',').includes(f.type)) return accept.includes('application/pdf') ? 'Upload a JPG, PNG or PDF file' : 'Upload a JPG or PNG photo';
  if (f.size > MAX_FILE_MB * 1024 * 1024) return `File must be ${MAX_FILE_MB} MB or smaller`;
  return null;
}

/**
 * Shared document upload field (school ID, driver's license, OR/CR). Validates type and size before upload.
 * `capture` adds a camera "Retake Photo" option (where the device supports it) next to "Reupload";
 * `preview` shows the chosen image before submission.
 */
export default function FileUpload({ label, file, error, onChange, onError, accept = ACCEPT, capture = false, preview = false, disabled = false, prepare }: {
  label: string;
  file: File | null;
  error?: string;
  onChange: (f: File | null) => void;
  onError: (msg: string) => void;
  accept?: string;
  capture?: boolean;
  preview?: boolean;
  disabled?: boolean;
  /** Optional step before validation, e.g. fitting an oversized phone photo. */
  prepare?: (f: File) => Promise<File>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const picked = useRef(0);
  const [preparing, setPreparing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!preview || !file || !file.type.startsWith('image/')) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, preview]);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    const seq = ++picked.current;
    let chosen = f;
    if (prepare && accept.split(',').includes(f.type)) {
      setPreparing(true);
      chosen = await prepare(f).catch(() => f);
      if (seq !== picked.current) return; // A newer photo was chosen meanwhile.
      setPreparing(false);
    }
    const problem = validateFile(chosen, accept);
    if (problem) onError(problem);
    else onChange(chosen);
  };
  disabled = disabled || preparing;
  const imageAccept = accept.split(',').filter(type => type.startsWith('image/')).join(',') || IMAGE_ACCEPT;
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1.5">{label}</label>
      <input ref={ref} type="file" accept={accept} className="hidden" disabled={disabled} onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {capture && <input ref={cameraRef} type="file" accept={imageAccept} capture="environment" className="hidden" disabled={disabled} onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />}
      {file ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 border border-green-200 bg-green-50 rounded-xl px-4 py-3">
            <FileText size={18} className="text-green-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-slate-400 hover:text-red-500 disabled:opacity-50" aria-label="Remove file"><X size={16} /></button>
          </div>
          {previewUrl && <img src={previewUrl} alt={`Preview of ${label}`} className="max-h-64 w-full rounded-xl border border-slate-200 object-contain bg-slate-50" />}
          {capture && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={disabled} onClick={() => cameraRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-[#2563EB] disabled:opacity-50"><Camera size={15} />Retake Photo</button>
              <button type="button" disabled={disabled} onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-[#2563EB] disabled:opacity-50"><RefreshCw size={15} />Reupload</button>
            </div>
          )}
        </div>
      ) : capture ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={disabled} onClick={() => cameraRef.current?.click()}
            className={`flex flex-col items-center gap-1.5 border-2 border-dashed ${error ? 'border-red-400' : 'border-slate-300'} rounded-xl px-4 py-5 text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors disabled:opacity-50`}>
            <Camera size={20} /><span className="text-sm font-medium">Take Photo</span><span className="text-xs text-slate-400">Uses the camera where supported</span>
          </button>
          <button type="button" disabled={disabled} onClick={() => ref.current?.click()}
            className={`flex flex-col items-center gap-1.5 border-2 border-dashed ${error ? 'border-red-400' : 'border-slate-300'} rounded-xl px-4 py-5 text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors disabled:opacity-50`}>
            <Upload size={20} /><span className="text-sm font-medium">Upload Image</span><span className="text-xs text-slate-400">JPG or PNG · up to {MAX_FILE_MB} MB</span>
          </button>
        </div>
      ) : (
        <button type="button" disabled={disabled} onClick={() => ref.current?.click()}
          className={`w-full flex flex-col items-center gap-1.5 border-2 border-dashed ${error ? 'border-red-400' : 'border-slate-300'} rounded-xl px-4 py-6 text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors`}>
          <Upload size={20} />
          <span className="text-sm font-medium">Tap to upload</span>
          <span className="text-xs text-slate-400">{accept.includes('application/pdf') ? 'JPG, PNG or PDF' : 'JPG or PNG'} · up to {MAX_FILE_MB} MB</span>
        </button>
      )}
      {preparing && <p className="text-xs text-slate-500 mt-1" role="status">Preparing photo…</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
