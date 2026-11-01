import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const { connectMongo, closeMongo } = await import('../shared/mongo.js');
try {
  await connectMongo();
  console.log('MongoDB connection successful.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closeMongo();
}
