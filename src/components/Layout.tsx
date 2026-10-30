import ParkingStationPanel from './ParkingStationPanel'; // PASS_PARKING_STATION_V1
import StaffBarrierPanel from './StaffBarrierPanel'; // PASS_STAFF_BARRIER_V1
import { PAGE_SECTIONS, type PageSection } from '../lib/pageSections';
import { useSimulatorAvailable } from './GateSimulator';
import React, { useEffect, useState, useId, ReactNode } from 'react';
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
  children?: PageSection[];
  roles?: string[];
}

// Each expandable group exposes every page section; selection is stored in the URL.
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18}/>, to: '/app/dashboard' },
  { label: 'User Accounts', icon: <Users size={18}/>, roles: ['admin'], children: PAGE_SECTIONS.users },
  { label: 'Vehicle Authorization', icon: <Car size={18}/>, roles: ['admin'], children: PAGE_SECTIONS.vehicleStaff },
  { label: 'Vehicle Verification', icon: <Car size={18}/>, roles: ['parking_staff'], children: PAGE_SECTIONS.vehicleStaff },
  { label: 'Emergency Vehicle Release', icon: <Shield size={18}/>, roles: ['parking_staff'], to: '/app/vehicle-releases' },
  { label: 'RFID Management', icon: <CreditCard size={18}/>, roles: ['admin'], children: PAGE_SECTIONS.rfid },
  { label: 'RFID Access Records', icon: <CreditCard size={18}/>, roles: ['parking_staff'], children: PAGE_SECTIONS.rfid },
  { label: 'Parking Operations', icon: <ParkingSquare size={18}/>, roles: ['parking_staff'], children: PAGE_SECTIONS.parking.filter(section => section.label !== 'Availability') },
  { label: 'Visitor Requests', icon: <QrCode size={18}/>, roles: ['admin'], children: PAGE_SECTIONS.visitors },
  { label: 'Visitor QR Access', icon: <QrCode size={18}/>, roles: ['parking_staff'], children: PAGE_SECTIONS.visitors },
  { label: 'Reports & Analytics', icon: <FileBarChart size={18}/>, roles: ['admin'], children: PAGE_SECTIONS.reports },
  { label: 'Parking Layout', icon: <MapPin size={18}/>, roles: ['admin'], to: '/app/parking/layout' },
  { label: 'Audit Logs', icon: <ScrollText size={18}/>, roles: ['admin'], to: '/app/audit' },
  { label: 'Records & History', icon: <ScrollText size={18}/>, roles: ['admin'], children: PAGE_SECTIONS.records },
  { label: 'System Settings', icon: <Settings size={18}/>, roles: ['admin'], to: '/app/settings' },
  { label: 'Violations', icon: <AlertTriangle size={18}/>, roles: ['parking_staff'], to: '/app/violations' },
  { label: 'My Vehicle', icon: <Car size={18}/>, roles: ['student', 'faculty', 'employee'], children: PAGE_SECTIONS.vehicleUser },
  { label: 'Parking Info', icon: <MapPin size={18}/>, roles: ['student', 'faculty', 'employee'], children: PAGE_SECTIONS.parking.filter(section => ['Availability', 'Parking Layout'].includes(section.label)) },
  { label: 'Parking History', icon: <Activity size={18}/>, roles: ['student', 'faculty', 'employee'], to: '/app/my-history' },
  { label: 'Profile', icon: <UserCog size={18}/>, to: '/app/profile' },
  { label: 'Notifications', icon: <Bell size={18}/>, to: '/app/notifications' },
];

function SidebarItem({ item, collapsed, onExpand }: { item: NavItem; collapsed: boolean; onExpand: () => void }) {
  const { pathname } = useLocation();
  const activeGroup = !!item.children?.some(child => child.to === pathname);
  const [open, setOpen] = useState(activeGroup);
  const childId = useId();
  useEffect(() => { if (activeGroup) setOpen(true); }, [pathname, activeGroup]);
  if (item.children) {
    return <div>
      <button type="button" title={collapsed ? item.label : undefined} aria-expanded={!collapsed && open} aria-controls={childId} aria-label={item.label}
        onClick={() => { if (collapsed) { onExpand(); setOpen(true); } else setOpen(previous => !previous); }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors min-h-11 ${activeGroup ? 'bg-white/15 text-white border-l-2 border-[#D4A72C]' : 'hover:bg-white/10 text-blue-100'}`}>
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && <><span className="flex-1 text-sm font-medium">{item.label}</span>{open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</>}
      </button>
      {open && !collapsed && <div id={childId} role="group" aria-label={`${item.label} sections`} className="ml-5 pl-3 mt-1 mb-2 space-y-1 border-l border-white/15">
        {item.children.map(child => <NavLink end key={child.to} to={child.to} className={({ isActive }) => `block px-3 py-2.5 min-h-10 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-white/15 text-white border-l-2 border-[#D4A72C]' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>{child.label}</NavLink>)}
      </div>}
    </div>;
  }
  return <NavLink end={item.to?.startsWith('/guest-dashboard')} to={item.to!} title={collapsed ? item.label : undefined} aria-label={item.label}
    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-lg transition-colors ${isActive ? 'bg-white/15 text-white border-l-2 border-[#D4A72C]' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}>
    <span className="shrink-0">{item.icon}</span>{!collapsed && <span className="text-sm font-medium">{item.label}</span>}
  </NavLink>;
}

export default function Layout({ children, navigation, profileTo = '/app/profile', notificationsTo = '/app/notifications' }: { children: ReactNode; navigation?: NavItem[]; profileTo?: string; notificationsTo?: string }) {
  const { user, logout } = useAuth();
  const simulatorAvailable = useSimulatorAvailable(user?.role === 'admin' || user?.role === 'parking_staff');
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();
  useEffect(() => { setSidebarOpen(false); }, [pathname]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [sidebarOpen]);

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
  const visibleNav = (navigation ?? NAV_ITEMS).filter(item => !item.roles || item.roles.includes(role)).map(item => ({ ...item, children: item.children?.filter(child => !child.simulatorOnly || simulatorAvailable === true) }));

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
      <nav aria-label="Main navigation" onClick={event => { if ((event.target as Element).closest('a')) setSidebarOpen(false); }} className="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-3 space-y-0.5">
        {visibleNav.map((item, i) => (
          <SidebarItem key={item.label} item={item} collapsed={collapsed} onExpand={() => setCollapsed(false)} />
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
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-20 bg-[#080677] text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} style={{ transform: 'rotate(90deg)' }} />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 w-full h-full bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-[#080677] z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => { setCollapsed(false); setSidebarOpen(o => !o); }} className="lg:hidden min-w-11 min-h-11 inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-blue-50">
              <Menu size={20} className="text-[#080677]" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <PassMark size="sm" subtitle={false} />
              <span className="font-bold text-[#080677] text-sm">PASS</span>
            </div>
            <p className="hidden lg:block text-xs text-slate-500">Dr. Yanga&apos;s Colleges, Inc. · Parking Access and Space Management System</p>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to={notificationsTo} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative min-w-11 min-h-11 inline-flex items-center justify-center p-2 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-[#2563EB] transition-colors">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
            <NavLink aria-label="Profile" to={profileTo} className="min-h-11 flex min-w-0 items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
              <div className="w-7 h-7 rounded-full bg-[#080677] text-white text-xs flex items-center justify-center font-semibold">
                {user?.name?.[0] ?? 'U'}
              </div>
              <span className="hidden sm:block max-w-48 truncate text-sm font-medium text-slate-700">{user?.name}</span>
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6">
          {role === 'parking_staff' && <StaffBarrierPanel />}
          {['parking_staff', 'admin'].includes(role) && <ParkingStationPanel />}
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
