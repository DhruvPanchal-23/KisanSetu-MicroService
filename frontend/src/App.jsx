import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Farms from './pages/Farms';
import FarmDetails from './pages/FarmDetails';
import Analytics from './pages/Analytics';
import FarmReports from './pages/FarmReports';
import { api } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const expire = () => setUser(null);
    window.addEventListener('session-expired', expire);
    const restore = async () => {
      setSessionError('');
      if (sessionStorage.getItem('kisansetu_token')) {
        try { const data = await api('/auth/me'); if (active) setUser(data); }
        catch (error) { if (active && sessionStorage.getItem('kisansetu_token')) setSessionError(error.message); }
      }
      if (active) setReady(true);
    };
    restore();
    return () => { active = false; window.removeEventListener('session-expired', expire); };
  }, [attempt]);
  function authenticate(data) {
    sessionStorage.setItem('kisansetu_token', data.access_token);
    setUser(data.user);
  }
  function logout() { sessionStorage.removeItem('kisansetu_token'); setUser(null); }
  if (!ready) return <div className="fullscreen-status" role="status">Opening your farm workspace…</div>;
  if (sessionError) return <div className="fullscreen-status"><p role="alert">{sessionError}</p><button onClick={() => setAttempt(value => value + 1)}>Try again</button></div>;
  if (!user) return <Routes>
    <Route path="/login" element={<Login onSuccess={authenticate} />} />
    <Route path="/register" element={<Register onSuccess={authenticate} />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>;
  return <div className="app-shell">
    <Navbar user={user} onLogout={logout} />
    <main className="main-content" id="main"><Routes>
      <Route path="/" element={<Dashboard user={user} />} />
      <Route path="/farms" element={<Farms />} />
      <Route path="/farms/:farmId" element={<FarmDetails />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/reports" element={<FarmReports />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes><footer>Your farms. Connected. <span>KisanSetu © {new Date().getFullYear()}</span></footer></main>
  </div>;
}
