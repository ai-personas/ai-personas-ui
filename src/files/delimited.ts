export const TABLE_ROWS = 500, TABLE_COLUMNS = 50;
export type Delimited = { rows: string[][]; truncated: boolean };

/** CSV/TSV with quoted delimiters, escaped quotes and multiline cells. */
export function parseDelimited(text: string, delimiter: ',' | '\t', partial = false): Delimited {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false, truncated = false;
  text = text.replace(/^\uFEFF/, '');
  if (!text) return { rows, truncated: partial };
  function field() { if (row.length < TABLE_COLUMNS) row.push(cell); else truncated = true; cell = ''; closed = false; }
  function record() { field(); rows.push(row); row = []; }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += char;
    } else if (char === delimiter) field();
    else if (char === '\n' || char === '\r') {
      record(); if (char === '\r' && text[i + 1] === '\n') i++;
      if (rows.length === TABLE_ROWS) return { rows, truncated: truncated || partial || i < text.length - 1 };
    } else if (char === '"' && !cell && !closed) quoted = true;
    else { if (closed || char === '"') throw new Error('Malformed quoted field. Switch to source view to inspect this file.'); cell += char; }
  }
  if (partial) return { rows, truncated: true }; // Do not invent a complete final record after a byte cutoff.
  if (quoted) throw new Error('Unclosed quoted field. Switch to source view to inspect this file.');
  if (cell || closed || row.length || !/[\r\n]$/.test(text)) record();
  return { rows, truncated };
}
