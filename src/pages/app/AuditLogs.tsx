import React, { useState } from 'react';
import { PageHeader, Card, Badge, statusBadge, Button, Table, SearchBar, Modal, Toast } from '../../components/ui';
import { MOCK_AUDIT_LOGS } from '../../data/mock';
import { Download } from 'lucide-react';

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [toast, setToast] = useState('');

  const filtered = MOCK_AUDIT_LOGS.filter(l => {
    const q = search.toLowerCase();
    return l.user.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || l.module.toLowerCase().includes(q);
  });

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast} type="success" onClose={() => setToast('')} />}
      <PageHeader title="Audit Log & Activity Monitor" subtitle="Track all system activities and user actions"
        action={<Button variant="outline" onClick={() => { setToast('Audit log exported'); }}><Download size={16} /> Export Log</Button>}
      />
      <Card>
        <div className="p-5 border-b border-slate-50">
          <div className="flex gap-3 flex-wrap">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by user, action, or module..." />
            <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
            <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
        </div>
        <Table
          columns={[
            { key: 'id', label: 'Log ID', render: l => <span className="font-mono text-xs">{l.id}</span> },
            { key: 'user', label: 'User', render: l => <div><p className="font-medium">{l.user}</p><p className="text-xs text-slate-400">{l.role}</p></div> },
            { key: 'action', label: 'Action', render: l => <span className="font-semibold text-[#080677]">{l.action}</span> },
            { key: 'module', label: 'Module' },
            { key: 'timestamp', label: 'Timestamp', render: l => <span className="font-mono text-xs">{l.timestamp}</span> },
            { key: 'status', label: 'Status', render: l => <Badge variant={l.status === 'success' ? 'success' : l.status === 'warning' ? 'warning' : 'danger'}>{l.status}</Badge> },
            { key: 'actions', label: '', render: l => <Button size="sm" variant="ghost" onClick={() => setSelected(l)}>Details</Button> },
          ]}
          data={filtered}
          onRowClick={setSelected}
        />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Activity Details">
        {selected && (
          <div className="space-y-3">
            {[['Log ID', selected.id], ['User', selected.user], ['Role', selected.role], ['Action', selected.action], ['Module', selected.module], ['Description', selected.description], ['IP Address', selected.ip], ['Timestamp', selected.timestamp], ['Status', selected.status]].map(([k, v]) => (
              <div key={k} className="flex gap-4 text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-400 w-28 shrink-0">{k}</span>
                <span className="font-medium text-slate-700 break-all">{v}</span>
              </div>
            ))}
            <Button variant="outline" onClick={() => setSelected(null)} className="mt-4">Close</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
