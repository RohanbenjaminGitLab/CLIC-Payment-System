import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Courses } from './pages/Courses';
import { Batches } from './pages/Batches';
import { Students } from './pages/Students';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';
import { StaffManagement } from './pages/StaffManagement';
import { BatchPayments } from './pages/BatchPayments';
import { Audit } from './pages/Audit';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';
import { ServerWakeupOverlay } from './components/ServerWakeupOverlay';


function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleGate({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function Shell() {
  return (
    <Protected>
      <Layout />
    </Protected>
  );
}

export default function App() {

  return (
    <AuthProvider>
      <ServerWakeupOverlay />
      <Routes>

        <Route path="/login" element={<Login />} />
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/batches" element={<Batches />} />
          <Route path="/students" element={<Students />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/batch-payments" element={<BatchPayments />} />
          <Route path="/reports" element={<Reports />} />
          <Route
            path="/staff"
            element={
              <RoleGate roles={['admin', 'manager']}>
                <StaffManagement />
              </RoleGate>
            }
          />
          <Route
            path="/audit"
            element={
              <RoleGate roles={['admin']}>
                <Audit />
              </RoleGate>
            }
          />
          <Route
            path="/settings"
            element={
              <RoleGate roles={['admin', 'manager', 'staff']}>
                <Settings />
              </RoleGate>
            }
          />
        </Route>
        <Route path="/users" element={<Navigate to="/staff" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
