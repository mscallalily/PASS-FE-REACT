import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Archive, History, RefreshCw, SearchX, Users, Car, Download } from 'lucide-react';
import { apiBlob, apiRequest } from '../../lib/apiClient';
import { Badge, Button, Card, Input, Modal, PageHeader, Select, Table, statusBadge } from '../../components/ui';
import RecordChanges from '../../components/RecordChanges';
import { formatCampusDateTime } from '../../lib/datetime';
import { readable, revisionSummary, fieldLabel } from '../../lib/recordPresentation';

type Entity = 'users' | 'vehicles';
type Row = { id: number; identifier: string; name: string; email?: string; owner?: string; owner_code?: string; status: string; archived_at: string | null };
type Revision = { revision_id: number; record_type: string; record_type_label?: string; record_label?: string; record_id: string; operation: string; actor_label: string | null; source: string | null; recorded_at: string; before_values: unknown; after_values: unknown; documents: { side: string; field: string }[] };
type Page<T> = { data: T[]; current_page: number; last_page: number; total: number; summary?: { active: number; archived: number } };
type HistoryResult = { history: Page<Revision>; entities: Record<string, string>; started_at: string | null };
const operationNames: Record<string, string> = { baseline: 'Initial snapshot', created: 'Created', updated: 'Updated', archived: 'Archived', restored: 'Restored', deleted: 'Deleted' };

export default function Records() {
  const { pathname } = useLocation(), [params, setParams] = useSearchParams();
  const history = pathname.endsWith('/history'), entity: Entity = pathname.endsWith('/vehicles') ? 'vehicles' : 'users';
  const [rows, setRows] = useState<Page<Row> | null>(null), [revisions, setRevisions] = useState<HistoryResult | null>(null), [entities, setEntities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0), [selected, setSelected] = useState<{ entity: Entity; row: Row } | null>(null), [detail, setDetail] = useState<Revision | null>(null);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [modalError, setModalError] = useState('');
  const state = params.get('state') || 'active', linked = history && params.has('revision_id');
  const scope = linked ? 'all' : params.get('scope') || 'business', includeBaseline = linked || params.get('include_baseline') === '1';
  const requestParams = new URLSearchParams(params);
  if (history) { requestParams.set('scope', scope); requestParams.set('include_baseline', includeBaseline ? '1' : '0'); } else requestParams.set('state', state);
  const query = requestParams.toString();
  const patchQuery = (key: string, value: string) => { const p = new URLSearchParams(params); value ? p.set(key, value) : p.delete(key); if (key !== 'page') p.delete('page'); if (key === 'record_type' && ['login_attempts', 'audit_logs', 'audit_alert_reviews'].includes(value)) p.set('scope', 'all'); setParams(p, { replace: key === 'search' }); };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setRows(null); setRevisions(null);
    const timer = setTimeout(() => {
      const url = history ? '/api/admin/record-history' : '/api/admin/record-archives/' + entity;
      apiRequest<Page<Row> | HistoryResult>(url + '?' + query, { signal: controller.signal }).then(r => {
        if (controller.signal.aborted) return;
        if ('history' in r) { setRevisions(r); setEntities(r.entities); } else setRows(r);
      }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Records could not be loaded.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [history, entity, query, refresh]);
  useEffect(() => { setDetail(null); setSelected(null); setReason(''); setModalError(''); setMessage(''); }, [pathname]);
  const change = async () => {
    if (!selected || busy) return;
    const target = selected; setBusy(true); setModalError('');
    try {
      const r = await apiRequest<{ message: string }>('/api/admin/record-archives/' + target.entity + '/' + target.row.id + '/' + (target.row.archived_at ? 'restore' : 'archive'), { method: 'POST', body: { reason } });
      setMessage(r.message); setSelected(null); setRefresh(n => n + 1);
    } catch (e) { setModalError(e instanceof Error ? e.message : 'The record could not be changed.'); }
    finally { setBusy(false); }
  };
  const download = async (r: Revision, doc: { side: string; field: string }) => {
    setModalError(''); setBusy(true);
    try {
      const blob = await apiBlob('/api/admin/record-history/' + r.revision_id + '/documents/' + encodeURIComponent(doc.field) + '?side=' + encodeURIComponent(doc.side));
      const ext = blob.type.includes('pdf') ? 'pdf' : blob.type.includes('png') ? 'png' : 'jpg';
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'PASS-history-' + r.revision_id + '-' + doc.side + '.' + ext; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setModalError(e instanceof Error ? e.message : 'The document is unavailable.'); }
    finally { setBusy(false); }
  };
  const page = history ? revisions?.history : rows, target = selected?.row;
  const clearFilters = () => setParams(history ? {} : { state });
  const hasFilters = ['search', 'record_type', 'record_id', 'revision_id', 'operation', 'date_from', 'date_to'].some(key => params.has(key));
  const archiveCount = rows?.summary;
  return <div className="space-y-5 animate-fadein">
    <PageHeader title="Records & History" subtitle="Find account and vehicle records, manage archives, and review saved changes." action={<Button variant="outline" disabled={loading} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={16} />Refresh</Button>} />
    <nav aria-label="Records sections" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {[{ label: 'Accounts', to: '/app/records/accounts', icon: Users, active: !history && entity === 'users' }, { label: 'Vehicles', to: '/app/records/vehicles', icon: Car, active: !history && entity === 'vehicles' }, { label: 'Change history', to: '/app/records/history', icon: History, active: history }].map(tab => <Link key={tab.to} to={tab.to} aria-current={tab.active ? 'page' : undefined} className={'inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium ' + (tab.active ? 'bg-[#080677] text-white' : 'text-slate-600 hover:bg-blue-50')}><tab.icon size={16} />{tab.label}</Link>)}
    </nav>
    {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    <Card>
      <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{history ? 'Saved record changes' : entity === 'users' ? 'Account records' : 'Vehicle records'}</h2><p className="mt-1 text-sm text-slate-500">{history ? 'Review what changed, who made the change, and when it was saved.' : 'Switch between active and archived records. Original identifiers and history are retained.'}</p></div>{history ? <Link to="/app/audit" className="inline-flex min-h-11 items-center text-sm font-medium text-[#080677] underline">View activity logs</Link> : <div className="flex gap-1 rounded-xl bg-slate-100 p-1">{(['active', 'archived'] as const).map(value => <button type="button" key={value} aria-pressed={state === value} onClick={() => patchQuery('state', value)} className={'min-h-11 rounded-lg px-3 text-sm ' + (state === value ? 'bg-white font-semibold text-[#080677] shadow-sm' : 'text-slate-500')}>{readable(value)} {archiveCount ? '(' + archiveCount[value] + ')' : ''}</button>)}</div>}</div>
        {linked && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800"><p>Viewing linked revision #{params.get('revision_id')}.</p><Button size="sm" variant="ghost" onClick={() => patchQuery('revision_id', '')}>Browse other changes</Button></div>}
        <div className={'grid gap-3 sm:grid-cols-2 ' + (history ? 'lg:grid-cols-4' : '')}>
          <Input label={history ? 'Search saved records' : entity === 'users' ? 'Find an account' : 'Find a vehicle'} placeholder={history ? 'Plate, name, email or record ID' : entity === 'users' ? 'Name, email or account code' : 'Plate number, owner or account code'} value={params.get('search') || ''} maxLength={100} onChange={e => patchQuery('search', e.target.value)} />
          {history && <>
            <Select label="Record type" value={params.get('record_type') || ''} onChange={e => patchQuery('record_type', e.target.value)}><option value="">All record types</option>{Object.entries(entities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
            <Select label="Type of change" value={params.get('operation') || ''} onChange={e => patchQuery('operation', e.target.value)}><option value="">All changes</option>{Object.entries(operationNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
            <Select label="History view" disabled={linked} value={scope} onChange={e => { const p = new URLSearchParams(params); p.set('scope', e.target.value); p.delete('page'); if (e.target.value === 'business' && ['login_attempts', 'audit_logs', 'audit_alert_reviews'].includes(p.get('record_type') || '')) p.delete('record_type'); setParams(p); }}><option value="business">Business records</option><option value="all">All retained records</option></Select>
            <Input label="From date" type="date" value={params.get('date_from') || ''} max={params.get('date_to') || undefined} onChange={e => patchQuery('date_from', e.target.value)} />
            <Input label="To date" type="date" value={params.get('date_to') || ''} min={params.get('date_from') || undefined} onChange={e => patchQuery('date_to', e.target.value)} />
            <details className="sm:col-span-2 text-sm text-slate-500"><summary className="cursor-pointer py-2">Exact record lookup</summary><Input label="Record ID" maxLength={128} value={params.get('record_id') || ''} onChange={e => patchQuery('record_id', e.target.value)} /></details>
          </>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">{history ? <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" disabled={linked} checked={includeBaseline} onChange={e => patchQuery('include_baseline', e.target.checked ? '1' : '0')} className="h-4 w-4 accent-[#080677]" />Include initial snapshots</label> : <p>Search covers both active and archived records; the selected view determines which rows appear.</p>}{hasFilters && <Button size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button>}</div>
      </div>
      {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Loading records…</p> : error ? <div role="alert" className="space-y-3 p-6 text-sm text-red-700"><p>{error}</p><Button variant="outline" onClick={() => setRefresh(n => n + 1)}>Retry</Button></div> : !page?.data.length ? <div className="space-y-2 p-10 text-center"><SearchX size={28} className="mx-auto text-slate-400" /><h3 className="font-semibold text-slate-700">{history ? 'No matching changes' : state === 'archived' ? 'No archived records here' : 'No matching records'}</h3><p className="mx-auto max-w-lg text-sm text-slate-500">{history ? 'Try another search or date range. Include initial snapshots to see records saved when history began.' : state === 'archived' ? 'Archived accounts or vehicles will appear here, with their history retained.' : 'Try a name, account code or plate number.'}</p></div> : history ? <Table data={revisions?.history.data || []} columns={[
        { key: 'record', label: 'Record', render: (r: Revision) => <div className="min-w-40"><p className="font-semibold text-slate-800">{r.record_label || readable(r.record_type) + ' #' + r.record_id}</p><p className="mt-1 text-xs text-slate-500">{r.record_type_label || entities[r.record_type] || readable(r.record_type)}</p></div> },
        { key: 'change', label: 'Change', render: (r: Revision) => <div><Badge variant={r.operation === 'created' || r.operation === 'restored' ? 'success' : r.operation === 'updated' ? 'info' : 'default'}>{operationNames[r.operation] || readable(r.operation)}</Badge><p className="mt-2 max-w-xs text-xs text-slate-500">{revisionSummary(r.operation, r.before_values, r.after_values)}</p></div> },
        { key: 'actor', label: 'Performed by', render: (r: Revision) => <span>{r.actor_label || 'System / no actor recorded'}</span> },
        { key: 'time', label: 'Recorded', render: (r: Revision) => <span className="whitespace-nowrap text-xs text-slate-600">{formatCampusDateTime(r.recorded_at)}</span> },
        { key: 'details', label: 'Details', render: (r: Revision) => <button type="button" aria-label={'View revision ' + r.revision_id} onClick={() => { setDetail(r); setModalError(''); }} className="min-h-11 rounded-lg px-2 text-sm font-medium text-[#080677] hover:bg-blue-50">View changes</button> },
      ]} /> : <Table data={rows?.data || []} columns={[
        { key: 'record', label: entity === 'users' ? 'Account' : 'Vehicle', render: (r: Row) => <div className="min-w-32"><p className="font-semibold text-slate-800">{entity === 'users' ? r.name || r.identifier : r.identifier}</p><p className="mt-1 text-xs text-slate-500">{entity === 'users' ? r.identifier : r.name || 'Vehicle details not provided'}</p></div> },
        { key: 'owner', label: entity === 'users' ? 'Email' : 'Owner', render: (r: Row) => <div><p className="break-words">{entity === 'users' ? r.email || 'Not recorded' : r.owner || 'Not recorded'}</p>{entity === 'vehicles' && r.owner_code && r.owner !== r.owner_code && <p className="mt-1 text-xs text-slate-500">{r.owner_code}</p>}</div> },
        { key: 'status', label: 'Current status', render: (r: Row) => <Badge variant={r.archived_at ? 'default' : statusBadge(r.status)}>{r.archived_at ? 'Archived' : readable(r.status)}</Badge> },
        ...(state === 'archived' ? [{ key: 'archived', label: 'Archived on', render: (r: Row) => <span className="whitespace-nowrap text-xs">{r.archived_at ? formatCampusDateTime(r.archived_at) : '—'}</span> }] : []),
        { key: 'actions', label: 'Actions', render: (r: Row) => <div className="flex flex-wrap items-center gap-3"><Link className="inline-flex min-h-11 items-center text-sm font-medium text-[#080677] underline" to={'/app/records/history?' + new URLSearchParams({ record_type: entity, record_id: String(r.id), include_baseline: '1' })}>View history</Link><Button size="sm" variant="outline" onClick={() => { setSelected({ entity, row: r }); setReason(''); setModalError(''); }}><Archive size={14} />{r.archived_at ? 'Restore' : 'Archive'}</Button></div> },
      ]} />}
      {page && !loading && page.total > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm text-slate-500"><p>{page.total.toLocaleString()} matching {history ? 'changes' : 'records'} · Page {page.current_page} of {page.last_page}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page.current_page <= 1} onClick={() => patchQuery('page', String(page.current_page - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={page.current_page >= page.last_page} onClick={() => patchQuery('page', String(page.current_page + 1))}>Next</Button></div></div>}
    </Card>
    {history && <details className="px-1 text-xs leading-relaxed text-slate-500"><summary className="cursor-pointer">About saved history</summary><p className="mt-2">{revisions?.started_at ? 'History available since ' + formatCampusDateTime(revisions.started_at) + '. ' : ''}Initial snapshots capture records present when history began. Earlier changes are not reconstructed. Business records omit routine sign-in, activity-log and alert-review revisions; choose All retained records to include them.</p></details>}
    <Modal open={!!selected} onClose={() => { if (!busy) setSelected(null); }} title={(target?.archived_at ? 'Restore ' : 'Archive ') + (target?.identifier || 'record')}>
      <div className="space-y-4"><p className="text-sm leading-relaxed text-slate-600">{target?.archived_at ? 'Restore this record for fresh approval. Its original identifier and history remain available; previous access credentials stay revoked.' : 'Remove this record from active use while retaining its original identifier, documents and history. A vehicle that is still inside must exit first.'}</p><label className="block text-sm font-medium text-slate-700">Reason<textarea value={reason} onChange={e => setReason(e.target.value)} minLength={5} maxLength={500} rows={3} placeholder="Explain why this record is being archived or restored." className="mt-2 w-full rounded-lg border border-slate-200 p-3" disabled={busy} /></label>{modalError && <p role="alert" className="text-sm text-red-700">{modalError}</p>}<div className="flex flex-wrap gap-3"><Button variant={target?.archived_at ? 'primary' : 'danger'} disabled={busy || reason.trim().length < 5} onClick={change}>{busy ? 'Saving…' : target?.archived_at ? 'Restore record' : 'Archive record'}</Button><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button></div></div>
    </Modal>
    <Modal open={!!detail} onClose={() => { if (!busy) setDetail(null); }} title={detail?.record_label || 'Saved change'} size="xl">
      {detail && <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-slate-800">{detail.record_type_label || readable(detail.record_type)}</p><p className="mt-1 text-sm text-slate-500">{detail.actor_label || 'System / no actor recorded'} · {formatCampusDateTime(detail.recorded_at)}</p></div><Badge variant="info">{operationNames[detail.operation] || readable(detail.operation)}</Badge></div>{detail.operation === 'baseline' && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">This is the initial retained version, rather than a new change made by a user.</p>}<RecordChanges key={detail.revision_id} before={detail.before_values} after={detail.after_values} />
        {!!detail.documents.length && <section className="space-y-3 border-t border-slate-100 pt-4"><h3 className="font-semibold text-slate-800">Retained documents</h3><div className="flex flex-wrap gap-2">{detail.documents.map(doc => <Button key={doc.side + doc.field} size="sm" variant="outline" disabled={busy} onClick={() => download(detail, doc)}><Download size={14} />{doc.side === 'before' ? 'Previous' : 'Updated'} {fieldLabel(doc.field.replace(/_path$/, ''))}</Button>)}</div></section>}
        <details className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500"><summary className="cursor-pointer">Revision reference</summary><p className="mt-2 break-words">Revision #{detail.revision_id} · {detail.record_type} #{detail.record_id} · Source: {detail.source || 'Not recorded'}</p></details>{modalError && <p role="alert" className="text-sm text-red-700">{modalError}</p>}<div className="flex justify-end"><Button variant="outline" disabled={busy} onClick={() => setDetail(null)}>Close</Button></div></div>}
    </Modal>
  </div>;
}
