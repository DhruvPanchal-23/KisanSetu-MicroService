export function formatFarmDate(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Not available';
  const timestamp = value.trim().replace(' ', 'T');
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
  if (Number.isNaN(date.getTime())) return 'Not available';
  const calendar = timestamp.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(calendar)) {
    const day = new Date(`${calendar}T00:00:00Z`);
    if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== calendar) return 'Not available';
  }
  return `${date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })} IST`;
}
