import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Navbar';
import { api } from '../services/api';

export default function Register({ onSuccess }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (body.password !== body.confirm) { setError('Passwords do not match.'); return; }
    delete body.confirm; setBusy(true);
    try { onSuccess(await api('/auth/register', { method: 'POST', body })); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-layout"><section className="auth-story"><Brand /><div><span className="eyebrow">LET’S GROW SOMETHING GOOD</span><h1>Your land.<br />Your ambition.<br /><em>Our connection.</em></h1><p>Bring your farm into focus with local weather<br />and all your field details in one place.</p><div className="field-art" aria-hidden="true"><span>☀</span><i /><i /><i /><i /></div></div><small>A new season of possibilities.</small></section>
    <section className="auth-form"><div className="auth-form-inner"><span className="eyebrow">START YOUR JOURNEY</span><h2>Room to grow.</h2><p className="muted">Create your free farm workspace.</p><form onSubmit={submit}>
      <label>Your name<input name="name" autoComplete="name" placeholder="Full name" minLength="2" maxLength="80" required /></label>
      <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength="254" required /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength="8" maxLength="128" required /></label>
      <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" placeholder="Repeat your password" minLength="8" maxLength="128" required /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary full" disabled={busy}>{busy ? 'Creating account…' : 'Create account →'}</button>
    </form><p className="auth-switch">Already growing with us? <Link to="/login">Sign in</Link></p></div></section></div>;
}
