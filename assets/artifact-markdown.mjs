// artifact-markdown.mjs
// Self-contained, dependency-free Markdown + linkify renderer for VERIFIED text
// artifact bodies (job listings, READMEs, notes …). It exists so a persona's
// signed `.md`/`.txt` body reads as a document with clickable apply links instead
// of an escaped `<pre>` dump — WITHOUT opening an XSS hole in a page that renders
// hash-checked bytes.
//
// Security contract (non-negotiable — the caller feeds it attacker-influenced,
// signed-but-arbitrary bytes):
//   * The DOM is built exclusively with document.createElement / createTextNode /
//     textContent. innerHTML is NEVER assigned from artifact bytes, so raw HTML
//     in the body (`<script>`, `<img onerror=…>`) is rendered as inert text and
//     can never execute.
//   * Anchor hrefs pass a strict scheme allowlist (http/https/mailto). Every
//     other scheme (javascript:, data:, vbscript:, file:, blob:, relative, …) is
//     refused and the target degrades to plain text. A second, browser-parsed
//     protocol check (a.protocol) backstops the string check.
//   * Links open with rel="noopener noreferrer nofollow" and target="_blank".
//   * No network, no external deps, no CDN — fits the offline, CSP-locked shell.

// Bound the work regardless of how much the caller already sliced.
const MAX_INPUT = 1024 * 1024;
// Bound emphasis recursion so pathological input can't blow the stack.
const MAX_DEPTH = 24;

// Only these schemes may become a live href. Bare autolinks additionally restrict
// themselves to http/https (see BARE_URL_RE); mailto arrives via [label](mailto:…).
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

// Control characters + space + DEL/C1 range. Any of these inside an href can be
// used to smuggle a scheme past a naive parser ("java\tscript:") or is simply not
// part of a real URL token (we always extract a clean token before sanitizing).
function hasUnsafeUrlChar(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x20 || (c >= 0x7f && c <= 0x9f)) return true;
  }
  return false;
}

// A bare URL in prose: an explicit http(s):// origin, or a leading www. we upgrade
// to https://. Stops at whitespace and characters that usually delimit a URL in
// text; trailing sentence punctuation is trimmed by the caller.
const BARE_URL_RE = /(?:https?:\/\/|www\.)[^\s<>()[\]{}"'`]+/;
const BARE_URL_RE_G = new RegExp(BARE_URL_RE.source, 'g');
// Characters commonly adjacent to a URL in prose that are not part of it.
const TRAILING_PUNCT = /[.,;:!?)\]}'"»›]+$/;

/**
 * Return a safe href for `raw`, or '' if its scheme is not allowlisted.
 * Exported so the browser check can unit-test the allowlist directly.
 */
export function sanitizeUrl(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (hasUnsafeUrlChar(s)) return '';
  // A scheme is a contiguous run of scheme chars terminated by ':'. If the string
  // carries an explicit scheme, it must be allowlisted. Whitespace between the
  // scheme letters and ':' breaks this match, so obfuscated schemes fall through
  // to the "no explicit scheme" branch and are refused.
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s);
  if (!m) return ''; // scheme-less / relative / ambiguous → never linkified
  return ALLOWED_SCHEMES.has(m[1].toLowerCase() + ':') ? s : '';
}

// Build an anchor from an already-sanitized href, with a defense-in-depth
// re-check via the browser's own URL parser. Falls back to a text node.
function anchor(doc, href, label) {
  const a = doc.createElement('a');
  a.setAttribute('href', href);
  // The browser normalizes weird inputs; re-verify the resolved protocol.
  const proto = String(a.protocol || '').toLowerCase();
  if (!ALLOWED_SCHEMES.has(proto)) return doc.createTextNode(String(label));
  a.target = '_blank';
  a.rel = 'noopener noreferrer nofollow';
  a.textContent = String(label);
  return a;
}

// Split `text` into a fragment of text nodes + <a> for every bare URL. Used for
// plain-text bodies and inside inline Markdown parsing. Preserves every other
// character verbatim (no Markdown interpretation here).
function linkifyFragment(doc, text) {
  const frag = doc.createDocumentFragment();
  const s = String(text == null ? '' : text);
  let last = 0;
  BARE_URL_RE_G.lastIndex = 0;
  let m;
  while ((m = BARE_URL_RE_G.exec(s))) {
    const start = m.index;
    let url = m[0];
    // Give trailing sentence punctuation back to the surrounding text.
    const trailMatch = TRAILING_PUNCT.exec(url);
    let trail = '';
    if (trailMatch) { trail = trailMatch[0]; url = url.slice(0, url.length - trail.length); }
    if (!url) { // was all punctuation somehow — emit literally, keep scanning
      BARE_URL_RE_G.lastIndex = start + m[0].length;
      continue;
    }
    if (start > last) frag.appendChild(doc.createTextNode(s.slice(last, start)));
    const canonical = url[0] === 'w' || url[0] === 'W' ? 'https://' + url : url;
    const href = sanitizeUrl(canonical);
    frag.appendChild(href ? anchor(doc, href, url) : doc.createTextNode(url));
    if (trail) frag.appendChild(doc.createTextNode(trail));
    last = start + url.length + trail.length;
    BARE_URL_RE_G.lastIndex = last;
  }
  if (last < s.length) frag.appendChild(doc.createTextNode(s.slice(last)));
  return frag;
}

// Parse one span of Markdown text into inline DOM nodes. Handles `code`,
// [label](url), **bold**/__bold__, *em*/_em_, and bare-URL autolinks. Everything
// that is not a recognized construct is literal text.
function inlineInto(doc, parent, text, depth) {
  const s = String(text == null ? '' : text);
  let i = 0, plain = '';
  const flushPlain = () => {
    if (!plain) return;
    parent.appendChild(linkifyFragment(doc, plain));
    plain = '';
  };
  while (i < s.length) {
    const ch = s[i];

    // `inline code` — content is literal, no nested parsing or linkifying.
    if (ch === '`') {
      const end = s.indexOf('`', i + 1);
      if (end > i) {
        flushPlain();
        const code = doc.createElement('code');
        code.textContent = s.slice(i + 1, end);
        parent.appendChild(code);
        i = end + 1; continue;
      }
    }

    // [label](url) with optional "title". Unsafe scheme → label as plain text.
    if (ch === '[') {
      const m = /^\[([^\]]*)\]\(\s*(<[^>]*>|[^)\s]*)(?:\s+"[^"]*"|\s+'[^']*')?\s*\)/.exec(s.slice(i));
      if (m) {
        flushPlain();
        const label = m[1];
        let target = m[2];
        if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
        const href = sanitizeUrl(target);
        if (href && depth < MAX_DEPTH) {
          const a = anchor(doc, href, '');
          if (a.nodeType === 1) { // real <a>, not a fallback text node
            inlineInto(doc, a, label || target, depth + 1);
            parent.appendChild(a);
          } else {
            inlineInto(doc, parent, label || target, depth + 1);
          }
        } else {
          // Refused scheme (javascript:, data:, …): keep the visible label only.
          inlineInto(doc, parent, label || '', depth + 1);
        }
        i += m[0].length; continue;
      }
    }

    // **bold** or __bold__
    if ((ch === '*' && s[i + 1] === '*') || (ch === '_' && s[i + 1] === '_')) {
      const marker = ch + ch;
      const end = s.indexOf(marker, i + 2);
      if (end > i + 1 && depth < MAX_DEPTH) {
        flushPlain();
        const strong = doc.createElement('strong');
        inlineInto(doc, strong, s.slice(i + 2, end), depth + 1);
        parent.appendChild(strong);
        i = end + 2; continue;
      }
    }

    // *em* (any position) or _em_ (only at word boundaries, so snake_case is safe)
    if (ch === '*' || ch === '_') {
      const boundaryOk = ch === '*' || i === 0 || !/[A-Za-z0-9]/.test(s[i - 1]);
      if (boundaryOk && s[i + 1] && s[i + 1] !== ' ') {
        let end = -1;
        for (let j = i + 1; j < s.length; j++) {
          if (s[j] !== ch) continue;
          if (s[j - 1] === ' ') continue;
          if (ch === '_' && j + 1 < s.length && /[A-Za-z0-9]/.test(s[j + 1])) continue;
          end = j; break;
        }
        if (end > i && depth < MAX_DEPTH) {
          flushPlain();
          const em = doc.createElement('em');
          inlineInto(doc, em, s.slice(i + 1, end), depth + 1);
          parent.appendChild(em);
          i = end + 1; continue;
        }
      }
    }

    plain += ch; i++;
  }
  flushPlain();
}

const CLOSE_FENCE = (marker) => new RegExp('^\\s*' + (marker === '`' ? '`{3,}' : '~{3,}') + '\\s*$');
const STRUCTURAL_LINE = /^\s*(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|`{3,}|~{3,})/;

/**
 * Render a Markdown string into a detached `<div class="fv-md">` element.
 * Pure DOM construction — safe to inject into the file-viewer host.
 *
 * @param {string} text  the verified/decoded artifact body
 * @param {Document} [documentRef]  DOM document (defaults to global `document`)
 * @returns {HTMLDivElement}
 */
export function renderMarkdownDocument(text, documentRef) {
  const doc = documentRef || (typeof document !== 'undefined' ? document : null);
  if (!doc) throw new Error('renderMarkdownDocument requires a DOM document');
  const root = doc.createElement('div');
  root.className = 'fv-md';
  const src = String(text == null ? '' : text).slice(0, MAX_INPUT);
  const lines = src.split(/\r?\n/);
  let i = 0;
  let list = null, listType = '';
  const closeList = () => { list = null; listType = ''; };

  while (i < lines.length) {
    const raw = lines[i];

    // Fenced code block ``` / ~~~ — verbatim, never inline-parsed.
    const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(raw);
    if (fence) {
      closeList();
      const marker = fence[1][0];
      const closeRe = CLOSE_FENCE(marker);
      const buf = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i])) { buf.push(lines[i]); i++; }
      if (i < lines.length) i++; // consume closing fence
      const pre = doc.createElement('pre');
      pre.className = 'fv-code';
      const code = doc.createElement('code');
      code.textContent = buf.join('\n');
      pre.appendChild(code);
      root.appendChild(pre);
      continue;
    }

    // ATX heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(raw);
    if (heading) {
      closeList();
      const h = doc.createElement('h' + heading[1].length);
      inlineInto(doc, h, heading[2].replace(/\s+#+\s*$/, '').trim(), 0);
      root.appendChild(h);
      i++; continue;
    }

    // Thematic break
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(raw)) {
      closeList();
      root.appendChild(doc.createElement('hr'));
      i++; continue;
    }

    // Blockquote (gather consecutive `>` lines)
    const bqLead = /^\s*>\s?(.*)$/.exec(raw);
    if (bqLead) {
      closeList();
      const parts = [bqLead[1]];
      i++;
      let mm;
      while (i < lines.length && (mm = /^\s*>\s?(.*)$/.exec(lines[i]))) { parts.push(mm[1]); i++; }
      const block = doc.createElement('blockquote');
      inlineInto(doc, block, parts.join('\n'), 0);
      root.appendChild(block);
      continue;
    }

    // List items (unordered / ordered)
    const ulItem = /^\s*[-*+]\s+(.*)$/.exec(raw);
    const olItem = /^\s*(\d+)[.)]\s+(.*)$/.exec(raw);
    if (ulItem || olItem) {
      const type = ulItem ? 'ul' : 'ol';
      if (!list || listType !== type) {
        closeList();
        list = doc.createElement(type);
        listType = type;
        root.appendChild(list);
      }
      const li = doc.createElement('li');
      inlineInto(doc, li, ulItem ? ulItem[1] : olItem[2], 0);
      list.appendChild(li);
      i++; continue;
    }

    // Blank line
    if (!raw.trim()) { closeList(); i++; continue; }

    // Paragraph — gather consecutive non-blank, non-structural lines.
    closeList();
    const paraLines = [raw];
    i++;
    while (i < lines.length && lines[i].trim() && !STRUCTURAL_LINE.test(lines[i])) {
      paraLines.push(lines[i]); i++;
    }
    const p = doc.createElement('p');
    inlineInto(doc, p, paraLines.join('\n'), 0);
    root.appendChild(p);
  }

  return root;
}

/**
 * Render plain text into a detached `<pre class="filview">`, verbatim, with bare
 * URLs turned into safe anchors. No Markdown structure is interpreted.
 *
 * @param {string} text
 * @param {Document} [documentRef]
 * @returns {HTMLPreElement}
 */
export function renderPlainTextWithLinks(text, documentRef) {
  const doc = documentRef || (typeof document !== 'undefined' ? document : null);
  if (!doc) throw new Error('renderPlainTextWithLinks requires a DOM document');
  const pre = doc.createElement('pre');
  pre.className = 'filview';
  pre.appendChild(linkifyFragment(doc, String(text == null ? '' : text).slice(0, MAX_INPUT)));
  return pre;
}
