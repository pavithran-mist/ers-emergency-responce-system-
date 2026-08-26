import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AlertToast } from './components/AlertToast';
import { IncidentActionModal } from './components/IncidentActionModal';
import { LocationMapModal } from './components/LocationMapModal';

// Pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiveCamerasPage } from './pages/LiveCamerasPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { PoliceAlertsPage } from './pages/PoliceAlertsPage';
import { FireAlertsPage } from './pages/FireAlertsPage';
import { AmbulanceAlertsPage } from './pages/AmbulanceAlertsPage';
import { AIVisionPage } from './pages/AIVisionPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminCamerasPage } from './pages/AdminCamerasPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

// Protected Layout
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toastSelectedIncident, setToastSelectedIncident] = useState<any | null>(null);
  const [locationIncident, setLocationIncident] = useState<any | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="app-surface flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          <div className="page-enter">{children}</div>
        </main>
      </div>

      {/* Real-time emergency toast alerts */}
      <AlertToast
        onSelectIncident={(inc) => setToastSelectedIncident(inc)}
        onOpenLocation={(inc) => setLocationIncident(inc)}
      />

      {/* Modals triggered from toasts */}
      <IncidentActionModal
        incident={toastSelectedIncident}
        onClose={() => setToastSelectedIncident(null)}
        onUpdated={() => setToastSelectedIncident(null)}
        onOpenLocationModal={(inc) => setLocationIncident(inc)}
      />

      <LocationMapModal
        incident={locationIncident}
        onClose={() => setLocationIncident(null)}
      />
    </div>
  );
};

// Route Guard: Requires login and APPROVED status
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono text-cyan-400">
        INITIALIZING ASTRA AI COMMAND SYSTEM...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status === 'PENDING') {
    return <Navigate to="/pending-approval" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

// Route Guard: Requires ADMIN role
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <MainLayout>{children}</MainLayout>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <Routes>
            {/* Public Pages */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/pending-approval" element={<PendingApprovalPage />} />

            {/* Operator & User Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cameras"
              element={
                <ProtectedRoute>
                  <LiveCamerasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/incidents"
              element={
                <ProtectedRoute>
                  <IncidentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts/police"
              element={
                <ProtectedRoute>
                  <PoliceAlertsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts/fire"
              element={
                <ProtectedRoute>
                  <FireAlertsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts/ambulance"
              element={
                <ProtectedRoute>
                  <AmbulanceAlertsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-vision"
              element={
                <ProtectedRoute>
                  <AIVisionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin Exclusive Routes */}
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminUsersPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/cameras"
              element={
                <AdminRoute>
                  <AdminCamerasPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminRoute>
                  <AdminSettingsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <AdminRoute>
                  <AuditLogsPage />
                </AdminRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
};
