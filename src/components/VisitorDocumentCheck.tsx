import React, { useState } from 'react';
import { apiRequest } from '../lib/apiClient';
import { Button } from './ui';

type Check = { result: string; message: string };
type Result = { license: { checks: Record<string, Check>; extracted: { license_numbers?: string[]; expiry_date?: string }; notes?: string[] }; plate: Check & { submitted: string; candidates: string[]; confidence: number | null } };
const labels: Record<string, string> = { document_type: 'Looks like an LTO license', name: 'Driver name', license_number: 'License number', expiry_date: 'License expiry', image_quality: 'License image quality', text_extraction: 'Text extraction' };
export default function VisitorDocumentCheck({ requestId }: { requestId: number }) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setBusy(true); setError(''); setResult(null);
    try { setResult(await apiRequest<Result>(`/api/visitors/requests/${requestId}/document-check`, { method: 'POST' })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Automatic check unavailable. Review the photos manually.'); }
    finally { setBusy(false); }
  }
  function item(label: string, check: Check) {
    const color = check.result === 'pass' ? 'text-green-700' : check.result === 'fail' ? 'text-red-700' : 'text-amber-700';
    return <div key={label} className="flex gap-2 py-2"><span className={color} aria-hidden="true">{check.result === 'pass' ? '✓' : check.result === 'fail' ? '×' : '?'}</span><div className="min-w-0"><p className="font-medium text-slate-700">{label} <span className={`text-xs ${color}`}>{check.result === 'pass' ? 'Matched' : check.result === 'fail' ? 'Mismatch' : 'Needs manual review'}</span></p><p className="text-xs leading-relaxed text-slate-500">{check.message}</p></div></div>;
  }
  return <section className="rounded-xl border border-slate-200 p-4 text-sm" aria-label="Automatic document check">
    <h4 className="font-semibold text-[#080677] mb-2">Automatic preliminary check</h4>
    <Button size="sm" variant="outline" onClick={run} disabled={busy}>{busy ? 'Reading license and plate…' : result ? 'Re-run automatic check' : 'Read license & check plate'}</Button>
    <div role="status">{busy && <p className="mt-2 text-xs text-slate-500">Keep this request open while the photos are processed.</p>}{error && <p className="mt-2 text-red-700">{error}</p>}</div>
    {result && <div className="mt-3 divide-y divide-slate-100">{Object.entries(result.license.checks).map(([key, check]) => item(labels[key] ?? key, check))}{item('Vehicle plate', result.plate)}<p className="py-2 text-xs text-slate-500 break-words">Submitted plate: {result.plate.submitted}. Read from photo: {result.plate.candidates.join(', ') || 'Unreadable'}.<br/>License read: {result.license.extracted.license_numbers?.join(', ') || 'Unreadable'} · Expiry: {result.license.extracted.expiry_date || 'Unreadable'}</p></div>}
    <p className="mt-3 text-xs leading-relaxed text-slate-400">OCR may misread characters. Compare both photos yourself. This does not verify authenticity or approve the request.</p>
  </section>;
}
