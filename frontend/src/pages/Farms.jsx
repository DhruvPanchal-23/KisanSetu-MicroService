import { useEffect, useRef, useState } from 'react';
import { api, downloadFarmReport } from '../services/api';
import FarmCard from '../components/FarmCard';
import FarmFormDialog from '../components/FarmFormDialog';
import FarmDeleteDialog from '../components/FarmDeleteDialog';

export default function Farms() {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState('');
  const [reportError, setReportError] = useState('');
  const [reporting, setReporting] = useState(null);
  const loadController = useRef(null);
  const mutationController = useRef(null);
  const reportController = useRef(null);
  const heading = useRef(null);
  const locked = Boolean(busy) || reporting !== null;

  async function load() {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setError(''); setLoading(true);
    try {
      const rows = await api('/farms', { signal: controller.signal });
      if (!controller.signal.aborted) setFarms(rows);
    } catch (error) {
      if (!controller.signal.aborted) setError(error.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    heading.current?.focus();
    load();
    return () => {
      loadController.current?.abort();
      mutationController.current?.abort();
      reportController.current?.abort();
    };
  }, []);
  function open(farm = null) {
    if (locked) return;
    setEditing(farm); setFormError(''); setFormOpen(true);
  }
  async function save(body) {
    if (locked) return;
    const controller = new AbortController();
    mutationController.current = controller;
    setBusy('save'); setFormError('');
    try {
      const farm = await api(editing ? `/farms/${editing.id}` : '/farms', {
        method: editing ? 'PUT' : 'POST', body, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setFarms(current => editing ? current.map(item => item.id === farm.id ? farm : item) : [farm, ...current]);
      setFormOpen(false); setMessage(editing ? 'Farm updated.' : 'Your new farm has been added.');
    } catch (error) {
      if (!controller.signal.aborted) setFormError(error.message);
    } finally {
      if (!controller.signal.aborted) setBusy('');
    }
  }
  async function remove() {
    if (locked || !deleting) return;
    const controller = new AbortController();
    mutationController.current = controller;
    setBusy('delete'); setFormError('');
    try {
      await api(`/farms/${deleting.id}`, { method: 'DELETE', signal: controller.signal });
      if (controller.signal.aborted) return;
      setFarms(current => current.filter(farm => farm.id !== deleting.id));
      setDeleting(null); setMessage('Farm deleted.');
      requestAnimationFrame(() => heading.current?.focus());
    } catch (error) {
      if (!controller.signal.aborted) setFormError(error.message);
    } finally {
      if (!controller.signal.aborted) setBusy('');
    }
  }
  async function downloadReport(farm) {
    if (locked) return;
    const controller = new AbortController();
    reportController.current = controller;
    setReporting(farm.id); setReportError(''); setMessage('');
    try {
      await downloadFarmReport(farm.id, { signal: controller.signal });
      if (!controller.signal.aborted) setMessage('PDF downloaded.');
    } catch (error) {
      if (!controller.signal.aborted) setReportError(error.message);
    } finally {
      if (!controller.signal.aborted) setReporting(null);
    }
  }
  return <>
    <header className="page-header">
      <div><span className="eyebrow">A PLACE FOR EVERY ACRE</span><h1 ref={heading} tabIndex={-1}>My farms</h1><p>Your land, beautifully organized.</p></div>
      <button className="primary" disabled={locked} onClick={() => open()}>+ Add a farm</button>
    </header>
    {message && <div className="success" role="status">{message}</div>}
    {reportError && <div className="error" role="alert">{reportError} Use Download PDF to try again.</div>}
    {error && <div className="error" role="alert">{error} <button className="text-button" disabled={loading || locked} onClick={load}>Try again</button></div>}
    <div className="section-heading">
      <h2>Your fields <span className="count">{farms.length}</span></h2>
      <span className="muted">{farms.reduce((sum, farm) => sum + farm.area_acres, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} acres in total</span>
    </div>
    {loading ? <div className="card loading" role="status">Loading your farms…</div> : !farms.length && !error ? <div className="card empty-state">
      <span aria-hidden="true">♧</span><h2>Give your farm a home.</h2><p>Add your location and crop details to keep track of your fields and weather.</p>
      <button className="primary" disabled={locked} onClick={() => open()}>+ Add your first farm</button>
    </div> : <div className="farms-grid">{farms.map(farm => <FarmCard key={farm.id} farm={farm} onEdit={open} onDownload={downloadReport}
      reportBusy={locked} isGenerating={reporting === farm.id} actionsBusy={locked}
      onDelete={farm => { if (!locked) { setDeleting(farm); setFormError(''); } }} />)}</div>}
    <FarmFormDialog open={formOpen} farm={editing} busy={busy === 'save'} error={formError}
      onClose={() => { if (!busy) setFormOpen(false); }} onSave={save} />
    <FarmDeleteDialog open={Boolean(deleting)} farm={deleting} busy={busy === 'delete'} error={formError}
      onClose={() => { if (!busy) setDeleting(null); }} onConfirm={remove} />
  </>;
}
