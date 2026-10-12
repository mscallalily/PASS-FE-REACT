import React, { useState } from 'react';
import { PageHeader, Card, Button, Select, Tabs, Toast, StatCard } from '../../components/ui';
import { OCCUPANCY_DATA, ZONE_CAPACITY } from '../../data/mock';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { FileBarChart, Download, Printer, Calendar } from 'lucide-react';

const VEHICLE_DIST = [
  { name: 'Sedan', value: 142, color: '#2563EB' },
  { name: 'SUV', value: 78, color: '#38BDF8' },
  { name: 'Hatchback', value: 55, color: '#10B981' },
  { name: 'Motorcycle', value: 33, color: '#F59E0B' },
  { name: 'Van', value: 12, color: '#8B5CF6' },
];

const WEEKLY_DATA = [
  { day: 'Mon', entries: 138, exits: 135 },
  { day: 'Tue', entries: 145, exits: 142 },
  { day: 'Wed', entries: 132, exits: 130 },
  { day: 'Thu', entries: 151, exits: 149 },
  { day: 'Fri', entries: 165, exits: 160 },
  { day: 'Sat', entries: 89, exits: 88 },
  { day: 'Sun', entries: 42, exits: 40 },
];

export default function Reports() {
  const [reportType, setReportType] = useState('Daily Parking Activity');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast} type="success" onClose={() => setToast('')} />}
      <PageHeader title="Reports & Analytics" subtitle="Generate and export parking system reports"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => showToast('Printing report...')}><Printer size={16} /> Print</Button>
            <Button onClick={() => showToast('Report exported as CSV')}><Download size={16} /> Export CSV</Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <Select label="Report Type" value={reportType} onChange={e => setReportType(e.target.value)}>
            {['Daily Parking Activity', 'Weekly Parking Activity', 'Monthly Parking Activity', 'Vehicle Registration Reports', 'User Registration Reports', 'RFID Entry/Exit Reports', 'Parking Occupancy Reports', 'Visitor Access Reports', 'Parking Violations Reports'].map(r => <option key={r}>{r}</option>)}
          </Select>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Date From</label>
            <input type="date" defaultValue="2024-09-01" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Date To</label>
            <input type="date" defaultValue="2024-09-30" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
          <Select label="Parking Zone">
            <option>All Zones</option>
            {['Zone A', 'Zone B', 'Zone C', 'Zone D'].map(z => <option key={z}>{z}</option>)}
          </Select>
          <Button onClick={() => showToast('Report generated')}><FileBarChart size={16} /> Generate Report</Button>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Entries" value="1,862" icon={<Calendar size={18} />} color="blue" sub="This month" />
        <StatCard label="Total Exits" value="1,844" icon={<Calendar size={18} />} color="sky" sub="This month" />
        <StatCard label="Avg Duration" value="6.2h" icon={<Calendar size={18} />} color="green" sub="Per session" />
        <StatCard label="Occupancy Rate" value="67%" icon={<Calendar size={18} />} color="amber" sub="Monthly avg" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-5">Weekly Entry & Exit Activity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={WEEKLY_DATA}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none' }} />
              <Legend />
              <Bar dataKey="entries" name="Entries" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="exits" name="Exits" fill="#38BDF8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-5">Vehicle Type Distribution</h3>
          <div className="flex items-center gap-6">
            <PieChart width={160} height={160}>
              <Pie data={VEHICLE_DIST} cx={80} cy={80} innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
                {VEHICLE_DIST.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
            <div className="space-y-2 flex-1">
              {VEHICLE_DIST.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-500 flex-1">{d.name}</span>
                  <span className="font-semibold text-slate-700">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-700 mb-5">Hourly Activity Pattern</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={OCCUPANCY_DATA}>
            <XAxis dataKey="time" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none' }} />
            <Line type="monotone" dataKey="entries" name="Entries" stroke="#2563EB" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="exits" name="Exits" stroke="#38BDF8" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
