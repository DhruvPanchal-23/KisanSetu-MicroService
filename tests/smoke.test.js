import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createServer as createSocketServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { validateFarm } from '../farm-service/models.js';
import { generateFarms } from '../farm-service/seed.js';
import { getFarmSeedReference } from '../farm-service/seed-reference.js';
import { fetchWeather } from '../weather-service/weather.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SECRET = 'integration-only-secret-with-at-least-32-characters';
const WEATHER = {
  temperature: 35, humidity: 85, precipitation: 0, wind_speed: 25,
  weather_code: 0, observed_at: '2026-10-18T12:00', timezone: 'Asia/Kolkata',
  source: 'Test fixture', forecast: [{ date: '2026-10-18', high: 35, low: 23, rain: 12 }],
};

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

function launch(script, env, args = []) {
  const child = spawn(process.execPath, [join(ROOT, script), ...args], {
    cwd: ROOT, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const done = new Promise(resolve => {
    child.once('error', error => resolve({ code: null, error }));
    child.once('close', code => resolve({ code }));
  });
  return { child, done, output: () => output };
}

async function checkReport(response, farmId) {
  assert.equal(response.status, 200, response.text);
  assert.match(response.headers.get('content-type'), /^application\/pdf\b/i);
  assert.match(response.headers.get('content-disposition'), /attachment/i);
  assert.ok(response.headers.get('content-disposition').includes(`farm-${farmId}-report.pdf`));
  assert.equal(Buffer.from(response.bytes.subarray(0, 5)).toString(), '%PDF-');
  const task = getDocument({ data: new Uint8Array(response.bytes), useSystemFonts: false });
  try {
    const pdf = await task.promise;
    assert.ok(pdf.numPages >= 1, 'The report must contain a readable PDF page');
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent();
      pages.push(content.items.map(item => item.str || '').join(' '));
    }
    return pages.join(' ').replace(/\s+/g, ' ').normalize('NFC');
  } finally {
    await task.destroy();
  }
}

test('weather provider mapping works without an external request', async () => {
  const result = await fetchWeather(18.5, 73.8, {
    fetchImpl: async url => {
      const params = new URL(url).searchParams;
      assert.equal(params.get('latitude'), '18.5');
      assert.equal(params.get('longitude'), '73.8');
      assert.ok(params.get('current').includes('temperature_2m'));
      return new Response(JSON.stringify({
        current: {
          temperature_2m: 29, relative_humidity_2m: 70, precipitation: 0,
          wind_speed_10m: 8, weather_code: 2, time: '2026-10-18T12:00',
        },
        timezone: 'Asia/Kolkata', daily: {
          time: ['2026-10-18'], temperature_2m_max: [31],
          temperature_2m_min: [22], precipitation_sum: [4],
        },
      }), { headers: { 'content-type': 'application/json' } });
    },
  });
  assert.equal(result.temperature, 29);
  assert.equal(result.forecast[0].rain, 4);
  assert.equal(result.timezone, 'Asia/Kolkata');
});

test('demo farm generation is valid, random, repeatable, and bounded', () => {
  const farms = generateFarms(100, 42);
  assert.equal(generateFarms().length, 5);
  assert.deepEqual(farms, generateFarms(100, 42));
  assert.notDeepEqual(farms, generateFarms(100, 43));
  assert.notDeepEqual(generateFarms(), generateFarms());
  assert.equal(farms.length, 100);
  assert.equal(new Set(farms.map(farm => farm.name)).size, 100);
  for (const farm of farms) {
    assert.match(farm.name, /^Demo /);
    assert.deepEqual(validateFarm(farm), farm);
  }
  for (const count of [0, 101, 1.5]) assert.throws(() => generateFarms(count));
});

test('services preserve accounts and support farms, reports, ownership, and safe seeding', { timeout: 90_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kisansetu-smoke-'));
  const processes = [];
  let weatherUnavailable = false;
  const weatherServer = createServer((request, response) => {
    const unavailable = request.url.startsWith('/weather') && weatherUnavailable;
    response.writeHead(unavailable ? 503 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(unavailable ? { detail: 'Weather temporarily unavailable' }
      : request.url === '/health' ? { status: 'ok' } : WEATHER));
  });
  const reservations = [];
  try {
    const ports = { weather: await listen(weatherServer) };
    for (const name of ['auth', 'farm', 'gateway']) {
      const socket = createSocketServer();
      reservations.push(socket);
      ports[name] = await listen(socket);
    }

    const authDb = new DatabaseSync(join(directory, 'auth.db'));
    authDb.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL)');
    const savedHash = await argon2.hash('Stored-password-123', { type: argon2.argon2id });
    const savedToken = jwt.sign({}, SECRET, { algorithm: 'HS256', issuer: 'kisansetu', subject: '99', expiresIn: '8h' });
    authDb.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run(99, 'Saved Farmer', 'stored@example.com', savedHash);
    authDb.close();
    const farmDb = new DatabaseSync(join(directory, 'farm.db'));
    farmDb.exec(`CREATE TABLE farms (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL,
      location TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
      area_acres REAL NOT NULL, crop TEXT NOT NULL, soil_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    farmDb.prepare('INSERT INTO farms (id, user_id, name, location, latitude, longitude, area_acres, crop, soil_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(88, 99, 'Saved Farm', 'Pune, Maharashtra', 18.5, 73.8, 5, 'Rice', 'Black', '2024-06-15 19:45:00');
    farmDb.close();

    const env = {
      ...process.env, MONGODB_URI: '', HOST: '127.0.0.1', JWT_SECRET: SECRET,
      ...Object.fromEntries(Object.entries(ports).map(([name, port]) => [`${name.toUpperCase()}_URL`, `http://127.0.0.1:${port}`])),
    };
    await Promise.all(reservations.map(closeServer));
    for (const [name, folder] of [['auth', 'auth-service'], ['farm', 'farm-service'], ['gateway', 'gateway']]) {
      processes.push(launch(`${folder}/main.js`, {
        ...env, PORT: String(ports[name]), DATABASE_PATH: join(directory, `${name}.db`),
      }));
    }

    const baseUrl = `http://127.0.0.1:${ports.gateway}`;
    let accessToken;
    async function api(path, { method = 'GET', json, raw, token = accessToken } = {}) {
      const headers = {};
      if (token) headers.authorization = `Bearer ${token}`;
      if (json !== undefined || raw !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(baseUrl + path, {
        method, headers, body: raw ?? (json === undefined ? undefined : JSON.stringify(json)),
        signal: AbortSignal.timeout(10_000),
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text = response.headers.get('content-type')?.includes('application/pdf')
        ? '' : new TextDecoder().decode(bytes);
      let data;
      if (response.headers.get('content-type')?.includes('application/json') && text) data = JSON.parse(text);
      return { status: response.status, headers: response.headers, bytes, text, data };
    }

    let healthy = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await api('/health');
        if (response.status === 200 && response.data.status === 'ok') {
          healthy = true;
          break;
        }
      } catch {}
      if (processes.some(process => process.child.exitCode !== null)) break;
      await delay(100);
    }
    assert.ok(healthy, 'Services did not become healthy');
    assert.equal((await api('/api/farms')).status, 401);
    assert.equal((await api('/api/farms/1/report')).status, 401);

    const savedLogin = await api('/api/auth/login', {
      method: 'POST', json: { email: 'stored@example.com', password: 'Stored-password-123' },
    });
    assert.equal(savedLogin.status, 200, savedLogin.text);
    assert.equal(savedLogin.data.user.id, 99);
    assert.equal((await api('/api/auth/me', { token: savedToken })).data.name, 'Saved Farmer');
    assert.equal((await api('/api/farms', { token: savedToken })).data[0].id, 88);
    const savedReport = await checkReport(await api('/api/farms/88/report', { token: savedToken }), 88);
    for (const value of ['2024-06-15 19:45:00', 'Farm added 2024-06-16', 'Seed record date', '2024-06-16', 'Maharashtra', 'Synthetic demo data']) {
      assert.ok(savedReport.includes(value), `Saved farm report must include ${value}`);
    }

    assert.equal((await api('/api/auth/register', {
      method: 'POST', json: { name: 'Test', email: 'bad', password: 'short' },
    })).status, 422);
    const account = { name: 'Test Farmer', email: 'farmer@example.com', password: 'Long-password-123' };
    const registration = await api('/api/auth/register', { method: 'POST', json: account });
    assert.equal(registration.status, 201, registration.text);
    accessToken = registration.data.access_token;
    assert.deepEqual(Object.keys(registration.data.user).sort(), ['email', 'id', 'name']);
    assert.equal((await api('/api/auth/register', { method: 'POST', json: account })).status, 409);
    assert.equal((await api('/api/auth/login', {
      method: 'POST', json: { ...account, password: 'wrong-password' },
    })).status, 401);
    assert.equal((await api('/api/auth/login', {
      method: 'POST', json: { ...account, email: 'FARMER@example.com' },
    })).status, 200);
    assert.equal((await api('/api/auth/me')).data.name, 'Test Farmer');
    assert.deepEqual((await api('/api/farms')).data, []);

    const farm = {
      name: 'Test Farm', location: 'Pune, Maharashtra', latitude: 18.5, longitude: 73.8,
      area_acres: 5, crop: 'Rice', soil_type: 'Clay',
    };
    for (const change of [{ area_acres: -1 }, { latitude: 100 }, { name: '   ' }, { crop: 'Invalid' }]) {
      assert.equal((await api('/api/farms', { method: 'POST', json: { ...farm, ...change } })).status, 422);
    }
    const created = await api('/api/farms', { method: 'POST', json: farm });
    assert.equal(created.status, 201, created.text);
    const farmId = created.data.id;
    assert.equal((await api('/api/farms')).data.length, 1);
    const report = await api(`/api/farms/${farmId}/report`);
    const reportText = await checkReport(report, farmId);
    for (const value of ['Test Farm', 'Pune', 'Rice', 'Clay', '18.5', '73.8', (5 * 0.40468564224).toFixed(4)]) {
      assert.ok(reportText.includes(value), `Report must include ${value}`);
    }
    assert.ok(reportText.includes('Soil differs: this farm has Clay soil'));
    assert.ok(reportText.includes('Not calculated: soil does not match.'));
    assert.equal((await api('/api/farms/999999/report')).status, 404);
    const unsafe = await api('/api/farms', {
      method: 'POST', json: { ...farm, name: '<script>alert(1)</script>', location: 'Pune & <b>west</b>' },
    });
    assert.equal(unsafe.status, 201, unsafe.text);
    const literalText = await checkReport(await api(`/api/farms/${unsafe.data.id}/report`), unsafe.data.id);
    assert.ok(literalText.includes('<script>alert(1)</script>'));
    assert.ok(literalText.includes('Pune & <b>west</b>'));
    assert.equal((await api(`/api/farms/${unsafe.data.id}`, { method: 'DELETE' })).status, 204);
    const unicodeFarm = {
      ...farm, name: `राम शेत ${'Greenfield '.repeat(7).trim()}`.slice(0, 80),
      location: `पुणे महाराष्ट्र ${'North Field '.repeat(10).trim()}`.slice(0, 120),
    };
    const unicode = await api('/api/farms', { method: 'POST', json: unicodeFarm });
    assert.equal(unicode.status, 201, unicode.text);
    const unicodeText = await checkReport(await api(`/api/farms/${unicode.data.id}/report`), unicode.data.id);
    for (const value of [unicodeFarm.name, unicodeFarm.location]) {
      assert.ok(unicodeText.replace(/\s/g, '').includes(value.normalize('NFC').replace(/\s/g, '')),
        `PDF must retain the complete Unicode field: ${value}`);
    }
    assert.equal((await api(`/api/farms/${unicode.data.id}`, { method: 'DELETE' })).status, 204);

    const dashboard = await api(`/api/dashboard/${farmId}`);
    assert.equal(dashboard.status, 200, dashboard.text);
    assert.deepEqual(Object.keys(dashboard.data).sort(), ['farm', 'warning', 'weather']);
    assert.equal(dashboard.data.weather.temperature, 35);
    assert.equal(dashboard.data.farm.id, farmId);
    assert.equal(dashboard.data.warning, null);
    weatherUnavailable = true;
    const degraded = await api(`/api/dashboard/${farmId}`);
    assert.equal(degraded.status, 200, degraded.text);
    assert.deepEqual(Object.keys(degraded.data).sort(), ['farm', 'warning', 'weather']);
    assert.equal(degraded.data.farm.id, farmId);
    assert.equal(degraded.data.weather, null);
    assert.ok(degraded.data.warning);
    await checkReport(await api(`/api/farms/${farmId}/report`), farmId);
    weatherUnavailable = false;

    const second = await api('/api/auth/register', {
      method: 'POST', json: { ...account, email: 'other@example.com' },
    });
    assert.equal(second.status, 201, second.text);
    const otherToken = second.data.access_token;
    assert.deepEqual((await api('/api/farms', { token: otherToken })).data, []);
    for (const method of ['GET', 'PUT', 'DELETE']) {
      assert.equal((await api(`/api/farms/${farmId}`, {
        method, token: otherToken, ...(method === 'PUT' ? { json: farm } : {}),
      })).status, 404);
    }
    assert.equal((await api(`/api/dashboard/${farmId}`, { token: otherToken })).status, 404);
    assert.equal((await api(`/api/farms/${farmId}/report`, { token: otherToken })).status, 404);
    const claims = { sub: String(registration.data.user.id), iat: 1, exp: 2, iss: 'kisansetu' };
    for (const token of [
      'broken',
      jwt.sign(claims, SECRET, { algorithm: 'HS256' }),
      jwt.sign({ ...claims, exp: 4102444800 }, SECRET, { algorithm: 'HS384' }),
      jwt.sign({ ...claims, iat: Math.floor(Date.now() / 1000) + 3600, exp: 4102444800 }, SECRET, { algorithm: 'HS256' }),
      jwt.sign({ sub: claims.sub, iat: 1, iss: 'kisansetu' }, SECRET, { algorithm: 'HS256' }),
    ]) assert.equal((await api('/api/auth/me', { token })).status, 401);

    const updated = await api(`/api/farms/${farmId}`, { method: 'PUT', json: { ...farm, name: 'Updated Farm', area_acres: 10, crop: 'Wheat', soil_type: 'Black' } });
    assert.equal(updated.status, 200, updated.text);
    assert.equal(updated.data.name, 'Updated Farm');
    assert.equal(updated.data.created_at, created.data.created_at, 'Editing must preserve the farm added date');
    const updatedReport = await checkReport(await api(`/api/farms/${farmId}/report`), farmId);
    assert.ok(updatedReport.includes('Updated Farm'));
    assert.ok(!updatedReport.includes('Test Farm'));
    assert.ok(updatedReport.includes('Wheat'));
    const reference = getFarmSeedReference(updated.data);
    assert.equal(reference.soilMatches, true);
    assert.ok(updatedReport.includes(reference.record.date));
    assert.ok(updatedReport.includes(`${reference.waterLitres.toLocaleString('en-IN', { maximumFractionDigits: 2 })} litres`), 'Report volume must use the updated saved acreage');
    assert.equal((await api(`/api/farms/${farmId}`, { method: 'DELETE' })).status, 204);
    assert.deepEqual((await api('/api/farms')).data, []);
    assert.equal((await api(`/api/farms/${farmId}`)).status, 404);
    assert.equal((await api(`/api/farms/${farmId}/report`)).status, 404);
    assert.equal((await api('/api/auth/login', { method: 'POST', raw: '{invalid' })).status, 400);

    let seededFarms;
    for (let attempt = 0; attempt < 2; attempt++) {
      const seeder = launch('farm-service/seed.js', { ...env, KISANSETU_TOKEN: accessToken }, [
        '--url', baseUrl, '--seed', '42', '--count', '3',
      ]);
      processes.push(seeder);
      const completed = await Promise.race([
        seeder.done,
        delay(30_000, { code: null, error: new Error('Seed CLI timed out') }, { ref: false }),
      ]);
      assert.equal(completed.code, 0, `${completed.error ?? ''}\n${seeder.output()}`);
      const farms = (await api('/api/farms')).data;
      assert.equal(farms.length, 3);
      assert.ok(farms.every(farm => farm.name.startsWith('Demo ')));
      if (seededFarms) assert.deepEqual(farms, seededFarms, 'Repeated seeding must preserve farm IDs and avoid duplicates');
      seededFarms = farms;
    }
    assert.deepEqual((await api('/api/farms', { token: otherToken })).data, []);
    assert.equal((await api('/api/farms', { token: savedToken })).data[0].id, 88);
  } catch (error) {
    for (const process of processes) console.error(process.output());
    throw error;
  } finally {
    for (const process of processes) if (process.child.exitCode === null) process.child.kill();
    await Promise.all(processes.map(process => process.done));
    for (const reservation of reservations) if (reservation.listening) await closeServer(reservation);
    if (weatherServer.listening) {
      weatherServer.closeAllConnections();
      await closeServer(weatherServer);
    }
    await rm(directory, { recursive: true, force: true });
  }
});
