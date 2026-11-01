import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, downloadFarmReport } from '../services/api';
import { formatFarmDate } from '../services/farmDate';
import WeatherCard from '../components/WeatherCard';
import FarmFormDialog from '../components/FarmFormDialog';
import FarmDeleteDialog from '../components/FarmDeleteDialog';

export default function FarmDetails() {
  const { farmId } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const reportController = useRef(null);
  const loadController = useRef(null);
  const mutationController = useRef(null);
  const heading = useRef(null);
  const focusedFarm = useRef(null);
  const farm = record?.farmId === farmId ? record.farm : null;
  const locked = Boolean(busy) || reporting;

  useEffect(() => {
    if (focusedFarm.current !== farmId) {
      heading.current?.focus();
      focusedFarm.current = farmId;
    }
    setReportError(''); setReportMessage(''); setReporting(false);
    setFormOpen(false); setDeleteOpen(false); setFormError(''); setBusy(''); setActionMessage('');
    return () => {
      reportController.current?.abort();
      mutationController.current?.abort();
      loadController.current?.abort();
    };
  }, [farmId]);

  useEffect(() => {
    const controller = new AbortController();
    loadController.current = controller;
    const signal = controller.signal;
    setLoading(true); setError(''); setNotFound(false);
    setWeather(null); setWeatherError(''); setWeatherLoading(true);
    async function load() {
      try {
        const saved = await api(`/farms/${farmId}`, { signal });
        if (signal.aborted) return;
        setRecord({ farmId, farm: saved });
        setLoading(false); setWeatherLoading(true);
        try {
          const dashboard = await api(`/dashboard/${farmId}`, { signal });
          if (signal.aborted) return;
          setWeather(dashboard.weather);
          setWeatherError(dashboard.warning || (dashboard.weather ? '' : 'Local weather is temporarily unavailable.'));
        } catch (error) {
          if (!signal.aborted) setWeatherError(error.message);
        } finally {
          if (!signal.aborted) setWeatherLoading(false);
        }
      } catch (error) {
        if (signal.aborted) return;
        const missing = error.status === 404 || error.message === 'Farm not found';
        setNotFound(missing); setError(error.message);
        setWeatherLoading(false);
        if (missing) setRecord(null);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [farmId, refresh]);

  async function downloadReport() {
    if (locked || !farm) return;
    const controller = new AbortController();
    reportController.current = controller;
    setReporting(true); setReportError(''); setReportMessage('');
    try {
      await downloadFarmReport(farm.id, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setReportMessage('PDF downloaded.');
      }
    } catch (error) {
      if (!controller.signal.aborted) setReportError(error.message);
    } finally {
      if (!controller.signal.aborted) setReporting(false);
      if (reportController.current === controller) reportController.current = null;
    }
  }

  async function save(body) {
    if (locked || !farm) return;
    const controller = new AbortController();
    mutationController.current = controller;
    loadController.current?.abort();
    setLoading(false); setWeatherLoading(false); setBusy('save'); setFormError('');
    try {
      const updated = await api(`/farms/${farm.id}`, { method: 'PUT', body, signal: controller.signal });
      if (controller.signal.aborted) return;
      setRecord({ farmId, farm: updated });
      setFormOpen(false); setActionMessage('Farm updated.');
      setWeather(null); setWeatherLoading(true);
      setRefresh(value => value + 1);
    } catch (error) {
      if (!controller.signal.aborted) setFormError(error.message);
    } finally {
      if (!controller.signal.aborted) setBusy('');
    }
  }

  async function remove() {
    if (locked || !farm) return;
    const controller = new AbortController();
    mutationController.current = controller;
    loadController.current?.abort();
    setLoading(false); setWeatherLoading(false); setBusy('delete'); setFormError('');
    try {
      await api(`/farms/${farm.id}`, { method: 'DELETE', signal: controller.signal });
      if (controller.signal.aborted) return;
      setDeleteOpen(false);
      navigate('/farms', { replace: true });
    } catch (error) {
      if (!controller.signal.aborted) setFormError(error.message);
    } finally {
      if (!controller.signal.aborted) setBusy('');
    }
  }

  return <>
    <Link className="back-link" to="/farms">← Back to my farms</Link>
    <header className="page-header farm-detail-header">
      <div>
        <span className="eyebrow">YOUR FIELD, IN FOCUS</span>
        <h1 ref={heading} tabIndex={-1}>{farm?.name || 'Farm details'}</h1>
        <p>{farm?.location || 'Your farm information and local weather.'}</p>
      </div>
      <div className="farm-detail-actions">
        <button className="secondary" disabled={loading || weatherLoading || locked} onClick={() => setRefresh(value => value + 1)}>
          {loading ? 'Loading…' : weatherLoading ? 'Loading weather…' : '↻ Refresh'}
        </button>
        {farm && <button className="primary" disabled={locked || loading} onClick={downloadReport}>
          {reporting ? 'Downloading PDF…' : '↓ Download PDF'}
        </button>}
      </div>
    </header>
    {farm && actionMessage && <div className="success" role="status">{actionMessage}</div>}
    {farm && reportMessage && <div className="success" role="status">{reportMessage}</div>}
    {farm && reportError && <div className="error" role="alert">{reportError} <button className="text-button" disabled={locked || loading} onClick={downloadReport}>Try download again</button></div>}
    {error && !notFound && <div className="error" role="alert">{error} <button className="text-button" disabled={loading || locked} onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
    {notFound ? <section className="card empty-state" role="status">
      <h2>Farm not found</h2>
      <p>This farm may have been deleted, or it may belong to another account.</p>
      <Link className="primary" to="/farms">View my farms</Link>
    </section> : !farm && loading ? <div className="card loading" role="status">Loading farm details…</div> : farm && <div className="farm-detail-grid">
      <section className="card farm-info-card" aria-labelledby="farm-info-heading">
        <div className="section-heading"><h2 id="farm-info-heading">Farm information</h2><span className="tag farm-detail-tag">{farm.crop}</span></div>
        <dl className="farm-info-grid">
          <div><dt>Farm name</dt><dd>{farm.name}</dd></div>
          <div><dt>Location</dt><dd>{farm.location}</dd></div>
          <div><dt>Current crop</dt><dd>{farm.crop}</dd></div>
          <div><dt>Soil type</dt><dd>{farm.soil_type}</dd></div>
          <div><dt>Area in acres</dt><dd>{farm.area_acres} acres</dd></div>
          <div><dt>Area in hectares</dt><dd>{(farm.area_acres * 0.40468564224).toFixed(4)} hectares</dd></div>
          <div><dt>Latitude</dt><dd>{farm.latitude}°</dd></div>
          <div><dt>Longitude</dt><dd>{farm.longitude}°</dd></div>
          <div><dt>Farm ID</dt><dd>{farm.id}</dd></div>
          <div><dt>Created</dt><dd>{formatFarmDate(farm.created_at)}</dd></div>
        </dl>
        <div className="farm-detail-management">
          <button className="secondary" disabled={locked || loading} onClick={() => { setFormError(''); setFormOpen(true); }}>Edit farm</button>
          <button className="text-button danger" disabled={locked || loading} onClick={() => { setFormError(''); setDeleteOpen(true); }}>Delete farm</button>
        </div>
      </section>
      <div>
        {weatherLoading ? <section className="card weather-card"><h2>Local weather</h2><p role="status">Loading weather and the three-day forecast…</p></section> : <>
          {weatherError && <div className="notice" role="status">{weatherError} Your farm information is still available. <button className="text-button" disabled={locked || loading} onClick={() => setRefresh(value => value + 1)}>Retry weather</button></div>}
          <WeatherCard weather={weather} farm={farm} />
        </>}
      </div>
    </div>}
    <FarmFormDialog open={formOpen && Boolean(farm)} farm={farm} busy={busy === 'save'} error={formError}
      onClose={() => { if (!busy) setFormOpen(false); }} onSave={save} />
    <FarmDeleteDialog open={deleteOpen && Boolean(farm)} farm={farm} busy={busy === 'delete'} error={formError}
      onClose={() => { if (!busy) setDeleteOpen(false); }} onConfirm={remove} />
  </>;
}
