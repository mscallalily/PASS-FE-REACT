import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, RefreshCw, ScrollText, SearchX } from 'lucide-react';
import AuditPriorityAlerts from '../../components/AuditPriorityAlerts';
import RecordChanges from '../../components/RecordChanges';
import { Badge, Button, Card, Input, Modal, PageHeader, Select, Table, Toast } from '../../components/ui';
import { apiRequest } from '../../lib/apiClient';
import { campusDateKey, formatCampusDateTime } from '../../lib/datetime';
import { auditPresentation, exportCsv, MODULES, OUTCOMES, type Outcome, type Presentation, type Values } from '../../lib/recordPresentation';

type AuditLog = { log_id: number; user_id: number | null; actor_label: string | null; actor_name?: string | null; action: string; auditable_type: string | null; auditable_id: number | null; old_values: Values; new_values: Values; ip_address: string | null; user_agent: string | null; created_at: string; presentation?: Presentation };
type Result = { data: AuditLog[]; current_page: number; last_page: number; total: number; summary?: Record<Outcome, number> };

function historyType(type: string | null) {
  if (!type) return null;
  const name = type.split('\\').pop() || '';
  const aliases: Record<string, string> = { User: 'users', Vehicle: 'vehicles', Driver: 'drivers', DriverLicense: 'driver_licenses', VehicleAuthorization: 'vehicle_authorizations', ParkingTransaction: 'parking_transactions', RfidTag: 'rfid_tags', RFIDTag: 'rfid_tags' };
  if (aliases[name]) return aliases[name];
  return ['users', 'user_profiles', 'user_roles', 'roles', 'role_permissions', 'drivers', 'driver_licenses', 'vehicles', 'vehicle_authorizations', 'vehicle_driver', 'rfid_tags', 'rfid_assignments', 'rfid_readers', 'visitors', 'visitor_requests', 'qr_passes', 'vehicle_release_requests', 'parking_transactions', 'access_events', 'parking_violations', 'violation_evidences', 'parking_areas', 'parking_zones', 'parking_slots', 'access_gates', 'departments', 'vehicle_types', 'login_attempts', 'audit_logs', 'audit_alert_reviews'].includes(name) ? name : null;
}

export default function AuditLogs() {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<Result | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0), [selected, setSelected] = useState<AuditLog | null>(null), [toast, setToast] = useState('');
  const query = params.toString(), outcome = params.get('outcome') || '';
  const filter = (key: string, value: string) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); if (key !== 'page') next.delete('page'); setParams(next, { replace: key === 'search' }); };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setResult(null);
    const timer = setTimeout(() => {
      apiRequest<Result>('/api/admin/audit-logs?' + query, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setResult(data); })
        .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Activity could not be loaded.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, refresh]);
  const logs = result?.data || [], presentation = selected ? auditPresentation(selected) : null;
  const exportPage = () => {
    if (!logs.length || loading || error) return;
    exportCsv('PASS-Audit-Logs-' + campusDateKey() + '.csv', [
      ['Log ID', 'Performed by', 'Actor code', 'Activity', 'Action code', 'Module', 'Record', 'Outcome', 'Recorded at', 'IP address'],
      ...logs.map(log => { const p = auditPresentation(log); return [log.log_id, log.actor_name || log.actor_label || 'System', log.actor_label || '', p.action, log.action, p.module_label, p.record_label, p.outcome_label, formatCampusDateTime(log.created_at), log.ip_address || '']; }),
    ]);
    setToast('This page of activity was exported.');
  };
  const hasFilters = ['search', 'module', 'outcome', 'date_from', 'date_to'].some(key => params.has(key));
  return <div className="space-y-5 animate-fadein">
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
    <PageHeader title="Audit Logs" subtitle="See who did what and review the activities that need attention." action={<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={loading} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={16} />Refresh</Button><Button variant="outline" disabled={loading || !!error || !logs.length} onClick={exportPage}><Download size={16} />Export page CSV</Button></div>} />
    <AuditPriorityAlerts refreshKey={refresh} />
    <Card>
      <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
        <div><h2 className="font-semibold text-slate-900">Activity history</h2><p className="mt-1 text-sm text-slate-500">Completed actions and routine records appear here. Priority alerts are reviewed above.</p></div>
        <div className="flex flex-wrap gap-2" aria-label="Filter activity by result">
          <button type="button" aria-pressed={!outcome} onClick={() => filter('outcome', '')} className={'min-h-11 rounded-lg border px-3 py-2 text-sm ' + (!outcome ? 'border-[#080677] bg-blue-50 font-semibold text-[#080677]' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>All activity</button>
          {Object.entries(OUTCOMES).map(([key, label]) => <button type="button" key={key} aria-pressed={outcome === key} onClick={() => filter('outcome', key)} className={'min-h-11 rounded-lg border px-3 py-2 text-sm ' + (outcome === key ? 'border-[#080677] bg-blue-50 font-semibold text-[#080677]' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>{label}<span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums text-slate-600">{result?.summary?.[key as Outcome] ?? '—'}</span></button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Search activity" placeholder="Name, account code or action" maxLength={100} value={params.get('search') || ''} onChange={e => filter('search', e.target.value)} />
          <Select label="Module" value={params.get('module') || ''} onChange={e => filter('module', e.target.value)}><option value="">All modules</option>{Object.entries(MODULES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
          <Input label="From date" type="date" max={params.get('date_to') || undefined} value={params.get('date_from') || ''} onChange={e => filter('date_from', e.target.value)} />
          <Input label="To date" type="date" min={params.get('date_from') || undefined} value={params.get('date_to') || ''} onChange={e => filter('date_to', e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><p>Filter counts cover all matching pages. Times are shown in Philippine time.</p>{hasFilters && <Button variant="ghost" size="sm" onClick={() => setParams({})}>Clear filters</Button>}</div>
      </div>
      {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Loading activity…</p> : error ? <div role="alert" className="space-y-3 p-6 text-sm text-red-700"><p>{error}</p><Button variant="outline" onClick={() => setRefresh(n => n + 1)}>Try again</Button></div> : !logs.length ? <div className="space-y-2 p-10 text-center"><SearchX size={28} className="mx-auto text-slate-400" /><h3 className="font-semibold text-slate-700">No matching activity</h3><p className="text-sm text-slate-500">Try a different search, date range or result.</p></div> : <Table data={logs} columns={[
        { key: 'activity', label: 'Activity', render: (log: AuditLog) => { const p = auditPresentation(log); return <div className="min-w-40"><p className="font-semibold text-slate-800">{p.action}</p><p className="mt-1 text-xs text-slate-500">{p.record_label}</p></div>; } },
        { key: 'actor', label: 'Performed by', render: (log: AuditLog) => <div><p className="font-medium text-slate-700">{log.actor_name || log.actor_label || (log.user_id ? 'Account #' + log.user_id : 'System')}</p>{log.actor_name && log.actor_label && <p className="mt-1 text-xs text-slate-500">{log.actor_label}</p>}</div> },
        { key: 'module', label: 'Module', render: (log: AuditLog) => <span className="text-sm text-slate-600">{auditPresentation(log).module_label}</span> },
        { key: 'result', label: 'Result', render: (log: AuditLog) => { const p = auditPresentation(log); return <Badge variant={p.variant}>{p.outcome_label}</Badge>; } },
        { key: 'recorded', label: 'Recorded', render: (log: AuditLog) => <span className="whitespace-nowrap text-xs text-slate-600">{formatCampusDateTime(log.created_at)}</span> },
        { key: 'details', label: 'Details', render: (log: AuditLog) => <button type="button" aria-label={'View details of log ' + log.log_id} onClick={() => setSelected(log)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[#080677] hover:bg-blue-50"><ScrollText size={15} />View details</button> },
      ]} />}
      {result && !loading && !error && result.total > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm text-slate-500"><p>{result.total.toLocaleString()} matching activities · Page {result.current_page} of {result.last_page}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={result.current_page <= 1} onClick={() => filter('page', String(result.current_page - 1))}>Previous</Button><Button size="sm" variant="outline" disabled={result.current_page >= result.last_page} onClick={() => filter('page', String(result.current_page + 1))}>Next</Button></div></div>}
    </Card>
    <Modal open={!!selected} onClose={() => setSelected(null)} title={presentation?.action || 'Activity details'} size="xl">
      {selected && presentation && <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-slate-800">{presentation.record_label}</p><p className="mt-1 text-sm text-slate-500">{selected.actor_name || selected.actor_label || 'System'} · {formatCampusDateTime(selected.created_at)}</p></div><Badge variant={presentation.variant}>{presentation.outcome_label}</Badge></div>
        <RecordChanges key={selected.log_id} before={selected.old_values} after={selected.new_values} />
        {historyType(selected.auditable_type) && selected.auditable_id != null && selected.auditable_id > 0 && <Link className="inline-flex min-h-11 items-center text-sm font-medium text-[#080677] underline" to={'/app/records/history?' + new URLSearchParams({ record_type: historyType(selected.auditable_type)!, record_id: String(selected.auditable_id), scope: 'all', include_baseline: '1' })}>View this record’s history</Link>}
        <details className="rounded-xl border border-slate-200 p-4 text-sm"><summary className="cursor-pointer font-medium text-slate-700">Audit references & connection details</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2">{[['Log reference', '#' + selected.log_id], ['Action code', selected.action], ['Record reference', (selected.auditable_type || 'System') + ' #' + (selected.auditable_id ?? '—')], ['IP address', selected.ip_address || 'Not recorded'], ['Browser / device', selected.user_agent || 'Not recorded']].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-slate-700">{value}</dd></div>)}</dl></details>
        <div className="flex justify-end"><Button variant="outline" onClick={() => setSelected(null)}>Close</Button></div>
      </div>}
    </Modal>
  </div>;
}
