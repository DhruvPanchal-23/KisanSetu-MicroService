import { NavLink } from 'react-router-dom';

export function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true">♧</span><span>KisanSetu<small>YOUR PARTNER IN GROWTH</small></span></div>;
}

export default function Navbar({ user, onLogout }) {
  return <aside className="sidebar">
    <a className="skip-link" href="#main">Skip to content</a>
    <Brand />
    <div className="workspace-label">FARM WORKSPACE</div>
    <nav aria-label="Main navigation">
      <NavLink to="/" end><span aria-hidden="true">▦</span> Overview</NavLink>
      <NavLink to="/farms"><span aria-hidden="true">▤</span> My farms</NavLink>
      <NavLink to="/analytics"><span aria-hidden="true">▥</span> Analytics</NavLink>
      <NavLink to="/reports"><span aria-hidden="true">▧</span> Farm Report</NavLink>
    </nav>
    <div className="sidebar-note"><span aria-hidden="true">↗</span><strong>Your farms.<br />All in one place.</strong><p>Keep track of your fields and their local weather.</p></div>
    <div className="profile"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>Farmer account</small></div></div>
    <button className="logout" onClick={onLogout}>Sign out <span aria-hidden="true">↗</span></button>
  </aside>;
}
