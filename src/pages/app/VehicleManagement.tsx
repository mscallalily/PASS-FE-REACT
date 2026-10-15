import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { REGULAR_USER_ROLES, useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Badge, statusBadge, Button, Table, SearchBar, Select, Modal, Input, Tabs, Toast, EmptyState } from '../../components/ui';
import { MOCK_VEHICLES } from '../../data/mock';
import { Car, Plus, AlertTriangle, RefreshCw } from 'lucide-react';
import DriverLicenseVerification from '../../components/DriverLicenseVerification';
import LicenseReviewQueue from '../../components/LicenseReviewQueue';
import { useLicense, licenseOnFile as isLicenseOnFile } from '../../context/LicenseContext';
import { ApiError } from '../../lib/apiClient';

type AuthorizationStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired' | 'suspended';

// Fields shared by the staff list and the owner's own vehicle list.
interface VehicleRecord {
  authorization_id: number | null;
  sticker_number: string | null;
  authorization_status: AuthorizationStatus | null;
  valid_from: string | null;
  valid_until: string | null;
  requested_at: string | null;
  reviewed_at: string | null;
  remarks: string | null;
  vehicle_id: number;
  plate_number: string;
  make: string | null;
  model: string | null;
  color: string | null;
  year_model: number | null;
  vehicle_type: string | null;
  parking_area: string | null;
}

interface VehicleAuthorizationRow extends VehicleRecord {
  authorization_id: number;
  authorization_status: AuthorizationStatus;
  owner_code: string | null;
  owner_kind: 'user' | 'visitor';
  owner_name: string | null;
}

type AuthAction = { kind: 'suspend' | 'lift'; row: VehicleAuthorizationRow };

const AUTH_STATUS_LABEL: Record<AuthorizationStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  revoked: 'Revoked',
  expired: 'Expired',
  suspended: 'Suspended',
};

const AUTH_STATUS_VARIANT: Record<AuthorizationStatus, 'success' | 'warning' | 'danger' | 'default' | 'purple'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  revoked: 'danger',
  expired: 'default',
  suspended: 'purple',
};

function AuthStatusBadge({ status }: { status: AuthorizationStatus | null }) {
  if (!status) return <Badge variant="default">Not Requested</Badge>;

  return (
    <Badge variant={AUTH_STATUS_VARIANT[status] ?? 'default'}>
      {AUTH_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function vehicleDescription(r: VehicleRecord) {
  return [r.year_model, r.make, r.model].filter(Boolean).join(' ') || 'â€”';
}

function getToken(): string | null {
  return (
    localStorage.getItem('pass_auth_token') ||
    sessionStorage.getItem('pass_auth_token')
  );
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error('Your session has expired. Please log in again.');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.message || `Request failed with status ${response.status}.`, response.status);
  }

  return data as T;
}

function formatDate(value: string | null) {
  if (!value) return 'â€”';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface VehicleRow {
  id: string;
  plate: string;
  owner: string;
  make: string;
  model: string;
  year: number | string | null;
  type: string;
  color: string;
  rfid: string | null;
  status: string;
  registrationStatus?: string;
  authorizationStatus?: string | null;
  validity?: string | null;
}

interface VehiclesApiResponse {
  vehicles?: VehicleRow[];
  message?: string;
}
async function fetchVehicles(): Promise<VehicleRow[]> {
  const token = getToken();

  if (!token) {
    throw new Error('Session expired. Please log in again.');
  }

  const response = await fetch('/api/admin/vehicles', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data: VehiclesApiResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }

  return data.vehicles ?? [];
}

export default function VehicleManagement() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const license = useLicense();
  const licenseOnFile = isLicenseOnFile(license.status);
  const isRegularUser = REGULAR_USER_ROLES.includes(user?.role ?? null);
  const [tab, setTab] = useState(isRegularUser ? 'My Vehicles' : 'Authorization');
  const [rfidRequests, setRfidRequests] = useState<{ plate: string; status: string; submitted: string }[]>([]);
  const [requestVehicle, setRequestVehicle] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [authRows, setAuthRows] = useState<VehicleAuthorizationRow[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSearch, setAuthSearch] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [authReloadKey, setAuthReloadKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<AuthAction | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const [myRows, setMyRows] = useState<VehicleRecord[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState('');
  const [myReloadKey, setMyReloadKey] = useState(0);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), type === 'error' ? 5000 : 3000);
  };

  // Staff "Authorization" tab: all authorizations, filtered server-side.
  useEffect(() => {
    if (isRegularUser || tab !== 'Authorization') return;

    let cancelled = false;

    const loadAuthorizations = async () => {
      setAuthLoading(true);
      setAuthError('');

      try {
        const params = new URLSearchParams();
        if (authStatus) params.set('status', authStatus);
        if (authSearch.trim()) params.set('search', authSearch.trim());
        const query = params.toString();

        const data = await apiRequest<{ data: VehicleAuthorizationRow[] }>(
          `/api/vehicles/authorizations${query ? `?${query}` : ''}`
        );

        if (!cancelled) setAuthRows(data.data ?? []);
      } catch (err) {
        if (!cancelled) setAuthError(err instanceof Error ? err.message : 'Unable to load vehicle authorizations.');
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };

    // Debounce so typing in the search box does not fire a request per keystroke.
    const timer = setTimeout(loadAuthorizations, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isRegularUser, tab, authSearch, authStatus, authReloadKey]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehicleError, setVehicleError] = useState('');

  // Regular user "Authorization Status" tab: only the signed-in user's vehicles.
  useEffect(() => {
    if (!isRegularUser || tab !== 'Authorization Status') return;

    let cancelled = false;

    const loadMyVehicles = async () => {
      setMyLoading(true);
      setMyError('');

      try {
        const data = await apiRequest<{ data: VehicleRecord[] }>('/api/vehicles/my-authorizations');
        if (!cancelled) setMyRows(data.data ?? []);
      } catch (err) {
        if (!cancelled) setMyError(err instanceof Error ? err.message : 'Unable to load your vehicle authorizations.');
      } finally {
        if (!cancelled) setMyLoading(false);
      }
    };

    loadMyVehicles();

    // Pick up changes made by staff when the user returns to this window.
    const onFocus = () => setMyReloadKey(k => k + 1);
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [isRegularUser, tab, myReloadKey]);

  const openAction = (action: AuthAction) => {
    setPendingAction(action);
    setActionReason('');
    setActionError('');
  };

  const closeAction = () => {
    if (actionBusy) return;
    setPendingAction(null);
  };

  const confirmAction = async () => {
    if (!pendingAction) return;

    const { kind, row } = pendingAction;
    const endpoint = kind === 'suspend' ? 'suspend' : 'lift-suspension';

    setActionBusy(true);
    setActionError('');

    try {
      const result = await apiRequest<{ message: string; data: VehicleAuthorizationRow | null }>(
        `/api/vehicles/authorizations/${row.authorization_id}/${endpoint}`,
        {
          method: 'PATCH',
          body: JSON.stringify(kind === 'suspend' ? { reason: actionReason.trim() || null } : {}),
        }
      );

      // Show the new status right away, then refetch so filters stay accurate.
      if (result.data) {
        const updated = result.data;
        setAuthRows(rows => rows.map(r => (r.authorization_id === updated.authorization_id ? updated : r)));
      }
      setAuthReloadKey(k => k + 1);

      setPendingAction(null);
      showToast(`${result.message} (${row.plate_number})`);
    } catch (err) {
      // The row on screen is out of date: the record was removed/replaced (404)
      // or its status changed elsewhere (409). Reload so the table matches MySQL.
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
        setPendingAction(null);
        setAuthReloadKey(k => k + 1);
        showToast(
          err.status === 404
            ? `The authorization shown for ${row.plate_number} no longer exists. The list has been refreshed; please try again.`
            : `${err.message} The list has been refreshed to show the current status.`,
          'error'
        );
        return;
      }

      // Keep the dialog open so the reason (e.g. expired validity) stays visible.
      setActionError(err instanceof Error ? err.message : 'The request could not be completed.');
    } finally {
      setActionBusy(false);
    }
  };

  useEffect(() => {
    if (!isRegularUser) setTab('Authorization');
    else if (pathname.endsWith('/drivers')) setTab('Driver & License');
    else if (pathname.endsWith('/rfid')) setTab('RFID Requests');
    else setTab('My Vehicles');
  }, [isRegularUser, pathname]);

  useEffect(() => {
  let cancelled = false;

  async function loadVehicles() {
    setLoadingVehicles(true);
    setVehicleError('');

    try {
      const data = await fetchVehicles();

      if (!cancelled) {
        setVehicles(data);
      }
    } catch (error) {
      if (!cancelled) {
        setVehicleError(
          error instanceof Error
            ? error.message
            : 'Failed to load vehicles.'
        );
      }
    } finally {
      if (!cancelled) {
        setLoadingVehicles(false);
      }
    }
  }

  loadVehicles();

  return () => {
    cancelled = true;
  };
}, []);

  const roleScopedVehicles = vehicles;
  const filtered = roleScopedVehicles.filter(v => {
    const q = search.toLowerCase();
    const matchQ = v.plate.toLowerCase().includes(q) || v.owner.toLowerCase().includes(q) || v.make.toLowerCase().includes(q);
    const matchType = !filterType || v.type === filterType;
    const matchStatus = !filterStatus || v.status === filterStatus;
    return matchQ && matchType && matchStatus;
  });

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader backToDashboard
        title={isRegularUser ? 'My Vehicle' : 'Vehicle Authorization'}
        subtitle={isRegularUser ? 'Manage your vehicle, driver information, and authorization status' : 'Review campus vehicle records and authorization status'}
        action={isRegularUser ? <Button onClick={() => setShowRegister(true)}><Plus size={16} /> Register Vehicle</Button> : undefined}
      />

      <Tabs
        tabs={isRegularUser ? ['My Vehicles', 'Driver & License', 'Authorization Status', 'RFID Requests'] : ['Authorization', 'License Verification']}
        active={tab}
        onChange={setTab}
      />

      {tab === 'My Vehicles' && isRegularUser && !licenseOnFile && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <p className="flex-1 min-w-[200px] text-sm text-amber-800">Submit your driverâ€™s license before registering a vehicle.</p>
          <Button size="sm" onClick={() => setTab('Driver & License')}>Submit License</Button>
        </div>
      )}

      {tab === 'My Vehicles' && (
        <Card>
          <div className="p-5 border-b border-slate-50">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by plate, owner, or make...">
              <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                {['Sedan', 'SUV', 'Hatchback', 'Motorcycle', 'Van'].map(t => <option key={t}>{t}</option>)}
              </Select>
              <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                {['active', 'pending', 'suspended', 'rejected'].map(s => <option key={s}>{s}</option>)}
              </Select>
            </SearchBar>
          </div>
          {loadingVehicles && (
  <p className="px-5 py-3 text-sm text-slate-500">
    Loading vehicles...
  </p>
)}

{vehicleError && (
  <p className="px-5 py-3 text-sm text-red-600">
    {vehicleError}
  </p>
)}
          <Table
            columns={[
              { key: 'plate', label: 'Plate No.', render: v => <span className="font-mono font-bold text-[#080677]">{v.plate}</span> },
              { key: 'vehicle', label: 'Vehicle', render: v => `${v.year} ${v.make} ${v.model}` },
              { key: 'type', label: 'Type' },
              { key: 'color', label: 'Color' },
              { key: 'rfid', label: 'RFID', render: v => v.rfid ? <span className="text-xs font-mono text-slate-500">{v.rfid}</span> : <span className="text-xs text-slate-300">Unassigned</span> },
              { key: 'status', label: 'Status', render: v => <Badge variant={statusBadge(v.status)}>{v.status}</Badge> },
              { key: 'actions', label: 'Actions', render: v => <Button size="sm" variant="ghost" onClick={() => setSelected(v)}>View</Button> },
            ]}
            data={filtered}
            onRowClick={setSelected}
          />
        </Card>
      )}

      {tab === 'RFID Requests' && isRegularUser && (
        <Card className="p-5 sm:p-6">
          <div className="max-w-2xl space-y-4">
            <div>
              <h3 className="font-semibold text-[#080677]">Request RFID Assignment</h3>
              <p className="text-sm text-slate-500 mt-1">Vehicle registration and RFID assignment are separate processes. An RFID is not assigned until authorized staff records it.</p>
            </div>
            <Select label="Registered vehicle" value={requestVehicle} onChange={e => setRequestVehicle(e.target.value)}>
              <option value="">Select a vehicle</option>
              {roleScopedVehicles.map(v => <option key={v.id} value={v.plate}>{v.plate} â€” {v.make} {v.model}</option>)}
            </Select>
            <Button disabled={!requestVehicle || rfidRequests.some(r => r.plate === requestVehicle)} onClick={() => {
              setRfidRequests(prev => [...prev, { plate: requestVehicle, status: 'Pending Admin Processing', submitted: new Date().toLocaleDateString() }]);
              showToast('Demo request added locally. Backend submission is not connected.');
            }}>Submit RFID Request</Button>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Prototype only: requests are stored in this page's temporary state and will not persist after refresh.</div>
            <div className="overflow-x-auto">
              <Table columns={[
                { key: 'plate', label: 'Vehicle Plate' },
                { key: 'submitted', label: 'Submitted' },
                { key: 'status', label: 'Processing Status', render: r => <Badge variant="warning">{r.status}</Badge> },
              ]} data={rfidRequests} />
            </div>
          </div>
        </Card>
      )}

      {tab === 'Driver & License' && isRegularUser && (
        <Card className="p-5 sm:p-6">
          <DriverLicenseVerification variant="web" owner={user?.name ?? 'User'} />
        </Card>
      )}

      {tab === 'License Verification' && !isRegularUser && <LicenseReviewQueue onToast={showToast} />}

      {tab === 'Authorization' && !isRegularUser && (
        <Card>
          <div className="p-5 border-b border-slate-50">
            <SearchBar value={authSearch} onChange={setAuthSearch} placeholder="Search by plate, sticker, owner, or ID...">
              <Select value={authStatus} onChange={e => setAuthStatus(e.target.value)}>
                <option value="">All Status</option>
                {(Object.keys(AUTH_STATUS_LABEL) as AuthorizationStatus[]).map(s => (
                  <option key={s} value={s}>{AUTH_STATUS_LABEL[s]}</option>
                ))}
              </Select>
            </SearchBar>
          </div>
          {authError && (
            <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">Unable to load vehicle authorizations: {authError}</p>
            </div>
          )}
          {authLoading && authRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Loading vehicle authorizations...</p>
          ) : (
            <Table
              columns={[
                { key: 'plate_number', label: 'Plate No.', render: (r: VehicleAuthorizationRow) => <span className="font-mono font-bold text-[#080677]">{r.plate_number}</span> },
                { key: 'vehicle', label: 'Vehicle', render: (r: VehicleAuthorizationRow) => (
                  <div>
                    <p className="text-slate-700">{vehicleDescription(r)}</p>
                    {r.color && <p className="text-xs text-slate-400">{r.color}</p>}
                  </div>
                )},
                { key: 'vehicle_type', label: 'Type', render: (r: VehicleAuthorizationRow) => r.vehicle_type || 'â€”' },
                { key: 'owner', label: 'Owner', render: (r: VehicleAuthorizationRow) => (
                  <div>
                    <p className="text-slate-700">{r.owner_name || 'â€”'}</p>
                    <p className="text-xs text-slate-400">{r.owner_kind === 'visitor' ? 'Visitor' : r.owner_code || 'User'}</p>
                  </div>
                )},
                { key: 'parking_area', label: 'Parking Area', render: (r: VehicleAuthorizationRow) => r.parking_area || 'All areas' },
                { key: 'sticker_number', label: 'Sticker No.', render: (r: VehicleAuthorizationRow) => r.sticker_number
                  ? <span className="text-xs font-mono text-slate-500">{r.sticker_number}</span>
                  : <span className="text-xs text-slate-300">None</span> },
                { key: 'authorization_status', label: 'Auth Status', render: (r: VehicleAuthorizationRow) => (
                  <AuthStatusBadge status={r.authorization_status} />
                )},
                { key: 'validity', label: 'Validity', render: (r: VehicleAuthorizationRow) => (
                  r.valid_from || r.valid_until
                    ? <span className="whitespace-nowrap">{formatDate(r.valid_from)} â€“ {formatDate(r.valid_until)}</span>
                    : 'â€”'
                )},
                { key: 'actions', label: 'Actions', render: (r: VehicleAuthorizationRow) => {
                  if (r.authorization_status === 'approved') {
                    return (
                      <Button size="sm" variant="danger" onClick={() => openAction({ kind: 'suspend', row: r })}>Suspend</Button>
                    );
                  }

                  if (r.authorization_status === 'suspended') {
                    return (
                      <Button size="sm" variant="outline" onClick={() => openAction({ kind: 'lift', row: r })}>Lift Suspension</Button>
                    );
                  }

                  return <span className="text-xs text-slate-300">â€”</span>;
                }},
              ]}
              data={authRows}
            />
          )}
        </Card>
      )}

      {tab === 'Authorization Status' && isRegularUser && (
        <Card>
          <div className="p-5 border-b border-slate-50 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-slate-500">Authorization status of the vehicles registered under your account.</p>
            <Button size="sm" variant="outline" disabled={myLoading} onClick={() => setMyReloadKey(k => k + 1)}>
              <RefreshCw size={14} className={myLoading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>
          {myError && (
            <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">Unable to load your vehicle authorizations: {myError}</p>
            </div>
          )}
          {myLoading && myRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Loading your vehicle authorizations...</p>
          ) : !myError && myRows.length === 0 ? (
            <EmptyState
              title="No registered vehicles"
              description="You have no vehicles registered under your account yet. Once you register a vehicle, its authorization status will appear here."
            />
          ) : (
            <Table
              columns={[
                { key: 'plate_number', label: 'Plate No.', render: (r: VehicleRecord) => <span className="font-mono font-bold text-[#080677]">{r.plate_number}</span> },
                { key: 'vehicle', label: 'Vehicle', render: (r: VehicleRecord) => (
                  <div>
                    <p className="text-slate-700">{vehicleDescription(r)}</p>
                    {r.color && <p className="text-xs text-slate-400">{r.color}</p>}
                  </div>
                )},
                { key: 'vehicle_type', label: 'Type', render: (r: VehicleRecord) => r.vehicle_type || 'â€”' },
                { key: 'authorization_status', label: 'Auth Status', render: (r: VehicleRecord) => <AuthStatusBadge status={r.authorization_status} /> },
                { key: 'parking_area', label: 'Parking Area', render: (r: VehicleRecord) => r.authorization_id ? (r.parking_area || 'All areas') : 'â€”' },
                { key: 'sticker_number', label: 'Sticker No.', render: (r: VehicleRecord) => r.sticker_number
                  ? <span className="text-xs font-mono text-slate-500">{r.sticker_number}</span>
                  : <span className="text-xs text-slate-300">None</span> },
                { key: 'validity', label: 'Validity', render: (r: VehicleRecord) => (
                  r.valid_from || r.valid_until
                    ? <span className="whitespace-nowrap">{formatDate(r.valid_from)} â€“ {formatDate(r.valid_until)}</span>
                    : 'â€”'
                )},
                { key: 'requested_at', label: 'Requested', render: (r: VehicleRecord) => formatDate(r.requested_at) },
                { key: 'remarks', label: 'Remarks', render: (r: VehicleRecord) => r.remarks
                  ? <span className="block max-w-xs truncate text-slate-500" title={r.remarks}>{r.remarks}</span>
                  : <span className="text-xs text-slate-300">â€”</span> },
              ]}
              data={myRows}
            />
          )}
        </Card>
      )}

      {/* Suspend / Lift Suspension confirmation */}
      <Modal
        open={!!pendingAction}
        onClose={closeAction}
        title={pendingAction?.kind === 'lift' ? 'Lift Suspension' : 'Suspend Vehicle Authorization'}
        size="sm"
      >
        {pendingAction && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {pendingAction.kind === 'suspend' ? (
                <>Suspend the authorization for <span className="font-mono font-bold text-[#080677]">{pendingAction.row.plate_number}</span>? The vehicle will be treated as unauthorized until the suspension is lifted.</>
              ) : (
                <>Lift the suspension for <span className="font-mono font-bold text-[#080677]">{pendingAction.row.plate_number}</span>? The authorization will return to Approved if the vehicle still meets all approval and access requirements.</>
              )}
            </p>
            {pendingAction.kind === 'suspend' && (
              <Input
                label="Reason (optional)"
                placeholder="e.g. Parking violation under review"
                maxLength={255}
                value={actionReason}
                onChange={e => setActionReason(e.target.value)}
                disabled={actionBusy}
              />
            )}
            {actionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{actionError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={closeAction} disabled={actionBusy}>Cancel</Button>
              <Button
                variant={pendingAction.kind === 'suspend' ? 'danger' : 'primary'}
                onClick={confirmAction}
                disabled={actionBusy}
              >
                {actionBusy
                  ? 'Saving...'
                  : pendingAction.kind === 'suspend' ? 'Suspend' : 'Lift Suspension'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Vehicle Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Vehicle Details">
        {selected && (
          <div className="space-y-4">
            <div className="bg-[#F4F7FB] rounded-xl p-5 flex items-center gap-4">
              <div className="w-16 h-16 bg-[#2563EB]/10 rounded-2xl flex items-center justify-center">
                <Car size={32} className="text-[#2563EB]" />
              </div>
              <div>
                <p className="font-mono font-bold text-2xl text-[#080677]">{selected.plate}</p>
                <p className="text-slate-500">{selected.year} {selected.make} {selected.model}</p>
                <Badge variant={statusBadge(selected.status)}>{selected.status}</Badge>
              </div>
            </div>
            {[['Owner', selected.owner], ['Vehicle Type', selected.type], ['Color', selected.color], ['RFID Tag', selected.rfid || 'Not assigned'], ['Registration Status', selected.status]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-700">{v}</span>
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <Button onClick={() => { showToast('Demo only: changes were not saved to a database.'); setSelected(null); }}>Save</Button>
              <Button variant="danger" onClick={() => { showToast(`Suspended: ${selected.plate}`); setSelected(null); }}>Suspend</Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Register Vehicle Modal */}
      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Register Vehicle" size="md">
        {!licenseOnFile ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <p>A driverâ€™s license is required before you can register a vehicle. Submit it first; you can register the vehicle while it is waiting for review.</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => { setShowRegister(false); setTab('Driver & License'); }}>Go to Driver & License</Button>
              <Button variant="outline" onClick={() => setShowRegister(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {(license.status === 'pending_review' || license.status === 'processing') && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Your license is still pending review. The vehicle cannot be authorized until it is verified.</p>
            )}
            <Input label="Plate Number" placeholder="ABC-1234" />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Vehicle Type"><option>Sedan</option><option>SUV</option><option>Hatchback</option><option>Pickup</option><option>Motorcycle</option><option>Van</option></Select>
              <Input label="Year" placeholder="2024" type="number" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Make" placeholder="Toyota" />
              <Input label="Model" placeholder="Vios" />
            </div>
            <Input label="Color" placeholder="White" />
            <div className="flex gap-3 pt-2">
              <Button onClick={() => { showToast('Demo only: vehicle registration was not saved. Backend integration is required.'); setShowRegister(false); }}>Submit Registration</Button>
              <Button variant="outline" onClick={() => setShowRegister(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

