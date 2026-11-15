import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../lib/apiClient';

export type DocumentType = 'driver_license' | 'vehicle_or' | 'vehicle_cr';
export type ExtractedFields = Record<string, string | number>;
/** missing: not read; low_confidence: check it; conflict: already registered elsewhere. */
export type FieldFlag = 'missing' | 'low_confidence' | 'conflict';
export type DocumentStatus = 'ok' | 'partial' | 'retake' | 'not_license' | 'wrong_document' | 'invalid_image' | 'unavailable';
/** notes: per-field explanation (vehicle documents), shown by the caller only when the field still needs attention. */
type Result = { status: DocumentStatus; fields: ExtractedFields; flags: Record<string, FieldFlag>; notes?: Record<string, string>; issues: string[]; message: string };

const LABELS: Record<string, string> = {
  license_number: 'License number', expiry_date: 'Expiry date', plate_number: 'Plate number', make: 'Make', model: 'Model / series',
  color: 'Color', year_model: 'Year model', vehicle_type: 'Vehicle type', registration_expiry: 'Registration valid until',
};

/**
 * Reads an uploaded license or OR/CR image and pre-fills the form. Only the
 * latest file's result is applied: a slower response for an earlier photo is
 * discarded. Values stay editable; the server checks the submitted files again.
 */
export default function DocumentAutofill({ file, documentType, onFields, compact = false }: {
  file: File | null;
  documentType: DocumentType;
  /** Called once per photo with what was read (also when reading failed); flags mark fields to enter or check. */
  onFields: (fields: ExtractedFields, flags: Record<string, FieldFlag>, status: DocumentStatus, notes: Record<string, string>) => void;
  /** Show only the processing status and issues; the caller displays the values. */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const apply = useRef(onFields);
  apply.current = onFields;

  useEffect(() => {
    const seq = ++sequence.current;
    request.current?.abort();
    setResult(null); setError(''); setBusy(false);
    if (!file || !file.type.startsWith('image/')) return;
    const controller = new AbortController();
    request.current = controller;
    const body = new FormData();
    body.append('document', file); body.append('document_type', documentType);
    setBusy(true);
    apiRequest<Result>('/api/documents/autofill', { method: 'POST', body, signal: controller.signal })
      .then(data => {
        if (seq !== sequence.current) return;
        setResult(data);
        apply.current(data.fields ?? {}, data.flags ?? {}, data.status, data.notes ?? {});
      })
      .catch(err => {
        if (seq !== sequence.current || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'The document could not be read. Enter the details manually.');
        apply.current({}, {}, 'unavailable', {});
      })
      .finally(() => { if (seq === sequence.current) setBusy(false); });
    return () => controller.abort();
  }, [file, documentType]);

  if (!file) return null;
  return (
    <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-sm" aria-live="polite">
      {busy && <p className="flex items-center gap-2 text-blue-800"><Loader2 size={15} className="animate-spin" />Reading the document… this can take a few seconds.</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {result && <>
        {/* OR/CR (compact): a photo that was read is not a failure; per-field certainty is
            judged in the combined review, which says what still needs checking. */}
        <p className={`flex items-start gap-2 ${result.status === 'ok' ? 'text-green-800' : compact && result.status === 'partial' ? 'text-slate-700' : 'text-amber-800'}`}>
          {result.status === 'ok' || (compact && result.status === 'partial') ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span>{result.message}</span>
        </p>
        {result.issues.map(issue => <p key={issue} className="text-amber-800">{issue}</p>)}
        {!compact && (Object.keys(result.fields).length > 0 || Object.keys(result.flags).length > 0) && (
          <dl className="grid gap-1 sm:grid-cols-2">
            {Array.from(new Set([...Object.keys(result.fields), ...Object.keys(result.flags)])).map(key => (
              <div key={key} className="flex flex-wrap gap-1">
                <dt className="font-semibold text-slate-700">{LABELS[key] ?? key}:</dt>
                <dd className={result.flags[key] ? 'text-amber-800' : 'text-slate-700'}>
                  {result.fields[key] ?? 'not found'}
                  {result.flags[key] === 'missing' && ' — enter it manually or retake the photo'}
                  {result.flags[key] === 'low_confidence' && ' — check this value'}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </>}
    </div>
  );
}
