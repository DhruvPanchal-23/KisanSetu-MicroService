import { createApp, httpError, requestService, start } from '../shared/http.js';

const urls = {
  auth: process.env.AUTH_URL || 'http://localhost:8001',
  farm: process.env.FARM_URL || 'http://localhost:8002',
  weather: process.env.WEATHER_URL || 'http://localhost:8003',
};
const origins = new Set((process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',').map(value => value.trim()).filter(Boolean));

export const app = createApp();

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && origins.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.vary('Origin');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Max-Age', '600');
    }
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function upstream(req, service, path, method = 'GET', body) {
  const headers = { Authorization: req.get('Authorization') || '' };
  const options = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  return requestService(urls[service].replace(/\/$/, '') + path, options);
}

function jsonBody(req) {
  if (req.body === undefined) throw httpError(400, 'Request body must be valid JSON');
  return req.body;
}

async function sendResponse(res, response, report = false) {
  res.status(response.status);
  if (response.status === 204) return res.end();
  if (report) {
    for (const name of ['content-type', 'content-disposition', 'cache-control']) {
      const value = response.headers.get(name);
      if (value) res.set(name, value);
    }
  } else {
    res.type('application/json');
  }
  res.send(Buffer.from(await response.arrayBuffer()));
}

app.get('/health', async (_req, res) => {
  const services = Object.fromEntries(await Promise.all(Object.entries(urls).map(async ([name, url]) => {
    try {
      const response = await requestService(url.replace(/\/$/, '') + '/health', { timeoutMs: 3000 });
      await response.arrayBuffer();
      return [name, response.status === 200 ? 'ok' : 'unavailable'];
    } catch {
      return [name, 'unavailable'];
    }
  })));
  res.json({ status: Object.values(services).every(value => value === 'ok') ? 'ok' : 'degraded', services });
});

app.get('/docs', (_req, res) => res.json({
  title: 'KisanSetu Gateway',
  endpoints: [
    'GET /health', 'POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me',
    'GET /api/farms', 'POST /api/farms', 'GET /api/farms/:id', 'PUT /api/farms/:id',
    'DELETE /api/farms/:id', 'GET /api/farms/:id/report', 'GET /api/dashboard/:id',
  ],
}));

app.get('/api/dashboard/:farmId', async (req, res) => {
  const farm = await (await upstream(req, 'farm', `/farms/${encodeURIComponent(req.params.farmId)}`)).json();
  let weather = null;
  let warning = null;
  try {
    const query = new URLSearchParams({ latitude: farm.latitude, longitude: farm.longitude });
    weather = await (await upstream(req, 'weather', `/weather?${query}`)).json();
  } catch (error) {
    if (error.status && error.status < 500) throw error;
    warning = error.detail || 'Weather service is temporarily unavailable';
  }
  res.json({ farm, weather, warning });
});

app.all('/api/auth/:action', async (req, res) => {
  const { action } = req.params;
  if (!['POST login', 'POST register', 'GET me'].includes(`${req.method} ${action}`)) {
    throw httpError(404, 'Route not found');
  }
  const response = await upstream(req, 'auth', `/${action}`, req.method,
    req.method === 'POST' ? jsonBody(req) : undefined);
  await sendResponse(res, response);
});

app.get('/api/farms/:farmId/report', async (req, res) => {
  const response = await upstream(req, 'farm', `/farms/${encodeURIComponent(req.params.farmId)}/report`);
  await sendResponse(res, response, true);
});

async function farms(req, res) {
  const path = '/farms' + (req.params.farmId === undefined ? '' : `/${encodeURIComponent(req.params.farmId)}`);
  const response = await upstream(req, 'farm', path, req.method,
    ['POST', 'PUT'].includes(req.method) ? jsonBody(req) : undefined);
  await sendResponse(res, response);
}

app.route('/api/farms').get(farms).post(farms);
app.route('/api/farms/:farmId').get(farms).put(farms).delete(farms);

start(app, 8000);
