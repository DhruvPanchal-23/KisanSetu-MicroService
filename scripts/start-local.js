import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const envFile = resolve(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) {
  console.error('Set a random JWT_SECRET of at least 32 characters in .env first.');
  process.exit(1);
}
const frontend = process.argv.includes('--frontend');
const vite = resolve(root, 'frontend/node_modules/vite/bin/vite.js');
if (frontend && !existsSync(vite)) {
  console.error('Install frontend dependencies first: npm run setup');
  process.exit(1);
}
const env = { ...process.env, HOST: '127.0.0.1', AUTH_URL: 'http://127.0.0.1:8001',
  FARM_URL: 'http://127.0.0.1:8002', WEATHER_URL: 'http://127.0.0.1:8003' };
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const [folder, port] of [['auth-service', 8001], ['farm-service', 8002], ['weather-service', 8003], ['gateway', 8000]]) {
  children.push(spawn(process.execPath, [resolve(root, folder, 'main.js')], { cwd: root,
    env: { ...env, PORT: String(port) }, stdio: 'inherit' }));
}
if (frontend) children.push(spawn(process.execPath, [vite, '--host', '127.0.0.1', '--strictPort'], { cwd: resolve(root, 'frontend'), env, stdio: 'inherit' }));
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
console.log(frontend ? 'Open http://localhost:5173. Press Ctrl+C to stop.' : 'Backend: http://localhost:8000. Press Ctrl+C to stop.');
