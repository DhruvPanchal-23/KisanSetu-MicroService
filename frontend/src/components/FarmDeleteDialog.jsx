import { useEffect, useId, useRef } from 'react';

export default function FarmDeleteDialog({ open, farm, busy, error, onClose, onConfirm }) {
  const dialog = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (open && !element.open) {
      element.showModal();
      element.querySelector('.secondary')?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);
  useEffect(() => {
    const element = dialog.current;
    return () => { if (element.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className="farm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => {
    event.preventDefault();
    if (!busy) onClose();
  }}>
    <h2 id={titleId}>Delete {farm?.name}?</h2>
    <p id={descriptionId}>This permanently removes the farm from your account.</p>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="dialog-actions">
      <button type="button" className="secondary" disabled={busy} autoFocus onClick={onClose}>Keep farm</button>
      <button type="button" className="primary delete-button" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : 'Delete farm'}</button>
    </div>
  </dialog>;
}
