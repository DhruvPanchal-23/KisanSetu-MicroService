import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeFarms } from '../src/services/farmAnalytics.js';

test('farm analytics groups normalized categories, sums decimals and sorts by area then name', () => {
  const result = summarizeFarms([
    { crop: ' rice ', soil_type: ' Alluvial ', area_acres: 0.1 },
    { crop: 'RICE', soil_type: 'alluvial', area_acres: 0.2 },
    { crop: 'Wheat', soil_type: 'Black', area_acres: 1.5 },
    { crop: ' maize ', soil_type: 'Loamy', area_acres: 1.5 },
  ]);
  assert.equal(result.farmCount, 4);
  assert.equal(result.cropCount, 3);
  assert.ok(Math.abs(result.totalAcres - 3.3) < 1e-12);
  assert.deepEqual(result.crops.map(row => row.name), ['Maize', 'Wheat', 'Rice']);
  assert.deepEqual(result.soils.map(row => row.name), ['Black', 'Loamy', 'Alluvial']);
  for (const rows of [result.crops, result.soils]) {
    assert.equal(rows[2].farmCount, 2);
    assert.ok(Math.abs(rows[2].areaAcres - 0.3) < 1e-12);
    assert.ok(Math.abs(rows[2].share - 0.3 / 3.3 * 100) < 1e-12);
    assert.ok(Math.abs(rows.reduce((sum, row) => sum + row.share, 0) - 100) < 1e-12);
    assert.ok(rows.every(row => row.share >= 0 && row.share <= 100));
  }
});

test('farm analytics returns empty summaries for an empty account', () => {
  assert.deepEqual(summarizeFarms([]), { farmCount: 0, totalAcres: 0, cropCount: 0, crops: [], soils: [] });
});
