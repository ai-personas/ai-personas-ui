const TECHNICAL_KEY = /(?:^|_)(?:id|ids|did|ref|refs|hash|sha256|signature|signature_hex|key_id|kernel_id|node_id|persona_id|environment_id|workspace_id|run_id|bundle_id|artifact_id|record_id|call_id|request_id|schema|url|uri|locator|token)(?:$|_)/i;
const HUMAN_PRIORITY = [
  'message', 'summary', 'answer', 'result', 'outcome', 'description', 'rationale',
  'intent', 'task', 'purpose', 'next_needed_effect', 'status', 'reason', 'detail',
];

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export function isTechnicalKey(key) {
  return TECHNICAL_KEY.test(String(key || ''));
}

export function humanizeMachineKey(key) {
  const words = String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Detail';
}

export function isMachineIdentifier(value) {
  const text = clean(value);
  if (!text) return false;
  if (/^(?:did:|sha256:|kernel:|persona:|env:|run[-:]|workspace[-:]|bundle[-:]|artifact[-:]|record[-:])/i.test(text)) return true;
  if (/^[0-9a-f]{32,}$/i.test(text) || /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(text)) return true;
  if (/^[A-Z0-9_-]{24,}$/i.test(text) && /\d/.test(text)) return true;
  return false;
}

function scalar(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  const text = clean(value);
  return text && !isMachineIdentifier(text) ? text : '';
}

function parseInput(input) {
  if (input && typeof input === 'object') {
    return { parsed: input, raw: JSON.stringify(input, null, 2) };
  }
  const raw = String(input ?? '').trim();
  if (!raw || !/^[{[]/.test(raw)) return { parsed: null, raw };
  try { return { parsed: JSON.parse(raw), raw }; } catch (_) { return { parsed: null, raw }; }
}

function pushUnique(target, value, limit) {
  const text = clean(value);
  if (!text || target.includes(text) || target.length >= limit) return;
  target.push(text);
}

/**
 * Convert arbitrary model/operator JSON into a bounded, human-first projection.
 * Technical identifiers remain available through `raw`, but never become the
 * headline, prose, facts, or list items.
 */
export function structuredContentProjection(input) {
  const { parsed, raw } = parseInput(input);
  if (parsed === null) {
    return { parsed: false, headline: '', paragraphs: raw ? [raw] : [], facts: [], items: [], raw };
  }

  const paragraphs = [], facts = [], items = [];
  let headline = '';
  const visited = new Set();

  const visit = (value, depth = 0, parent = '') => {
    if (value === null || value === undefined || depth > 3) return;
    if (typeof value !== 'object') {
      const text = scalar(value);
      if (text && !headline) headline = text;
      else pushUnique(paragraphs, text, 4);
      return;
    }
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const entry of value.slice(0, 12)) {
        const text = scalar(entry);
        if (text) pushUnique(items, text, 12);
        else if (entry && typeof entry === 'object') visit(entry, depth + 1, parent);
      }
      return;
    }

    const entries = Object.entries(value);
    const ordered = [
      ...HUMAN_PRIORITY.flatMap((key) => entries.filter(([candidate]) => candidate === key)),
      ...entries.filter(([key]) => !HUMAN_PRIORITY.includes(key)),
    ];
    for (const [key, entry] of ordered) {
      if (isTechnicalKey(key) || entry === null || entry === undefined) continue;
      const label = humanizeMachineKey(key);
      const text = scalar(entry);
      if (text) {
        if (HUMAN_PRIORITY.includes(key) && !headline && text.length <= 300) headline = text;
        else if (HUMAN_PRIORITY.includes(key) && text.length > 80) pushUnique(paragraphs, text, 4);
        else if (facts.length < 10) facts.push({ label, value: text });
        continue;
      }
      if (Array.isArray(entry)) {
        const before = items.length;
        visit(entry, depth + 1, key);
        if (items.length > before && parent && facts.length < 10) {
          facts.push({ label, value: `${entry.length} item${entry.length === 1 ? '' : 's'}` });
        }
      } else if (entry && typeof entry === 'object') {
        visit(entry, depth + 1, key);
      }
    }
  };

  visit(parsed);
  if (!headline) {
    if (items.length) headline = `${items.length} item${items.length === 1 ? '' : 's'} returned`;
    else if (facts.length) headline = 'Structured response';
    else headline = 'Technical response received';
  }
  const meaningfulFacts = facts.filter(({ value }) => value !== headline && !isMachineIdentifier(value));
  return { parsed: true, headline, paragraphs, facts: meaningfulFacts, items, raw };
}

export function operatorResponseText(body, status = 0) {
  const projection = structuredContentProjection(body);
  const ok = status >= 200 && status < 300;
  const lines = [ok ? 'Request succeeded.' : status ? `Request failed (HTTP ${status}).` : 'No response from the node.'];
  if (projection.headline) lines.push(projection.headline);
  for (const paragraph of projection.paragraphs.slice(0, 2)) {
    if (paragraph !== projection.headline) lines.push(paragraph);
  }
  for (const fact of projection.facts.slice(0, 8)) lines.push(`${fact.label}: ${fact.value}`);
  for (const item of projection.items.slice(0, 8)) lines.push(`• ${item}`);
  return [...new Set(lines.filter(Boolean))].join('\n');
}
