import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { SourceDetailPage } from './pages/SourceDetailPage';
import { SourcesPage } from './pages/SourcesPage';
import { SuggestionDetailPage } from './pages/SuggestionDetailPage';
import { SuggestionsPage } from './pages/SuggestionsPage';

function Shell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <div className="brand">FCS Pulse Media Admin</div>
          <div className="muted">{auth.email}</div>
        </div>
        <nav className="nav">
          <NavLink to="/suggestions" className={({ isActive }) => (isActive ? 'active' : '')}>
            Pending
          </NavLink>
          <NavLink to="/sources" className={({ isActive }) => (isActive ? 'active' : '')}>
            Directory
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => (isActive ? 'active' : '')}>
            Reports
          </NavLink>
          <button type="button" className="btn-secondary" onClick={() => void auth.signOut()}>
            Sign out
          </button>
        </nav>
      </header>
      {children}
    </div>
  );
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (!auth.loaded) {
    return (
      <div className="shell">
        <div className="card">Loading…</div>
      </div>
    );
  }
  if (!auth.configured) {
    return (
      <div className="shell">
        <div className="card error">
          Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Media Admin.
        </div>
      </div>
    );
  }
  if (!auth.isAdmin) {
    return <Navigate to="/login" replace />;
  }
  return <Shell>{children}</Shell>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/suggestions"
        element={
          <RequireAdmin>
            <SuggestionsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/suggestions/:id"
        element={
          <RequireAdmin>
            <SuggestionDetailPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/sources"
        element={
          <RequireAdmin>
            <SourcesPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/sources/new"
        element={
          <RequireAdmin>
            <SourceDetailPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/sources/:id"
        element={
          <RequireAdmin>
            <SourceDetailPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAdmin>
            <ReportsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/reports/:id"
        element={
          <RequireAdmin>
            <ReportDetailPage />
          </RequireAdmin>
        }
      />
      <Route path="/corrections" element={<Navigate to="/reports" replace />} />
      <Route path="*" element={<Navigate to="/suggestions" replace />} />
    </Routes>
  );
}
