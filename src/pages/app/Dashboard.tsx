import PersonalDashboard from '../../components/PersonalDashboard';
import { jsonFetch } from '../../lib/http';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatCard, Card } from '../../components/ui';
import {
  Users, Car, CreditCard, ParkingSquare, UserCheck, AlertTriangle,
  TrendingUp, Activity, Shield, Bell, ArrowRight, CheckCircle, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCampusDate, formatCampusDateTime } from '../../lib/datetime';
import { apiRequest } from '../../lib/apiClient';
import { useLiveLoad, useLiveSync } from '../../lib/liveSync';


type DashboardSummary = {
  total_users: number;
  total_vehicles: number;
  total_rfid_tags: number;
  assigned_rfid_tags: number;
  available_rfid_tags: number;
  pending_approvals: number;
  pending_vehicle_authorizations: number;
};


type ParkingOccupancy = {
  zone_id: number;
  zone: string;
  capacity: number;
  occupied: number;
  available: number;
};

type DashboardData = {
  summary: DashboardSummary;
  today_activity: {
    entries: number;
    exits: number;
  };
  parking_occupancy: ParkingOccupancy[];
};


const COLORS = ['#2563EB', '#38BDF8', '#10B981', '#F59E0B'];


function AdminDashboard() {
  const [dashboardData, setDashboardData] =
    useState<DashboardData | null>(null);
    const [dashboardError, setDashboardError] = useState('');
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [recentLogsError, setRecentLogsError] = useState('');

  useEffect(() => {
    const token =
      localStorage.getItem('pass_auth_token') ||
      sessionStorage.getItem('pass_auth_token');

    if (!token) {
      setDashboardError('No login token found. Please log in again.');
      return;
    }
const loadDashboard = async () => {

  try {
    const response = await jsonFetch('/api/admin/dashboard', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? 'You are not authorized to view this dashboard.'
              : `Failed to load dashboard (${response.status}).`
          );
        }

        const data: DashboardData = await response.json();
        setDashboardData(data);
      } catch (error) {
        setDashboardError(
          error instanceof Error
            ? error.message
            : 'Unable to load dashboard data.'
        );
      }
    };

loadDashboard();

const loadRecentLogs = async () => {
  try {
    const response = await jsonFetch('/api/admin/audit-logs?page=1', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Audit logs request failed (${response.status})`);
    }

    const result = await response.json();
    setRecentLogs((result.data ?? []).slice(0, 5));
  } catch (error) {
    setRecentLogsError(error instanceof Error ? error.message : 'Unable to load recent administrative activity.');
  }
};

loadRecentLogs();
}, []);

const activeAlerts: { type: string; msg: string }[] = [];

if (dashboardData) {
  const pending = dashboardData.summary.pending_approvals;

  if (pending > 0) {
    activeAlerts.push({
      type: 'info',
      msg: `${pending} user registration requests pending approval`,
    });
  }

  const zones = dashboardData.parking_occupancy || [];

  zones.forEach(zone => {
    if (zone.capacity <= 0) return;

    const percentage = Math.round(
      (zone.occupied / zone.capacity) * 100
    );

    if (percentage >= 80) {
      activeAlerts.push({
        type: 'warning',
        msg: `${zone.zone} at ${percentage}% capacity (${zone.occupied}/${zone.capacity} slots occupied)`,
      });
    }
  });
}
  return (

    <div className="animate-fadein space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#080677]">Administrative Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">System overview — {formatCampusDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Summary Cards */}
      {dashboardError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {dashboardError}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={dashboardData ? String(dashboardData.summary.total_users) : '...'}
          icon={<Users size={20} />}
          color="blue"
          sub="Registered accounts"
        />

        <StatCard
          label="Vehicles"
          value={dashboardData ? String(dashboardData.summary.total_vehicles) : '...'}
          icon={<Car size={20} />}
          color="sky"
          sub="Registered vehicles"
        />

        <StatCard
          label="RFID Tags"
          value={dashboardData ? String(dashboardData.summary.total_rfid_tags) : '...'}
          icon={<CreditCard size={20} />}
          color="purple"
          sub={
            dashboardData
              ? `${dashboardData.summary.available_rfid_tags} available`
              : 'Loading RFID tags...'
          }
        />

        <StatCard
          label="Pending Approvals"
          value={dashboardData ? String(dashboardData.summary.pending_approvals) : '...'}
          icon={<Clock size={20} />}
          color="amber"
          sub="Needs action"
        />
      </div>


      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-1">
            Entry & Exit Activity
          </h3>
          <p className="text-xs text-slate-400 mb-5">
            Today's total entries and exits
          </p>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart
  data={[
    {
      time: "Today",
      entries: dashboardData?.today_activity.entries ?? 0,
      exits: dashboardData?.today_activity.exits ?? 0,
    },
  ]}
>
              <XAxis dataKey="time" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="entries" name="Entries" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="exits" name="Exits" fill="#38BDF8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-1">Parking Occupancy by Area</h3>
          <p className="text-xs text-slate-400 mb-4">Current capacity utilization</p>
          <div className="space-y-4">
            {(dashboardData?.parking_occupancy ?? []).map((z, i) => {
              const pct = Math.round((z.occupied / z.capacity) * 100);
              return (
                <div key={z.zone}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-600">{z.zone}</span>
                    <span className="font-semibold text-slate-700">{pct}% occupied</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i] }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{z.occupied} occupied</span>
                    <span>{z.capacity - z.occupied} free of {z.capacity}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent Events + Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-700">Recent Administrative Activity</h3>
            <Link to="/app/audit" className="text-xs text-[#2563EB] hover:underline flex items-center gap-1">View audit log <ArrowRight size={12} /></Link>
          </div>
          <div className="space-y-3">
            {recentLogsError && <p role="alert" className="text-sm text-red-700">{recentLogsError}</p>}
            {recentLogs.length === 0 ? <p className="text-sm text-slate-400">No administrative activity yet.</p> : recentLogs.map(event => (
              <div key={event.log_id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                <Activity size={18} className="text-blue-600 shrink-0 mt-1"/>
                <div className="min-w-0"><p className="text-sm font-medium text-slate-700 break-words">{event.action}</p><p className="text-xs text-slate-500">{event.actor_label || 'System'} · {formatCampusDateTime(event.created_at)}</p></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Quick Actions</h3>
          <div className="space-y-2.5">
            {[
              { label: 'Add User', to: '/app/users', icon: <Users size={16} /> },
              { label: 'Review Registrations', to: '/app/users/requests', icon: <Clock size={16} /> },
              { label: 'Review Vehicle Authorization', to: '/app/vehicles/authorization', icon: <Car size={16} /> },
              { label: 'Manage RFID Assignments', to: '/app/rfid', icon: <CreditCard size={16} /> },
              { label: 'Roles & Permissions', to: '/app/roles', icon: <Shield size={16} /> },
              { label: 'View Reports', to: '/app/reports', icon: <Activity size={16} /> },
            ].map(a => (
              <Link key={a.label} to={a.to}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#2563EB] transition-colors text-sm font-medium">
                {a.icon} {a.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Bell size={18} /> Active Alerts</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeAlerts.map((a, i) => (
            <div key={i} className={`flex gap-3 p-4 rounded-xl border ${
              a.type === 'warning' ? 'bg-amber-50 border-amber-200' :
              a.type === 'danger' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <AlertTriangle size={16} className={a.type === 'warning' ? 'text-amber-500' : a.type === 'danger' ? 'text-red-500' : 'text-blue-500'} />
              <p className="text-xs text-slate-600 leading-relaxed">{a.msg}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function UserDashboard() {
  return <PersonalDashboard />;
}

// ============================================
// PARKING STAFF DASHBOARD
// ============================================

interface AreaFigures { capacity: number; occupied: number; available: number; maintenance: number; occupancy_percent: number; awaiting_confirmation?: number }

interface ActivityRow {
  kind: 'access' | 'incident';
  id: string;
  at: string | null;
  direction?: 'in' | 'out';
  access_method?: 'rfid' | 'qr' | 'manual';
  result: string;
  reason: string | null;
  plate_number: string | null;
  category?: string | null;
  slot_code: string | null;
  staff_override?: boolean;
  source?: string | null;
}

interface ParkingDashboardData {
  today: { entries: number; exits: number; denied: number; by_method: Record<'rfid' | 'qr' | 'manual', number>; by_category: Record<'student' | 'faculty' | 'employee' | 'visitor', number> };
  active_visitors: number;
  inside: { total: number; cars: number; motorcycles: number; visitors: number; awaiting_confirmation: number; with_slot: number; distinct_slots: number; consistent: boolean };
  occupancy: { car: AreaFigures | null; motorcycle: AreaFigures | null; overall: AreaFigures };
  recent_activity: ActivityRow[];
  campus_date: string;
}

const METHOD_NAME = { rfid: 'RFID', qr: 'Visitor QR', manual: 'Staff override' } as const;

function activityLabel(a: ActivityRow) {
  if (a.kind === 'incident') return { tag: 'WRONG SLOT', tone: 'bg-amber-100 text-amber-800', text: a.reason ?? 'Wrong-slot incident' };
  const method = a.access_method ? METHOD_NAME[a.access_method] : '';
  const what = a.direction === 'out' ? 'exit' : 'entry';
  if (a.result === 'denied') return { tag: 'DENIED', tone: 'bg-red-100 text-red-700', text: `${method} ${what} denied: ${a.reason ?? ''}` };
  return {
    tag: a.direction === 'out' ? 'EXIT' : 'ENTRY',
    tone: a.direction === 'out' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700',
    text: `${method} ${what}${a.slot_code ? ` · slot ${a.slot_code}` : ''}${a.staff_override ? ' · staff override' : ''}`,
  };
}

function ParkingStaffDashboard() {
  const [dashboard, setDashboard] = useState<ParkingDashboardData | null>(null);
  const [error, setError] = useState('');
  const { offline } = useLiveSync();

  // Reloads whenever parking or violation records change (shared refresh).
  const load = useCallback(() => apiRequest<ParkingDashboardData>('/api/parking/dashboard'), []);
  useLiveLoad(load, ['parking', 'violations'], setDashboard, setError);

  const d = dashboard;
  const v = (n: number | undefined) => (d ? String(n ?? 0) : '...');

  return (
    <div className="animate-fadein space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#080677]">Parking Staff Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Access records, vehicle verification, and parking occupancy{d ? ` · ${d.campus_date} (Manila time)` : ''}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{d ? `Showing the last loaded figures. ${error}` : `Unable to load dashboard: ${error}`}</p>
        </div>
      )}
      {offline && !error && d && <p className="text-xs text-amber-700">Connection lost; figures will update when the server is reachable again.</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Entries" value={v(d?.today.entries)} icon={<TrendingUp size={20} />} color="green"
          sub={d ? `${d.today.by_method.rfid} RFID · ${d.today.by_method.qr} QR · ${d.today.by_method.manual} override` : undefined} />
        <StatCard label="Today's Exits" value={v(d?.today.exits)} icon={<Activity size={20} />} color="blue" />
        <StatCard label="Denied Access" value={v(d?.today.denied)} icon={<AlertTriangle size={20} />} color="red" sub="today" />
        <StatCard label="Active Visitors" value={v(d?.active_visitors)} icon={<UserCheck size={20} />} color="sky" sub="visitors parked now" />
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="font-semibold text-slate-700">Parking Occupancy (now)</h3>
          <span className="text-sm text-slate-500">Overall <strong className="text-[#080677] text-lg">{d ? `${d.occupancy.overall.occupancy_percent}%` : '…'}</strong> of {d?.occupancy.overall.capacity ?? 139} slots</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Cars inside', d?.inside.cars, `${d?.occupancy.car?.available ?? '…'} of ${d?.occupancy.car?.capacity ?? 55} car slots available`],
            ['Motorcycles inside', d?.inside.motorcycles, `${d?.occupancy.motorcycle?.available ?? '…'} of ${d?.occupancy.motorcycle?.capacity ?? 84} motorcycle slots available`],
            ['Vehicles inside', d?.inside.total, 'active parking transactions, including earlier days'],
            ['Available slots', d?.occupancy.overall.available, `${d?.occupancy.overall.maintenance ?? 0} under maintenance`],
          ].map(([label, value, sub]) => (
            <div key={label as string} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-[#080677]">{d ? (value as number) : '…'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
        {d && (
          <p className={`text-xs mt-3 ${d.inside.consistent ? 'text-slate-500' : 'text-red-600'}`}>
            {d.inside.consistent
              ? `Records agree: ${d.inside.total} vehicles inside = ${d.inside.total} active transactions = ${d.inside.distinct_slots} distinct slots held.`
              : `Records do not agree: ${d.inside.total} active transactions, ${d.inside.with_slot} with a slot, ${d.inside.distinct_slots} distinct slots.`}
            {d.inside.awaiting_confirmation > 0 && ` ${d.inside.awaiting_confirmation} assigned slot(s) not yet confirmed by staff.`}
          </p>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Vehicle Verification', to: '/app/vehicles/authorization', color: 'bg-blue-600' },
              { label: 'Visitor QR Verify', to: '/app/qr-verify', color: 'bg-green-600' },
              { label: 'Occupancy', to: '/app/parking/occupancy', color: 'bg-amber-600' },
              { label: 'Access Records', to: '/app/rfid/monitor', color: 'bg-slate-600' },
            ].map(action => (
              <Link key={action.label} to={action.to} className={`${action.color} text-white p-5 rounded-2xl text-center font-semibold hover:opacity-90 transition-opacity`}>
                {action.label}
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Recent Activity</h3>
          {!d ? <p className="text-sm text-slate-400">Loading activity…</p> : d.recent_activity.length === 0 ? (
            <p className="text-sm text-slate-400">No gate activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {d.recent_activity.slice(0, 8).map(a => {
                const l = activityLabel(a);
                return (
                  <li key={a.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${l.tone}`}>{l.tag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate"><span className="font-mono font-semibold text-[#080677]">{a.plate_number ?? 'Unknown'}</span>{a.category ? <span className="text-xs text-slate-400 capitalize"> · {a.category}</span> : null}</p>
                      <p className="text-xs text-slate-500 truncate">{l.text}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{formatCampusDateTime(a.at, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role;
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'parking_staff') return <ParkingStaffDashboard />;
  return <UserDashboard />;
}
