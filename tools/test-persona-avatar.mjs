import assert from 'node:assert/strict';

import {
  legacyPersonaAvatarSeed,
  normalizePersonaAvatar,
  personaAvatarCells,
  resolvePersonaAvatar,
} from '../assets/persona-avatar.mjs';

const descriptor = {
  schema: 'persona-avatar/1',
  kind: 'identicon',
  seed: '0123456789abcdef'.repeat(4),
  primary_color: '#D8E9FF',
  secondary_color: '#17365D',
  initials: 'OV',
};

assert.deepEqual(normalizePersonaAvatar(descriptor), descriptor);
assert.equal(resolvePersonaAvatar(descriptor, {
  personaId: 'persona-one', name: 'Orin Vale',
}).source, 'signed');

const cells = personaAvatarCells(descriptor);
assert.ok(cells.length > 0);
assert.deepEqual(cells, personaAvatarCells(descriptor), 'identicon must be deterministic');
const cellKeys = new Set(cells.map(({row, column}) => `${row}:${column}`));
for (const {row, column} of cells) {
  assert.ok(cellKeys.has(`${row}:${4 - column}`), 'identicon must be horizontally symmetric');
}

for (const invalid of [
  {...descriptor, seed: descriptor.seed.toUpperCase()},
  {...descriptor, primary_color: '#d8e9ff'},
  {...descriptor, initials: '<>'},
  {...descriptor, initials: 'ov'},
  {...descriptor, initials: 'ØV'},
  {...descriptor, kind: 'image'},
  {...descriptor, extra: 'not in persona-avatar/1'},
  {...descriptor, public_url: 'https://tracker.invalid/avatar.png'},
  {...descriptor, data: 'data:image/svg+xml,<svg onload=alert(1)>'},
]) {
  assert.equal(normalizePersonaAvatar(invalid), null);
}

const fallback = resolvePersonaAvatar(null, {
  personaId: 'legacy-persona-1', name: 'Mara Chen',
});
assert.equal(fallback.source, 'legacy-fallback');
assert.equal(fallback.initials, 'MC');
assert.equal(fallback.seed, legacyPersonaAvatarSeed('legacy-persona-1', 'Mara Chen'));
assert.deepEqual(fallback, resolvePersonaAvatar({
  ...descriptor, avatar_url: 'javascript:alert(1)',
}, {personaId: 'legacy-persona-1', name: 'Mara Chen'}));
assert.notEqual(fallback.seed, legacyPersonaAvatarSeed('legacy-persona-2', 'Mara Chen'));
assert.equal(Object.hasOwn(fallback, 'url'), false);
assert.equal(Object.hasOwn(fallback, 'data'), false);

const hostileFallback = resolvePersonaAvatar({
  ...descriptor, initials: '<script>',
}, {personaId: '<img src=x>', name: '<svg onload=alert(1)>'});
assert.equal(hostileFallback.source, 'legacy-fallback');
assert.match(hostileFallback.initials, /^[A-Z0-9]{1,2}$/);

console.log('signed persona avatar + deterministic local fallback contract: ok');
