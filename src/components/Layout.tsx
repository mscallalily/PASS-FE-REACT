import React, { useEffect, useState, ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/apiClient';
import { useTopicVersion } from '../lib/liveSync';
import { roleLabel, useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Car, CreditCard, ParkingSquare, FileBarChart,
  ScrollText, AlertTriangle, Settings, Bell, LogOut, ChevronDown, ChevronRight,
  Menu, Shield, MapPin, QrCode, Activity, UserCog
} from 'lucide-react';
import { Modal, Button } from './ui';
import { DyciLogo, PassMark } from './Brand';

interface NavItem {
  label: string;
  icon: ReactNode;
  to?: string;
  children?: { label: string; to: string }[];
  roles?: string[];
}

// One sidebar entry per page. Sub-sections (e.g. Entry & Exit / Occupancy / Layout) live as
// tabs inside their page, so they are NOT repeated here. Profile and Notifications live in the
// top bar (avatar + bell), so they are not repeated here either.
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, to: '/app/dashboard', roles: ['admin', 'parking_staff', 'student', 'faculty', 'employee'] },

  // Admin
  { label: 'User Accounts', icon: <Users size={18} />, roles: ['admin'], to: '/app/users' },
  { label: 'Vehicle Authorization', icon: <Car size={18} />, roles: ['admin'], to: '/app/vehicles/authorization' },
  { label: 'RFID Management', icon: <CreditCard size={18} />, roles: ['admin'], to: '/app/rfid' },
  { label: 'Visitor Requests', icon: <QrCode size={18} />, roles: ['admin'], to: '/app/visitors' },
  { label: 'Reports & Analytics', icon: <FileBarChart size={18} />, roles: ['admin'], to: '/app/reports' },
  { label: 'Audit Logs', icon: <ScrollText size={18} />, roles: ['admin'], to: '/app/audit' },
  { label: 'System Settings', icon: <Settings size={18} />, roles: ['admin'], to: '/app/settings' },

  // Parking staff
  { label: 'Vehicle Verification', icon: <Car size={18} />, roles: ['parking_staff'], to: '/app/vehicles/authorization' },
  { label: 'RFID Access Records', icon: <CreditCard size={18} />, roles: ['parking_staff'], to: '/app/rfid/monitor' },
  { label: 'Parking Operations', icon: <ParkingSquare size={18} />, roles: ['parking_staff'], to: '/app/parking/transactions' },
  { label: 'Visitor QR Access', icon: <QrCode size={18} />, roles: ['parking_staff'], to: '/app/visitors' },
  { label: 'Violations', icon: <AlertTriangle size={18} />, roles: ['parking_staff'], to: '/app/violations' },

  // Student / Faculty / Employee
  { label: 'My Vehicle', icon: <Car size={18} />, roles: ['student', 'faculty', 'employee'], to: '/app/vehicles' },
  { label: 'Parking Info', icon: <MapPin size={18} />, roles: ['student', 'faculty', 'employee'], to: '/app/parking/availability' },
  { label: 'Parking History', icon: <Activity size={18} />, roles: ['student', 'faculty', 'employee'], to: '/app/my-history' },
];

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-white/10 text-blue-100 ${open ? 'bg-white/10' : ''}`}
        >
          <span className="shrink-0">{item.icon}</span>
          {!collapsed && <><span className="flex-1 text-sm font-medium">{item.label}</span>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</>}
        </button>
        {open && !collapsed && (
          <div className="ml-9 mt-1 space-y-0.5">
            {item.children.map(c => (
              <NavLink key={c.to} to={c.to}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-white/15 text-white border-l-2 border-[#D4A72C]' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`
                }
              >{c.label}</NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <NavLink to={item.to!}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-white/15 text-white border-l-2 border-[#D4A72C]' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`
      }
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
    </NavLink>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();

  // Unread notification count from the API; refreshed when notifications change and on navigation.
  const notificationsVersion = useTopicVersion(['notifications']);
  useEffect(() => {
    let cancelled = false;
    const load = () => apiRequest<{ unread_count: number }>('/api/notifications/unread-count')
      .then(r => { if (!cancelled) setUnread(r.unread_count); })
      .catch(() => { /* keep the last known count */ });
    load();
    return () => { cancelled = true; };
  }, [pathname, notificationsVersion]);

  const role = user?.role ?? 'student';
  const visibleNav = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Institution + system branding */}
      <div className="px-4 py-4 border-b border-white/10">
        {!collapsed ? (
          <div className="space-y-3">
            <DyciLogo onDark className="h-10" />
            <div className="pt-3 border-t border-white/10"><PassMark onDark size="sm" /></div>
          </div>
        ) : (
          <div className="flex justify-center"><PassMark onDark size="sm" subtitle={false} /></div>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs text-blue-300">Signed in as</p>
          <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-[#96D1F2]/20 text-[#96D1F2] text-[10px] rounded-full font-medium uppercase tracking-wide">
            {roleLabel(role)}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-3 space-y-0.5">
        {visibleNav.map((item, i) => (
          <SidebarItem key={i} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 border-t border-white/10">
        <button
          onClick={() => setLogoutModal(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-300 hover:bg-red-500/20 transition-colors"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB]">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col bg-[#080677] transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} shrink-0 relative`}>
        {sidebarContent}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-20 bg-[#080677] text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} style={{ transform: 'rotate(90deg)' }} />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#080677] z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(o => !o)} className="lg:hidden p-1.5 rounded-lg hover:bg-blue-50">
              <Menu size={20} className="text-[#080677]" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <PassMark size="sm" subtitle={false} />
              <span className="font-bold text-[#080677] text-sm">PASS</span>
            </div>
            <p className="hidden lg:block text-xs text-slate-500">Dr. Yanga&apos;s Colleges, Inc. · Parking Access and Space Management System</p>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/app/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative p-2 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-[#2563EB] transition-colors">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
            <NavLink to="/app/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
              <div className="w-7 h-7 rounded-full bg-[#080677] text-white text-xs flex items-center justify-center font-semibold">
                {user?.name?.[0] ?? 'U'}
              </div>
              <span className="hidden sm:block text-sm font-medium text-slate-700">{user?.name}</span>
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Logout Modal */}
      <Modal open={logoutModal} onClose={() => setLogoutModal(false)} title="Confirm Logout" size="sm">
        <p className="text-sm text-slate-600 mb-6">Are you sure you want to log out of PASS?</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setLogoutModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleLogout}>Yes, Logout</Button>
        </div>
      </Modal>
    </div>
  );
}
