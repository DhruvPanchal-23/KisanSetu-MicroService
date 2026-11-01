import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { summarizeFarms } from '../services/farmAnalytics';

function area(value) {
  return value > 0 && value < 0.01 ? '<0.01' : value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function percentage(value) {
  return value > 0 && value < 0.1 ? '<0.1' : value.toLocaleString('en-IN', { maximumFractionDigits: 1 });
}

function Breakdown({ id, title, rows, soil = false }) {
  return <section className={`analytics-panel card${soil ? ' analytics-soil' : ''}`} aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    <p className="muted">Share of your total farm area.</p>
    <ul className="analytics-breakdown">
      {rows.map(row => <li className="analytics-row" key={row.name}>
        <div className="analytics-row-heading"><h3>{row.name}</h3><strong>{area(row.areaAcres)} acres</strong></div>
        <div className="analytics-track" aria-hidden="true"><span style={{ width: `${row.share}%` }} /></div>
        <p className="muted">{percentage(row.share)}% of total area &middot; {row.farmCount} {row.farmCount === 1 ? 'farm' : 'farms'}</p>
      </li>)}
    </ul>
  </section>;
}

export default function Analytics() {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const heading = useRef(null);

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api('/farms', { signal: controller.signal })
      .then(rows => { if (!controller.signal.aborted) setFarms(rows); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const summary = summarizeFarms(farms);
  return <>
    <header className="page-header">
      <div><span className="eyebrow">YOUR LAND, IN NUMBERS</span><h1 ref={heading} tabIndex={-1}>Analytics</h1><p>A breakdown of your saved farms, crops, and soil.</p></div>
      <button className="secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh</button>
    </header>
    {loading ? <div className="card loading" role="status">Loading your farm analytics...</div>
      : error ? <div className="error" role="alert">{error} <button className="text-button" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>
        : !farms.length ? <div className="card empty-state"><h2>No farms to analyze yet</h2><p>Add your farm details to see your area by crop and soil type.</p><Link className="primary" to="/farms">Add your first farm</Link></div>
          : <>
            <div className="stats-grid">
              <div className="stat card"><span>Farms in your care</span><strong>{summary.farmCount}<small> farms</small></strong><p>Your saved farm records</p></div>
              <div className="stat card"><span>Total farm area</span><strong>{area(summary.totalAcres)}<small> acres</small></strong><p>Area across all your farms</p></div>
              <div className="stat card"><span>Crop varieties</span><strong>{summary.cropCount}<small> crops</small></strong><p>Crops across your fields</p></div>
            </div>
            <div className="analytics-grid">
              <Breakdown id="analytics-crops" title="Area by crop" rows={summary.crops} />
              <Breakdown id="analytics-soils" title="Area by soil" rows={summary.soils} soil />
            </div>
          </>}
  </>;
}
