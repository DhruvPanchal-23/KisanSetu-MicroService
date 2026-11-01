import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFarmReport } from '../services/api';
import { formatFarmDate } from '../services/farmDate';

export default function FarmReports() {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [reporting, setReporting] = useState(null);
  const [reportError, setReportError] = useState('');
  const [message, setMessage] = useState('');
  const heading = useRef(null);
  const reportController = useRef(null);

  useEffect(() => {
    heading.current?.focus();
    return () => reportController.current?.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api('/farms', { signal: controller.signal })
      .then(rows => { if (!controller.signal.aborted) setFarms(rows); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  async function download(farm) {
    if (reportController.current) return;
    const controller = new AbortController();
    reportController.current = controller;
    setReporting(farm.id); setReportError(''); setMessage('');
    try {
      await downloadFarmReport(farm.id, { signal: controller.signal });
      if (!controller.signal.aborted) setMessage(`PDF downloaded for ${farm.name}.`);
    } catch (error) {
      if (!controller.signal.aborted) setReportError(error.message);
    } finally {
      if (!controller.signal.aborted) setReporting(null);
      if (reportController.current === controller) reportController.current = null;
    }
  }

  return <>
    <header className="page-header">
      <div>
        <span className="eyebrow">YOUR FARM RECORDS</span>
        <h1 ref={heading} tabIndex={-1}>Farm Report</h1>
        <p>Download saved farm details with synthetic weather and irrigation references from 2024–2025.</p>
      </div>
    </header>
    {message && <div className="success" role="status">{message}</div>}
    {reportError && <div className="error" role="alert">{reportError} Use Download PDF to try again.</div>}
    {error && <div className="error" role="alert">{error} <button className="text-button" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
    {loading ? <div className="card loading" role="status">Loading farm reports…</div> : error ? null : !farms.length ? <section className="card empty-state">
      <h2>No farms to report yet.</h2>
      <p>Add a farm to download its report.</p>
      <Link className="primary" to="/farms">View my farms</Link>
    </section> : <div className="card report-list" role="region" aria-label="Farm reports" tabIndex={0}>
      <table className="report-table">
        <caption className="sr-only">Available farm reports</caption>
        <thead><tr><th scope="col">Farm</th><th scope="col">Crop</th><th scope="col">Area (acres)</th><th scope="col">Farm added</th><th scope="col">Report</th></tr></thead>
        <tbody>{farms.map(farm => <tr key={farm.id}>
          <th scope="row"><Link className="report-farm" to={`/farms/${farm.id}`}>{farm.name}</Link><small className="report-location">{farm.location}</small></th>
          <td>{farm.crop}</td>
          <td>{farm.area_acres}</td>
          <td className="report-date">{formatFarmDate(farm.created_at)}</td>
          <td><button className="secondary report-download" disabled={reporting !== null} aria-label={`Download PDF for ${farm.name}`} onClick={() => download(farm)}>
            {reporting === farm.id ? 'Downloading PDF…' : 'Download PDF'}
          </button></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </>;
}
