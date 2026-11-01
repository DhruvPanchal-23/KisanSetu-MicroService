import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFarmDate } from '../src/services/farmDate.js';

test('saved UTC and explicit offsets display the same farm-added instant in IST', () => {
  const saved = formatFarmDate('2020-06-15 12:34:56');
  assert.equal(saved, formatFarmDate('2020-06-15T12:34:56Z'));
  assert.equal(saved, formatFarmDate('2020-06-15T18:04:56+05:30'));
  assert.equal(saved, formatFarmDate('2020-06-15T08:34:56-0400'));
  assert.match(saved, /15 June 2020/);
  assert.match(saved, /06:04:56/);
  assert.match(saved, /IST$/);
});

test('missing and invalid saved farm dates never become a current or normalized date', () => {
  for (const value of [undefined, null, '', '   ', 0, 'not-a-date', '2026-13-01 12:00:00', '2026-02-30 12:00:00']) {
    assert.equal(formatFarmDate(value), 'Not available');
  }
});
