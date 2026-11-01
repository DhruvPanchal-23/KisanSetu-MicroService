import { MongoClient, ServerApiVersion } from 'mongodb';

export const mongoConfigured = Boolean(process.env.MONGODB_URI?.trim());
let client;
export async function connectMongo() {
  if (!mongoConfigured) throw new Error('Set MONGODB_URI in .env first.');
  try {
    client ??= new MongoClient(process.env.MONGODB_URI.trim(), {
      appName: 'KisanSetu', serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000,
      maxPoolSize: 10, serverApi: { version: ServerApiVersion.v1 },
    });
    await client.connect();
    const database = client.db(process.env.MONGODB_DB?.trim() || 'kisansetu');
    await database.command({ ping: 1 });
    return database;
  } catch {
    await closeMongo();
    throw new Error('MongoDB connection failed. Check MONGODB_URI, database credentials and the Atlas IP access list.');
  }
}

export async function closeMongo() {
  await client?.close();
  client = undefined;
}

export async function nextMongoId(database, collection) {
  const counter = await database.collection('counters').findOneAndUpdate(
    { _id: collection }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' },
  );
  if (!Number.isSafeInteger(counter.value) || counter.value < 1) throw new Error('Database ID limit exceeded');
  return counter.value;
}

export async function prepareMongoCollection(database, name) {
  const collection = database.collection(name);
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex(name === 'users' ? { email: 1 } : { user_id: 1 }, name === 'users' ? { unique: true } : {});
  const last = await collection.findOne({}, { sort: { id: -1 }, projection: { id: 1 } });
  await database.collection('counters').updateOne({ _id: name }, { $max: { value: last?.id || 0 } }, { upsert: true });
  return collection;
}
