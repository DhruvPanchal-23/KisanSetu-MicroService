import { createApp, httpError, start } from '../shared/http.js';
import { fetchWeather } from './weather.js';

export const app = createApp();

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/weather', async (req, res) => {
  const coordinates = {};
  for (const [name, min, max] of [['latitude', -90, 90], ['longitude', -180, 180]]) {
    const value = req.query[name];
    const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    if (!Number.isFinite(number) || number < min || number > max) {
      throw httpError(422, `${name} must be a finite number between ${min} and ${max}`);
    }
    coordinates[name] = number;
  }
  try {
    res.json(await fetchWeather(coordinates.latitude, coordinates.longitude));
  } catch {
    throw httpError(503, 'Weather is temporarily unavailable. Please try again later.');
  }
});

start(app, 8003);
