import React, { useState } from 'react';
import { PageHeader, Card, Badge, statusBadge, Modal, EmptyState } from '../../components/ui';
import { MOCK_TRANSACTIONS } from '../../data/mock';
import { Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ParkingHistory() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<any>(null);
  const personalTransactions = MOCK_TRANSACTIONS.filter(transaction => transaction.driver === user?.name);

  return (
    <div className="animate-fadein max-w-3xl">
      <PageHeader title="My Parking History" subtitle="View your vehicle's parking transaction records" />
      <Card>
        <div className="p-5 border-b border-slate-50">
          <div className="flex gap-3 flex-wrap">
            <input type="search" placeholder="Search transactions..." className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white min-w-[200px]" />
            <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
        </div>
        {personalTransactions.length === 0 ? (
          <EmptyState title="No parking history yet" description="Your RFID entry and exit records will appear here." />
        ) : <div className="divide-y divide-slate-50">
          {personalTransactions.map(txn => (
            <div key={txn.id} onClick={() => setSelected(txn)} className="flex items-center gap-4 px-5 py-4 hover:bg-blue-50/40 cursor-pointer transition-colors">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock size={18} className="text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[#080677]">{txn.plate}</span>
                  <Badge variant={statusBadge(txn.status)}>{txn.status}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{txn.entry} → {txn.exit || 'Ongoing'} · {txn.entryGate}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-[#2563EB]">{txn.duration}</p>
                <p className="text-xs text-slate-400">{txn.method}</p>
              </div>
            </div>
          ))}
        </div>}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Transaction Details" size="sm">
        {selected && (
          <div className="space-y-3">
            {[
              ['Transaction ID', selected.id],
              ['Plate Number', selected.plate],
              ['Driver', selected.driver],
              ['Entry Time', selected.entry],
              ['Exit Time', selected.exit || '—'],
              ['Duration', selected.duration],
              ['Entry Gate', selected.entryGate],
              ['Exit Gate', selected.exitGate || '—'],
              ['Access Method', selected.method],
              ['Status', selected.status],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-700 capitalize">{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
