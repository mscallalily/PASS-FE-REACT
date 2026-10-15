import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth, UserRole } from './context/AuthContext';
import { LicenseProvider } from './context/LicenseContext';
import Layout from './components/Layout';

import LandingPage from './pages/LandingPage';
import GuestLandingPage from './pages/GuestLandingPage';
import GuestDashboardPage from './pages/GuestDashboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GuestRegisterPage from './pages/GuestRegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import MobileApp from './pages/MobileApp';

import Dashboard from './pages/app/Dashboard';
import UserManagement from './pages/app/UserManagement';
import VehicleManagement from './pages/app/VehicleManagement';
import RFIDManagement from './pages/app/RFIDManagement';
import ParkingOperations from './pages/app/ParkingOperations';
import VisitorQR from './pages/app/VisitorQR';
import Reports from './pages/app/Reports';
import AuditLogs from './pages/app/AuditLogs';
import Violations from './pages/app/Violations';
import SystemSettings from './pages/app/SystemSettings';
import Profile from './pages/app/Profile';
import Notifications from './pages/app/Notifications';
import ParkingHistory from './pages/app/ParkingHistory';

function ProtectedApp() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'guest') return <Navigate to="/guest-dashboard" replace />;
  return <Layout><Outlet /></Layout>;
}

function GuestRoute() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'guest') return <Navigate to="/app/dashboard" replace />;
  return <Outlet />;
}

function RoleRoute({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuth();
  return roles.includes(user?.role ?? null) ? <>{children}</> : <AccessDenied />;
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-5 text-red-600 font-bold text-2xl">!</div>
      <h2 className="text-2xl font-bold text-navy mb-2">Access Denied</h2>
      <p className="text-slate-500 max-w-sm">You don't have permission to view this page. Contact your administrator if you believe this is an error.</p>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/guest" element={<GuestLandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/guest" element={<GuestRegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/mobile" element={<MobileApp />} />

      {/* Guest dashboard (separate from regular user) */}
      <Route element={<GuestRoute />}>
        <Route path="/guest-dashboard" element={<GuestDashboardPage />} />
      </Route>

      {/* Protected app routes */}
      <Route path="/app" element={<ProtectedApp />}>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="my-history" element={<RoleRoute roles={['student', 'faculty', 'employee']}><ParkingHistory /></RoleRoute>} />
        <Route path="users" element={<RoleRoute roles={['admin']}><UserManagement /></RoleRoute>} />
        {/* Legacy links redirect to the consolidated account-management screen. */}
        <Route path="users/requests" element={<Navigate to="/app/users" replace />} />
        <Route path="roles" element={<Navigate to="/app/users" replace />} />
        <Route path="vehicles" element={<RoleRoute roles={['admin', 'parking_staff', 'student', 'faculty', 'employee']}><VehicleManagement /></RoleRoute>} />
        <Route path="vehicles/register" element={<RoleRoute roles={['student', 'faculty', 'employee']}><VehicleManagement /></RoleRoute>} />
        <Route path="vehicles/authorization" element={<RoleRoute roles={['admin', 'parking_staff']}><VehicleManagement /></RoleRoute>} />
        <Route path="drivers" element={<RoleRoute roles={['admin', 'parking_staff', 'student', 'faculty', 'employee']}><VehicleManagement /></RoleRoute>} />
        <Route path="rfid" element={<RoleRoute roles={['admin']}><RFIDManagement /></RoleRoute>} />
        <Route path="rfid/monitor" element={<RoleRoute roles={['parking_staff']}><RFIDManagement /></RoleRoute>} />
        <Route path="parking/transactions" element={<RoleRoute roles={['parking_staff']}><ParkingOperations /></RoleRoute>} />
        <Route path="parking/layout" element={<RoleRoute roles={['parking_staff']}><ParkingOperations /></RoleRoute>} />
        <Route path="parking/occupancy" element={<RoleRoute roles={['parking_staff']}><ParkingOperations /></RoleRoute>} />
        <Route path="parking/availability" element={<RoleRoute roles={['parking_staff', 'student', 'faculty', 'employee']}><ParkingOperations /></RoleRoute>} />
        <Route path="visitors" element={<RoleRoute roles={['parking_staff']}><VisitorQR /></RoleRoute>} />
        <Route path="qr-verify" element={<RoleRoute roles={['parking_staff']}><VisitorQR /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute roles={['admin']}><Reports /></RoleRoute>} />
        <Route path="audit" element={<RoleRoute roles={['admin']}><AuditLogs /></RoleRoute>} />
        <Route path="violations" element={<RoleRoute roles={['parking_staff']}><Violations /></RoleRoute>} />
        <Route path="settings" element={<RoleRoute roles={['admin']}><SystemSettings /></RoleRoute>} />
        <Route path="*" element={<AccessDenied />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LicenseProvider>
          <AppRoutes />
        </LicenseProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
