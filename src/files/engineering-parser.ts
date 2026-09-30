import { ENGINEERING_BYTES, type Drawing, type EngineeringFormat } from './engineering.ts';
import { parseDxf } from './dxf.ts';
import { parseGcode } from './gcode.ts';
import { parseKicad } from './kicad.ts';
export function parseEngineering(buffer: ArrayBuffer, format: EngineeringFormat): Drawing {
  if (buffer.byteLength > ENGINEERING_BYTES) throw new Error('Engineering preview exceeds 4 MiB. Download the original or export a smaller drawing.');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { throw new Error('This preview requires a UTF-8 / ASCII file. Export it as UTF-8 in the authoring application.'); }
  if (text.includes('\0')) throw new Error('Binary engineering files are not supported by the text geometry reader.');
  if (format === 'dxf') return parseDxf(text);
  if (format === 'gcode') return parseGcode(text);
  if (format === 'pcb' || format === 'footprint' || format === 'schematic') return parseKicad(text, format);
  throw new Error('Unknown engineering preview format.');
}
