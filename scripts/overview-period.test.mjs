import assert from 'node:assert/strict';
import test from 'node:test';
import { overviewRange, overviewDailySales } from '../apps/web/src/components/dashboard/overview-period.ts';

test('Gregorian month begins on the first, not thirty days ago', () => {
  assert.deepEqual(overviewRange('month', 'gregory', new Date('2026-09-24T12:00:00Z')), { from: '2026-09-01', to: '2026-09-24' });
});
test('Persian settlement month uses the first day of Mehr', () => {
  assert.deepEqual(overviewRange('month', 'persian', new Date('2026-09-24T12:00:00Z')), { from: '2026-09-23', to: '2026-09-24' });
});
test('month boundary follows Tehran midnight, including year rollover', () => {
  assert.deepEqual(overviewRange('month', 'gregory', new Date('2026-12-31T20:30:00Z')), { from: '2027-01-01', to: '2027-01-01' });
  assert.deepEqual(overviewRange('month', 'gregory', new Date('2026-12-31T20:29:59Z')), { from: '2026-12-01', to: '2026-12-31' });
});
test('week starts on Saturday, including a week spanning months', () => {
  assert.deepEqual(overviewRange('week', 'persian', new Date('2026-09-24T12:00:00Z')), { from: '2026-09-19', to: '2026-09-24' });
  assert.deepEqual(overviewRange('week', 'persian', new Date('2026-10-01T12:00:00Z')), { from: '2026-09-26', to: '2026-10-01' });
  assert.deepEqual(overviewRange('week', 'persian', new Date('2026-09-25T20:30:00Z')), { from: '2026-09-26', to: '2026-09-26' });
});
test('hourly sales on the first day are combined without losing integer precision', () => {
  const totals = overviewDailySales([{ bucket: '2026-09-23T00:00:00', grossSales: '9007199254740993' }, { bucket: '2026-09-23T01:00:00', grossSales: '7' }]);
  assert.equal(totals.get('2026-09-23'), '9007199254741000');
});
