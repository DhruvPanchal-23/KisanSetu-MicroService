import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import { users } from './database.js';
import { createApp, httpError, start } from '../shared/http.js';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || secret.startsWith('replace-')) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 characters');
}
const dummyHash = await argon2.hash('invalid-password-placeholder', { type: argon2.argon2id });
const app = createApp();
const publicUser = row => ({ id: row.id, name: row.name, email: row.email });

function credentials(body, registration = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(422, 'Enter valid account details');
  if (typeof body.email !== 'string' || !validator.isEmail(body.email.trim()) || body.email.length > 254) {
    throw httpError(422, 'Enter a valid email address');
  }
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    throw httpError(422, 'Password must contain between 8 and 128 characters');
  }
  if (registration && (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80)) {
    throw httpError(422, 'Name must contain between 2 and 80 characters');
  }
  return { email: body.email.trim().toLowerCase(), password: body.password, ...(registration ? { name: body.name.trim() } : {}) };
}

function session(row) {
  const token = jwt.sign({}, secret, { algorithm: 'HS256', issuer: 'kisansetu', subject: String(row.id), expiresIn: '8h' });
  return { access_token: token, token_type: 'bearer', user: publicUser(row) };
}

app.get('/health', async (request, response) => {
  try { await users.health(); response.json({ status: 'ok' }); }
  catch { response.status(503).json({ status: 'unavailable' }); }
});

app.post('/register', async (request, response) => {
  const body = credentials(request.body, true);
  const hash = await argon2.hash(body.password, { type: argon2.argon2id });
  let row;
  try {
    row = await users.create(body.name, body.email, hash);
  } catch (error) {
    if (error.code === 11000 || error.message.includes('UNIQUE constraint failed: users.email')) throw httpError(409, 'An account with that email already exists');
    throw error;
  }
  response.status(201).json(session(row));
});

app.post('/login', async (request, response) => {
  const body = credentials(request.body);
  const row = await users.byEmail(body.email);
  let valid = false;
  try { valid = await argon2.verify(row?.password_hash || dummyHash, body.password); } catch { /* Reject invalid stored hashes. */ }
  if (!row || !valid) throw httpError(401, 'Incorrect email or password');
  response.json(session(row));
});

app.get('/me', async (request, response) => {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization || '')?.[1];
  let id;
  try {
    if (!token) throw new Error('Missing token');
    const claims = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'kisansetu' });
    id = Number(claims.sub);
    if (typeof claims.sub !== 'string' || !/^[1-9]\d*$/.test(claims.sub) || !Number.isSafeInteger(id)
        || !Number.isFinite(claims.exp) || !Number.isFinite(claims.iat)
        || claims.iat > Math.floor(Date.now() / 1000)) throw new Error('Invalid token claims');
  } catch {
    response.set('WWW-Authenticate', 'Bearer');
    throw httpError(401, 'Please sign in again');
  }
  const row = await users.byId(id);
  if (!row) throw httpError(401, 'Account no longer exists');
  response.json(publicUser(row));
});

start(app, 8001);
