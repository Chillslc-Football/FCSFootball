import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function LoginPage() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.loaded && auth.isAdmin) {
    return <Navigate to="/suggestions" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await auth.signIn(email, password);
    if (!result.ok) setError(result.error);
    setBusy(false);
  }

  return (
    <div className="shell">
      <div className="brand" style={{ marginBottom: 8 }}>
        FCS Pulse Media Admin
      </div>
      <p className="muted">Sign in with an allowlisted administrator account. No public sign-up.</p>
      <form className="card stack" onSubmit={(e) => void onSubmit(e)} style={{ maxWidth: 420 }}>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <div className="error">{error}</div> : null}
        {auth.unauthorized ? (
          <div className="error">
            This account authenticated but is not on the Media Admin allowlist.
          </div>
        ) : null}
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
