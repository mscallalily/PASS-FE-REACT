import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Badge, statusBadge, Button, Table, SearchBar, Select, Modal, StatCard, Tabs } from '../../components/ui';
import { MOCK_PARKING_SLOTS, MOCK_TRANSACTIONS, ZONE_CAPACITY, OCCUPANCY_DATA } from '../../data/mock';
import { ParkingSquare, Car, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const SLOT_COLORS: Record<string, string> = {
  available: 'bg-green-500',
  occupied: 'bg-red-500',
  reserved: 'bg-yellow-400',
  maintenance: 'bg-gray-400',
};

function ParkingLayout() {
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [zone, setZone] = useState('Zone A');

  const zoneSlots = MOCK_PARKING_SLOTS.filter(s => s.zone === zone);

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Select label="Select Zone" value={zone} onChange={e => setZone(e.target.value)}>
            {['Zone A', 'Zone B', 'Zone C'].map(z => <option key={z}>{z}</option>)}
          </Select>
          <div className="flex items-center gap-4 ml-auto flex-wrap text-xs font-medium">
            {Object.entries(SLOT_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${color}`} />
                <span className="capitalize text-slate-500">{status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#F4F7FB] rounded-2xl p-6">
          {/* Entry/Exit */}
          <div className="flex justify-between mb-4">
            <div className="bg-[#080677] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1"><ArrowUp size={12} /> Exit</div>
            <div className="bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1"><ArrowDown size={12} /> Entry</div>
          </div>
          {/* Parking grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {zoneSlots.map(slot => (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot)}
                className={`relative p-3 rounded-xl border-2 transition-all hover:scale-105 ${SLOT_COLORS[slot.status]} border-transparent hover:border-[#080677]`}
              >
                <p className="text-xs font-bold text-white">{slot.id}</p>
                {slot.vehicle && <p className="text-[9px] text-white/80 mt-0.5 truncate">{slot.vehicle}</p>}
                <p className="text-[9px] text-white/70 capitalize">{slot.type}</p>
              </button>
            ))}
          </div>
          {/* Walkway */}
          <div className="mt-4 h-2 bg-slate-200 rounded-full" />
          <p className="text-xs text-center text-slate-400 mt-2">← Walkway →</p>
        </div>

      </Card>

      <Modal open={!!selectedSlot} onClose={() => setSelectedSlot(null)} title={`Slot ${selectedSlot?.id}`} size="sm">
        {selectedSlot && (
          <div className="space-y-3">
            <div className={`w-full h-24 ${SLOT_COLORS[selectedSlot.status]} rounded-xl flex items-center justify-center`}>
              <p className="text-white font-bold text-2xl">{selectedSlot.id}</p>
            </div>
            {[['Zone', selectedSlot.zone], ['Type', selectedSlot.type], ['Status', selectedSlot.status], ['Assigned Vehicle', selectedSlot.vehicle || 'None'], ['Floor', selectedSlot.floor]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium capitalize">{v}</span>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setSelectedSlot(null)}>Close</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function OccupancyMonitor() {
  const total = MOCK_PARKING_SLOTS.length;
  const occupied = MOCK_PARKING_SLOTS.filter(s => s.status === 'occupied').length;
  const available = MOCK_PARKING_SLOTS.filter(s => s.status === 'available').length;
  const reserved = MOCK_PARKING_SLOTS.filter(s => s.status === 'reserved').length;
  const pct = Math.round((occupied / total) * 100);
  const PIE_DATA = [
    { name: 'Occupied', value: occupied, color: '#EF4444' },
    { name: 'Available', value: available, color: '#10B981' },
    { name: 'Reserved', value: reserved, color: '#F59E0B' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Capacity" value={total} icon={<ParkingSquare size={18} />} color="navy" />
        <StatCard label="Occupied" value={occupied} icon={<Car size={18} />} color="red" sub={`${pct}%`} />
        <StatCard label="Available" value={available} icon={<CheckCircle size={18} />} color="green" />
        <StatCard label="Reserved" value={reserved} icon={<ParkingSquare size={18} />} color="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 flex flex-col items-center">
          <h3 className="font-semibold text-slate-700 mb-5 self-start">Current Occupancy</h3>
          <PieChart width={220} height={220}>
            <Pie data={PIE_DATA} cx={110} cy={110} innerRadius={65} outerRadius={100} paddingAngle={2} dataKey="value">
              {PIE_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
          </PieChart>
          <div className="flex gap-6 mt-4">
            {PIE_DATA.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-slate-500">{d.name}: <strong className="text-slate-700">{d.value}</strong></span>
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <span className="text-4xl font-bold text-[#080677]">{pct}%</span>
            <p className="text-sm text-slate-400">Overall Occupancy</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-5">Occupancy by Zone</h3>
          {ZONE_CAPACITY.map((z, i) => {
            const p = Math.round((z.occupied / z.capacity) * 100);
            return (
              <div key={z.zone} className="mb-4">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-600">{z.zone}</span>
                  <span className="text-slate-500">{z.occupied}/{z.capacity}</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${p > 80 ? 'bg-red-500' : p > 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${p}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-700 mb-5">Peak Occupancy Today</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={OCCUPANCY_DATA}>
            <XAxis dataKey="time" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none' }} />
            <Bar dataKey="entries" name="Entries" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export default function ParkingOperations() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isRegularUser = ['student', 'faculty', 'employee'].includes(user?.role ?? '');
  const [tab, setTab] = useState(isRegularUser ? 'Availability' : 'Entry & Exit Records');
  const [transactionSearch, setTransactionSearch] = useState('');
  const filteredTransactions = MOCK_TRANSACTIONS.filter(transaction => {
    const query = transactionSearch.toLowerCase();
    return transaction.plate.toLowerCase().includes(query) || transaction.driver.toLowerCase().includes(query) || transaction.id.toLowerCase().includes(query);
  });

  useEffect(() => {
    if (pathname.endsWith('/layout')) setTab('Parking Layout');
    else if (pathname.endsWith('/occupancy')) setTab('Occupancy Monitor');
    else if (pathname.endsWith('/availability')) setTab('Availability');
    else setTab('Entry & Exit Records');
  }, [pathname]);

  return (
    <div className="animate-fadein">
      <PageHeader
        title={isRegularUser ? 'Parking Information' : 'Parking Operations'}
        subtitle={isRegularUser ? 'View current campus parking availability' : 'Review access records, occupancy, and the parking layout'}
      />
      <Tabs tabs={isRegularUser ? ['Availability'] : ['Entry & Exit Records', 'Occupancy Monitor', 'Parking Layout']} active={tab} onChange={setTab} />

      {tab === 'Entry & Exit Records' && (
        <Card>
          <div className="p-5">
            <SearchBar value={transactionSearch} onChange={setTransactionSearch} placeholder="Search by plate, driver, or record ID..." />
          </div>
          <Table
            columns={[
              { key: 'id', label: 'Txn ID', render: t => <span className="font-mono text-xs text-slate-500">{t.id}</span> },
              { key: 'plate', label: 'Plate', render: t => <span className="font-mono font-bold text-[#080677]">{t.plate}</span> },
              { key: 'driver', label: 'Driver' },
              { key: 'entry', label: 'Entry' },
              { key: 'exit', label: 'Exit', render: t => t.exit || '—' },
              { key: 'duration', label: 'Duration', render: t => <span className={t.status === 'ongoing' ? 'text-amber-600 font-semibold' : ''}>{t.duration}</span> },
              { key: 'method', label: 'Method' },
              { key: 'status', label: 'Status', render: t => <Badge variant={statusBadge(t.status)}>{t.status}</Badge> },
            ]}
            data={filteredTransactions}
          />
        </Card>
      )}

      {tab === 'Parking Layout' && <ParkingLayout />}

      {tab === 'Occupancy Monitor' && <OccupancyMonitor />}

      {tab === 'Availability' && (
        <div className="space-y-5">
          <div className="bg-gradient-to-r from-[#080677] to-[#2563EB] rounded-2xl p-8 text-white text-center">
            <p className="text-blue-200 font-medium mb-2">Available Parking Spaces Right Now</p>
            <p className="text-7xl font-bold text-[#38BDF8]">77</p>
            <p className="text-blue-200 mt-2">of 180 total slots</p>
            <p className="text-xs text-blue-300 mt-3">Last updated: just now</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ZONE_CAPACITY.map(z => {
              const free = z.capacity - z.occupied;
              const pct = (free / z.capacity) * 100;
              return (
                <Card key={z.zone} className="p-5 text-center">
                  <p className="font-bold text-[#080677] text-lg">{z.zone}</p>
                  <p className={`text-3xl font-bold mt-2 ${free < 5 ? 'text-red-500' : free < 15 ? 'text-amber-500' : 'text-green-500'}`}>{free}</p>
                  <p className="text-xs text-slate-400">available of {z.capacity}</p>
                  <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${free < 5 ? 'bg-red-500' : free < 15 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
