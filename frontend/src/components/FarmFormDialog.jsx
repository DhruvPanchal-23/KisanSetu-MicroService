import { useEffect, useId, useRef } from 'react';

const crops = ['Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane', 'Soybean'];
const soils = ['Alluvial', 'Black', 'Red', 'Loamy', 'Sandy', 'Clay'];

export default function FarmFormDialog({ open, farm = null, busy, error, onClose, onSave }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (open && !element.open) {
      element.showModal();
      element.querySelector('input[name="name"]')?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);
  useEffect(() => {
    const element = dialog.current;
    return () => { if (element.open) element.close(); };
  }, []);
  function submit(event) {
    event.preventDefault();
    if (busy) return;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    ['latitude', 'longitude', 'area_acres'].forEach(key => { body[key] = Number(body[key]); });
    onSave(body);
  }
  return <dialog ref={dialog} className="farm-dialog" aria-labelledby={titleId} onCancel={event => {
    event.preventDefault();
    if (!busy) onClose();
  }}>
    <div className="section-heading">
      <div><span className="eyebrow">YOUR FIELD DETAILS</span><h2 id={titleId}>{farm ? 'Edit farm' : 'Add a new farm'}</h2></div>
      <button type="button" className="close-button" aria-label="Close form" disabled={busy} onClick={onClose}>×</button>
    </div>
    <form key={`${open}-${farm?.id || 'new'}`} onSubmit={submit}>
      <fieldset className="farm-form-fields" disabled={busy}>
        <label>Farm name<input name="name" placeholder="e.g. Riverside Farm" defaultValue={farm?.name} minLength="2" maxLength="80" required autoFocus /></label>
        <label>Location<input name="location" placeholder="Village or city, state" defaultValue={farm?.location} minLength="2" maxLength="120" required /></label>
        <div className="form-row">
          <label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" placeholder="e.g. 18.5204" defaultValue={farm?.latitude} required /></label>
          <label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" placeholder="e.g. 73.8567" defaultValue={farm?.longitude} required /></label>
        </div>
        <p className="field-hint">Use the farm’s coordinates from your map app for accurate local weather.</p>
        <div className="form-row">
          <label>Area (acres)<input name="area_acres" type="number" step="any" min="0" max="100000" defaultValue={farm?.area_acres} required /></label>
          <label>Current crop<select name="crop" defaultValue={farm?.crop || 'Rice'}>{crops.map(crop => <option key={crop}>{crop}</option>)}</select></label>
        </div>
        <label>Soil type<select name="soil_type" defaultValue={farm?.soil_type || 'Alluvial'}>{soils.map(soil => <option key={soil}>{soil}</option>)}</select></label>
      </fieldset>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="dialog-actions">
        <button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save farm →'}</button>
      </div>
    </form>
  </dialog>;
}
