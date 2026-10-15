import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { REGULAR_USER_ROLES, useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Badge, statusBadge, Button, Table, SearchBar, Select, Modal, Input, Tabs, Toast } from '../../components/ui';
import { Car, Plus, AlertTriangle } from 'lucide-react';
import DriverLicenseVerification from '../../components/DriverLicenseVerification';
import LicenseReviewQueue from '../../components/LicenseReviewQueue';
import { useLicense } from '../../context/LicenseContext';

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

function getToken(): string | null {
  return (
    localStorage.getItem('pass_auth_token') ||
    sessionStorage.getItem('pass_auth_token')
  );
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
  const licenseOnFile = license.status === 'pending' || license.status === 'verified';
  const isRegularUser = REGULAR_USER_ROLES.includes(user?.role ?? null);
  const [tab, setTab] = useState(isRegularUser ? 'My Vehicles' : 'Authorization');
  const [rfidRequests, setRfidRequests] = useState<{ plate: string; status: string; submitted: string }[]>([]);
  const [requestVehicle, setRequestVehicle] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [toast, setToast] = useState('');
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehicleError, setVehicleError] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

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
      {toast && <Toast message={toast} type="success" onClose={() => setToast('')} />}
      <PageHeader
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
          <p className="flex-1 min-w-[200px] text-sm text-amber-800">Submit your driver’s license before registering a vehicle.</p>
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
              {roleScopedVehicles.map(v => <option key={v.id} value={v.plate}>{v.plate} — {v.make} {v.model}</option>)}
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

      {(tab === 'Authorization' || tab === 'Authorization Status') && (
        <Card>
          <Table
            columns={[
              { key: 'plate', label: 'Plate No.', render: v => <span className="font-mono font-bold text-[#080677]">{v.plate}</span> },
              { key: 'owner', label: 'Owner' },
              { key: 'type', label: 'Type' },
              { key: 'status', label: 'Auth Status', render: v => (
                <Badge variant={v.status === 'active' ? 'success' : v.status === 'pending' ? 'warning' : 'danger'}>
                  {v.status === 'active' ? 'Authorized' : v.status === 'pending' ? 'Pending Review' : v.status}
                </Badge>
              )},
              { key: 'validity', label: 'Valid Until', render: () => '2025-08-31' },
              ...(!isRegularUser ? [{ key: 'actions', label: 'Actions', render: (v: any) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => showToast(`Authorization updated for ${v.plate}`)}>Update</Button>
                  <Button size="sm" variant="danger" onClick={() => showToast(`Suspended: ${v.plate}`)}>Suspend</Button>
                </div>
              )}] : []),
            ]}
            data={roleScopedVehicles}
          />
        </Card>
      )}

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
              <p>A driver’s license is required before you can register a vehicle. Submit it first; you can register the vehicle while it is waiting for review.</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => { setShowRegister(false); setTab('Driver & License'); }}>Go to Driver & License</Button>
              <Button variant="outline" onClick={() => setShowRegister(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {license.status === 'pending' && (
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
