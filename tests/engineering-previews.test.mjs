import test from 'node:test';
import assert from 'node:assert/strict';
import { fileFormat, previewLimit, archivePath } from '../src/files/formats.ts';
import { ENGINEERING_BYTES, MAX_DRAW_POINTS, DrawingBuilder, engineeringFormat, engineeringAdvice, throughArc } from '../src/files/engineering.ts';
import { parseEngineering } from '../src/files/engineering-parser.ts';
import { parseSExpr } from '../src/files/kicad.ts';
import { drawEngineering, initialDrawingView } from '../src/files/engineering-renderer.ts';
const bytes = text => new TextEncoder().encode(text).buffer;
const parse = (text, format) => parseEngineering(bytes(text), format);
const dxf = entities => '0\nSECTION\n2\nENTITIES\n' + entities + '\n0\nENDSEC\n0\nEOF\n';
const line = '0\nLINE\n8\nOutline\n10\n0\n20\n0\n11\n10\n21\n5';
const board = body => `(kicad_pcb (version 20240108) ${body})`;
const track = '(segment (start 0 0) (end 10 5) (width 0.25) (layer "F.Cu"))';
const near = (a, b) => { assert.equal(a.length, b.length); a.forEach((v, i) => assert(Math.abs(v - b[i]) < 1e-7, `${a} != ${b}`)); };
const last = drawing => drawing.paths.at(-1).points.at(-1);
function valid(drawing) { assert(drawing.paths.length); for (const path of drawing.paths) { assert(path.points.length >= 2); assert(path.points.flat().every(Number.isFinite)); } return drawing; }

test('engineering extensions route with generic MIME and mixed case', () => {
  for (const ext of ['DXF', 'gcode', 'NC', 'tap', 'kicad_pcb', 'kicad_mod', 'kicad_sch']) assert.equal(fileFormat('folder/a.' + ext, 'application/octet-stream').kind, 'engineering');
  assert.equal(previewLimit('engineering'), ENGINEERING_BYTES);
});
test('existing model, table, authored HTML and unknown binary routing stays intact', () => {
  assert.equal(fileFormat('a.glb').kind, 'model'); assert.equal(fileFormat('a.csv').kind, 'table');
  assert.equal(fileFormat('a.html', 'model/stl').kind, 'text'); assert.equal(fileFormat('a.blend').kind, 'unsupported');
  assert.equal(fileFormat('a.fbx').kind, 'unsupported'); assert.equal(fileFormat('a.step').kind, 'text');
});
test('format dispatch rejects object prototype names', () => {
  for (const name of ['constructor', 'a.__proto__', 'a.toString']) { assert.equal(engineeringFormat(name), undefined); assert.equal(engineeringAdvice(name), ''); }
});
test('native format guidance is specific without promising a converter', () => {
  assert.match(engineeringAdvice('scene.BLEND'), /not executed/); assert.match(engineeringAdvice('part.step'), /ASCII DXF/);
  assert.match(engineeringAdvice('board.gbr'), /polarity/); assert.match(engineeringAdvice('scene.usdz'), /self-contained/);
});
test('parser checks byte, encoding and binary boundaries', () => {
  assert.throws(() => parseEngineering(new ArrayBuffer(ENGINEERING_BYTES + 1), 'dxf'), /4 MiB/);
  assert.throws(() => parseEngineering(Uint8Array.of(255).buffer, 'dxf'), /UTF-8/);
  assert.throws(() => parse('\0', 'dxf'), /Binary/); assert.throws(() => parse('test', '__proto__'), /Unknown/);
});
test('DXF LINE preserves coordinates and layers', () => { const d = valid(parse(dxf(line), 'dxf')); assert.equal(d.paths[0].layer, 'Outline'); near(last(d), [10, 5, 0]); assert.equal(d.units, 'drawing units'); });
test('DXF circles and counterclockwise wrapped arcs are tessellated', () => {
  const d = valid(parse(dxf('0\nCIRCLE\n10\n1\n20\n2\n40\n3\n0\nARC\n10\n0\n20\n0\n40\n1\n50\n350\n51\n10'), 'dxf'));
  assert(d.paths[0].closed); near(d.paths[0].points[0], [4, 2, 0]); assert(d.paths[1].points.length < 20);
});
test('DXF LWPOLYLINE supports closed outlines and positive/negative bulges', () => {
  for (const bulge of [1, -1]) { const d = valid(parse(dxf(`0\nLWPOLYLINE\n90\n2\n70\n1\n10\n0\n20\n0\n42\n${bulge}\n10\n2\n20\n0`), 'dxf')); assert.equal(d.paths.length, 2); near(d.paths[0].points.at(-1), [2, 0, 0]); assert(d.paths[0].points.some(p => bulge > 0 ? p[1] < -.9 : p[1] > .9)); }
});
test('DXF never counts BLOCKS as placed geometry and reports omissions', () => {
  const d = parse(dxf(line + '\n0\nINSERT\n2\nremote-block'), 'dxf'); assert.equal(d.paths.length, 1); assert(d.warnings.some(w => /1 unsupported/.test(w)));
  assert.throws(() => parse('0\nSECTION\n2\nBLOCKS\n' + line + '\n0\nENDSEC\n0\nEOF', 'dxf'), /ENTITIES/);
});
test('DXF non-default extrusion is omitted, not falsely projected', () => { const d = parse(dxf(line + '\n0\nLINE\n10\n0\n20\n0\n11\n2\n21\n2\n230\n-1'), 'dxf'); assert.equal(d.paths.length, 1); assert(d.warnings.some(w => /unsupported/.test(w))); });
test('DXF rejects malformed, missing, nonfinite and excessive geometry', () => {
  for (const text of [dxf(line).replace('0\nEOF', ''), '0\nSECTION\n2', dxf(line.replace('10\n0', '10\nNaN')), dxf('0\nCIRCLE\n10\n0\n20\n0\n40\n0'), dxf('0\nLWPOLYLINE\n90\n3\n10\n0\n20\n0\n10\n1\n20\n1')]) assert.throws(() => parse(text, 'dxf'));
});
test('G-code supports millimeter absolute and incremental linear moves', () => {
  const d = valid(parse('G21 G90\nG0 X10 Y5\nG91\nG1 X2 Y-1 Z3\nX1\nG90\nG1 X20', 'gcode'));
  near(last(d), [20, 4, 3]); assert.equal(d.paths[0].layer, 'Rapid G0'); assert.equal(d.paths[1].layer, 'Feed G1');
});
test('G-code inches convert to mm without rescaling earlier coordinates', () => { const d = parse('G20 G90 G0 X1\nG21 G91 G1 X1', 'gcode'); near(last(d), [26.4, 0, 0]); });
test('G-code comments and compact words are handled without evaluation', () => { near(last(parse('N10G21G90\nG0X1Y2(foo) ; G92 X400\nG1X3', 'gcode')), [3, 2, 0]); });
test('G-code I/J arcs support both directions and helical Z', () => {
  for (const [code, y] of [[3, 1], [2, -1]]) { const d = valid(parse(`G0 X1\nG${code} X0 Y${y} Z2 I-1 J0`, 'gcode')); near(last(d), [0, y, 2]); near(d.paths[1].points[0], [1, 0, 0]); }
});
test('G-code R arcs support minor and major sweeps', () => {
  const minor = parse('G0 X1\nG3 X0 Y1 R1', 'gcode'), major = parse('G0 X1\nG3 X0 Y1 R-1', 'gcode');
  near(last(minor), [0, 1, 0]); near(last(major), [0, 1, 0]); assert(major.paths[1].points.length > minor.paths[1].points.length * 2);
});
test('G-code full circles retain the commanded endpoint', () => { const d = parse('G0 X1\nG2 I-1 J0', 'gcode'); near(last(d), [1, 0, 0]); assert(d.paths[1].points.length >= 180); });
test('G-code M2/M30 ends the program and ignores later blocks', () => { for (const end of ['M2', 'M30']) near(last(parse(`G1 X1\n${end}\nG1 X999`, 'gcode')), [1, 0, 0]); });
test('G-code dwell does not cause an inherited modal move', () => { const d = parse('G1 X1\nG4 P10\nG1 X2', 'gcode'); assert.equal(d.paths.length, 2); assert.throws(() => parse('G1 X1\nG4 X10', 'gcode'), /dwell/); });
test('G-code mode conflicts, duplicate words and coordinates before motion fail', () => {
  for (const s of ['X1', 'G0 G1 X1', 'G20 G21 G0 X1', 'G90 G91 G0 X1', 'G0 X1 X2', 'G1 X1\nG80\nX2']) assert.throws(() => parse(s, 'gcode'), /Line/);
});
test('G-code dangerous-to-guess coordinate modes and cycles fail closed', () => {
  for (const code of [10, 18, 19, 28, 41, 43, 53, 54, 68, 81, 90.1, 92]) assert.throws(() => parse(`G0 X1\nG${code} X2`, 'gcode'), /Unsupported G/);
});
test('G-code unsupported M codes, axes, macros and checksums are rejected', () => {
  for (const s of ['G1 X#1', 'G1 X[1+2]', 'G1 X1*99', 'M98 P1', 'G1 A90', 'G1 X1 E2', 'G1 X1 (unterminated', 'G1 X1 )', 'G1 X1 (nested(a))']) assert.throws(() => parse(s, 'gcode'));
});
test('G-code invalid arcs are rejected, never drawn as straight chords', () => {
  for (const s of ['G2 X1', 'G2 X1 I0 J0', 'G2 X1 I1 R2', 'G2 X10 R1', 'G0 X1\nG3 X0 Y2 I-1', 'G1 X1 I2']) assert.throws(() => parse(s, 'gcode'));
});
test('KiCad tokenizer handles quoted parentheses and escapes literally', () => { assert.deepEqual(parseSExpr('(a "b(\\\"c)" (d 2))'), ['a', 'b("c)', ['d', '2']]); });
test('KiCad tokenizer rejects truncation, extra roots, strings and deep nesting', () => {
  for (const s of ['(', '(a', '(a))', '(a)(b)', '(a "unterminated)', '('.repeat(66) + ')'.repeat(66)]) assert.throws(() => parseSExpr(s));
});
test('KiCad enforces token budget', () => { assert.throws(() => parseSExpr('(a ' + 'x '.repeat(250_001) + ')'), /token limit/); });
test('KiCad dispatch requires correct modern root', () => { assert.throws(() => parse(board(track), 'schematic'), /kicad_sch/); assert.throws(() => parse('(module test)', 'footprint'), /modern/); });
test('KiCad PCB tracks retain widths and native downward Y orientation', () => { const d = valid(parse(board(track), 'pcb')); assert.equal(d.paths[0].width, .25); assert.equal(d.paths[0].layer, 'F.Cu'); assert(d.yDown); near(last(d), [10, 5, 0]); });
test('KiCad board outlines, circles and modern arcs render', () => {
  const d = valid(parse(board('(gr_rect (start 0 0) (end 20 10) (stroke (width 0.1)) (layer "Edge.Cuts")) (gr_circle (center 3 3) (end 4 3) (layer "F.SilkS")) (arc (start 1 0) (mid 0 1) (end -1 0) (width 0.2) (layer "F.Cu"))'), 'pcb'));
  assert.equal(d.paths.length, 3); assert(d.paths[0].closed); near(last(d), [-1, 0, 0]);
});
test('KiCad footprint-local positions transform without rotating pad angles twice', () => {
  const d = valid(parse(board('(footprint "Test" (at 10 20 90) (fp_line (start 0 0) (end 2 0) (layer "F.SilkS")) (pad "1" smd rect (at 2 0 90) (size 4 2) (layers "F.Cu")))'), 'pcb'));
  near(d.paths[0].points[1], [10, 18, 0]); near(d.paths[1].points[0], [9, 20, 0]);
});
test('KiCad standalone footprints, circular pads, vias and drills render', () => {
  valid(parse('(footprint "Pad" (pad "1" thru_hole circle (at 0 0) (size 2 2) (drill 1) (layers "*.Cu" "*.Mask")))', 'footprint'));
  const d = valid(parse(board('(via (at 2 2) (size 1) (drill 0.5) (layers "F.Cu" "B.Cu"))'), 'pcb')); assert(d.layers.includes('Drill'));
});
test('KiCad zones are explicitly boundaries, not copper pours', () => { const d = parse(board('(zone (layer "F.Cu") (polygon (pts (xy 0 0) (xy 2 0) (xy 2 2))))'), 'pcb'); assert.match(d.paths[0].layer, /zone boundary/); assert(d.warnings.some(w => /not copper fills/.test(w))); });
test('KiCad custom pads, old arcs and external models are not interpreted', () => {
  const d = parse(board(track + '(gr_arc (start 0 0) (end 1 0) (angle 90)) (footprint "Test" (pad "1" smd custom (at 0 0) (size 2 2) (layers "F.Cu")) (model "https://invalid.example/private.step"))'), 'pcb');
  assert.equal(d.paths.length, 1); assert(d.warnings.some(w => /custom/.test(w))); assert(d.warnings.some(w => /Legacy/.test(w)));
});
test('KiCad schematic draws wires, buses, junctions and explicit anchor markers', () => {
  const d = valid(parse('(kicad_sch (wire (pts (xy 0 0) (xy 5 0))) (bus (pts (xy 0 2) (xy 5 2))) (junction (at 5 0) (diameter 0)) (symbol (lib_id "Device:R") (at 5 5)) (label "NET<script>" (at 1 1)) (sheet (at 10 10) (size 5 5)))', 'schematic'));
  assert(d.layers.includes('Wires')); assert(d.layers.includes('Symbol anchors (not outlines)')); assert(d.warnings.some(w => /Symbol graphics/.test(w)));
});
test('KiCad malformed coordinates, pad sizes and empty geometry fail', () => {
  for (const s of [board(track.replace('(end 10 5)', '(end 10)')), board(track.replace('10 5', 'NaN 5')), board(''), board('(footprint "X" (pad "1" smd rect (size -2 1)))')]) assert.throws(() => parse(s, 'pcb'));
});
test('geometry builders enforce point, path and layer bounds', () => {
  const a = new DrawingBuilder(); assert.throws(() => a.path(Array.from({ length: MAX_DRAW_POINTS + 1 }, () => [0, 0, 0])), /point/);
  const b = new DrawingBuilder(); for (let i = 0; i < 10_000; i++) b.path([[0, 0, 0], [1, 1, 1]]); assert.throws(() => b.path([[0, 0, 0], [1, 1, 1]]), /path/);
  const c = new DrawingBuilder(); for (let i = 0; i < 128; i++) c.path([[0, 0, 0], [1, 1, 1]], String(i)); assert.throws(() => c.path([[0, 0, 0], [1, 1, 1]], 'extra'), /layer/);
});
test('geometry builders reject nonfinite values, negative widths and degenerate arcs', () => {
  const b = new DrawingBuilder(); assert.throws(() => b.path([[0, 0, 0], [Infinity, 1, 1]])); assert.throws(() => b.path([[0, 0, 0], [1, 1, 1]], 'x', -1)); assert.throws(() => throughArc([0, 0, 0], [1, 1, 0], [2, 2, 0]), /Degenerate/);
});
test('Canvas renderer supports filtering and bounds its backing store', () => {
  const previous = globalThis.window; globalThis.window = { devicePixelRatio: 3 }; let strokes = 0;
  const context = { setTransform() {}, setLineDash() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() { strokes++; } };
  const canvas = { clientWidth: 8000, clientHeight: 1000, getContext: () => context };
  try { const d = parse(dxf(line), 'dxf'); drawEngineering(canvas, d, initialDrawingView()); assert.equal(strokes, 1); assert(canvas.width <= 4096 && canvas.height <= 4096); const v = initialDrawingView(); v.hidden.add('Outline'); drawEngineering(canvas, d, v); assert.equal(strokes, 1); }
  finally { globalThis.window = previous; }
});
test('Canvas unavailable fails with an actionable source fallback', () => { assert.throws(() => drawEngineering({ getContext: () => null }, parse(dxf(line), 'dxf'), initialDrawingView()), /Canvas 2D is unavailable/); });
test('archive path protections are unchanged for engineering files', () => { assert.equal(archivePath('./board/part.kicad_pcb'), 'board/part.kicad_pcb'); assert.throws(() => archivePath('../part.dxf'), /safely/); });
