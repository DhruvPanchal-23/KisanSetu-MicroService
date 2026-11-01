import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, httpError, requestService, start } from '../shared/http.js';
import { farms } from './database.js';
import { validateFarm } from './models.js';
import { renderReport } from './report.js';

const AUTH_URL = (process.env.AUTH_URL || 'http://localhost:8001').replace(/\/$/, '');
export const app = createApp();

async function owner(request) {
  try {
    const response = await requestService(`${AUTH_URL}/me`, {
      timeoutMs: 10000, headers: { Authorization: request.get('Authorization') || '' },
    });
    const user = await response.json();
    if (!Number.isSafeInteger(user.id)) throw httpError(503, 'Authentication service is unavailable');
    return user.id;
  } catch (error) {
    if (error.status === 401) throw httpError(401, 'Please sign in again');
    throw httpError(503, 'Authentication service is unavailable');
  }
}

function farmId(request) {
  const value = request.params.farmId;
  if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw httpError(422, 'Farm ID must be an integer');
  }
  return Number(value);
}

async function getFarm(id, userId) {
  const farm = await farms.get(id, userId);
  if (!farm) throw httpError(404, 'Farm not found');
  return farm;
}

app.get('/health', async (request, response) => {
  try { await farms.health(); response.json({ status: 'ok' }); }
  catch { response.status(503).json({ status: 'unavailable' }); }
});

app.get('/farms', async (request, response) => {
  const userId = await owner(request);
  response.json(await farms.list(userId));
});

app.get('/farms/:farmId', async (request, response) => {
  const userId = await owner(request);
  response.json(await getFarm(farmId(request), userId));
});

app.get('/farms/:farmId/report', async (request, response) => {
  const userId = await owner(request);
  const id = farmId(request);
  const farm = await getFarm(id, userId);
  const report = await renderReport(farm);
  response.set({ 'Content-Disposition': `attachment; filename="farm-${id}-report.pdf"`, 'Cache-Control': 'no-store' });
  response.type('application/pdf').send(report);
});

app.post('/farms', async (request, response) => {
  const userId = await owner(request);
  const farm = validateFarm(request.body);
  response.status(201).json(await farms.create(userId, farm));
});

app.put('/farms/:farmId', async (request, response) => {
  const userId = await owner(request);
  const id = farmId(request);
  const farm = validateFarm(request.body);
  const updated = await farms.update(id, userId, farm);
  if (!updated) throw httpError(404, 'Farm not found');
  response.json(updated);
});

app.delete('/farms/:farmId', async (request, response) => {
  const userId = await owner(request);
  if (!await farms.remove(farmId(request), userId)) throw httpError(404, 'Farm not found');
  response.status(204).end();
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start(app, 8002);
