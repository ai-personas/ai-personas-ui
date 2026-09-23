import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { explorationLimits, localExpiry, expiryInput } from '../src/explorationPolicy.ts';

function form(seconds = '90', calls = '6', episodes = '3') {
  const input = new FormData();
  input.set('seconds', seconds); input.set('calls', calls); input.set('episodes', episodes);
  return input;
}
test('exact API durations, including sub-minute and fractional-minute values, round trip', () => {
  for (const seconds of [1, 30, 59, 60, 90, 1800, 604800]) {
    assert.equal(explorationLimits(form(String(seconds))).seconds_per_episode, seconds);
  }
});
test('zero, negatives, decimals, missing values and excessive bounds are not rounded or defaulted', () => {
  for (const value of ['', ' ', '0', '-1', '1.5', 'NaN', 'Infinity', '604801']) {
    assert.throws(() => explorationLimits(form(value)), /Seconds per episode/);
  }
  assert.throws(() => explorationLimits(form('90', '1001')), /Calls per episode/);
  assert.throws(() => explorationLimits(form('90', '6', '10001')), /Total episode allowance/);
  assert.throws(() => explorationLimits(new FormData()), /Calls per episode/);
});
test('integer call and recurrence bounds use the unchanged contract units', () => {
  assert.deepEqual(explorationLimits(form('604800', '1000', '10000')), {
    calls_per_episode: 1000, seconds_per_episode: 604800, max_episodes: 10000,
  });
});
test('invalid retained expiry does not crash rendering or silently grant another week', () => {
  for (const value of [null, undefined, {}, false, '', 'invalid date', NaN, Infinity]) {
    assert.equal(localExpiry(value), '');
  }
});
test('opening the editor preserves expiry seconds and milliseconds in local time', () => {
  const old = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/New_York', 'Asia/Kolkata']) {
      process.env.TZ = zone;
      for (const instant of ['2026-01-15T10:23:45.123Z', '2026-09-23T10:23:45.678Z']) {
        assert.equal(expiryInput(localExpiry(instant)), instant, zone);
      }
    }
  } finally {
    if (old === undefined) delete process.env.TZ; else process.env.TZ = old;
  }
});
test('empty or malformed edited expiry is rejected instead of granting an implicit default', () => {
  for (const value of [null, '', ' ', 'invalid']) assert.throws(() => expiryInput(value), /expiry/);
});
test('the actual production control uses seconds, integer bounds and the tested conversion', () => {
  const source = readFileSync(new URL('../src/ExplorationControls.tsx', import.meta.url), 'utf8');
  assert.match(source, /name="seconds"[^>]*min="1"[^>]*max="604800"[^>]*step="1"/);
  assert.match(source, /defaultValue=\{d.seconds_per_episode \?\? 1800\}/);
  assert.match(source, /\.\.\.explorationLimits\(form\)/);
  assert.match(source, /expiryInput\(form.get\('expires'\), d.expires\)/);
  assert.doesNotMatch(source, /name="minutes"|form.get\('minutes'\)/);
});

test('unchanged expiry preserves the second occurrence of an autumn DST overlap', () => {
  const old = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    const original = '2026-11-01T06:30:00.000Z';
    assert.equal(localExpiry(original), '2026-11-01T01:30:00.000');
    assert.equal(expiryInput('2026-11-01T01:30', original), original);
  } finally {
    if (old === undefined) delete process.env.TZ; else process.env.TZ = old;
  }
});
test('a nonexistent spring local time and invalid calendar dates are not silently normalized', () => {
  const old = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    assert.throws(() => expiryInput('2026-03-08T02:30'), /valid exploration expiry/);
    assert.throws(() => expiryInput('2026-02-30T12:00'), /valid exploration expiry/);
  } finally {
    if (old === undefined) delete process.env.TZ; else process.env.TZ = old;
  }
});
