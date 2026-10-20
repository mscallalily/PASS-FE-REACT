import React, { lazy, Suspense } from 'react';
import AppErrorBoundary from './components/AppErrorBoundary';
import EmailCodeVerification from './components/EmailCodeVerification';
const PendingAccountPage = lazy(() => import('./pages/PendingAccountPage'));
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth, UserRole } from './context/AuthContext';
import { LicenseProvider } from './context/LicenseContext';
import { LiveSyncProvider } from './lib/liveSync';
import Layout from './components/Layout';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const GuestLandingPage = lazy(() => import('./pages/GuestLandingPage'));
const GuestDashboardPage = lazy(() => import('./pages/GuestDashboardPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const GuestRegisterPage = lazy(() => import('./pages/GuestRegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const MobileApp = lazy(() => import('./pages/MobileAccessPage'));

const Dashboard = lazy(() => import('./pages/app/Dashboard'));
const UserManagement = lazy(() => import('./pages/app/UserManagement'));
const VehicleManagement = lazy(() => import('./pages/app/VehicleManagement'));
const VehicleRelease = lazy(() => import('./pages/app/VehicleRelease'));
const RFIDManagement = lazy(() => import('./pages/app/RFIDManagement'));
const ParkingOperations = lazy(() => import('./pages/app/ParkingOperations'));
const VisitorQR = lazy(() => import('./pages/app/VisitorQR'));
const Reports = lazy(() => import('./pages/app/Reports'));
const AuditLogs = lazy(() => import('./pages/app/AuditLogs'));
const Violations = lazy(() => import('./pages/app/Violations'));
const SystemSettings = lazy(() => import('./pages/app/SystemSettings'));
const Profile = lazy(() => import('./pages/app/Profile'));
const Notifications = lazy(() => import('./pages/app/Notifications'));
const ParkingHistory = lazy(() => import('./pages/app/ParkingHistory'));

/** Shown briefly while a saved session is restored, instead of redirecting to /login. */
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

function SessionLoading() {
  return <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">Loading your session…</div>;
}

function ProtectedApp() {
  const { isAuthenticated, user, ready } = useAuth();
  if (!ready) return <SessionLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.emailVerified === false && ['student', 'faculty', 'employee', 'guest'].includes(user?.role ?? '')) return <Navigate to="/verify-email" replace />;
  if (user?.accountStatus === 'pending') return <PendingAccountPage />;
  if (user?.accountStatus && user.accountStatus !== 'active') return <AccessDenied />;
  if (user?.role === 'guest') return <Navigate to="/guest-dashboard" replace />;
  return <Layout><Outlet /></Layout>;
}

function GuestRoute() {
  const { isAuthenticated, user, ready } = useAuth();
  if (!ready) return <SessionLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.emailVerified === false) return <Navigate to="/verify-email" replace />;
  if (user?.accountStatus && user.accountStatus !== 'active') return <AccessDenied />;
  if (user?.role !== 'guest') return <Navigate to="/app/dashboard" replace />;
  return <Outlet />;
}

function RoleRoute({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuth();
  return roles.includes(user?.role ?? null) ? <>{children}</> : <AccessDenied />;
}

function AccessDenied() {
  const { logout } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-5 text-red-600 font-bold text-2xl">!</div>
      <h2 className="text-2xl font-bold text-navy mb-2">Access Denied</h2>
      <p className="text-slate-500 max-w-sm">You don't have permission to view this page. Contact your administrator if you believe this is an error.</p>
      <button className="mt-5 text-blue-700" onClick={() => { void logout(); }}>Sign out</button>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/guest" element={<GuestLandingPage />} />
      <Route path="/verify-email" element={<div className="min-h-screen bg-slate-50 p-6 flex items-center"><EmailCodeVerification /></div>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/guest" element={<GuestRegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/mobile" element={<MobileApp />} />

      {/* Guest dashboard (separate from regular user) */}
      <Route element={<GuestRoute />}>
        <Route path="/guest-dashboard" element={<GuestDashboardPage />} />
        <Route path="/guest-dashboard/:section" element={<GuestDashboardPage />} />
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
        <Route path="users/requests" element={<RoleRoute roles={['admin']}><UserManagement /></RoleRoute>} />
        <Route path="roles" element={<RoleRoute roles={['admin']}><UserManagement /></RoleRoute>} />
        <Route path="vehicle-releases" element={<RoleRoute roles={['admin', 'parking_staff', 'student', 'faculty', 'employee']}><VehicleRelease /></RoleRoute>} />
        <Route path="vehicles" element={<RoleRoute roles={['admin', 'parking_staff', 'student', 'faculty', 'employee']}><VehicleManagement /></RoleRoute>} />
        <Route path="vehicles/licenses" element={<RoleRoute roles={['admin', 'parking_staff']}><VehicleManagement /></RoleRoute>} />
        <Route path="vehicles/status" element={<RoleRoute roles={['student', 'faculty', 'employee']}><VehicleManagement /></RoleRoute>} />
        <Route path="vehicles/rfid-requests" element={<RoleRoute roles={['student', 'faculty', 'employee']}><VehicleManagement /></RoleRoute>} />
        <Route path="vehicles/register" element={<RoleRoute roles={['student', 'faculty', 'employee']}><VehicleManagement /></RoleRoute>} />
        <Route path="vehicles/authorization" element={<RoleRoute roles={['admin', 'parking_staff']}><VehicleManagement /></RoleRoute>} />
        <Route path="drivers" element={<RoleRoute roles={['admin', 'parking_staff', 'student', 'faculty', 'employee']}><VehicleManagement /></RoleRoute>} />
        <Route path="rfid" element={<RoleRoute roles={['admin', 'parking_staff']}><RFIDManagement /></RoleRoute>} />
        <Route path="rfid/simulator" element={<RoleRoute roles={['admin', 'parking_staff']}><RFIDManagement /></RoleRoute>} />
        <Route path="rfid/monitor" element={<RoleRoute roles={['admin', 'parking_staff']}><RFIDManagement /></RoleRoute>} />
        <Route path="parking/transactions" element={<RoleRoute roles={['parking_staff']}><ParkingOperations /></RoleRoute>} />
        <Route path="parking/layout" element={<RoleRoute roles={['admin', 'parking_staff', 'student', 'faculty', 'employee']}><ParkingOperations /></RoleRoute>} />
        <Route path="parking/occupancy" element={<RoleRoute roles={['parking_staff']}><ParkingOperations /></RoleRoute>} />
        <Route path="parking/availability" element={<RoleRoute roles={['parking_staff', 'student', 'faculty', 'employee']}><ParkingOperations /></RoleRoute>} />
        <Route path="visitors/passes" element={<RoleRoute roles={['admin', 'parking_staff']}><VisitorQR /></RoleRoute>} />
        <Route path="visitors" element={<RoleRoute roles={['admin', 'parking_staff']}><VisitorQR /></RoleRoute>} />
        <Route path="qr-verify" element={<RoleRoute roles={['admin', 'parking_staff']}><VisitorQR /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute roles={['admin']}><Reports /></RoleRoute>} />
        <Route path="reports/:category" element={<RoleRoute roles={['admin']}><Reports /></RoleRoute>} />
        <Route path="audit" element={<RoleRoute roles={['admin']}><AuditLogs /></RoleRoute>} />
        <Route path="violations" element={<RoleRoute roles={['parking_staff']}><Violations /></RoleRoute>} />
        <Route path="settings/:section" element={<RoleRoute roles={['admin']}><SystemSettings /></RoleRoute>} />
        <Route path="settings" element={<RoleRoute roles={['admin']}><SystemSettings /></RoleRoute>} />
        <Route path="*" element={<AccessDenied />} />
      </Route>

      <Route path="*" element={<main className="min-h-screen p-6 flex items-center justify-center"><div><h1 className="text-xl font-bold">Page not found</h1><a href="/" className="block text-blue-700 mt-4">Back to Home</a></div></main>} />
    </Routes>
  );
}

function UserServices() {
  const { user } = useAuth();
  const routes = <Suspense fallback={<SessionLoading />}><AppRoutes /></Suspense>;
  // Pending accounts may read /me and logout only. Mount their status page
  // without protected background services, which would be denied by the API.
  if (user && (user.accountStatus !== 'active' || user.emailVerified === false)) return routes;
  return <LiveSyncProvider key={user?.id || 'anonymous'}><LicenseProvider>{routes}</LicenseProvider></LiveSyncProvider>;
}
export default function App() {
  return <AppErrorBoundary><BrowserRouter><AuthProvider><UserServices /></AuthProvider></BrowserRouter></AppErrorBoundary>;
}
