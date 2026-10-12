import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, Card, Badge, statusBadge, Button, Table, SearchBar, Select, Modal, Input, Tabs, Toast } from '../../components/ui';
import { MOCK_USERS } from '../../data/mock';
import { UserPlus, Check, X } from 'lucide-react';

export default function UserManagement() {
  const [tab, setTab] = useState('All Users');
  const { pathname } = useLocation();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState('');

  const filtered = MOCK_USERS.filter(u => {
    const q = search.toLowerCase();
    const matchQ = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.idNum.toLowerCase().includes(q);
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = !filterStatus || u.status === filterStatus;
    return matchQ && matchRole && matchStatus;
  });

  const pending = MOCK_USERS.filter(u => u.status === 'pending');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    if (pathname.endsWith('/requests')) setTab('Pending Approval');
    else if (pathname.endsWith('/roles')) setTab('Roles & Permissions');
    else setTab('All Users');
  }, [pathname]);

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast} type="success" onClose={() => setToast('')} />}
      <PageHeader title="User Management" subtitle="Manage user accounts and registration requests"
        action={<Button onClick={() => setShowAdd(true)}><UserPlus size={16} /> Add User</Button>}
      />

      <Tabs tabs={['All Users', 'Pending Approval', 'Roles & Permissions']} active={tab} onChange={setTab} />

      {tab === 'All Users' && (
        <Card>
          <div className="p-5 border-b border-slate-50">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by name, email, or ID...">
              <Select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <option value="">All Roles</option>
                {['student', 'faculty', 'employee', 'parking_staff'].map(r => <option key={r} value={r} className="capitalize">{r === 'parking_staff' ? 'Parking Staff' : r}</option>)}
              </Select>
              <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                {['active', 'pending', 'suspended'].map(s => <option key={s}>{s}</option>)}
              </Select>
            </SearchBar>
          </div>
          <Table
            columns={[
              { key: 'name', label: 'Name', render: u => <div><p className="font-medium text-slate-700">{u.name}</p><p className="text-xs text-slate-400">{u.idNum}</p></div> },
              { key: 'email', label: 'Email' },
              { key: 'role', label: 'Role', render: u => <span className="capitalize">{u.role === 'parking_staff' ? 'Parking Staff' : u.role}</span> },
              { key: 'dept', label: 'Department' },
              { key: 'status', label: 'Status', render: u => <Badge variant={statusBadge(u.status)}>{u.status}</Badge> },
              { key: 'actions', label: 'Actions', render: u => (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(u)}>View</Button>
                </div>
              )},
            ]}
            data={filtered}
          />
        </Card>
      )}

      {tab === 'Pending Approval' && (
        <Card>
          <div className="p-5">
            <p className="text-sm text-slate-500 mb-5">{pending.length} registration request(s) awaiting review</p>
            {pending.length === 0 ? (
              <p className="text-center text-slate-400 py-10">No pending requests.</p>
            ) : (
              <div className="space-y-4">
                {pending.map(u => (
                  <div key={u.id} className="border border-amber-200 bg-amber-50 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-700">{u.name}</p>
                      <p className="text-sm text-slate-500">{u.email} — {u.idNum}</p>
                      <p className="text-xs text-slate-400 mt-1 capitalize">{u.role} · {u.dept}</p>
                      <p className="text-xs text-slate-400">Registered: {u.registered}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { showToast(`Demo only: ${u.name} was not actually approved. Backend integration is required.`); }} variant="success"><Check size={14} /> Approve</Button>
                      <Button size="sm" variant="danger" onClick={() => showToast(`Demo only: ${u.name} was not actually rejected. Backend integration is required.`)}><X size={14} /> Reject</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelected(u)}>Details</Button>
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
          <p className="text-sm text-slate-500 mb-6">Manage system roles and their access permissions.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Permission</th>
                  {['Admin', 'Parking Staff', 'Employee', 'Faculty', 'Student'].map(r => (
                    <th key={r} className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase whitespace-nowrap">{r}</th>
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
                ].map(row => (
                  <tr key={row.perm} className="border-b border-slate-50 hover:bg-blue-50/30">
                    <td className="py-3 px-4 font-medium text-slate-600">{row.perm}</td>
                    {row.vals.map((v, i) => (
                      <td key={i} className="py-3 px-3 text-center">
                        {v ? <Check size={16} className="text-green-500 mx-auto" /> : <span className="text-slate-300">Not allowed</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* User Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="User Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 rounded-2xl bg-[#2563EB] text-white text-2xl font-bold flex items-center justify-center">
                {selected.name[0]}
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">{selected.name}</p>
                <p className="text-slate-500 text-sm">{selected.email}</p>
                <Badge variant={statusBadge(selected.status)} >{selected.status}</Badge>
              </div>
            </div>
            {[['ID Number', selected.idNum], ['Role', selected.role], ['Department', selected.dept], ['Contact', selected.contact], ['Registered', selected.registered]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-700 capitalize">{v}</span>
              </div>
            ))}
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          </div>
        )}
      </Modal>

      {/* Add User Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New User" size="md">
        <div className="space-y-4">
          <Input label="Full Name" placeholder="Juan dela Cruz" />
          <Input label="Institutional ID" placeholder="2024-00001" />
          <Input label="Email" type="email" placeholder="juan@university.edu" />
          <Select label="User Role">
            {['student', 'faculty', 'employee', 'parking_staff'].map(r => <option key={r} className="capitalize" value={r}>{r === 'parking_staff' ? 'Parking Staff' : r}</option>)}
          </Select>
          <Select label="Department">
            {['College of Engineering', 'College of Science', 'College of Business', 'Security Office', 'Parking Office'].map(d => <option key={d}>{d}</option>)}
          </Select>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => { showToast('Demo only: user was not created in the database. Backend integration is required.'); setShowAdd(false); }}>Add User</Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
