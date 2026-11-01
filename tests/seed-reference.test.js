import assert from 'node:assert/strict';
import test from 'node:test';
import { getFarmSeedReference, SEED_SOURCE } from '../farm-service/seed-reference.js';

const row = (date, soil_type = 'Clay', state = 'Maharashtra', suggested_irrigation_mm = 4) => ({
  date, state, soil_type, suggested_irrigation_mm, is_synthetic: true,
});
const records = [
  row('2024-02-29'), row('2024-06-15', 'Clay', 'Maharashtra', 9),
  row('2025-06-15', 'Sandy', 'Maharashtra', 10), row('2025-06-15'),
  row('2025-01-01', 'Clay', 'Maharashtra', 0), row('2025-06-15', 'Loamy', 'Karnataka'),
  row('2025-06-15', 'Alluvial', 'Madhya Pradesh'),
];
const farm = { location: 'Pune, Maharashtra', soil_type: 'Clay', area_acres: 2.5, created_at: '2025-06-15 12:00:00' };

test('seed source describes the actual synthetic reference file', () => {
  assert.deepEqual(SEED_SOURCE, {
    fileName: 'india_weather_irrigation_2024_2025.json', startDate: '2024-01-01', endDate: '2025-12-31',
    recordCount: 20468, isSynthetic: true,
  });
});

test('exact-date matches prefer the saved soil and convert reference depth with saved acreage', () => {
  const result = getFarmSeedReference({ ...farm, location: 'Pune,  MAHARASHTRA.' }, records);
  assert.equal(result.farmDate, '2025-06-15');
  assert.equal(result.matchType, 'exact-date');
  assert.equal(result.record, records[3]);
  assert.equal(result.soilMatches, true);
  assert.equal(result.waterLitres, 4 * 2.5 * 4046.8564224);
  assert.match(result.message, /synthetic/i);
});

test('out-of-range farm dates use only the same calendar day in the latest seed year', () => {
  const result = getFarmSeedReference({ ...farm, created_at: '2026-06-15 00:00:00' }, records);
  assert.equal(result.farmDate, '2026-06-15');
  assert.equal(result.matchType, 'calendar-day');
  assert.equal(result.record.date, '2025-06-15');
  assert.match(result.message, /not current weather/i);
  assert.equal(getFarmSeedReference({ ...farm, created_at: '2026-06-16 00:00:00' }, records).record, null);
});

test('leap days match exact dates or the latest available matching calendar day', () => {
  assert.equal(getFarmSeedReference({ ...farm, created_at: '2024-02-29 00:00:00' }, records).record, records[0]);
  const fallback = getFarmSeedReference({ ...farm, created_at: '2028-02-29 00:00:00' }, records);
  assert.equal(fallback.record, records[0]);
  assert.equal(fallback.matchType, 'calendar-day');
});

test('state matching requires one complete state name and tolerates separators and case', () => {
  for (const location of ['Pune', 'MaharashtraNagar', 'Maharashtra / Karnataka']) {
    const result = getFarmSeedReference({ ...farm, location }, records);
    assert.equal(result.record, null);
    assert.equal(result.matchType, null);
    assert.match(result.message, /state/i);
  }
  const result = getFarmSeedReference({ ...farm, location: 'Bhopal; MADHYA---PRADESH', soil_type: 'Alluvial' }, records);
  assert.equal(result.record.state, 'Madhya Pradesh');
  assert.equal(result.soilMatches, true);
});

test('a state reference with mismatched soil never presents a farm water volume', () => {
  const result = getFarmSeedReference({ ...farm, soil_type: 'Loamy' }, records);
  assert.equal(result.record.state, 'Maharashtra');
  assert.equal(result.soilMatches, false);
  assert.equal(result.waterLitres, null);
  assert.match(result.message, /differs/);
});

test('missing or invalid farm-added dates do not get a seed reference', () => {
  for (const created_at of [undefined, null, '', 'not-a-date', '2025-02-30 12:00:00', '2026-02-29 12:00:00']) {
    const result = getFarmSeedReference({ ...farm, created_at }, records);
    assert.equal(result.farmDate, null);
    assert.equal(result.record, null);
    assert.equal(result.matchType, null);
    assert.equal(result.waterLitres, null);
  }
});

test('UTC and explicit offsets use the farm-added calendar day in India, including a year rollover', () => {
  for (const created_at of ['2024-12-31 20:00:00', '2025-01-01T01:30:00+05:30', '2024-12-31T15:00:00-0500']) {
    const result = getFarmSeedReference({ ...farm, created_at }, records);
    assert.equal(result.farmDate, '2025-01-01');
    assert.equal(result.record, records[4]);
    assert.equal(result.waterLitres, 0);
  }
});

test('water conversion requires a finite positive saved area and nonnegative finite reference depth', () => {
  for (const area_acres of [0, -1, NaN, Infinity, '2.5']) {
    assert.equal(getFarmSeedReference({ ...farm, area_acres }, records).waterLitres, null);
  }
  for (const depth of [-1, NaN, Infinity]) {
    assert.equal(getFarmSeedReference(farm, [row('2025-06-15', 'Clay', 'Maharashtra', depth)]).waterLitres, null);
  }
});
