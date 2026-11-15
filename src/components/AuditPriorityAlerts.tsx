import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ChevronDown } from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { Badge, Button, Card, Modal } from './ui';
import { formatCampusDateTime } from '../lib/datetime';
import { readable } from '../lib/recordPresentation';
type Alert = { key: string; severity: 'critical' | 'high' | 'medium'; title: string; detail: string; source: string; record_id: string; occurred_at: string; review: null | { reviewed_by: number; note: string; reviewed_at: string } };
type Result = { data: Alert[]; summary: Record<Alert['severity'], number>; note: string };
export default function AuditPriorityAlerts({ refreshKey }: { refreshKey: number }) {
  const [result, setResult] = useState<Result | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0), [reviewed, setReviewed] = useState(false), [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Alert | null>(null), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [reviewError, setReviewError] = useState('');
  useEffect(() => {
    const c = new AbortController(); setLoading(true); setError('');
    apiRequest<Result>('/api/admin/audit-alerts', { signal: c.signal }).then(r => { if (!c.signal.aborted) setResult(r); })
      .catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Priority alerts could not be loaded.'); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [refreshKey, revision]);
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible') setRevision(n => n + 1); }, 30000); return () => clearInterval(t); }, []);
  const review = async () => {
    if (!selected || busy) return; setBusy(true); setReviewError('');
    try { await apiRequest('/api/admin/audit-alerts/' + selected.key + '/review', { method: 'POST', body: { note } }); setSelected(null); setRevision(n => n + 1); }
    catch (e) { setReviewError(e instanceof Error ? e.message : 'The review could not be saved.'); } finally { setBusy(false); }
  };
  const pending = result?.data.filter(a => !a.review) || [], handled = result?.data.filter(a => a.review) || [];
  const list = reviewed ? handled : pending;
  const visible = expanded ? list : list.slice(0, 3);
  return <Card className="p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-3"><div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-[#080677]"><ShieldCheck size={20} /></div><div><h2 className="font-semibold text-slate-900">Priority review</h2><p className="mt-1 text-sm text-slate-500">Unusual patterns and parking record issues appear here.</p></div></div>
      <Button size="sm" variant="ghost" disabled={loading} onClick={() => setRevision(n => n + 1)}>Refresh alerts</Button>
    </div>
    {loading && <p role="status" className="mt-4 text-sm text-slate-500">{result ? 'Refreshing priority review…' : 'Checking for priority alerts…'}</p>}
    {error ? <div role="alert" className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600"><p>Priority alerts are unavailable. The previous result cannot be verified.</p><p className="mt-1 text-xs">{error}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => setRevision(n => n + 1)}>Retry alerts</Button></div> : result && <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={!reviewed} onClick={() => { setReviewed(false); setExpanded(false); }} className={'min-h-11 rounded-lg px-3 text-sm ' + (!reviewed ? 'bg-blue-50 font-semibold text-[#080677]' : 'text-slate-500 hover:bg-slate-50')}>Needs review ({pending.length})</button>
        <button type="button" aria-pressed={reviewed} onClick={() => { setReviewed(true); setExpanded(false); }} className={'min-h-11 rounded-lg px-3 text-sm ' + (reviewed ? 'bg-blue-50 font-semibold text-[#080677]' : 'text-slate-500 hover:bg-slate-50')}>Reviewed ({handled.length})</button>
        {(['critical', 'high', 'medium'] as const).filter(level => result.summary[level] > 0).map(level => <Badge key={level} variant={level === 'critical' ? 'danger' : 'warning'}>{readable(level)}: {result.summary[level]}</Badge>)}
      </div>
      {!list.length && !loading && <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{reviewed ? 'No reviewed alerts in the current review window.' : 'No alerts currently need review.'}</p>}
      <div className="mt-3 space-y-3">{visible.map(a => <article key={a.key} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2"><Badge variant={a.severity === 'critical' ? 'danger' : 'warning'}>{readable(a.severity)}</Badge><Badge variant={a.review ? 'default' : 'info'}>{a.review ? 'Reviewed' : 'Needs review'}</Badge></div><h3 className="font-medium text-slate-800">{a.title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{a.detail}</p></div></div>
        <p className="mt-3 text-xs text-slate-500">{formatCampusDateTime(a.occurred_at)} · {readable(a.source)} #{a.record_id}</p>
        {a.review && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Review note: {a.review.note}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-4"><Link className="inline-flex min-h-11 items-center text-sm font-medium text-[#080677] underline" to={'/app/records/history?' + new URLSearchParams(a.source === 'record_history' ? { revision_id: a.record_id } : { record_type: a.source, record_id: a.record_id, scope: 'all', include_baseline: '1' })}>View supporting history</Link><Button size="sm" variant="outline" disabled={loading} onClick={() => { setSelected(a); setNote(''); setReviewError(''); }}>{a.review ? 'Add review update' : 'Record review'}</Button></div>
      </article>)}</div>
      {list.length > 3 && <Button variant="ghost" className="mt-2" onClick={() => setExpanded(v => !v)}><ChevronDown size={15} />{expanded ? 'Show fewer' : 'Show all ' + list.length + ' alerts'}</Button>}
      <details className="mt-4 text-xs leading-relaxed text-slate-500"><summary className="cursor-pointer">How these alerts are identified</summary><p className="mt-2">{result.note}</p></details>
    </>}
    <Modal open={!!selected} onClose={() => { if (!busy) setSelected(null); }} title="Record alert review">
      <div className="space-y-4"><div><p className="font-medium text-slate-800">{selected?.title}</p><p className="mt-2 text-sm leading-relaxed text-slate-600">Describe what you checked. Saving a review retains the original activity and does not automatically resolve the condition.</p></div><label className="block text-sm font-medium text-slate-700">Review note<textarea value={note} onChange={e => setNote(e.target.value)} minLength={5} maxLength={500} rows={4} disabled={busy} placeholder="What did you check, and what did you find?" className="mt-2 w-full rounded-lg border border-slate-200 p-3" /></label>{reviewError && <p role="alert" className="text-sm text-red-700">{reviewError}</p>}<div className="flex flex-wrap gap-3"><Button disabled={busy || note.trim().length < 5} onClick={review}>{busy ? 'Saving…' : 'Save review'}</Button><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button></div></div>
    </Modal>
  </Card>;
}
