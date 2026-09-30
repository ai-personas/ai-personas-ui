import { DrawingBuilder, arcPoints, finite, positiveAngle, type Drawing, type Point } from './engineering.ts';
/** Deliberately strict modal subset. Unknown position-changing commands fail closed. */
export function parseGcode(text: string): Drawing {
  const out = new DrawingBuilder(); out.drawing.units = 'mm';
  out.warn('Inspection only, NOT a machine simulation or manufacturing approval. Origin starts at XYZ 0; units default to mm and distances to absolute until specified. No offsets, compensation, stock, collision or machine kinematics are evaluated.');
  let position: Point = [0, 0, 0], scale = 1, absolute = true, motion: number | undefined;
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    if (index > 100_000) throw new Error('G-code line limit exceeded.');
    const fail = (message: string): never => { throw new Error(`Line ${index + 1}: ${message} Use source view; unsupported machine behavior is not guessed.`); };
    let line = '', comment = false;
    for (const char of lines[index]) {
      if (!comment && char === ';') break;
      if (char === '(') { if (comment) fail('Nested comments are unsupported.'); comment = true; }
      else if (char === ')') { if (!comment) fail('Unmatched comment delimiter.'); comment = false; }
      else if (!comment) line += char;
    }
    if (comment) fail('Unclosed comment.');
    line = line.trim().toUpperCase(); if (!line || line === '%') continue;
    const words = [...line.matchAll(/([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g)];
    if (line.replace(/([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g, '').trim()) fail('Macros, checksums, expressions or unknown syntax are unsupported.');
    const values = new Map<string, number>(), codes: number[] = [], misc: number[] = [];
    for (const [, key, raw] of words) {
      const value = finite(raw);
      if (key === 'G') codes.push(value);
      else if (key === 'M') misc.push(value);
      else if (!'NXYZIJRFSTP'.includes(key)) fail(`Unsupported word ${key}.`);
      else { if (values.has(key)) fail(`Repeated ${key} word.`); values.set(key, value); }
    }
    const groups = [codes.filter(c => [0, 1, 2, 3].includes(c)), codes.filter(c => [20, 21].includes(c)), codes.filter(c => [90, 91].includes(c))];
    if (groups.some(g => g.length > 1)) fail('Conflicting modal commands.');
    for (const g of codes) {
      if ([0, 1, 2, 3].includes(g)) motion = g;
      else if (g === 20) scale = 25.4;
      else if (g === 21) scale = 1;
      else if (g === 90) absolute = true;
      else if (g === 91) absolute = false;
      else if (![4, 17, 40, 49, 80, 91.1, 94].includes(g)) fail(`Unsupported G${g}.`);
    }
    if (misc.some(m => ![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 30].includes(m))) fail('Unsupported M code.');
    if (misc.length || values.has('T') || values.has('S')) out.warn('Spindle, coolant, tool changes and stops are not simulated.');
    if (codes.includes(80)) motion = undefined;
    if (codes.includes(4)) {
      if (codes.some(c => [0, 1, 2, 3, 80].includes(c)) || [...values.keys()].some(k => !'NP'.includes(k)) || misc.length) fail('Unsupported dwell block.');
      continue;
    }
    if (values.has('P')) fail('P is supported only for a standalone G4 dwell.');
    const hasAxes = ['X', 'Y', 'Z'].some(key => values.has(key)), hasCenter = ['I', 'J', 'R'].some(key => values.has(key));
    if (hasAxes || hasCenter) {
      if (motion === undefined) fail('Coordinates precede a supported motion mode.');
      const next = position.map((p, i) => values.has('XYZ'[i]) ? (absolute ? 0 : p) + values.get('XYZ'[i])! * scale : p) as Point;
      next.forEach(finite);
      if (motion === 0 || motion === 1) {
        if (hasCenter) fail('Arc parameters on a linear move.');
        out.path([[...position], next], motion === 0 ? 'Rapid G0' : 'Feed G1');
      } else {
        let center: Point;
        if (values.has('R')) {
          if (values.has('I') || values.has('J')) fail('Both radius and center arc formats are present.');
          const signedRadius = values.get('R')! * scale, radius = Math.abs(signedRadius), dx = next[0] - position[0], dy = next[1] - position[1], chord = Math.hypot(dx, dy);
          if (!chord || !radius || chord > 2 * radius) fail('Invalid radius arc.');
          const height = Math.sqrt(Math.max(0, radius * radius - chord * chord / 4)) * (motion === 2 ? -1 : 1) * (signedRadius < 0 ? -1 : 1);
          center = [(position[0] + next[0]) / 2 - dy / chord * height, (position[1] + next[1]) / 2 + dx / chord * height, position[2]];
        } else {
          if (!values.has('I') && !values.has('J')) fail('Arc requires incremental I/J center offsets or R.');
          center = [position[0] + (values.get('I') || 0) * scale, position[1] + (values.get('J') || 0) * scale, position[2]];
        }
        const radius = Math.hypot(position[0] - center[0], position[1] - center[1]), endRadius = Math.hypot(next[0] - center[0], next[1] - center[1]);
        if (!radius || Math.abs(radius - endRadius) > Math.max(.01, radius * .001)) fail('Arc endpoint is not on the specified circle.');
        const start = Math.atan2(position[1] - center[1], position[0] - center[0]), end = Math.atan2(next[1] - center[1], next[0] - center[0]);
        const angle = motion === 2 ? -(positiveAngle(start - end) || Math.PI * 2) : (positiveAngle(end - start) || Math.PI * 2);
        const points = arcPoints(center, radius, start, angle, next[2]); points[0] = [...position]; points[points.length - 1] = next;
        out.path(points, motion === 2 ? 'Arc G2' : 'Arc G3');
      }
      position = next;
    }
    if (misc.includes(2) || misc.includes(30)) break;
  }
  return out.finish();
}
