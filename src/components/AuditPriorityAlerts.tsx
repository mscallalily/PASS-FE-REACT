import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/apiClient';
import { Badge, Button, Card, Modal } from './ui';
import { formatCampusDateTime } from '../lib/datetime';
type Alert = { key: string; severity: 'critical' | 'high' | 'medium'; title: string; detail: string; source: string; record_id: string; occurred_at: string; review: null | { reviewed_by: number; note: string; reviewed_at: string } };
type Result = { data: Alert[]; summary: Record<Alert['severity'], number>; note: string };
export default function AuditPriorityAlerts({ refreshKey }: { refreshKey: number }) {
  const [result, setResult] = useState<Result | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0), [all, setAll] = useState(false), [selected, setSelected] = useState<Alert | null>(null), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [reviewError, setReviewError] = useState('');
  useEffect(() => {
    const c = new AbortController(); setLoading(true); setError('');
    apiRequest<Result>('/api/admin/audit-alerts', { signal: c.signal }).then(r => { if (!c.signal.aborted) setResult(r); }).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Priority alerts could not be loaded.'); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [refreshKey, revision]);
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible') setRevision(n => n + 1); }, 30000); return () => clearInterval(t); }, []);
  const review = async () => {
    if (!selected || busy) return; setBusy(true); setReviewError('');
    try { await apiRequest(`/api/admin/audit-alerts/${selected.key}/review`, { method: 'POST', body: { note } }); setSelected(null); setRevision(n => n + 1); }
    catch (e) { setReviewError(e instanceof Error ? e.message : 'The review could not be saved.'); } finally { setBusy(false); }
  };
  return <Card className="p-4 sm:p-6 space-y-4">
    <div className="flex flex-wrap justify-between items-start gap-3"><div><h2 className="font-bold text-lg text-[#080677]">Priority Alerts</h2><p className="text-sm text-slate-500 mt-1">Review unusual activity before routine logs.</p></div><Button size="sm" variant="outline" onClick={() => setRevision(n => n + 1)}>Refresh alerts</Button></div>
    <div className="grid grid-cols-3 gap-2 sm:gap-4">{(['critical', 'high', 'medium'] as const).map(level => <div key={level} className={`min-w-0 rounded-xl border p-3 ${level === 'critical' ? 'border-red-200 bg-red-50 text-red-800' : level === 'high' ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><p className="capitalize text-xs font-semibold">{level}</p><p className="text-2xl font-bold mt-1">{result?.summary[level] ?? '—'}</p><p className="text-[10px] sm:text-xs">Needs review</p></div>)}</div>
    {loading && <p role="status" className="text-sm text-slate-500">{result ? 'Refreshing alerts…' : 'Loading priority alerts…'}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {result && <><p className="text-xs leading-relaxed text-slate-500">{result.note}</p>{!result.data.length && <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">No priority signals in the current review window.</p>}
      {(all ? result.data : result.data.slice(0, 5)).map(a => <div key={a.key} className="rounded-xl border border-slate-200 p-4 space-y-3"><div className="flex flex-wrap gap-2"><Badge variant={a.severity === 'critical' ? 'danger' : 'warning'}>{a.severity.toUpperCase()}</Badge><Badge variant={a.review ? 'default' : 'info'}>{a.review ? 'Reviewed' : 'Needs review'}</Badge></div><h3 className="font-semibold text-slate-800">{a.title}</h3><p className="text-sm text-slate-600">{a.detail}</p><p className="text-xs text-slate-500 break-all">{formatCampusDateTime(a.occurred_at)} · {a.source} #{a.record_id}</p>{a.review && <p className="text-sm text-slate-600">Review: {a.review.note}</p>}<div className="flex flex-wrap gap-4 items-center"><Link className="text-sm text-blue-700 underline" to={`/app/records/history?${a.source === 'record_history' ? `revision_id=${a.record_id}` : `record_type=${a.source}&record_id=${a.record_id}`}`}>View retained history</Link><Button size="sm" variant="outline" onClick={() => { setSelected(a); setNote(''); setReviewError(''); }}>{a.review ? 'Add review update' : 'Record review'}</Button></div></div>)}
      {result.data.length > 5 && <Button variant="ghost" onClick={() => setAll(v => !v)}>{all ? 'Show fewer alerts' : `Show all ${result.data.length} alerts`}</Button>}</>}
    <Modal open={!!selected} onClose={() => { if (!busy) setSelected(null); }} title="Record alert review"><div className="space-y-4"><p className="text-sm text-slate-600">{selected?.title}. Record what you checked. This preserves the original evidence and does not automatically resolve the underlying condition.</p><label className="block text-sm font-medium text-slate-700">Review note<textarea value={note} onChange={e => setNote(e.target.value)} minLength={5} maxLength={500} rows={4} disabled={busy} className="mt-2 w-full border border-slate-200 rounded-lg p-3" /></label>{reviewError && <p role="alert" className="text-sm text-red-700">{reviewError}</p>}<div className="flex gap-3 flex-wrap"><Button disabled={busy || note.trim().length < 5} onClick={review}>{busy ? 'Saving…' : 'Save review'}</Button><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button></div></div></Modal>
  </Card>;
}
