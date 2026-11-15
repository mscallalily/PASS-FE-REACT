import { formatCampusDateTime } from '../../lib/datetime';
import { PrivilegedAccountInviteModal, PrivilegedInvitationStatus } from '../../components/PrivilegedAccountInvitations';
import { jsonFetch } from '../../lib/http';
import { PAGE_SECTIONS, selectedSection } from '../../lib/pageSections';

import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  PageHeader,
  Card,
  Badge,
  statusBadge,
  Button,
  Table,
  SearchBar,
  Select,
  Modal,

  Toast,
} from '../../components/ui';
import { UserPlus, Check, X, RefreshCw } from 'lucide-react';
import { apiBlob } from '../../lib/apiClient';
type SchoolIdCheck = { status: string; reasons: string[]; note: string; checks: Record<string, { result: string; detail: string }> };
const ID_CHECK_LABELS: Record<string, string> = { matched: 'Details matched', manual_review: 'Staff review needed', unavailable: 'Automatic reader unavailable', needs_correction: 'Needs correction' };

type UserStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'deactivated';

interface UserRow {
  id: string;
  name: string;
  email: string;
  idNum: string;
  role: string;
  userType: string;
  dept: string;
  contact: string;
  status: UserStatus;
  registered: string;
  registrationCategory?: string | null;
  yearLevel?: string | null;
  section?: string | null;
  schoolIdCheck?: SchoolIdCheck | null;
  schoolIdSubmitted?: boolean;
  archivedAt?: string | null;
}

interface ApiUser {
  id: string;
  name?: string;
  email?: string;
  idNum?: string | null;
  role?: string | null;
  userType?: string | null;
  dept?: string | null;
  contact?: string | null;
  status: UserStatus;
  registered?: string | null;
  registrationCategory?: string | null;
  yearLevel?: string | null;
  section?: string | null;
  schoolIdCheck?: SchoolIdCheck | null;
  schoolIdSubmitted?: boolean;
  archivedAt?: string | null;
}

interface ApiListResponse {
  users?: {
    data?: ApiUser[];
    current_page?: number;
    last_page?: number;
    total?: number;
  };
  message?: string;
}

function getToken(): string | null {
  return (
    localStorage.getItem('pass_auth_token') ||
    sessionStorage.getItem('pass_auth_token')
  );
}

function displayRole(role?: string | null, userType?: string | null) {
  const value = (role || userType || 'user').toLowerCase();

  if (['parking_staff', 'security', 'parking'].includes(value)) {
    return 'parking_staff';
  }

  if (['administrator', 'parking_admin'].includes(value)) {
    return 'admin';
  }

  return value;
}

function mapUser(user: ApiUser): UserRow {
  return {
    id: String(user.id),
    name: user.name?.trim() || 'Unnamed User',
    email: user.email || '',
    idNum: user.idNum || '—',
    role: displayRole(user.role, user.userType),
    userType: user.userType || 'other',
    dept: user.dept || '—',
    contact: user.contact || '—',
    status: user.status,
    registered: user.registered || '',
    registrationCategory: user.registrationCategory, yearLevel: user.yearLevel, section: user.section, schoolIdCheck: user.schoolIdCheck, schoolIdSubmitted: user.schoolIdSubmitted,
    archivedAt: user.archivedAt ?? null,
  };
}

function formatDate(value: string) {
  return formatCampusDateTime(value);
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error('Your session has expired. Please log in again.');
  }

  const response = await jsonFetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
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

export default function UserManagement() {
  const { pathname } = useLocation();
  const tab = selectedSection(PAGE_SECTIONS.users, pathname);

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [page, setPage] = useState(1), [lastPage, setLastPage] = useState(1), [total, setTotal] = useState(0);

  const [filterStatus, setFilterStatus] = useState('');
  const [archiveView, setArchiveView] = useState<'active' | 'archived'>('active');
  const [archiveTarget, setArchiveTarget] = useState<UserRow | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveError, setArchiveError] = useState('');

  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const [idPreview, setIdPreview] = useState<{ url: string; pdf: boolean } | null>(null);
  const [idError, setIdError] = useState('');
  const [idLoading, setIdLoading] = useState(false);
  const previewSequence = useRef(0);
  useEffect(() => { previewSequence.current++; setIdPreview(null); setIdError(''); setIdLoading(false); }, [selected?.id]);
  useEffect(() => () => { if (idPreview) URL.revokeObjectURL(idPreview.url); }, [idPreview]);
  const viewSchoolId = async () => {
    if (!selected || idLoading) return;
    const seq = ++previewSequence.current;
    setIdLoading(true); setIdError('');
    try { const blob = await apiBlob(`/api/admin/users/${selected.id}/school-id`); if (seq !== previewSequence.current) return; setIdPreview({ url: URL.createObjectURL(blob), pdf: blob.type === 'application/pdf' }); }
    catch (error) { if (seq === previewSequence.current) setIdError(error instanceof Error ? error.message : 'Unable to load the ID.'); }
    finally { if (seq === previewSequence.current) setIdLoading(false); }
  };

  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };



  useEffect(() => {
    if (tab === 'Roles & Permissions') return;

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({ page: String(page) });
        if (filterRole) params.set('role', filterRole);

        if (tab === 'Pending Approval') {
          params.set('status', 'pending');
        } else {
          if (filterStatus) params.set('status', filterStatus);
          if (archiveView === 'archived') params.set('archive', 'archived');
        }

        if (search.trim()) {
          params.set('search', search.trim());
        }

        const query = params.toString();
        const endpoint = `/api/admin/users${query ? `?${query}` : ''}`;

        const result = await apiRequest<ApiListResponse>(endpoint);
        const rows = (result.users?.data || []).map(mapUser);

        if (!cancelled) {
          setUsers(rows); setLastPage(result.users?.last_page ?? 1); setTotal(result.users?.total ?? 0);
        }
      } catch (err) {
        if (!cancelled) {
          setUsers([]);
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load users.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, search, filterStatus, filterRole, archiveView, page, refreshKey]);
  useEffect(() => { setPage(1); }, [tab, search, filterStatus, filterRole, archiveView]);

  const filtered = users.filter((user) => {
    const matchRole = !filterRole || user.role === filterRole;
    return matchRole;
  });

  const pending = users.filter((user) => user.status === 'pending');

  async function handleDecision(
    user: UserRow,
    decision: 'approve' | 'reject'
  ) {
    const action = decision === 'approve' ? 'approve' : 'reject';
    const confirmation =
      decision === 'approve'
        ? `Approve the account of ${user.name}?`
        : `Reject and deactivate the account of ${user.name}?`;

    if (!window.confirm(confirmation)) return;

    setActionId(user.id);
    setError('');

    try {
      await apiRequest<{ message?: string }>(
        `/api/admin/users/${encodeURIComponent(user.id)}/${action}`,
        { method: 'PATCH' }
      );

      showToast(
        decision === 'approve'
          ? `${user.name}'s account was approved.`
          : `${user.name}'s account was rejected.`
      );

      if (selected?.id === user.id) {
        setSelected(null);
      }

      setRefreshKey((value) => value + 1);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'The action failed.';

      setError(message);
      showToast(message);
    } finally {
      setActionId(null);
    }
  }

  // One contextual control; the request names the explicit operation (never a blind toggle).
  async function handleArchiveChange() {
    if (!archiveTarget || actionId !== null) return;
    const operation = archiveTarget.archivedAt ? 'restore' : 'archive';
    if (archiveReason.trim().length < 5) { setArchiveError('Enter a reason with at least five characters.'); return; }
    setActionId(archiveTarget.id);
    setArchiveError('');
    try {
      const result = await apiRequest<{ message?: string }>(
        `/api/admin/record-archives/users/${encodeURIComponent(archiveTarget.id)}/${operation}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: archiveReason.trim() }) }
      );
      showToast(result.message || (operation === 'archive' ? 'Account archived.' : 'Account restored.'));
      if (selected?.id === archiveTarget.id) setSelected(null);
      setArchiveTarget(null);
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'The action failed.');
    } finally {
      setActionId(null);
      // Refresh after success and after conflicts (e.g. archived in another tab) so the label matches the server.
      setRefreshKey((value) => value + 1);
    }
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
        title={tab === 'All Users' ? 'User Management' : tab}
        subtitle="Manage user accounts and registration requests"
        action={
          <Button onClick={() => setShowAdd(true)}>
            <UserPlus size={16} />
            Invite Admin / Staff
          </Button>
        }
      />



      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              <RefreshCw size={14} />
              Retry
            </Button>
          </div>
        </div>
      )}

      {tab === 'All Users' && (
        <Card>
          <div className="p-5 border-b border-slate-50">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, email, or ID..."
            >
              <Select
                value={filterRole}
                onChange={(event) => setFilterRole(event.target.value)}
              >
                <option value="">All Roles</option>
                {[
                  ['admin', 'Administrator'],
                  ['parking_staff', 'Parking Staff'],
                  ['student', 'Student'],
                  ['faculty', 'Faculty'],
                  ['employee', 'Employee'],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>

              <Select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
              >
                <option value="">All Status</option>
                {[
                  'active',
                  'pending',
                  'suspended',
                  'deactivated',
                ].map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </Select>

              <Select
                aria-label="Show records"
                value={archiveView}
                onChange={(event) => setArchiveView(event.target.value as 'active' | 'archived')}
              >
                <option value="active">Active Records</option>
                <option value="archived">Archived Records</option>
              </Select>
            </SearchBar>
          </div>

          <div className="p-5">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Loading users from the database...
              </p>
            ) : (
              <Table
                columns={[
                  {
                    key: 'name',
                    label: 'Name',
                    render: (user: UserRow) => (
                      <div>
                        <p className="font-medium text-slate-700">
                          {user.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {user.idNum}
                        </p>
                      </div>
                    ),
                  },
                  { key: 'email', label: 'Email' },
                  {
                    key: 'role',
                    label: 'Role',
                    render: (user: UserRow) => (
                      <span className="capitalize">
                        {user.role === 'parking_staff'
                          ? 'Parking Staff'
                          : user.role === 'admin'
                            ? 'Administrator'
                            : user.role}
                      </span>
                    ),
                  },
                  { key: 'dept', label: 'Department' },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (user: UserRow) => (
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={statusBadge(user.status)}>
                          {user.status}
                        </Badge>
                        {user.archivedAt && <Badge variant="default">archived</Badge>}
                      </div>
                    ),
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    render: (user: UserRow) => (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelected(user)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant={user.archivedAt ? 'outline' : 'danger'}
                          disabled={actionId !== null}
                          onClick={() => { setArchiveTarget(user); setArchiveReason(''); setArchiveError(''); }}
                        >
                          {actionId === user.id ? 'Processing...' : user.archivedAt ? 'Restore' : 'Archive'}
                        </Button>
                      </div>
                    ),
                  },
                ]}
                data={filtered}
              />
            )}

            {!loading && !error && filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">
                No users found.
              </p>
            )}
          </div>
        </Card>
      )}

      {tab === 'Pending Approval' && (
        <Card>
          <div className="p-5">
            <p className="text-sm text-slate-500 mb-5">
              {pending.length} pending registration request(s) on this page
            </p>

            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Loading pending registrations...
              </p>
            ) : pending.length === 0 ? (
              !error && (
                <p className="text-center text-slate-400 py-10">
                  No pending requests.
                </p>
              )
            ) : (
              <div className="space-y-4">
                {pending.map((user) => (
                  <div
                    key={user.id}
                    className="border border-amber-200 bg-amber-50 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-700">
                        {user.name}
                      </p>
                      <p className="text-sm text-slate-500 break-words">
                        {user.email} — {user.idNum}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 capitalize">
                        {user.role} · {user.dept}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Registered: {formatDate(user.registered)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        disabled={actionId !== null}
                        onClick={() => handleDecision(user, 'approve')}
                      >
                        <Check size={14} />
                        {actionId === user.id ? 'Processing...' : 'Approve'}
                      </Button>

                      <Button
                        size="sm"
                        variant="danger"
                        disabled={actionId !== null}
                        onClick={() => handleDecision(user, 'reject')}
                      >
                        <X size={14} />
                        Reject
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(user)}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === 'Roles & Permissions' && (
        <Card className="p-6">
          <p className="text-sm text-slate-500 mb-6">
            Role access reference. PASS enforces these permissions on the server.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Permission
                  </th>
                  {[
                    'Admin',
                    'Parking Staff',
                    'Employee',
                    'Faculty',
                    'Student',
                  ].map((role) => (
                    <th
                      key={role}
                      className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase whitespace-nowrap"
                    >
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {[
                  { perm: 'Manage Users', vals: [true, false, false, false, false] },
                  { perm: 'Manage Own Vehicles', vals: [false, false, true, true, true] },
                  { perm: 'Review Vehicle Authorizations / Licenses', vals: [true, true, false, false, false] },
                  { perm: 'Record Gate Entry / Exit', vals: [false, true, false, false, false] },
                  { perm: 'Manage RFID Assignments', vals: [true, false, false, false, false] },
                  { perm: 'View Visitor Requests / Passes', vals: [true, true, false, false, false] },
                  { perm: 'Approve / Reject Visitor Requests', vals: [true, false, false, false, false] },
                  { perm: 'View Administrative Reports', vals: [true, false, false, false, false] },
                  { perm: 'System Settings', vals: [true, false, false, false, false] },
                  { perm: 'View Parking Info', vals: [true, true, true, true, true] },
                ].map((row) => (
                  <tr
                    key={row.perm}
                    className="border-b border-slate-50 hover:bg-blue-50/30"
                  >
                    <td className="py-3 px-4 font-medium text-slate-600">
                      {row.perm}
                    </td>
                    {row.vals.map((allowed, index) => (
                      <td key={index} className="py-3 px-3 text-center">
                        {allowed ? (
                          <Check
                            size={16}
                            className="text-green-500 mx-auto"
                          />
                        ) : (
                          <span className="text-slate-300">
                            Not allowed
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {['All Users', 'Pending Approval'].includes(tab) && <div className="my-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{total} records · Page {page} of {lastPage}</span><div className="flex gap-2"><Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage(v => v - 1)}>Previous</Button><Button variant="outline" disabled={loading || page >= lastPage} onClick={() => setPage(v => v + 1)}>Next</Button></div></div>}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="User Details"
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 rounded-2xl bg-[#2563EB] text-white text-2xl font-bold flex items-center justify-center">
                {selected.name.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-lg">
                  {selected.name}
                </p>
                <p className="text-slate-500 text-sm break-all">
                  {selected.email}
                </p>
                <Badge variant={statusBadge(selected.status)}>
                  {selected.status}
                </Badge>
              </div>
            </div>

            {[
              ['ID Number', selected.idNum],
              ['Role', selected.role],
              ['User Type', selected.userType],
              ['Department', selected.dept],
              ...(selected.registrationCategory === 'shs' ? [['Grade / Year Level', selected.yearLevel ? `GRADE ${selected.yearLevel}` : '—'], ['Section', selected.section || '—']] : []),
              ['Contact', selected.contact],
              ['Registered', formatDate(selected.registered)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 text-sm border-b border-slate-50 pb-2"
              >
                <span className="text-slate-400">{label}</span>
                <span className="font-medium text-slate-700 capitalize text-right break-all">
                  {value || '—'}
                </span>
              </div>
            ))}

            {['admin', 'parking_staff'].includes(selected.role) && <PrivilegedInvitationStatus userId={selected.id} />}
            {selected.registrationCategory && <p className="text-sm text-slate-600">Registration category: <strong>{selected.registrationCategory === 'college' ? 'College Student' : selected.registrationCategory === 'shs' ? 'SHS Student' : 'Employee'}</strong></p>}
            {selected.schoolIdCheck && <section className="rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-2 text-sm">
              <h3 className="font-semibold text-[#080677]">ID document check · {ID_CHECK_LABELS[selected.schoolIdCheck.status] || selected.schoolIdCheck.status}</h3>
              {Object.entries(selected.schoolIdCheck.checks ?? {}).map(([key, result]) => <p key={key}><strong className="capitalize">{result.result}:</strong> {result.detail}</p>)}
              {selected.schoolIdCheck.reasons?.map(reason => <p key={reason} className="text-amber-800">{reason}</p>)}
              <p className="text-xs text-slate-600">{selected.schoolIdCheck.note}</p>
            </section>}
            {selected.schoolIdSubmitted && <Button variant="outline" disabled={idLoading} onClick={viewSchoolId}>{idLoading ? 'Loading ID…' : 'View institutional ID'}</Button>}
            {idError && <p role="alert" className="text-sm text-red-700">{idError}</p>}
            {idPreview && (idPreview.pdf ? <iframe src={idPreview.url} title="Institutional ID" className="w-full h-96 rounded-xl" /> : <img src={idPreview.url} alt="Uploaded institutional ID" className="max-h-[32rem] max-w-full mx-auto rounded-xl" />)}
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={!!archiveTarget}
        onClose={() => { if (actionId === null) setArchiveTarget(null); }}
        title={`${archiveTarget?.archivedAt ? 'Restore' : 'Archive'} ${archiveTarget?.name || 'account'}`}
        size="sm"
      >
        {archiveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {archiveTarget.archivedAt
                ? 'Restore this same account record. A suspended, rejected or pending account keeps that status; a previously active campus account returns as pending and needs approval. Revoked RFID and QR credentials stay revoked.'
                : 'Archive this account. The user can no longer sign in, active RFID and QR credentials are revoked, and pending visitor requests are cancelled. Vehicles, documents and parking history are kept.'}
            </p>
            <label className="block text-sm font-medium text-slate-700" htmlFor="archive-reason">Reason</label>
            <textarea
              id="archive-reason"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              rows={3}
              maxLength={500}
              value={archiveReason}
              disabled={actionId !== null}
              onChange={(event) => setArchiveReason(event.target.value)}
            />
            {archiveError && <p role="alert" className="text-sm text-red-700">{archiveError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={actionId !== null} onClick={() => setArchiveTarget(null)}>Cancel</Button>
              <Button
                variant={archiveTarget.archivedAt ? 'primary' : 'danger'}
                disabled={actionId !== null || archiveReason.trim().length < 5}
                onClick={() => void handleArchiveChange()}
              >
                {actionId !== null ? 'Processing...' : archiveTarget.archivedAt ? 'Restore account' : 'Archive account'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <PrivilegedAccountInviteModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={message => { showToast(message); setRefreshKey(value => value + 1); }} />
    </div>
  );
}
