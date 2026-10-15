import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, RefreshCw, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { Card, Badge, Button, Table, Modal, Select, SearchBar } from './ui';
import { LICENSE_STATUS_LABEL, LICENSE_TYPE_LABEL, LicenseType } from '../context/LicenseContext';
import { apiBlob, apiRequest, ApiError } from '../lib/apiClient';

type QueueStatus = 'processing' | 'needs_correction' | 'pending_review' | 'verified';
type CheckResult = 'pass' | 'fail' | 'uncertain';

interface OcrResult {
  decision?: string;
  reasons?: string[];
  notes?: string[];
  checks?: Record<string, { result: CheckResult; detail: string }>;
  extracted?: { license_numbers?: string[]; dates?: string[]; expiry_date?: string | null; name_tokens_found?: string[] };
  confidence?: number | null;
  sharpness?: number | null;
  width?: number | null;
  height?: number | null;
  engine?: string;
  text?: string;
}

interface Row {
  license_id: number;
  license_number: string;
  license_type: LicenseType;
  expiry_date: string | null;
  original_file_name: string | null;
  has_file: boolean;
  submitted_at: string | null;
  verification_status: QueueStatus;
  verification_source: 'automatic' | 'staff' | null;
  verification_reason: string | null;
  ocr_result: OcrResult | null;
  checked_at: string | null;
  reviewed_at: string | null;
  reviewer_code: string | null;
  owner_code: string | null;
  owner_name: string | null;
}

type Decision = 'verified' | 'needs_correction' | 'pending_review';

const STATUS_VARIANT: Record<QueueStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  processing: 'info',
  pending_review: 'warning',
  verified: 'success',
  needs_correction: 'danger',
};

const CHECK_LABEL: Record<string, string> = {
  image_quality: 'Image quality',
  text_extraction: 'Text extraction (OCR)',
  document_type: 'Looks like an LTO license',
  license_number: 'License number matches',
  expiry_date: 'Expiration date matches',
  name: 'Name matches registration',
};

const CHECK_ICON: Record<CheckResult, React.ReactNode> = {
  pass: <CheckCircle size={16} className="text-green-600 shrink-0" />,
  fail: <XCircle size={16} className="text-red-600 shrink-0" />,
  uncertain: <HelpCircle size={16} className="text-amber-500 shrink-0" />,
};

const formatDate = (value: string | null, withTime = false) =>
  value
    ? new Date(value).toLocaleString('en-PH', withTime
      ? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

/** Staff/admin queue for driver's license verification, backed by the Laravel API. */
export default function LicenseReviewQueue({ onToast }: { onToast: (message: string, type?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<Row | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [previewError, setPreviewError] = useState('');

  const [decision, setDecision] = useState<{ row: Row; decision: Decision } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const query = params.toString();
      const result = await apiRequest<{ data: Row[] }>(`/api/licenses${query ? `?${query}` : ''}`);
      setRows(result.data ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load license submissions.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  // Keep refreshing while any automatic check is still running.
  const anyProcessing = rows.some(r => r.verification_status === 'processing');
  useEffect(() => {
    if (!anyProcessing) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [anyProcessing, load]);

  // Keep the open details panel in sync with refreshed data.
  useEffect(() => {
    if (selected) setSelected(rows.find(r => r.license_id === selected.license_id) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Free the previous object URL whenever the preview changes or closes.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const openDetails = async (row: Row) => {
    setSelected(row);
    setPreview(null);
    setPreviewError('');
    if (!row.has_file) return;
    try {
      const blob = await apiBlob(`/api/licenses/${row.license_id}/file`);
      setPreview({ url: URL.createObjectURL(blob), type: blob.type });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'The document could not be loaded.');
    }
  };

  const closeDetails = () => {
    setSelected(null);
    setPreview(null);
  };

  const startDecision = (row: Row, d: Decision) => {
    setDecision({ row, decision: d });
    setReason(d === 'needs_correction' ? (row.verification_reason ?? '') : '');
    setActionError('');
  };

  const confirmDecision = async () => {
    if (!decision) return;
    setBusy(true);
    setActionError('');
    try {
      const result = await apiRequest<{ message: string }>(`/api/licenses/${decision.row.license_id}/review`, {
        method: 'PATCH',
        body: { decision: decision.decision, reason: reason.trim() || null },
      });
      setDecision(null);
      onToast(`${decision.row.owner_name || 'License'}: ${result.message}`);
      await load();
    } catch (err) {
      // The row is out of date (removed, or still being checked): resync with MySQL.
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
        setDecision(null);
        setSelected(null);
        onToast(`${err.message} The list has been refreshed.`, 'error');
        await load();
        return;
      }
      setActionError(err instanceof Error ? err.message : 'The decision could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const recheck = async (row: Row) => {
    try {
      const result = await apiRequest<{ message: string }>(`/api/licenses/${row.license_id}/recheck`, { method: 'POST' });
      onToast(result.message);
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'The check could not be restarted.', 'error');
    }
  };

  const statusCell = (r: Row) => (
    <div className="max-w-[260px] whitespace-normal">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant={STATUS_VARIANT[r.verification_status]}>
          {r.verification_status === 'processing' && <Loader2 size={12} className="mr-1 animate-spin" />}
          {LICENSE_STATUS_LABEL[r.verification_status]}
        </Badge>
        {r.verification_status === 'needs_correction' && r.verification_source === 'automatic' && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Auto-returned</span>
        )}
      </div>
      {r.verification_status === 'needs_correction' && r.verification_reason && (
        <p className="mt-1 text-xs text-slate-500 line-clamp-2" title={r.verification_reason}>{r.verification_reason.split('\n')[0]}</p>
      )}
    </div>
  );

  const actionsCell = (r: Row) => {
    if (r.verification_status === 'processing') return <span className="text-xs text-slate-400">Checking…</span>;
    return (
      <div className="flex gap-2">
        {r.verification_status === 'pending_review' && (
          <>
            <Button size="sm" variant="outline" onClick={() => startDecision(r, 'verified')}>Verify</Button>
            <Button size="sm" variant="danger" onClick={() => startDecision(r, 'needs_correction')}>Needs correction</Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => openDetails(r)}>Details</Button>
      </div>
    );
  };

  const ocr = selected?.ocr_result;

  return (
    <Card>
      <div className="p-5 border-b border-slate-50 space-y-3">
        <p className="text-sm text-slate-500">Each upload is checked automatically. Clear failures are returned to the user with a reason; everything else waits here for review. The automatic check is preliminary and cannot confirm authenticity, so verify each license against the uploaded document. Verifying a license does not authorize a vehicle or assign an RFID; those are separate steps.</p>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by owner, ID, or license number...">
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {(['pending_review', 'needs_correction', 'processing', 'verified'] as QueueStatus[]).map(s => (
              <option key={s} value={s}>{LICENSE_STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </SearchBar>
      </div>

      {error && (
        <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">Unable to load license submissions: {error}</p>
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-400">Loading license submissions...</p>
      ) : (
        <Table
          columns={[
            { key: 'owner', label: 'Owner', render: (r: Row) => (
              <div>
                <p className="font-medium text-slate-700">{r.owner_name || '—'}</p>
                {r.owner_code && <p className="text-xs text-slate-400">{r.owner_code}</p>}
              </div>
            )},
            { key: 'license_number', label: 'License No.', render: (r: Row) => <span className="font-mono text-xs">{r.license_number}</span> },
            { key: 'expiry_date', label: 'Expiry', render: (r: Row) => formatDate(r.expiry_date) },
            { key: 'file', label: 'Uploaded File', render: (r: Row) => r.has_file ? (
              <button type="button" onClick={() => openDetails(r)} className="inline-flex items-center gap-1.5 text-[#2563EB] hover:underline max-w-[180px]">
                <FileText size={14} className="shrink-0" />
                <span className="truncate">{r.original_file_name || 'View document'}</span>
              </button>
            ) : <span className="text-xs text-slate-300">No file</span> },
            { key: 'submitted_at', label: 'Submitted', render: (r: Row) => formatDate(r.submitted_at, true) },
            { key: 'status', label: 'Status', render: statusCell },
            { key: 'actions', label: 'Actions', render: actionsCell },
          ]}
          data={rows}
        />
      )}

      {/* Details: document preview, automatic check results, and corrective actions */}
      <Modal open={!!selected} onClose={closeDetails} title="License Submission" size="xl">
        {selected && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 min-h-[220px] flex items-center justify-center overflow-hidden">
                {!selected.has_file ? (
                  <p className="text-sm text-slate-400">No document uploaded.</p>
                ) : previewError ? (
                  <p className="text-sm text-red-600 p-4">{previewError}</p>
                ) : !preview ? (
                  <Loader2 size={24} className="text-slate-400 animate-spin" />
                ) : preview.type === 'application/pdf' ? (
                  <iframe src={preview.url} title="License document" className="w-full h-[420px]" />
                ) : (
                  <img src={preview.url} alt={`Driver's license submitted by ${selected.owner_name ?? 'user'}`} className="max-h-[420px] w-auto" />
                )}
              </div>
              {[
                ['Owner', `${selected.owner_name || '—'}${selected.owner_code ? ` (${selected.owner_code})` : ''}`],
                ['License No.', selected.license_number],
                ['Type', LICENSE_TYPE_LABEL[selected.license_type] ?? selected.license_type],
                ['Expiry', formatDate(selected.expiry_date)],
                ['Submitted', formatDate(selected.submitted_at, true)],
                ['Last decision', selected.verification_source === 'staff'
                  ? `PASS staff${selected.reviewer_code ? ` (${selected.reviewer_code})` : ''}, ${formatDate(selected.reviewed_at, true)}`
                  : selected.checked_at ? `Automatic check, ${formatDate(selected.checked_at, true)}` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 text-sm border-b border-slate-50 pb-2">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-slate-700 text-right">{v}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={STATUS_VARIANT[selected.verification_status]}>{LICENSE_STATUS_LABEL[selected.verification_status]}</Badge>
                {selected.verification_source === 'automatic' && selected.verification_status === 'needs_correction' && (
                  <span className="text-xs font-semibold text-red-500">Automatically returned</span>
                )}
              </div>

              {selected.verification_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Correction reason sent to the user</p>
                  <ul className="list-disc pl-5 text-sm text-red-700 space-y-0.5">
                    {selected.verification_reason.split('\n').filter(Boolean).map(r => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-[#080677] mb-2">Automatic preliminary check</h4>
                {!ocr ? (
                  <p className="text-sm text-slate-400">{selected.verification_status === 'processing' ? 'The check is running…' : 'No automatic check result is stored for this submission.'}</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(ocr.checks ?? {}).map(([key, check]) => (
                      <div key={key} className="flex items-start gap-2 text-sm">
                        {CHECK_ICON[check.result]}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700">{CHECK_LABEL[key] ?? key}</p>
                          <p className="text-xs text-slate-500">{check.detail}</p>
                        </div>
                      </div>
                    ))}
                    {(ocr.notes ?? []).length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-amber-700 space-y-0.5">
                        {ocr.notes!.map(n => <li key={n}>{n}</li>)}
                      </ul>
                    )}
                    {ocr.extracted && (
                      <p className="text-xs text-slate-500">
                        Read from document: license no. {ocr.extracted.license_numbers?.join(', ') || '—'}; expiry {ocr.extracted.expiry_date || '—'}
                        {ocr.confidence != null && ` · OCR confidence ${ocr.confidence}%`}
                      </p>
                    )}
                    {ocr.text && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Extracted text</summary>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-600">{ocr.text}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>

              {selected.verification_status !== 'processing' && (
                <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-100">
                  {selected.verification_status !== 'verified' && (
                    <Button size="sm" variant="success" onClick={() => startDecision(selected, 'verified')}>Mark verified</Button>
                  )}
                  {selected.verification_status !== 'needs_correction' && (
                    <Button size="sm" variant="danger" onClick={() => startDecision(selected, 'needs_correction')}>Return for correction</Button>
                  )}
                  {selected.verification_status !== 'pending_review' && (
                    <Button size="sm" variant="outline" onClick={() => startDecision(selected, 'pending_review')}>Move to pending review</Button>
                  )}
                  {selected.verification_status !== 'verified' && selected.has_file && (
                    <Button size="sm" variant="ghost" onClick={() => recheck(selected)}><RefreshCw size={14} /> Re-run automatic check</Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Staff decision confirmation */}
      <Modal
        open={!!decision}
        onClose={() => !busy && setDecision(null)}
        title={decision?.decision === 'verified' ? 'Verify License' : decision?.decision === 'needs_correction' ? 'Return for Correction' : 'Move to Pending Review'}
        size="sm"
      >
        {decision && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {decision.decision === 'verified'
                ? `Confirm that you checked ${decision.row.owner_name || 'this user'}'s license against the uploaded document and it is authentic and matches the registration.`
                : decision.decision === 'needs_correction'
                  ? `Return ${decision.row.owner_name || 'this user'}'s submission. They will be notified and asked to resubmit.`
                  : 'Move this submission back to the pending review queue.'}
            </p>
            {decision.decision === 'needs_correction' && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">What needs to be corrected?</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  disabled={busy}
                  placeholder="e.g. The photo is cropped; the expiration date is not visible."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                />
              </div>
            )}
            {actionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{actionError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDecision(null)} disabled={busy}>Cancel</Button>
              <Button
                variant={decision.decision === 'needs_correction' ? 'danger' : decision.decision === 'verified' ? 'success' : 'primary'}
                onClick={confirmDecision}
                disabled={busy || (decision.decision === 'needs_correction' && !reason.trim())}
              >
                {busy ? 'Saving...' : decision.decision === 'verified' ? 'Verify' : decision.decision === 'needs_correction' ? 'Return to user' : 'Move'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
