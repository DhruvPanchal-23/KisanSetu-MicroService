import { Link } from 'react-router-dom';

export default function FarmCard({ farm, onEdit, onDelete, onDownload, reportBusy, isGenerating, actionsBusy = false }) {
  return <article className="card farm-card" aria-labelledby={`farm-${farm.id}-name`}>
    <div className={`farm-illustration crop-${farm.crop.toLowerCase()}`} aria-hidden="true"><span>✳</span><i /><i /><i /></div>
    <div className="farm-card-content">
      <div className="section-heading"><span className="tag">{farm.crop}</span><span className="muted">{farm.area_acres} acres</span></div>
      <h2 id={`farm-${farm.id}-name`}><Link className="farm-card-link" to={`/farms/${farm.id}`} aria-label={`View details for ${farm.name}`}>{farm.name}</Link></h2>
      <p className="muted">{farm.location}</p>
      <dl><div><dt>Soil type</dt><dd>{farm.soil_type}</dd></div><div><dt>Coordinates</dt><dd>{farm.latitude.toFixed(3)}, {farm.longitude.toFixed(3)}</dd></div></dl>
      <span className="farm-card-hint" aria-hidden="true">View farm details ↗</span>
      <button className="secondary report-button" disabled={reportBusy || actionsBusy} aria-label={`Download PDF for ${farm.name}`} onClick={() => onDownload(farm)}>{isGenerating ? 'Downloading PDF…' : '↓ Download PDF'}</button>
      <div className="farm-actions">
        <button className="secondary" disabled={actionsBusy} aria-label={`Edit ${farm.name}`} onClick={() => onEdit(farm)}>Edit farm</button>
        <button className="text-button danger" disabled={actionsBusy} aria-label={`Delete ${farm.name}`} onClick={() => onDelete(farm)}>Delete</button>
      </div>
    </div>
  </article>;
}
