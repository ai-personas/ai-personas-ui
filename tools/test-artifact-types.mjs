import assert from 'node:assert/strict';
import {
  ARTIFACT_SNIFF_LIMITS,
  artifactDispatch,
  LOCAL_RENDERER_MANIFEST,
  resolveVerifiedArtifactDispatch,
  selectBuiltinArtifactRenderer,
  selectLocalArtifactModule,
  sniffArtifactFormat,
} from '../assets/artifact-types.mjs';

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

const utf8=(value)=>new TextEncoder().encode(value);
const png=Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,1]);
const jpeg=Uint8Array.from([0xff,0xd8,0xff,0xe0,0,0]);
const webp=utf8('RIFF\u0004\u0000\u0000\u0000WEBPVP8 ');
const pdf=utf8('%PDF-1.7\nfixture');
assert.equal(sniffArtifactFormat(png)?.format,'png');
assert.equal(sniffArtifactFormat(jpeg)?.format,'jpeg');
assert.equal(sniffArtifactFormat(webp)?.format,'webp');
assert.equal(sniffArtifactFormat(pdf)?.format,'pdf');
let resolved=resolveVerifiedArtifactDispatch('no-extension','',png);
assert.equal(resolved.effective.adapterId,'builtin:image');
assert.equal(resolved.inferred,true);
assert.equal(resolved.contradiction,false);
resolved=resolveVerifiedArtifactDispatch('portrait.pdf','application/pdf',png);
assert.equal(resolved.effective.adapterId,'builtin:image');
assert.equal(resolved.contradiction,true);
resolved=resolveVerifiedArtifactDispatch('photo.png','image/png',pdf);
assert.equal(resolved.effective.adapterId,'local:pdf.mjs');
assert.equal(resolved.contradiction,true);

const step=utf8('ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((\'fixture\'),\'2;1\');\nENDSEC;');
const ifc=utf8("ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4'));\nENDSEC;");
assert.equal(sniffArtifactFormat(step)?.format,'step');
assert.equal(sniffArtifactFormat(ifc)?.format,'ifc');
assert.equal(resolveVerifiedArtifactDispatch('model','',step).effective.adapterId,'local:cad3d.mjs');
assert.equal(resolveVerifiedArtifactDispatch('drawing.txt','text',ifc).contradiction,true);
assert.equal(sniffArtifactFormat(utf8('ply\nformat ascii 1.0\nelement vertex 3\nend_header\n'))?.format,'ply');
assert.equal(sniffArtifactFormat(utf8('solid mesh\nfacet normal 0 0 1\nouter loop\nendloop\nendfacet\nendsolid'))?.format,'stl');
assert.equal(sniffArtifactFormat(utf8('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'))?.format,'obj');
assert.equal(sniffArtifactFormat(utf8('0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n'))?.format,'dxf');
assert.equal(sniffArtifactFormat(utf8('(kicad_pcb (version 20240108) (generator pcbnew))'))?.format,'kicad_pcb');
assert.equal(sniffArtifactFormat(utf8('G04 fixture*\n%FSLAX24Y24*%\n%MOMM*%\nX1Y1D01*'))?.format,'gerber');
assert.equal(sniffArtifactFormat(Uint8Array.from([0x67,0x6c,0x54,0x46,2,0,0,0,12,0,0,0]))?.format,'glb');
const binaryStl=new Uint8Array(84+50); new DataView(binaryStl.buffer).setUint32(80,1,true);
assert.equal(sniffArtifactFormat(binaryStl)?.format,'stl');
const threeMf=utf8('PK\u0003\u0004[Content_Types].xml 3D/3dmodel.model');
assert.equal(sniffArtifactFormat(threeMf)?.format,'3mf');
const boundedZip=new Uint8Array(ARTIFACT_SNIFF_LIMITS.binaryBytes+32);
boundedZip.set([0x50,0x4b,0x03,0x04]);
boundedZip.set(utf8('3D/3dmodel.model'),ARTIFACT_SNIFF_LIMITS.binaryBytes+2);
assert.equal(sniffArtifactFormat(boundedZip)?.format,'zip');
assert.equal(sniffArtifactFormat(utf8('<script>globalThis.pwned=true</script>')),null);
console.log('artifact renderer dispatch matrix: ok');
