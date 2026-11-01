import { createHash, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { requestService } from '../shared/http.js';
import { CROPS, SOILS, validateFarm } from './models.js';

const LOCATIONS = [
  ['Pune, Maharashtra', 18.5204, 73.8567],
  ['Nashik, Maharashtra', 20.0059, 73.7910],
  ['Lucknow, Uttar Pradesh', 26.8467, 80.9462],
  ['Indore, Madhya Pradesh', 22.7196, 75.8577],
  ['Jaipur, Rajasthan', 26.9124, 75.7873],
  ['Mysuru, Karnataka', 12.2958, 76.6394],
];

export function generateFarms(count = 5, seed = null) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Count must be between 1 and 100');
  if (seed !== null && !Number.isSafeInteger(seed)) throw new Error('Seed must be a safe integer');
  const digest = seed === null ? randomBytes(32) : createHash('sha256').update(String(seed)).digest();
  const batch = digest.subarray(0, 8).toString('hex');
  let counter = 0;
  const random = () => createHash('sha256').update(digest).update(String(counter++)).digest().readUInt32BE(0) / 4294967296;
  const choose = (values) => values[Math.floor(random() * values.length)];
  return Array.from({ length: count }, (_, index) => {
    const [location, latitude, longitude] = choose(LOCATIONS);
    return validateFarm({
      name: `Demo Greenfield ${batch}-${String(index + 1).padStart(3, '0')}`,
      location: `Demo near ${location}`,
      latitude: Number((latitude + random() * 0.16 - 0.08).toFixed(6)),
      longitude: Number((longitude + random() * 0.16 - 0.08).toFixed(6)),
      area_acres: Number((1 + random() * 39).toFixed(2)),
      crop: choose(CROPS), soil_type: choose(SOILS),
    });
  });
}

function passwordPrompt() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('A secure password prompt is unavailable. Use an interactive terminal or KISANSETU_TOKEN.');
  }
  process.stdout.write('Account password: ');
  emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolvePassword, reject) => {
    let password = '';
    const finish = (error) => {
      process.stdin.removeListener('keypress', onKey);
      process.stdin.removeListener('end', onEnd);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolvePassword(password);
    };
    const onEnd = () => finish(new Error('No password received.'));
    const onKey = (text, key = {}) => {
      if ((key.ctrl && ['c', 'd'].includes(key.name))) return finish(new Error('Cancelled.'));
      if (['return', 'enter'].includes(key.name)) return finish();
      if (key.name === 'backspace') password = Array.from(password).slice(0, -1).join('');
      else if (text && !key.ctrl && !key.meta && (!key.name || Array.from(text).length === 1)) password += text;
    };
    process.stdin.on('keypress', onKey);
    process.stdin.once('end', onEnd);
  });
}

async function main() {
  let added = 0;
  let skipped = 0;
  try {
    const args = process.argv.slice(2).flatMap((argument) => {
      const match = argument.match(/^--(count|seed)(-?\d+)$/);
      return match ? [`--${match[1]}`, match[2]] : [argument];
    });
    const { values } = parseArgs({ args, options: {
      count: { type: 'string', default: '5' }, seed: { type: 'string' },
      email: { type: 'string' }, url: { type: 'string', default: 'http://localhost:8000' },
      help: { type: 'boolean', short: 'h' },
    } });
    if (values.help) {
      console.log('Add fictional demo farms to an existing account.\n\nUsage: node farm-service/seed.js [--url URL] [--email EMAIL] [--count 1-100] [--seed INTEGER]\n\nThe password is prompted without echo; KISANSETU_TOKEN skips login.\nSeeded names use a SHA-256 batch prefix. Matching names are skipped.');
      return;
    }
    if (!/^\d+$/.test(values.count)) throw new Error('--count must be between 1 and 100');
    if (values.seed !== undefined && !/^-?\d+$/.test(values.seed)) throw new Error('--seed must be a safe integer');
    const farms = generateFarms(Number(values.count), values.seed === undefined ? null : Number(values.seed));
    let gateway;
    try { gateway = new URL(values.url); } catch { throw new Error('--url must be a valid HTTP(S) gateway URL'); }
    if (!['http:', 'https:'].includes(gateway.protocol) || !gateway.hostname || gateway.username || gateway.password) {
      throw new Error('--url must be an HTTP(S) gateway URL without credentials');
    }
    let token = (process.env.KISANSETU_TOKEN || '').trim();
    const request = async (method, path, body) => {
      let response;
      try {
        response = await requestService(new URL(path, gateway), {
          method, redirect: 'error',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch (error) {
        if (error.status === 401) throw new Error('Sign-in failed or the token has expired. Check your credentials and try again.');
        throw new Error('Gateway request failed. Check --url and service health.');
      }
      try { return await response.json(); } catch { throw new Error('The gateway returned an unexpected response.'); }
    };
    if (!token) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error('Use an interactive terminal or set KISANSETU_TOKEN.');
      }
      let email = values.email;
      if (!email) {
        const terminal = createInterface({ input: process.stdin, output: process.stdout });
        try { email = await terminal.question('Account email: '); } finally { terminal.close(); }
      }
      const password = await passwordPrompt();
      if (!email.trim() || !password) throw new Error('An existing account email and password are required.');
      const login = await request('POST', '/api/auth/login', { email: email.trim(), password });
      if (typeof login.access_token !== 'string') throw new Error('The gateway returned an unexpected sign-in response.');
      token = login.access_token;
    }
    const existing = await request('GET', '/api/farms');
    if (!Array.isArray(existing)) throw new Error('The gateway returned an unexpected farm list.');
    const names = new Set(existing.map((farm) => farm.name));
    for (const farm of farms) {
      if (names.has(farm.name)) { skipped += 1; continue; }
      await request('POST', '/api/farms', farm);
      names.add(farm.name);
      added += 1;
    }
    console.log(`Added ${added} demo farms; skipped ${skipped} existing demo farms.`);
  } catch (error) {
    console.error(`${error.message} Added ${added}; skipped ${skipped}.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
