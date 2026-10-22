import React, { useEffect, useRef, useState } from 'react';

export interface DocumentFields {
  fullName?: string;
  idNum?: string;
  licenseNo?: string;
  licenseType?: string;
  licenseExpiry?: string;
}

const labels: Record<keyof DocumentFields, string> = {
  fullName: 'Full name', idNum: 'Student number', licenseNo: 'License number',
  licenseType: 'License type', licenseExpiry: 'Expiry date',
};

export default function DocumentAutofill({ file, documentType, onApply }: {
  file: File | null;
  documentType: 'school_id' | 'driver_license';
  onApply: (fields: DocumentFields) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ fields: DocumentFields; text: string; message: string } | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    request.current?.abort();
    setResult(null); setError(''); setBusy(false);
    return () => request.current?.abort();
  }, [file, documentType]);

  async function readDocument() {
    if (!file || busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(''); setResult(null);
    const body = new FormData();
    body.append('document', file); body.append('document_type', documentType);
    try {
      const response = await fetch('/api/documents/autofill', {
        method: 'POST', headers: { Accept: 'application/json' }, body, signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.fields) throw new Error(data?.message || 'Cannot read the document. You can enter the details manually.');
      if (!controller.signal.aborted) setResult(data);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Document reading failed.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
    <button type="button" onClick={readDocument} disabled={!file || busy}
      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {busy ? 'Reading document…' : 'Read document'}
    </button>
    <p className="text-xs text-slate-600">Upload a document, read its text, then review the suggestions. You can edit all details before submitting.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {result && <div className="space-y-3" aria-live="polite">
      {Object.entries(result.fields).length ? <>
        <dl className="text-sm">{Object.entries(result.fields).map(([key, value]) => <div key={key} className="flex gap-2"><dt className="font-semibold">{labels[key as keyof DocumentFields]}:</dt><dd>{value}</dd></div>)}</dl>
        <button type="button" onClick={() => onApply(result.fields)} className="rounded-lg border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-800">Use these details</button>
        <p className="text-xs text-slate-600">This replaces the matching form fields. Check and correct them before submitting.</p>
      </> : <p className="text-sm text-amber-800">Text was read, but no fields could be identified confidently. Enter the details manually.</p>}
      <details><summary className="cursor-pointer text-sm text-blue-800">Detected text</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{result.text}</pre></details>
      <p className="text-xs text-slate-600">{result.message}</p>
    </div>}
  </div>;
}
