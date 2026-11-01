import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Navbar';
import { api } from '../services/api';

export default function Login({ onSuccess }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const data = new FormData(event.currentTarget);
    try { onSuccess(await api('/auth/login', { method: 'POST', body: Object.fromEntries(data) })); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-layout"><section className="auth-story"><Brand /><div><span className="eyebrow">YOUR FARMS. YOUR WORKSPACE.</span><h1>Good farming<br />starts with<br /><em>knowing more.</em></h1><p>Your farms and local weather.<br />Connected in one simple workspace.</p><div className="field-art" aria-hidden="true"><span>☀</span><i /><i /><i /><i /></div></div><small>Built for the people who grow our world.</small></section>
    <section className="auth-form"><div className="auth-form-inner"><span className="eyebrow">WELCOME TO KISANSETU</span><h2>Back to your roots.</h2><p className="muted">Sign in to see what’s happening on your farm.</p><form onSubmit={submit}>
      <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength="254" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="Your password" minLength="8" maxLength="128" required /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in →'}</button>
    </form><p className="auth-switch">New to KisanSetu? <Link to="/register">Create an account</Link></p></div></section></div>;
}
