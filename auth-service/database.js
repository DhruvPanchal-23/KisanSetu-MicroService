import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMongo, mongoConfigured, nextMongoId, prepareMongoCollection } from '../shared/mongo.js';

const mongo = mongoConfigured ? await connectMongo() : null;
const collection = mongo ? await prepareMongoCollection(mongo, 'users') : null;
const path = process.env.DATABASE_PATH || fileURLToPath(new URL('./storage/auth.db', import.meta.url));
if (!mongo && path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
const db = mongo ? null : new DatabaseSync(path);
db?.exec(`PRAGMA busy_timeout = 10000;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL);`);

export const users = {
  async byId(id) { return collection ? collection.findOne({ id }, { projection: { _id: 0 } }) : db.prepare('SELECT * FROM users WHERE id = ?').get(id); },
  async byEmail(email) { return collection ? collection.findOne({ email }, { projection: { _id: 0 } }) : db.prepare('SELECT * FROM users WHERE email = ?').get(email); },
  async create(name, email, password_hash) {
    if (collection) {
      const row = { id: await nextMongoId(mongo, 'users'), name, email, password_hash };
      await collection.insertOne({ ...row });
      return row;
    }
    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, password_hash);
    return this.byId(Number(result.lastInsertRowid));
  },
  async health() { if (mongo) await mongo.command({ ping: 1, maxTimeMS: 3000 }); else db.prepare('SELECT 1').get(); },
};
