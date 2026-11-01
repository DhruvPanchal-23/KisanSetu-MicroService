import express from 'express';

export function httpError(status, detail) {
  return Object.assign(new Error(typeof detail === 'string' ? detail : 'Request failed'), { status, detail });
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb', strict: false }));
  return app;
}

export async function requestService(url, { timeoutMs = 25000, ...options } = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw httpError(503, 'Service is temporarily unavailable');
  }
  if (!response.ok) {
    let detail = 'Service request failed';
    try { detail = (await response.json()).detail || detail; } catch { /* An unavailable proxy may return plain text. */ }
    throw httpError(response.status, detail);
  }
  return response;
}

export function start(app, defaultPort) {
  app.use((request, response) => response.status(404).json({ detail: 'Route not found' }));
  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return response.status(400).json({ detail: 'Request body must be valid JSON' });
    if (error.type === 'entity.too.large') return response.status(413).json({ detail: 'Request body is too large' });
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
    if (status === 500) console.error('Request failed:', error.message);
    response.status(status).json({ detail: status === 500 ? 'An unexpected server error occurred' : error.detail || error.message });
  });
  const PORT = Number(process.env.PORT) || defaultPort;
  const host = process.env.HOST || '0.0.0.0';
  const name = process.env.SERVICE_NAME || 'Service';
  const server = app.listen(PORT, host, () => console.log(`${name} running on port ${PORT}`));
  server.on('error', error => { console.error(`Cannot start ${name} on port ${PORT}:`, error.message); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { server.close(() => process.exit(0)); server.closeIdleConnections(); });
  }
  return server;
}
