import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import WeatherCard from '../components/WeatherCard';

export default function Dashboard({ user }) {
  const [farms, setFarms] = useState([]);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api('/farms', { signal: controller.signal }).then(rows => {
      setFarms(rows); setSelected(current => rows.some(farm => String(farm.id) === current) ? current : rows[0] ? String(rows[0].id) : '');
      if (!rows.length) setLoading(false);
    }).catch(error => { if (error.name !== 'AbortError') { setError(error.message); setLoading(false); } });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    api(`/dashboard/${selected}`, { signal: controller.signal }).then(setData)
      .catch(error => { if (error.name !== 'AbortError') setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, refresh]);
  return <><header className="page-header"><div><span className="eyebrow">YOUR FARM, AT A GLANCE</span><h1>Hello, {user.name.split(' ')[0]} <span className="greeting-leaf" aria-hidden="true">✳</span></h1><p>A clearer picture of your fields. A confident start to your day.</p></div><span className="date-label">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span></header>
    <section className="welcome-banner">
      <div className="banner-copy">
        <span className="eyebrow">Jai Jawan, Jai Kisan</span>
        <h2><span>Rooted in Tradition.</span><span>Growing with Technology.</span></h2>
        <p>Honouring India's farmers with smart farming solutions, weather updates, and connected farm management.</p>
        <Link className="banner-link" to="/farms">Manage your farms <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="banner-art" aria-hidden="true"><div className="sun" /><div className="hill hill-one" /><div className="hill hill-two" /><div className="field-lines" /></div>
    </section>
    <div className="stats-grid"><div className="stat card"><span>Farms in your care</span><strong>{farms.length}<small> farms</small></strong></div><div className="stat card"><span>Total cultivated area</span><strong>{farms.reduce((total, farm) => total + farm.area_acres, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}<small> acres</small></strong><p>Every acre, accounted for</p></div><div className="stat card"><span>Crop varieties</span><strong>{new Set(farms.map(farm => farm.crop)).size}<small> crops</small></strong><p>Diversity across your fields</p></div></div>
    <div className="section-heading dashboard-controls"><div><span className="eyebrow">FIELD CONDITIONS</span><h2>Your daily farm brief</h2></div><div className="toolbar">{farms.length > 0 && <label className="sr-only" htmlFor="farm-select">Select farm</label>}{farms.length > 0 && <select id="farm-select" value={selected} onChange={event => setSelected(event.target.value)}>{farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select>}<button className="secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>↻ Refresh</button></div></div>
    {error && <div className="error" role="alert">{error}</div>}
    {loading ? <div className="card loading" role="status">Gathering your field conditions…</div> : !farms.length && !error ? <div className="card empty-state"><span aria-hidden="true">♧</span><h2>Your next season starts here.</h2><p>Add your first farm to see its details and local weather.</p><Link className="primary" to="/farms">Add your first farm →</Link></div> : data && <>
      {data.warning && <p className="notice" role="status">{data.warning} Your farm details are still available.</p>}
      <WeatherCard weather={data.weather} farm={data.farm} />
      <section className="farm-strip card"><div><span className="eyebrow">SELECTED FARM</span><h3>{data.farm.name}</h3><p>{data.farm.location} · {data.farm.area_acres} acres · {data.farm.soil_type} soil</p></div><Link to={`/farms/${data.farm.id}`}>View farm details ↗</Link></section>
    </>}
  </>;
}
