const BASE = (import.meta.env.VITE_API_URL?.trim() || '/api').replace(/\/+$/, '');

export async function api(path, { method = 'GET', body, signal, responseType = 'json' } = {}) {
  const token = sessionStorage.getItem('kisansetu_token');
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method, signal,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach KisanSetu. Check your connection and make sure the services are running.');
  }
  if (response.ok && responseType === 'blob') return response.blob();
  let data = null;
  if (response.status !== 204) {
    try { data = await response.json(); } catch { /* Handle unavailable proxy responses below. */ }
  }
  if (!response.ok) {
    if (response.status === 401 && token) {
      sessionStorage.removeItem('kisansetu_token');
      window.dispatchEvent(new Event('session-expired'));
    }
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map(item => `${item.loc.at(-1)}: ${item.msg}`).join('. ')
      : typeof detail === 'string' ? detail : 'Something went wrong. Please try again.';
    throw Object.assign(new Error(message), { status: response.status });
  }
  if (response.status !== 204 && data === null) throw new Error('The server returned an unreadable response. Please try again.');
  return data;
}

export async function downloadFarmReport(farmId, { signal } = {}) {
  const blob = await api(`/farms/${farmId}/report`, { responseType: 'blob', signal });
  signal?.throwIfAborted();
  if (blob.type.split(';')[0].toLowerCase() !== 'application/pdf') {
    throw new Error('The report was not returned as a PDF. Please try again.');
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `farm-${farmId}-report.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
