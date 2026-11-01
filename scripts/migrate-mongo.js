import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

if (existsSync('.env')) process.loadEnvFile('.env');
const { connectMongo, closeMongo, prepareMongoCollection } = await import('../shared/mongo.js');
try {
  // Read both sources before writing anything. Never create missing source files.
  const sources = [
    ['users', process.env.AUTH_DATABASE_PATH || 'auth-service/storage/auth.db'],
    ['farms', process.env.FARM_DATABASE_PATH || 'farm-service/storage/farms.db'],
  ].map(([name, path]) => {
    const sqlite = new DatabaseSync(path, { readOnly: true });
    try { return [name, sqlite.prepare(`SELECT * FROM ${name}`).all()]; }
    finally { sqlite.close(); }
  });
  const database = await connectMongo();
  // Refuse conflicting records instead of replacing accounts or farm ownership.
  for (const [name, rows] of sources) {
    const collection = await prepareMongoCollection(database, name);
    for (const row of rows) {
      const existing = await collection.findOne(name === 'users' ? { $or: [{ id: row.id }, { email: row.email }] } : { id: row.id });
      if (existing && Object.keys(row).some(key => existing[key] !== row[key])) {
        throw new Error(`Conflicting ${name} record ${row.id}. Migration stopped; existing records were not overwritten.`);
      }
    }
  }
  for (const [name, rows] of sources) {
    for (const row of rows) {
      await database.collection(name).updateOne({ id: row.id }, { $setOnInsert: { ...row } }, { upsert: true });
    }
    await prepareMongoCollection(database, name);
    console.log(`Migrated ${rows.length} ${name} records. SQLite source preserved.`);
  }
} catch {
  console.error('Migration failed. Check the MongoDB connection, source database paths and conflicting destination records. Sources are unchanged; keep services stopped until resolved.');
  process.exitCode = 1;
} finally {
  await closeMongo();
}
