import React, { useEffect, useState } from 'react';import { PageHeader, Card, Button, Select, Tabs, Toast, StatCard } from '../../components/ui';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { FileBarChart, Download, Printer, Calendar } from 'lucide-react';

export default function Reports() {
  const [reportType, setReportType] = useState('Daily Parking Activity');
  const [toast, setToast] = useState('');
  const [accessEvents, setAccessEvents] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [reportError, setReportError] = useState('');

useEffect(() => {
  const token =
    localStorage.getItem('pass_auth_token') ||
    sessionStorage.getItem('pass_auth_token');

  fetch('/api/access-events?limit=500', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`Failed to load reports (${response.status})`);
      }
      return response.json();
    })
    .then(result => {
      setAccessEvents(result.data ?? []);
    })
    .catch(error => {
      setReportError(error.message);
    })
    .finally(() => setLoading(false));
}, []);


useEffect(() => {
  const token =
    localStorage.getItem('pass_auth_token') ||
    sessionStorage.getItem('pass_auth_token');

  fetch('/api/vehicles/authorizations', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load vehicles (${response.status})`);
      }
      return response.json();
    })
    .then(result => {
      setVehicles(Array.isArray(result.data) ? result.data : []);
    })
    .catch(error => {
      console.error('Vehicle report error:', error);
    });
}, []);

       
     const totalEntries = accessEvents.filter(
  e => e.direction === 'in' && e.auth_result === 'granted'
).length;

const totalExits = accessEvents.filter(
  e => e.direction === 'out' && e.auth_result === 'granted'
).length;

const deniedAccess = accessEvents.filter(
  e => e.auth_result === 'denied'
).length;

const rfidScans = accessEvents.filter(
  e => e.access_method === 'rfid'
).length;


const WEEKLY_DATA = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
  const today = new Date();
  const monday = new Date(today);
  const dayOfWeek = (today.getDay() + 6) % 7;

  monday.setDate(today.getDate() - dayOfWeek);

  const targetDate = new Date(monday);
  const dayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day);
  targetDate.setDate(monday.getDate() + dayIndex);

  const dateString = [
    targetDate.getFullYear(),
    String(targetDate.getMonth() + 1).padStart(2, '0'),
    String(targetDate.getDate()).padStart(2, '0'),
  ].join('-');

  const dayEvents = accessEvents.filter(event =>
    event.event_datetime?.slice(0, 10) === dateString
  );

  return {
    day,
    entries: dayEvents.filter(
      event => event.direction === 'in' && event.auth_result === 'granted'
    ).length,
    exits: dayEvents.filter(
      event => event.direction === 'out' && event.auth_result === 'granted'
    ).length,
  };
});


const HOURLY_DATA = Array.from({ length: 24 }, (_, hour) => {
  const hourEvents = accessEvents.filter(event => {
    const dateTime = event.event_datetime || '';
    const match = dateTime.match(/[T ](\d{2}):/);

    return match && Number(match[1]) === hour;
  });

  return {
    time: `${String(hour).padStart(2, '0')}:00`,
    entries: hourEvents.filter(
      event =>
        event.direction === 'in' &&
        event.auth_result === 'granted'
    ).length,
    exits: hourEvents.filter(
      event =>
        event.direction === 'out' &&
        event.auth_result === 'granted'
    ).length,
  };
});


const VEHICLE_DIST = [
  { name: 'Sedan', color: '#2563EB' },
  { name: 'SUV', color: '#38BDF8' },
  { name: 'Hatchback', color: '#10B981' },
  { name: 'Motorcycle', color: '#F59E0B' },
  { name: 'Van', color: '#8B5CF6' },
].map(type => ({
  ...type,
  value: new Set(
    vehicles
      .filter(
        vehicle =>
          String(vehicle.vehicle_type || '').toLowerCase() ===
          type.name.toLowerCase()
      )
      .map(vehicle => vehicle.vehicle_id)
  ).size,
}));


const showToast = (msg: string) => {
  setToast(msg);
  setTimeout(() => setToast(''), 3000);
};

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

      {loading && <p className="text-sm text-slate-500 mb-4">Loading access records...</p>}
      {reportError && <p className="text-sm text-red-600 mb-4">{reportError}</p>}
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Entries" value={totalEntries} icon={<Calendar size={18} />} color="blue" />
<StatCard label="Total Exits" value={totalExits} icon={<Calendar size={18} />} color="sky" />
<StatCard label="RFID Scans" value={rfidScans} icon={<Calendar size={18} />} color="green" />
<StatCard label="Denied Access" value={deniedAccess} icon={<Calendar size={18} />} color="amber" />
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
          <LineChart data={HOURLY_DATA}>
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
