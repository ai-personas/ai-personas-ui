import assert from 'node:assert/strict';
import {artifactDispatch,LOCAL_RENDERER_MANIFEST,selectBuiltinArtifactRenderer,selectLocalArtifactModule} from '../assets/artifact-types.mjs';

const expected=new Map([
  ['board.gbr','gerber.mjs'],['board.kicad_pcb','kicad.mjs'],['inverter.cir','netlist.mjs'],
  ['switching.vcd','waveform.mjs'],['outline.dxf','dxf.mjs'],['enclosure.step','cad3d.mjs'],
  ['federated-model.ifc','cad3d.mjs'],
  ['report.pdf','pdf.mjs'],['bom.csv','table.mjs'],['trace.ndjson','datatree.mjs'],['readme.md','mdrich.mjs'],
]);
for(const [name,module] of expected) assert.equal(selectLocalArtifactModule(name,'')?.entry.file,module,name);
assert.equal(new Set(LOCAL_RENDERER_MANIFEST.map((entry)=>entry.file)).size,10);
assert.equal(selectLocalArtifactModule('unknown.bin','application/x-private'),null);
assert.deepEqual(selectBuiltinArtifactRenderer('photo.avif',''),{id:'image',ext:'avif'});
assert.equal(artifactDispatch('audio.opus','').adapterId,'builtin:audio');
assert.equal(artifactDispatch('movie.webm','').adapterId,'builtin:video');
assert.equal(artifactDispatch('unsafe.html','').adapterId,'builtin:code');
assert.equal(artifactDispatch('payload.bin','application/x-private').adapterId,'builtin:generic');
assert.equal(artifactDispatch('payload.bin','application/x-private').fetchMode,'bytes');
assert.equal(artifactDispatch('no-extension','table').module,'table.mjs');
assert.ok(!artifactDispatch('payload.bin','application/x-private').module);
assert.equal(artifactDispatch('opaque.payload','authored arbitrary role').adapterId,'builtin:generic');
console.log('artifact renderer dispatch matrix: ok');
