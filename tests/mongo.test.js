import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('MongoDB preserves account uniqueness, farm ownership, dates and IDs', { skip: !process.env.KISANSETU_TEST_MONGODB_URI }, async () => {
  process.env.MONGODB_URI = process.env.KISANSETU_TEST_MONGODB_URI;
  process.env.MONGODB_DB = `kisansetu_test_${randomUUID().replaceAll('-', '')}`;
  const { connectMongo, closeMongo } = await import('../shared/mongo.js');
  const database = await connectMongo();
  try {
    const { users } = await import('../auth-service/database.js');
    const { farms } = await import('../farm-service/database.js');
    const owner = await users.create('Test', 'test@example.com', 'test-hash');
    assert.equal((await users.byEmail(owner.email)).id, owner.id);
    assert.equal((await users.byId(owner.id)).password_hash, 'test-hash');
    await assert.rejects(users.create('Duplicate', owner.email, 'hash'), error => error.code === 11000);
    const input = { name: 'Test farm', location: 'Gujarat', latitude: 22, longitude: 72, area_acres: 2, crop: 'Wheat', soil_type: 'Alluvial' };
    const farm = await farms.create(owner.id, input);
    assert.equal(await farms.get(farm.id, owner.id + 1), null);
    assert.equal(await farms.update(farm.id, owner.id + 1, input), null);
    assert.equal(await farms.remove(farm.id, owner.id + 1), 0);
    const edited = await farms.update(farm.id, owner.id, { ...input, name: 'Edited farm' });
    assert.equal(edited.created_at, farm.created_at);
    assert.equal(edited.name, 'Edited farm');
    const more = await Promise.all(Array.from({ length: 5 }, () => farms.create(owner.id, input)));
    assert.equal(new Set(more.map(row => row.id)).size, 5);
    assert.equal((await farms.list(owner.id)).length, 6);
    await users.health();
    await farms.health();
    assert.equal(await farms.remove(farm.id, owner.id), 1);
  } finally {
    await database.dropDatabase();
    await closeMongo();
  }
});
