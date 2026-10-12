import React, { useState } from 'react';
import { PageHeader, Card, Badge, statusBadge, Button, Table, SearchBar, Modal, Tabs, Toast, StatCard, Input, Select } from '../../components/ui';
import { MOCK_VIOLATIONS } from '../../data/mock';
import { AlertTriangle, Plus, Upload, Check } from 'lucide-react';

export default function Violations() {
  const [tab, setTab] = useState('Violations');
  const [selected, setSelected] = useState<any>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast} type="success" onClose={() => setToast('')} />}
      <PageHeader title="Parking Violations" subtitle="Manage parking incidents and violation records"
        action={<Button onClick={() => setShowRecord(true)}><Plus size={16} /> Record Violation</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Violations" value="12" icon={<AlertTriangle size={18} />} color="red" />
        <StatCard label="Open" value="3" icon={<AlertTriangle size={18} />} color="red" />
        <StatCard label="Under Review" value="2" icon={<AlertTriangle size={18} />} color="amber" />
        <StatCard label="Resolved" value="7" icon={<Check size={18} />} color="green" />
      </div>

      <Card>
        <div className="p-5 border-b border-slate-50">
          <SearchBar value="" onChange={() => {}} placeholder="Search by plate, driver, or violation type..." />
        </div>
        <Table
          columns={[
            { key: 'id', label: 'ID', render: v => <span className="font-mono text-xs">{v.id}</span> },
            { key: 'plate', label: 'Plate', render: v => <span className="font-mono font-bold text-[#080677]">{v.plate}</span> },
            { key: 'driver', label: 'Driver' },
            { key: 'type', label: 'Violation Type', render: v => <span className="text-red-700 font-medium text-xs">{v.type}</span> },
            { key: 'location', label: 'Location' },
            { key: 'datetime', label: 'Date & Time', render: v => <span className="text-xs font-mono">{v.datetime}</span> },
            { key: 'reportedBy', label: 'Reported By' },
            { key: 'status', label: 'Status', render: v => <Badge variant={statusBadge(v.status)}>{v.status.replace('-', ' ')}</Badge> },
            { key: 'actions', label: 'Actions', render: v => (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelected(v)}>View</Button>
                {v.status === 'open' && <Button size="sm" variant="success" onClick={() => showToast(`Resolved: ${v.id}`)}>Resolve</Button>}
              </div>
            )},
          ]}
          data={MOCK_VIOLATIONS}
          onRowClick={setSelected}
        />
      </Card>

      {/* Violation Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Violation Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700">{selected.type}</p>
                <p className="text-xs text-red-500 mt-0.5">{selected.notes}</p>
              </div>
            </div>
            {[['Violation ID', selected.id], ['Plate Number', selected.plate], ['Driver', selected.driver], ['Location', selected.location], ['Date & Time', selected.datetime], ['Reported By', selected.reportedBy], ['Status', selected.status.replace('-', ' ')]].map(([k, v]) => (
              <div key={k} className="flex gap-4 text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-400 w-28 shrink-0">{k}</span>
                <span className="font-medium text-slate-700 capitalize">{v}</span>
              </div>
            ))}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Update Status</p>
              <Select><option>Open</option><option>Under Review</option><option>Resolved</option><option>Dismissed</option></Select>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Add Notes</p>
              <textarea rows={3} placeholder="Add investigation notes..." className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => { showToast('Violation updated'); setSelected(null); }}>Save Changes</Button>
              <Button variant="success" onClick={() => { showToast(`Resolved: ${selected.id}`); setSelected(null); }}>Mark Resolved</Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Violation Modal */}
      <Modal open={showRecord} onClose={() => setShowRecord(false)} title="Record Violation" size="md">
        <div className="space-y-4">
          <Input label="Vehicle Plate Number" placeholder="ABC-1234" />
          <Select label="Violation Type">
            {['Unauthorized Parking', 'Parking in Reserved Slot', 'Overstaying', 'Invalid Vehicle Authorization', 'Tailgating / Improper Gate Access', 'Blocking Access Lane', 'Other'].map(t => <option key={t}>{t}</option>)}
          </Select>
          <Input label="Location" placeholder="Zone A — Slot A-03" />
          <Input label="Reported By" placeholder="Officer name" />
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Notes</label>
            <textarea rows={3} placeholder="Describe the violation..." className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
            <Upload size={20} className="text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-slate-400">Attach evidence photo (optional)</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => { showToast('Violation recorded'); setShowRecord(false); }}>Record Violation</Button>
            <Button variant="outline" onClick={() => setShowRecord(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
