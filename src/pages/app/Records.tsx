import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { apiBlob, apiRequest } from '../../lib/apiClient';
import { Badge, Button, Card, Input, Modal, PageHeader, Select, Table } from '../../components/ui';
import { formatCampusDateTime } from '../../lib/datetime';

type Row = { id: number; identifier: string; name: string; email?: string; owner?: string; status: string; archived_at: string | null };
type Revision = { revision_id: number; record_type: string; record_id: string; operation: string; actor_label: string | null; source: string | null; recorded_at: string; before_values: unknown; after_values: unknown; documents: { side: string; field: string }[] };
type Page<T> = { data: T[]; current_page: number; last_page: number; total: number };
type HistoryResult = { history: Page<Revision>; entities: Record<string, string>; started_at: string | null };

export default function Records() {
  const { pathname } = useLocation();
  const history = pathname.endsWith('/history');
  const entity = pathname.endsWith('/vehicles') ? 'vehicles' : 'users';
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Page<Row> | null>(null), [revisions, setRevisions] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0), [selected, setSelected] = useState<Row | null>(null), [detail, setDetail] = useState<Revision | null>(null);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [modalError, setModalError] = useState('');
  const query = params.toString(), state = params.get('state') || 'archived';
  const patchQuery = (key: string, value: string) => { const p = new URLSearchParams(params); value ? p.set(key, value) : p.delete(key); if (key !== 'page') p.delete('page'); setParams(p); };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setRows(null); setRevisions(null);
    const timer = setTimeout(() => {
      const url = history ? '/api/admin/record-history' : `/api/admin/record-archives/${entity}`;
      apiRequest<Page<Row> | HistoryResult>(`${url}?${query}`, { signal: controller.signal }).then(r => {
        if (controller.signal.aborted) return;
        if ('history' in r) setRevisions(r); else setRows(r);
      }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Records could not be loaded.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [history, entity, query, refresh]);
  const change = async () => {
    if (!selected || busy) return;
    setBusy(true); setModalError('');
    try {
      const r = await apiRequest<{ message: string }>(`/api/admin/record-archives/${entity}/${selected.id}/${selected.archived_at ? 'restore' : 'archive'}`, { method: 'POST', body: { reason } });
      setMessage(r.message); setSelected(null); setRefresh(n => n + 1);
    } catch (e) { setModalError(e instanceof Error ? e.message : 'The record could not be changed.'); }
    finally { setBusy(false); }
  };
  const download = async (r: Revision, doc: { side: string; field: string }) => {
    setModalError(''); setBusy(true);
    try {
      const blob = await apiBlob(`/api/admin/record-history/${r.revision_id}/documents/${doc.field}?side=${doc.side}`);
      const ext = blob.type.includes('pdf') ? 'pdf' : blob.type.includes('png') ? 'png' : 'jpg';
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `PASS-history-${r.revision_id}-${doc.side}.${ext}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setModalError(e instanceof Error ? e.message : 'The document is unavailable.'); }
    finally { setBusy(false); }
  };
  const page = history ? revisions?.history : rows;
  return <div className="space-y-5">
    <PageHeader title={history ? 'Record History' : entity === 'users' ? 'Account Archive' : 'Vehicle Archive'} subtitle="Preserve original records and review changes" action={<Button variant="outline" onClick={() => setRefresh(n => n + 1)}>Refresh</Button>} />
    <Card className="p-4 text-sm text-slate-600 space-y-2">
      <p>Archiving keeps the original identifier, documents and transactions. Restored records require fresh approval; revoked RFID and QR credentials stay revoked.</p>
      {history && <p>History starts when retention is installed. Earlier states and files already deleted before installation cannot be reconstructed.</p>}
    </Card>
    {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    <Card className="p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {history ? <>
          <Select label="Record type" value={params.get('record_type') || ''} onChange={e => patchQuery('record_type', e.target.value)}><option value="">All types</option>{Object.entries(revisions?.entities || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Input label="Record ID" value={params.get('record_id') || ''} maxLength={128} onChange={e => patchQuery('record_id', e.target.value)} />
          <Select label="Change" value={params.get('operation') || ''} onChange={e => patchQuery('operation', e.target.value)}><option value="">All changes</option>{['baseline', 'created', 'updated', 'archived', 'restored', 'deleted'].map(v => <option key={v}>{v}</option>)}</Select>
          {params.has('revision_id') && <Button variant="outline" onClick={() => patchQuery('revision_id', '')}>Clear revision filter</Button>}
        </> : <>
          <Select label="Show records" value={state} onChange={e => patchQuery('state', e.target.value)}><option value="archived">Archived</option><option value="active">Active records</option></Select>
          <Input label={entity === 'users' ? 'Search account or email' : 'Search plate or owner'} value={params.get('search') || ''} maxLength={100} onChange={e => patchQuery('search', e.target.value)} />
        </>}
      </div>
      {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading records…</p> : error ? <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}<Button variant="outline" className="ml-3" onClick={() => setRefresh(n => n + 1)}>Retry</Button></div> : history ?
        <Table data={revisions?.history.data || []} columns={[
          { key: 'revision_id', label: 'Revision' }, { key: 'record', label: 'Record', render: (r: Revision) => <span className="break-all">{r.record_type} #{r.record_id}</span> },
          { key: 'operation', label: 'Change', render: (r: Revision) => <Badge>{r.operation}</Badge> },
          { key: 'actor_label', label: 'Performed by', render: (r: Revision) => r.actor_label || 'System / source not attributed' },
          { key: 'recorded_at', label: 'Recorded', render: (r: Revision) => formatCampusDateTime(r.recorded_at) },
          { key: 'actions', label: 'Actions', render: (r: Revision) => <Button size="sm" variant="outline" onClick={() => { setDetail(r); setModalError(''); }}>View changes</Button> },
        ]} /> : <Table data={rows?.data || []} columns={[
          { key: 'identifier', label: 'Original identifier' }, { key: 'name', label: 'Name / vehicle' }, { key: entity === 'users' ? 'email' : 'owner', label: entity === 'users' ? 'Email' : 'Owner' },
          { key: 'status', label: 'Status', render: (r: Row) => <Badge>{r.status}</Badge> },
          { key: 'archived_at', label: 'Archived', render: (r: Row) => r.archived_at ? formatCampusDateTime(r.archived_at) : '—' },
          { key: 'actions', label: 'Actions', render: (r: Row) => <div className="flex flex-wrap gap-3 items-center"><Button size="sm" variant={r.archived_at ? 'outline' : 'danger'} onClick={() => { setSelected(r); setReason(''); setModalError(''); }}>{r.archived_at ? 'Restore' : 'Archive'}</Button><Link className="text-blue-700 underline" to={`/app/records/history?record_type=${entity}&record_id=${r.id}`}>History</Link></div> },
        ]} />}
      {page && !loading && <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"><p>{page.total} records · Page {page.current_page} of {page.last_page}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page.current_page <= 1} onClick={() => patchQuery('page', String(page.current_page - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={page.current_page >= page.last_page} onClick={() => patchQuery('page', String(page.current_page + 1))}>Next</Button></div></div>}
    </Card>
    <Modal open={!!selected} onClose={() => { if (!busy) setSelected(null); }} title={`${selected?.archived_at ? 'Restore' : 'Archive'} ${selected?.identifier || 'record'}`}>
      <div className="space-y-4"><p className="text-sm text-slate-600">{selected?.archived_at ? 'Restore the original record for fresh approval. Old access credentials will remain revoked.' : 'Remove this record from active use while retaining its documents and transaction history. Vehicles still inside must exit first.'}</p><label className="block text-sm font-medium text-slate-700">Reason<textarea value={reason} onChange={e => setReason(e.target.value)} minLength={5} maxLength={500} rows={3} className="mt-2 w-full rounded-lg border border-slate-200 p-3" disabled={busy} /></label>{modalError && <p role="alert" className="text-sm text-red-700">{modalError}</p>}<div className="flex flex-wrap gap-3"><Button variant={selected?.archived_at ? 'primary' : 'danger'} disabled={busy || reason.trim().length < 5} onClick={change}>{busy ? 'Saving…' : selected?.archived_at ? 'Restore record' : 'Archive record'}</Button><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button></div></div>
    </Modal>
    <Modal open={!!detail} onClose={() => { if (!busy) setDetail(null); }} title={`Revision #${detail?.revision_id || ''}`} size="xl">
      {detail && <div className="space-y-4"><p className="text-sm text-slate-600 break-all">{detail.record_type} #{detail.record_id} · {detail.operation} · {detail.source || 'System source'}</p><div className="grid gap-4 md:grid-cols-2">{(['before', 'after'] as const).map(side => <div key={side} className="min-w-0"><h3 className="mb-2 font-semibold capitalize text-slate-700">{side}</h3><pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap break-all">{JSON.stringify(detail[`${side}_values`], null, 2)}</pre></div>)}</div><div className="flex flex-wrap gap-3">{detail.documents.map(doc => <Button key={doc.side + doc.field} variant="outline" disabled={busy} onClick={() => download(detail, doc)}>Download {doc.side} {doc.field.replace(/_path$/, '').replace(/_/g, ' ')}</Button>)}</div>{modalError && <p role="alert" className="text-sm text-red-700">{modalError}</p>}</div>}
    </Modal>
  </div>;
}
