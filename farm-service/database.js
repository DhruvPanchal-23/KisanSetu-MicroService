import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { connectMongo, mongoConfigured, nextMongoId, prepareMongoCollection } from '../shared/mongo.js';

const mongo = mongoConfigured ? await connectMongo() : null;
const collection = mongo ? await prepareMongoCollection(mongo, 'farms') : null;
const databasePath = process.env.DATABASE_PATH || fileURLToPath(new URL('./storage/farms.db', import.meta.url));
if (!mongo && databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });

const db = mongo ? null : new DatabaseSync(databasePath);
db?.exec(`PRAGMA busy_timeout = 10000;
  CREATE TABLE IF NOT EXISTS farms (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL,
    location TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
    area_acres REAL NOT NULL, crop TEXT NOT NULL, soil_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE INDEX IF NOT EXISTS farms_owner ON farms(user_id);`);

export const farms = {
  async list(user_id) { return collection ? collection.find({ user_id }, { projection: { _id: 0 } }).sort({ id: -1 }).toArray() : db.prepare('SELECT * FROM farms WHERE user_id = ? ORDER BY id DESC').all(user_id); },
  async get(id, user_id) { return collection ? collection.findOne({ id, user_id }, { projection: { _id: 0 } }) : db.prepare('SELECT * FROM farms WHERE id = ? AND user_id = ?').get(id, user_id); },
  async create(user_id, farm) {
    if (collection) {
      const row = { ...farm, id: await nextMongoId(mongo, 'farms'), user_id, created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') };
      await collection.insertOne({ ...row });
      return row;
    }
    const result = db.prepare(`INSERT INTO farms (user_id, name, location, latitude, longitude, area_acres, crop, soil_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(user_id, farm.name, farm.location, farm.latitude, farm.longitude, farm.area_acres, farm.crop, farm.soil_type);
    return this.get(Number(result.lastInsertRowid), user_id);
  },
  async update(id, user_id, farm) {
    if (collection) return collection.findOneAndUpdate({ id, user_id }, { $set: farm }, { returnDocument: 'after', projection: { _id: 0 } });
    const result = db.prepare(`UPDATE farms SET name=?, location=?, latitude=?, longitude=?, area_acres=?, crop=?, soil_type=? WHERE id=? AND user_id=?`)
      .run(farm.name, farm.location, farm.latitude, farm.longitude, farm.area_acres, farm.crop, farm.soil_type, id, user_id);
    return result.changes ? this.get(id, user_id) : null;
  },
  async remove(id, user_id) {
    return collection ? (await collection.deleteOne({ id, user_id })).deletedCount
      : db.prepare('DELETE FROM farms WHERE id = ? AND user_id = ?').run(id, user_id).changes;
  },
  async health() { if (mongo) await mongo.command({ ping: 1, maxTimeMS: 3000 }); else db.prepare('SELECT 1').get(); },
};
