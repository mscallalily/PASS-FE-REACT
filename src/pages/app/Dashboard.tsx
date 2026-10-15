import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatCard, Card } from '../../components/ui';

import {
  Users,
  Car,
  CreditCard,
  ParkingSquare,
  UserCheck,
  AlertTriangle,
  TrendingUp,
  Activity,
  Shield,
  Bell,
  ArrowRight,
  CheckCircle,
  Clock,
} from 'lucide-react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { ZONE_CAPACITY } from '../../data/mock';


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

// ============================================
// ADMIN DASHBOARD
// ============================================

function AdminDashboard() {
  const [dashboardData, setDashboardData] =
    useState<DashboardData | null>(null);
    const [occupancyData, setOccupancyData] = useState<any>(null);
    const [occupancyError, setOccupancyError] = useState('');
    const [dashboardError, setDashboardError] = useState('');
    const [recentLogs, setRecentLogs] = useState<any[]>([]);

  console.log('AdminDashboard rendered');

  useEffect(() => {
    console.log('AdminDashboard useEffect running');
    const token =
      localStorage.getItem('pass_auth_token') ||
      sessionStorage.getItem('pass_auth_token');

      console.log('Token found:', !!token);

    if (!token) {
      setDashboardError('No login token found. Please log in again.');
      return;
    }
const loadDashboard = async () => {
  console.log('Starting dashboard API request');

  try {
    const response = await fetch('/api/admin/dashboard', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('Dashboard API status:', response.status);

        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? 'You are not authorized to view this dashboard.'
              : `Failed to load dashboard (${response.status}).`
          );
        }

        const data: DashboardData = await response.json();
        console.log(
  'Dashboard data:',
  JSON.stringify(data, null, 2)
);
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

const loadOccupancy = async () => {
  try {
    const response = await fetch('/api/admin/parking/occupancy', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Occupancy API failed (${response.status})`);
    }

    const data = await response.json();
    console.log('Occupancy data:', data);
    setOccupancyData(data);
  } catch (error) {
    setOccupancyError(
      error instanceof Error
        ? error.message
        : 'Unable to load parking occupancy.'
    );
  }
};

loadOccupancy();
const loadRecentLogs = async () => {
  try {
    const response = await fetch('/api/admin/audit-logs?page=1', {
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
    console.error('Failed to load recent audit logs:', error);
  }
};

loadRecentLogs();
}, []);

const activeAlerts = [];

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
        <h1 className="text-2xl font-bold text-[#080677]">
          Administrative Dashboard
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          System overview{' '}
          {new Date().toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Summary Cards */}

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
            Today's hourly traffic
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
          <h3 className="font-semibold text-slate-700 mb-4">
            Parking Occupancy by Zone
          </h3>

          <div className="space-y-4">
            {ZONE_CAPACITY.map((zone, index) => {
              const percentage = Math.round(
                (zone.occupied / zone.capacity) * 100
              );

              return (
                <div key={zone.zone}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{zone.zone}</span>
                    <span>{percentage}% occupied</span>
                  </div>

                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{zone.occupied} occupied</span>
                    <span>
                      {zone.capacity - zone.occupied} free of {zone.capacity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">
              Recent Administrative Activity
            </h3>
            <Link
              to="/app/audit"
              className="text-xs text-blue-600 hover:underline"
            >
              View audit log
            </Link>
          </div>

          
<div className="space-y-3">
  {recentLogs.length === 0 ? (
    <p className="text-sm text-slate-400 p-3">
      No recent administrative activity.
    </p>
  ) : (
    recentLogs.map((event) => {
      const action = String(event.action || '');
      const isSuccess = [
        'created',
        'updated',
        'approved',
        'activated',
        'assigned',
      ].includes(action.toLowerCase());

      const moduleName =
        event.auditable_type?.split('\\').pop() || 'System';

      const actor =
        event.actor_label ||
        (event.user_id ? `User #${event.user_id}` : 'System');

      const timestamp = event.created_at
        ? new Date(
            event.created_at.replace(' ', 'T')
          ).toLocaleString('en-PH')
        : 'Unknown date';

      return (
        <div
          key={event.log_id}
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              isSuccess
                ? 'bg-green-100 text-green-600'
                : 'bg-amber-100 text-amber-600'
            }`}
          >
            {isSuccess ? 'OK' : '!'}
          </div>

          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700">
              {action} — {actor}
            </p>

            <p className="text-xs text-slate-400">
              {moduleName} · {timestamp}
            </p>
          </div>
        </div>
      );
    })
  )}
</div>

        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-4">
            Quick Actions
          </h3>

          <div className="space-y-2.5">
            {[
              {
                label: 'Add User',
                to: '/app/users',
                icon: <Users size={16} />,
              },
              {
                label: 'Review Registrations',
                to: '/app/users/requests',
                icon: <Clock size={16} />,
              },
              {
                label: 'Review Vehicle Authorization',
                to: '/app/vehicles/authorization',
                icon: <Car size={16} />,
              },
              {
                label: 'Manage RFID Assignments',
                to: '/app/rfid',
                icon: <CreditCard size={16} />,
              },
              {
                label: 'Roles & Permissions',
                to: '/app/roles',
                icon: <Shield size={16} />,
              },
              {
                label: 'View Reports',
                to: '/app/reports',
                icon: <Activity size={16} />,
              },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium"
              >
                {action.icon}
                {action.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Bell size={18} />
          Active Alerts
        </h3>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeAlerts.map((alert, index) => (
            <div
              key={index}
              className="flex gap-3 p-4 rounded-xl border bg-blue-50 border-blue-200"
            >
              <AlertTriangle size={16} className="text-blue-500" />
              <p className="text-xs text-slate-600">{alert.msg}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================
// REGULAR USER DASHBOARD
// ============================================

function UserDashboard() {
  const { user } = useAuth();

  return (
    <div className="animate-fadein space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#080677]">
          Hello, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {new Date().toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="My Vehicles"
          value="1"
          icon={<Car size={20} />}
          color="blue"
        />
        <StatCard
          label="Available Near You"
          value="39"
          icon={<ParkingSquare size={20} />}
          color="green"
          sub="Zone C"
        />
        <StatCard
          label="Today's Entries"
          value="1"
          icon={<Activity size={20} />}
          color="sky"
        />
        <StatCard
          label="Notifications"
          value="3"
          icon={<Bell size={20} />}
          color="amber"
          sub="2 unread"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-to-br from-[#080677] to-[#2563EB] text-white">
          <p className="text-blue-200 text-sm">
            Vehicle: ABC-1234
          </p>
          <h2 className="text-xl font-bold mt-1">
            Toyota Vios 2021
          </h2>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <CheckCircle size={16} className="text-green-400" />
            <span>RFID Active â€” Card RFID-001</span>
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm">
            <CheckCircle size={16} className="text-green-400" />
            <span>Authorization: Valid until Aug 2025</span>
          </div>

          <Link
            to="/app/vehicles"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-sky-300"
          >
            View vehicle details
            <ArrowRight size={14} />
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-4">
            Parking Availability
          </h3>

          <div className="space-y-3">
            {ZONE_CAPACITY.map((zone, index) => {
              const percentage = Math.round(
                (zone.occupied / zone.capacity) * 100
              );

              return (
                <div
                  key={zone.zone}
                  className="flex items-center gap-3"
                >
                  <span className="w-14 text-sm text-slate-500">
                    {zone.zone}
                  </span>

                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>

                  <span className="text-xs font-bold text-slate-600">
                    {zone.capacity - zone.occupied} free
                  </span>
                </div>
              );
            })}
          </div>

          <Link
            to="/app/parking/availability"
            className="mt-4 text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            View full map
            <ArrowRight size={12} />
          </Link>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-700 mb-4">
          Recent Parking Activity
        </h3>

        <div className="space-y-3">
          {[
            {
              date: 'Sep 1, 2024',
              entry: '07:32 AM',
              exit: '05:45 PM',
              zone: 'Zone A',
              duration: '10h 13m',
            },
            {
              date: 'Aug 30, 2024',
              entry: '08:10 AM',
              exit: '06:00 PM',
              zone: 'Zone B',
              duration: '9h 50m',
            },
          ].map((history, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-blue-50 rounded-xl"
            >
              <div>
                <p className="font-medium text-slate-700 text-sm">
                  {history.date}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {history.zone} Â· Entry: {history.entry} Â· Exit: {history.exit}
                </p>
              </div>

              <span className="text-sm font-bold text-blue-600">
                {history.duration}
              </span>
            </div>
          ))}
        </div>

        <Link
          to="/app/my-history"
          className="mt-4 text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          View full history
          <ArrowRight size={12} />
        </Link>
      </Card>
    </div>
  );
}

// ============================================
// PARKING STAFF DASHBOARD DATA TYPES
// ============================================

interface ParkingEvent {
  transaction_id: number;
  ticket_number: string | null;
  plate_number: string | null;
  entry_datetime: string | null;
  exit_datetime: string | null;
}

interface ParkingDashboardData {
  today_entries: number;
  today_exits: number;
  denied_access: number;
  active_visitors: number;
  recent_events: ParkingEvent[];
}

// ============================================
// PARKING STAFF DASHBOARD
// ============================================

function ParkingStaffDashboard() {
  const [dashboard, setDashboard] =
    useState<ParkingDashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError('');

        const token =
          localStorage.getItem('pass_auth_token') ||
          sessionStorage.getItem('pass_auth_token');

        if (!token) {
          throw new Error(
            'No login token found. Please sign in again.'
          );
        }

        const response = await fetch(
          '/api/parking/dashboard',
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              `Dashboard request failed (${response.status})`
          );
        }

        if (!cancelled) {
          setDashboard(data as ParkingDashboardData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load dashboard'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="animate-fadein space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-[#080677]">
          Parking Staff Dashboard
        </h1>

        <p className="text-sm text-slate-500 mt-1">
          Access records, vehicle verification, and parking occupancy
        </p>
      </div>

      {/* STATISTICS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <StatCard
          label="Today's Entries"
          value={
            loading
              ? '...'
              : dashboard
                ? String(dashboard.today_entries)
                : 'â€”'
          }
          icon={<TrendingUp size={20} />}
          color="green"
        />

        <StatCard
          label="Today's Exits"
          value={
            loading
              ? '...'
              : dashboard
                ? String(dashboard.today_exits)
                : 'â€”'
          }
          icon={<Activity size={20} />}
          color="blue"
        />

        <StatCard
          label="Denied Access"
          value={
            loading
              ? '...'
              : dashboard
                ? String(dashboard.denied_access)
                : 'â€”'
          }
          icon={<AlertTriangle size={20} />}
          color="red"
        />

        <StatCard
          label="Active Visitors"
          value={
            loading
              ? '...'
              : dashboard
                ? String(dashboard.active_visitors)
                : 'â€”'
          }
          icon={<UserCheck size={20} />}
          color="sky"
        />

      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">
            Unable to load dashboard: {error}
          </p>
        </div>
      )}

      {/* QUICK ACTIONS AND RECENT EVENTS */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* QUICK ACTIONS */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-4">
            Quick Actions
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Vehicle Verification',
                to: '/app/vehicles/authorization',
                color: 'bg-blue-600',
              },
              {
                label: 'Visitor QR Verify',
                to: '/app/qr-verify',
                color: 'bg-green-600',
              },
              {
                label: 'Occupancy',
                to: '/app/parking/occupancy',
                color: 'bg-amber-600',
              },
              {
                label: 'Access Records',
                to: '/app/rfid/monitor',
                color: 'bg-slate-600',
              },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className={`${action.color} text-white p-5 rounded-2xl text-center font-semibold hover:opacity-90 transition-opacity`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </Card>

        {/* RECENT EVENTS */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-4">
            Recent Events
          </h3>

          <div className="space-y-2">

            {loading ? (
              <p className="text-sm text-slate-400">
                Loading events...
              </p>
            ) : dashboard?.recent_events?.length ? (

              dashboard.recent_events
                .slice(0, 4)
                .map((event) => (
                  <div
                    key={event.transaction_id}
                    className="flex items-center gap-3 py-2 border-b border-slate-100"
                  >

                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      PARKING
                    </span>

                    <span className="text-sm text-slate-600 flex-1 truncate">
                      {event.plate_number ?? 'Unknown Vehicle'}
                      {' â€” '}
                      {event.ticket_number ?? 'No ticket'}
                    </span>

                    <span className="text-xs text-slate-400">
                      {event.entry_datetime
                        ? new Date(
                            event.entry_datetime.replace(' ', 'T')
                          ).toLocaleString('en-PH')
                        : 'No entry time'}
                    </span>

                  </div>
                ))

            ) : (
              <p className="text-sm text-slate-400">
                {error
                  ? 'Unable to retrieve recent events.'
                  : 'No recent parking events.'}
              </p>
            )}

          </div>
        </Card>

      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD ROLE ROUTING
// ============================================

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role;

  if (role === 'admin') {
    return <AdminDashboard />;
  }

  if (role === 'parking_staff') {
    return <ParkingStaffDashboard />;
  }

  return <UserDashboard />;
}

