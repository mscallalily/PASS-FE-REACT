
import React, { useEffect, useState } from 'react';
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
  Input,
  Tabs,
  Toast,
} from '../../components/ui';
import { UserPlus, Check, X, RefreshCw } from 'lucide-react';

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

  if (['parking_admin', 'parking_staff', 'security', 'parking'].includes(value)) {
    return 'parking_staff';
  }

  if (value === 'administrator') {
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
  };
}

function formatDate(value: string) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error('Your session has expired. Please log in again.');
  }

  const response = await fetch(url, {
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
  const [tab, setTab] = useState('All Users');
  const { pathname } = useLocation();

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newUser, setNewUser] = useState({
  full_name: '',
  user_code: '',
  email: '',
  password: '',
  password_confirmation: '',
  department_id: '',
  contact_number: '',
});

const [savingUser, setSavingUser] = useState(false);
const [addUserError, setAddUserError] = useState('');


  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    if (pathname.endsWith('/requests')) {
      setTab('Pending Approval');
    } else if (pathname.endsWith('/roles')) {
      setTab('Roles & Permissions');
    } else {
      setTab('All Users');
    }
  }, [pathname]);

  useEffect(() => {
    if (tab === 'Roles & Permissions') return;

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();

        if (tab === 'Pending Approval') {
          params.set('status', 'pending');
        } else if (filterStatus) {
          params.set('status', filterStatus);
        }

        if (search.trim()) {
          params.set('search', search.trim());
        }

        const query = params.toString();
        const endpoint = `/api/admin/users${query ? `?${query}` : ''}`;

        const result = await apiRequest<ApiListResponse>(endpoint);
        const rows = (result.users?.data || []).map(mapUser);

        if (!cancelled) {
          setUsers(rows);
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
  }, [tab, search, filterStatus, refreshKey]);

  const filtered = users.filter((user) => {
    const matchRole = !filterRole || user.role === filterRole;
    return matchRole;
  });

  const pending = users.filter((user) => user.status === 'pending');

async function handleAddUser() {
  setAddUserError('');

  if (
    !newUser.full_name.trim() ||
    !newUser.user_code.trim() ||
    !newUser.email.trim() ||
    !newUser.password ||
    !newUser.password_confirmation ||
    !newUser.department_id
  ) {
    setAddUserError('Please complete all required fields.');
    return;
  }

  if (newUser.password !== newUser.password_confirmation) {
    setAddUserError('Passwords do not match.');
    return;
  }

  setSavingUser(true);

  try {
    const result = await apiRequest<{ message: string; user: ApiUser }>(
      '/api/admin/users',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newUser,
          department_id: 9,
        }),
      }
    );

    showToast(result.message || 'Parking Staff account created.');
    setShowAdd(false);
    setNewUser({
      full_name: '',
      user_code: '',
      email: '',
      password: '',
      password_confirmation: '',
      department_id: '',
      contact_number: '',
    });
    setRefreshKey((value) => value + 1);
  } catch (err) {
    setAddUserError(
      err instanceof Error ? err.message : 'Unable to create account.'
    );
  } finally {
    setSavingUser(false);
  }
}


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
        title="User Management"
        subtitle="Manage user accounts and registration requests"
        action={
          <Button onClick={() => setShowAdd(true)}>
            <UserPlus size={16} />
            Add User
          </Button>
        }
      />

      <Tabs
        tabs={['All Users', 'Pending Approval', 'Roles & Permissions']}
        active={tab}
        onChange={setTab}
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
                      <Badge variant={statusBadge(user.status)}>
                        {user.status}
                      </Badge>
                    ),
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    render: (user: UserRow) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(user)}
                      >
                        View
                      </Button>
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
            Manage system roles and their access permissions.
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
                  { perm: 'Verify Vehicle Access', vals: [false, true, false, false, false] },
                  { perm: 'Manage RFID Assignments', vals: [true, false, false, false, false] },
                  { perm: 'Manage Visitor Access', vals: [false, true, false, false, false] },
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

            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add New User"
        size="md"
      >
        <div className="space-y-4">
  <p className="text-sm text-slate-500">
    Create a new Parking Staff account.
  </p>

  {addUserError && (
    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
      {addUserError}
    </p>
  )}

  <Input
    label="Full Name"
    placeholder="Juan dela Cruz"
    value={newUser.full_name}
    onChange={(e) =>
      setNewUser({ ...newUser, full_name: e.target.value })
    }
  />

  <Input
    label="Staff ID"
    placeholder="e.g. PST-0001"
    value={newUser.user_code}
    onChange={(e) =>
      setNewUser({ ...newUser, user_code: e.target.value })
    }
  />

  <Input
    label="Email"
    type="email"
    placeholder="staff@university.edu"
    value={newUser.email}
    onChange={(e) =>
      setNewUser({ ...newUser, email: e.target.value })
    }
  />

  <Input
    label="Password"
    type="password"
    value={newUser.password}
    onChange={(e) =>
      setNewUser({ ...newUser, password: e.target.value })
    }
  />

  <Input
    label="Confirm Password"
    type="password"
    value={newUser.password_confirmation}
    onChange={(e) =>
      setNewUser({ ...newUser, password_confirmation: e.target.value })
    }
  />

  <div>
  <label className="mb-1 block text-sm font-medium text-slate-700">
    Department
  </label>
  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
    Security Office
  </div>
</div>

  <Input
    label="Contact Number (optional)"
    placeholder="09XXXXXXXXX"
    value={newUser.contact_number}
    onChange={(e) =>
      setNewUser({ ...newUser, contact_number: e.target.value })
    }
  />

  <div className="flex gap-3 pt-2">
    <Button
      variant="outline"
      onClick={() => setShowAdd(false)}
      disabled={savingUser}
    >
      Cancel
    </Button>

    <Button onClick={handleAddUser} disabled={savingUser}>
      {savingUser ? 'Creating...' : 'Create Account'}
    </Button>
  </div>
</div>
      </Modal>
    </div>
  );
}
