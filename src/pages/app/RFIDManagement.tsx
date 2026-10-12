import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Badge, statusBadge, Button, Table, SearchBar, Modal, Tabs, StatCard, Toast, Input, Select } from '../../components/ui';
import { MOCK_RFID, MOCK_RFID_EVENTS, MOCK_VEHICLES } from '../../data/mock';
import { CreditCard, XCircle, Activity, Plus } from 'lucide-react';

function EntryExitMonitor() {
  const [events] = useState(MOCK_RFID_EVENTS);
  const [search, setSearch] = useState('');

  const filtered = events.filter(e => {
    const q = search.toLowerCase();
    return e.plate.toLowerCase().includes(q) || e.driver.toLowerCase().includes(q) || e.rfidId.toLowerCase().includes(q);
  });

  const todayEntries = events.filter(e => e.type === 'entry').length;
  const todayExits = events.filter(e => e.type === 'exit').length;
  const denied = events.filter(e => e.result === 'denied').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Today's Entries" value={todayEntries} icon={<Activity size={18} />} color="green" />
        <StatCard label="Today's Exits" value={todayExits} icon={<Activity size={18} />} color="blue" />
        <StatCard label="Denied" value={denied} icon={<XCircle size={18} />} color="red" />
      </div>
      <Card>
        <div className="px-5 pt-5">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by plate, driver, or RFID..." />
        </div>
        <Table
          columns={[
            { key: 'timestamp', label: 'Timestamp', render: e => <span className="font-mono text-xs">{e.timestamp}</span> },
            { key: 'rfidId', label: 'RFID', render: e => <span className="font-mono text-xs">{e.rfidId}</span> },
            { key: 'plate', label: 'Plate', render: e => <span className="font-mono font-bold text-[#080677]">{e.plate}</span> },
            { key: 'driver', label: 'Driver' },
            { key: 'gate', label: 'Gate' },
            { key: 'type', label: 'Type', render: e => <Badge variant={e.type === 'entry' ? 'success' : 'info'}>{e.type}</Badge> },
            { key: 'result', label: 'Result', render: e => <Badge variant={e.result === 'granted' ? 'success' : 'danger'}>{e.result}</Badge> },
          ]}
          data={filtered}
        />
      </Card>
    </div>
  );
}

export default function RFIDManagement() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [tab, setTab] = useState(user?.role === 'parking_staff' ? 'Access Records' : 'RFID Assignments');
  const [toast, setToast] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [requests, setRequests] = useState(() => MOCK_VEHICLES.filter(v => !v.rfid && v.status === 'pending').map(v => ({ id: `DEMO-REQ-${v.id}`, user: v.owner, vehicle: v.plate, submitted: 'Demo data', status: 'Pending Admin Processing' })));
  const updateRequest = (id: string, status: string) => setRequests(items => items.map(item => item.id === id ? { ...item, status } : item));

  useEffect(() => {
    setTab(pathname.endsWith('/monitor') ? 'Access Records' : (user?.role === 'admin' ? 'RFID Requests' : 'Access Records'));
  }, [pathname]);

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast} type="success" onClose={() => setToast('')} />}
      <PageHeader title="RFID Access" subtitle={user?.role === 'admin' ? 'Assign and revoke RFID credentials for authorized users' : 'Review regular-user RFID entry and exit results'}
        action={tab === 'RFID Assignments' ? <Button onClick={() => setShowAssign(true)}><Plus size={16} /> Register RFID</Button> : undefined}
      />

      <Tabs tabs={user?.role === 'admin' ? ['RFID Requests', 'RFID Assignments'] : ['Access Records']} active={tab} onChange={setTab} />

      {tab === 'RFID Requests' && user?.role === 'admin' && (
        <Card>
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm text-slate-600">Review requests separately from assigning an RFID identifier. Approving a request does not assign or activate a tag.</p>
            <p className="text-xs text-amber-700 mt-1">Prototype queue generated from sample pending vehicle records; connect this to the backend before operational use.</p>
          </div>
          <Table columns={[
            { key: 'id', label: 'Request' },
            { key: 'user', label: 'User' },
            { key: 'vehicle', label: 'Vehicle Plate' },
            { key: 'submitted', label: 'Submitted' },
            { key: 'status', label: 'Status', render: r => <Badge variant={r.status === 'Rejected' ? 'danger' : r.status === 'Approved for Assignment' ? 'success' : 'warning'}>{r.status}</Badge> },
            { key: 'actions', label: 'Actions', render: r => <div className="flex gap-2">
              {r.status === 'Pending Admin Processing' && <><Button size="sm" onClick={() => { updateRequest(r.id, 'Approved for Assignment'); setToast('Demo request approved for assignment. No RFID has been assigned.'); }}>Approve</Button><Button size="sm" variant="danger" onClick={() => { updateRequest(r.id, 'Rejected'); setToast('Demo request rejected. Backend is not connected.'); }}>Reject</Button></>}
            </div> },
          ]} data={requests} />
        </Card>
      )}

      {tab === 'RFID Assignments' && (
        <Card>
          <Table
            columns={[
              { key: 'id', label: 'RFID ID', render: r => <span className="font-mono font-bold text-[#080677]">{r.id}</span> },
              { key: 'user', label: 'Assigned User', render: r => r.user || <span className="text-slate-300 italic">Unassigned</span> },
              { key: 'vehicle', label: 'Vehicle', render: r => r.vehicle ? <span className="font-mono">{r.vehicle}</span> : '—' },
              { key: 'type', label: 'Type' },
              { key: 'assigned', label: 'Assigned Date', render: r => r.assigned || '—' },
              { key: 'expires', label: 'Expires', render: r => r.expires || '—' },
              { key: 'status', label: 'Status', render: r => <Badge variant={statusBadge(r.status)}>{r.status}</Badge> },
              { key: 'actions', label: 'Actions', render: r => (
                <div className="flex gap-2">
                  {r.status === 'active' && <Button size="sm" variant="danger" onClick={() => setToast(`Deactivated: ${r.id}`)}>Deactivate</Button>}
                  {!r.user && <Button size="sm" variant="ghost" onClick={() => setShowAssign(true)}>Assign</Button>}
                </div>
              )},
            ]}
            data={MOCK_RFID}
          />
        </Card>
      )}

      {tab === 'Access Records' && <EntryExitMonitor />}

      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Register / Assign RFID">
        <div className="space-y-4">
          <Input label="RFID Tag ID" placeholder="Enter the issued RFID ID" />
          <Select label="Assigned User">
            <option value="">Select User to Assign</option>
            <option>Maria Santos — 2021-00123</option>
            <option>Juan dela Cruz — 2019-00456</option>
            <option>Ana Reyes — EMP-0021</option>
          </Select>
          <Select label="Authorized Vehicle">
            <option value="">Select Vehicle</option>
            <option>ABC-1234 — Toyota Vios</option>
            <option>XYZ-5678 — Honda CR-V</option>
            <option>DEF-9012 — Mitsubishi Mirage</option>
          </Select>
          <Select label="Credential Type">
            <option>Card</option><option>Tag</option><option>Sticker</option>
          </Select>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => { setToast('Demo only: no RFID was assigned or saved. Backend integration is required.'); setShowAssign(false); }}>Register RFID</Button>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
