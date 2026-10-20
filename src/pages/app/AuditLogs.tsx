import { jsonFetch } from '../../lib/http';

import React, { useEffect, useState } from 'react';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Table,
  SearchBar,
  Modal,
  Toast,
} from '../../components/ui';
import { Download, RefreshCw } from 'lucide-react';
import { formatCampusDateTime } from '../../lib/datetime';

interface AuditLog {
  log_id: number;
  user_id: number | null;
  actor_label: string | null;
  action: string;
  auditable_type: string | null;
  auditable_id: number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditLogResponse {
  data: AuditLog[];
  current_page: number;
  last_page: number;
  total: number;
}

function getToken(): string | null {
  return (
    localStorage.getItem('pass_auth_token') ||
    sessionStorage.getItem('pass_auth_token')
  );
}

async function apiRequest<T>(url: string): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error('Your session has expired. Please log in again.');
  }

  const response = await jsonFetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed with status ${response.status}.`
    );
  }

  return data as T;
}

function formatDate(value: string): string {
  return formatCampusDateTime(value);
}

function getModule(log: AuditLog): string {
  const type = log.auditable_type?.split('\\').pop();

  if (type === 'User') return 'User Management';
  if (type === 'Vehicle') return 'Vehicle Management';
  if (type === 'RfidTag' || type === 'RFIDTag') {
    return 'RFID Management';
  }
  if (type === 'ParkingTransaction') return 'Parking Operations';

  return type || 'System';
}

function getDescription(log: AuditLog): string {
  const email = log.new_values?.email;

  if (
    log.action.toLowerCase() === 'created' &&
    log.auditable_type?.endsWith('\\User')
  ) {
    return `Created an account${
      email ? ` for ${String(email)}` : ''
    }.`;
  }

  const record = log.auditable_type?.split('\\').pop() || 'record';
  const id =
    log.auditable_id !== null ? ` (ID: ${log.auditable_id})` : '';

  return `${log.action} ${record}${id}.`;
}

function getStatus(action: string): 'success' | 'warning' | 'danger' {
  const value = action.toLowerCase();

  if (
    ['created', 'updated', 'approved', 'activated', 'assigned'].includes(value)
  ) {
    return 'success';
  }

  if (
    ['deleted', 'rejected', 'deactivated', 'suspended', 'failed'].includes(value)
  ) {
    return 'danger';
  }

  return 'warning';
}

function safeDetails(values: Record<string, unknown> | null): string {
  if (!values) return '—';

  return Object.entries(values)
    .filter(
      ([key]) =>
        !['password', 'password_confirmation'].includes(key.toLowerCase())
    )
    .map(([key, value]) => `${key}: ${String(value ?? '—')}`)
    .join(', ') || '—';
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      setLoading(true);
      setError('');

      try {
        const result = await apiRequest<AuditLogResponse>(
          `/api/admin/audit-logs?${new URLSearchParams({ page: String(page), ...(search ? { search } : {}), ...(startDate ? { date_from: startDate } : {}), ...(endDate ? { date_to: endDate } : {}) })}`
        );

        if (!cancelled) {
          setLogs(result.data || []);
          setLastPage(result.last_page || 1);
          setTotal(result.total || 0);
        }
      } catch (err) {
        if (!cancelled) {
          setLogs([]);
          setTotal(0);
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load audit logs.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLogs();

    return () => {
      cancelled = true;
    };
  }, [page, refreshKey, search, startDate, endDate]);

  useEffect(() => { setPage(1); }, [search, startDate, endDate]);

  const filtered = logs;

  function exportLogs() {
    if (filtered.length === 0) {
      setToast('There are no records to export on this page.');
      return;
    }

    const headers = [
      'Log ID',
      'User',
      'Action',
      'Module',
      'Description',
      'Timestamp',
      'Status',
      'IP Address',
    ];

    const rows = filtered.map((log) => [
      log.log_id,
      log.actor_label || `User #${log.user_id ?? '—'}`,
      log.action,
      getModule(log),
      getDescription(log),
      formatDate(log.created_at),
      getStatus(log.action),
      log.ip_address || '—',
    ]);

    const escapeCsv = (value: unknown) => {
      let cell = String(value ?? '');
      if (/^[\s\x00-\x1f]*[=+@\-]/.test(cell)) cell = "'" + cell;
      return '"' + cell.replace(/"/g, '""') + '"';
    };

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `PASS-Audit-Logs-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setToast('Audit logs exported successfully.');
  }

  return (
    <div className="animate-fadein">
      {toast && (
        <Toast
          message={toast}
          type="success"
          onClose={() => setToast('')}
        />
      )}

      <PageHeader
        title="Audit Log & Activity Monitor"
        subtitle="Track recorded system activities and user actions"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
            <Button variant="outline" disabled={loading || !!error || !filtered.length} onClick={exportLogs}>
              <Download size={16} />
              Export Page CSV
            </Button>
          </div>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Try Again
          </Button>
        </div>
      )}

      <Card>
        <div className="border-b border-slate-50 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-56 flex-1">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search by user, action, or module..."
              />
            </div>

            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />

            <input
              type="date"
              aria-label="End date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Showing {filtered.length} matching records on this page · {total} matching records across all pages
          </p>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Loading audit logs...
          </p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Audit logs could not be loaded.
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No matching audit logs found.
          </p>
        ) : (
          <Table
            columns={[
              {
                key: 'log_id',
                label: 'Log ID',
                render: (log: AuditLog) => (
                  <span className="font-mono text-xs">#{log.log_id}</span>
                ),
              },
              {
                key: 'user',
                label: 'User',
                render: (log: AuditLog) => (
                  <div>
                    <p className="font-medium text-slate-700">
                      {log.actor_label || `User #${log.user_id ?? '—'}`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {log.user_id ? `User ID: ${log.user_id}` : 'System'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'action',
                label: 'Action',
                render: (log: AuditLog) => (
                  <span className="font-semibold capitalize text-[#080677]">
                    {log.action}
                  </span>
                ),
              },
              {
                key: 'module',
                label: 'Module',
                render: (log: AuditLog) => getModule(log),
              },
              {
                key: 'timestamp',
                label: 'Timestamp',
                render: (log: AuditLog) => (
                  <span className="whitespace-nowrap font-mono text-xs">
                    {formatDate(log.created_at)}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (log: AuditLog) => (
                  <Badge variant={getStatus(log.action)}>
                    {getStatus(log.action)}
                  </Badge>
                ),
              },
              {
                key: 'details',
                label: '',
                render: (log: AuditLog) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelected(log)}
                  >
                    Details
                  </Button>
                ),
              },
            ]}
            data={filtered}
            onRowClick={setSelected}
          />
        )}

        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-4">
            <span className="text-sm text-slate-500">
              Page {page} of {lastPage}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= lastPage}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Activity Details"
        size="md"
      >
        {selected && (
          <div className="space-y-3">
            {[
              ['Log ID', `#${selected.log_id}`],
              ['User', selected.actor_label || `User #${selected.user_id ?? '—'}`],
              ['Action', selected.action],
              ['Module', getModule(selected)],
              ['Description', getDescription(selected)],
              ['Record ID', selected.auditable_id ?? '—'],
              ['New Values', safeDetails(selected.new_values)],
              ['Previous Values', safeDetails(selected.old_values)],
              ['IP Address', selected.ip_address || '—'],
              ['Timestamp', formatDate(selected.created_at)],
              ['Status', getStatus(selected.action)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex gap-4 border-b border-slate-50 pb-2 text-sm"
              >
                <span className="w-28 shrink-0 text-slate-400">
                  {label}
                </span>
                <span className="break-all font-medium text-slate-700">
                  {String(value)}
                </span>
              </div>
            ))}

            <div className="pt-3">
              <Button
                variant="outline"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
