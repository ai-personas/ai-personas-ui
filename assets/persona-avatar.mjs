const AVATAR_SCHEMA = 'persona-avatar/1';
const AVATAR_KIND = 'identicon';
const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_COLOR = /^#[0-9A-F]{6}$/;
const SAFE_INITIAL = /^[A-Z0-9]$/;
const AVATAR_FIELDS = Object.freeze([
  'schema', 'kind', 'seed', 'primary_color', 'secondary_color', 'initials',
]);
const FORBIDDEN_SOURCE_FIELDS = Object.freeze([
  'url', 'public_url', 'avatar_url', 'data', 'data_url', 'src', 'href',
]);

const FALLBACK_PALETTE = Object.freeze([
  ['#D8E9FF', '#17365D'],
  ['#DDF8E8', '#164B35'],
  ['#F5E5FF', '#4A2768'],
  ['#FFF0D5', '#603D0C'],
  ['#FFE2E8', '#612536'],
  ['#DDF5F3', '#174A4B'],
]);

function safeInitials(value) {
  const chars = Array.from(String(value ?? '').normalize('NFC').trim());
  return chars.length >= 1 && chars.length <= 2 && chars.every((char) =>
    SAFE_INITIAL.test(char)) ? chars.join('') : '';
}

function fallbackInitials(name, personaId) {
  const words = String(name ?? '').normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
  let chars = [];
  if (words.length > 1) {
    chars = [Array.from(words[0])[0], Array.from(words.at(-1))[0]];
  } else if (words.length === 1) {
    chars = Array.from(words[0]).slice(0, 2);
  }
  let initials = safeInitials(chars.join('').toLocaleUpperCase());
  if (initials) return initials;
  initials = safeInitials(Array.from(String(personaId ?? '').normalize('NFKC'))
    .filter((char) => SAFE_INITIAL.test(char)).slice(0, 2).join('').toLocaleUpperCase());
  return initials || 'AI';
}

function fnv32(value, salt) {
  let hash = (0x811c9dc5 ^ salt) >>> 0;
  for (const char of String(value ?? '').normalize('NFC')) {
    const code = char.codePointAt(0) || 0;
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= (code >>> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= code >>> 16;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function legacyPersonaAvatarSeed(personaId, name = '') {
  const identity = `${String(personaId ?? '')}\u0000${String(name ?? '')}`;
  return Array.from({length: 8}, (_, index) =>
    fnv32(identity, Math.imul(index + 1, 0x9e3779b1)).toString(16).padStart(8, '0'))
    .join('');
}

export function normalizePersonaAvatar(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== AVATAR_FIELDS.length
      || AVATAR_FIELDS.some((field) => !Object.hasOwn(value, field))
      || FORBIDDEN_SOURCE_FIELDS.some((field) => Object.hasOwn(value, field))
      || value.schema !== AVATAR_SCHEMA || value.kind !== AVATAR_KIND) return null;
  const seed = String(value.seed ?? '');
  const primaryColor = String(value.primary_color ?? '');
  const secondaryColor = String(value.secondary_color ?? '');
  const initials = safeInitials(value.initials);
  if (!HEX_64.test(seed) || !HEX_COLOR.test(primaryColor)
      || !HEX_COLOR.test(secondaryColor) || !initials) return null;
  return Object.freeze({
    schema: AVATAR_SCHEMA,
    kind: AVATAR_KIND,
    seed,
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    initials,
  });
}

export function resolvePersonaAvatar(value, {personaId = '', name = ''} = {}) {
  const signed = normalizePersonaAvatar(value);
  if (signed) return Object.freeze({...signed, source: 'signed'});
  const seed = legacyPersonaAvatarSeed(personaId, name);
  const palette = FALLBACK_PALETTE[Number.parseInt(seed.slice(0, 2), 16)
    % FALLBACK_PALETTE.length];
  return Object.freeze({
    schema: AVATAR_SCHEMA,
    kind: AVATAR_KIND,
    seed,
    primary_color: palette[0],
    secondary_color: palette[1],
    initials: fallbackInitials(name, personaId),
    source: 'legacy-fallback',
  });
}

export function personaAvatarCells(value) {
  const avatar = normalizePersonaAvatar(value) || value;
  if (!avatar || !HEX_64.test(String(avatar.seed ?? ''))) return [];
  const bytes = String(avatar.seed).match(/../g).map((part) => Number.parseInt(part, 16));
  const cells = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const index = row * 3 + column;
      const filled = ((bytes[index] ^ bytes[index + 15] ^ (row * 17 + column * 29))
        & 0x03) !== 0;
      if (!filled) continue;
      cells.push(Object.freeze({row, column}));
      if (column < 2) cells.push(Object.freeze({row, column: 4 - column}));
    }
  }
  return cells;
}

export const PERSONA_AVATAR_CONTRACT = Object.freeze({
  schema: AVATAR_SCHEMA,
  kind: AVATAR_KIND,
  forbiddenSourceFields: FORBIDDEN_SOURCE_FIELDS,
});
