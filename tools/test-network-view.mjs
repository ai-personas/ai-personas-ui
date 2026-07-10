import assert from 'node:assert/strict';

import {
  NETWORK_VIEW_LIMITS,
  compactCount,
  nextProgressiveGroupLevel,
  normalizeMonitoringBase,
  progressiveGroupLimit,
  safeCount,
  selectMonitoringBases,
  selectPriorityWindow,
  selectSearchWindow,
  takeProgressiveGroupWindow,
} from '../assets/network-view.mjs';

function* millionNodes() {
  for (let index = 0; index < 1_000_000; index++) {
    yield {
      id: `node-${String(index).padStart(7, '0')}`,
      label: index % 100_000 === 42 ? `Needle relay ${index}` : `Kernel ${index}`,
      priority: index % 997,
    };
  }
}

// A million inputs produce eight deterministic rows and no million-item derived array.
const million = selectPriorityWindow(millionNodes(), {
  limit: 8,
  keyOf: (item) => item.id,
  priorityOf: (item) => item.priority,
});
assert.equal(million.scanned, 1_000_000);
assert.equal(million.matched, 1_000_000);
assert.equal(million.items.length, 8);
assert.deepEqual(million.items.map((item) => item.id), [
  'node-0000996', 'node-0001993', 'node-0002990', 'node-0003987',
  'node-0004984', 'node-0005981', 'node-0006978', 'node-0007975',
]);

const searched = selectSearchWindow(millionNodes(), 'needle relay', {
  limit: 4,
  keyOf: (item) => item.id,
  priorityOf: (item) => item.priority,
});
assert.equal(searched.items.length, 4);
assert.equal(searched.matched, 10);
assert.ok(searched.items.every((item) => /Needle relay/.test(item.label)));
assert.deepEqual(
  selectPriorityWindow([
    {id: 'b', priority: 2}, {id: 'a', priority: 2}, {id: 'c', priority: 1},
  ], {limit: 2}).items.map((item) => item.id),
  ['a', 'b'],
  'equal-priority rows must be ordered by stable key, not arrival race',
);
const scanBound = selectPriorityWindow(millionNodes(), {limit: 3, scanLimit: 25});
assert.equal(scanBound.scanned, 25);
assert.equal(scanBound.scanLimitReached, true);

// Each group advances independently and never exceeds its explicit ceiling.
const groupProgress = new Map([['alpha', 0], ['beta', 2], ['maxed', 999]]);
const groupOptions = {initial: 12, step: 12, max: 48};
assert.equal(progressiveGroupLimit('alpha', groupProgress, groupOptions), 12);
assert.equal(progressiveGroupLimit('beta', groupProgress, groupOptions), 36);
assert.equal(progressiveGroupLimit('maxed', groupProgress, groupOptions), 48);
assert.equal(nextProgressiveGroupLevel('beta', groupProgress, groupOptions), 3);
const beta = takeProgressiveGroupWindow(
  (function* () { for (let i = 0; i < 1000; i++) yield i; }()),
  'beta',
  groupProgress,
  groupOptions,
);
assert.equal(beta.items.length, 36);
assert.equal(beta.scanned, 37, 'a collapsed group should consume only one look-ahead row');
assert.equal(beta.hasMore, true);
assert.equal(beta.omittedIsLowerBound, true);
const exactGroup = takeProgressiveGroupWindow(Array.from({length: 1000}, (_, i) => i),
  'beta', groupProgress, groupOptions);
assert.equal(exactGroup.total, 1000);
assert.equal(exactGroup.omitted, 964);

// Mandatory focus/activity expands the soft budget; no mandatory base is evicted.
const monitoring = selectMonitoringBases([
  {base: 'https://cold.example/node/', priority: 100},
  {base: 'https://live-c.example/', active: true, priority: 1},
  {base: 'https://fill.example/', priority: 90},
  {base: 'https://focused-b.example/', focused: true, priority: 0},
], {
  focusedBase: 'https://focused-a.example/',
  activeBases: ['https://live-a.example/', 'https://live-b.example/'],
  limit: 2,
  hardLimit: 8,
});
assert.deepEqual(monitoring.focused, [
  'https://focused-a.example', 'https://focused-b.example',
]);
assert.deepEqual(monitoring.active, [
  'https://live-a.example', 'https://live-b.example', 'https://live-c.example',
]);
assert.equal(monitoring.limit, 5);
for (const required of [...monitoring.focused, ...monitoring.active]) {
  assert.ok(monitoring.bases.includes(required), `${required} was silently dropped`);
}
const filled = selectMonitoringBases([
  {base: 'https://low.example', priority: 1},
  {base: 'https://high.example', priority: 9},
], {focusedBase: '', limit: 2, hardLimit: 4});
assert.deepEqual(filled.bases, ['', 'https://high.example']);
assert.throws(() => selectMonitoringBases([], {
  activeBases: Array.from({length: 5}, (_, i) => `https://active-${i}.example`),
  limit: 1,
  hardLimit: 4,
}), /exceed hard limit/);
assert.equal(normalizeMonitoringBase('https://user:secret@example.test/'), null);
assert.equal(normalizeMonitoringBase('javascript:alert(1)'), null);
assert.equal(normalizeMonitoringBase('@origin'), '');

// Count formatting is bounded, exact below 1K, and BigInt-safe above Number.MAX_SAFE_INTEGER.
assert.equal(safeCount(-2), 0);
assert.equal(safeCount('100000000000000000000000'), Number.MAX_SAFE_INTEGER);
assert.equal(safeCount('350', 100), 100);
assert.equal(compactCount(999), '999');
assert.equal(compactCount(1_500), '1.5K');
assert.equal(compactCount(12_345_678), '12.3M');
assert.equal(compactCount(999_999_999_999_999_999n), '999Q');
assert.equal(compactCount(10n ** 40n), '999Q+');
assert.equal(compactCount('not-a-count'), '0');

assert.equal(NETWORK_VIEW_LIMITS.maxScan, 1_000_000);
console.log('bounded network view contract: ok');
