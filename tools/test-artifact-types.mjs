import assert from 'node:assert/strict';

import {
  artifactTypeLabel,
  selectArtifactRenderer,
  sniffArtifactMediaType,
} from '../assets/artifact-types.mjs';

const png=Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
assert.equal(sniffArtifactMediaType(png),'image/png');
assert.deepEqual(selectArtifactRenderer('application/octet-stream',{
  path:'external-artifacts/content-address-without-suffix',
  responseMedia:'application/octet-stream',contentMedia:sniffArtifactMediaType(png),
}),{id:'image',mediaType:'image/png',source:'bytes'});

const pdf=new TextEncoder().encode('%PDF-1.7\n');
assert.equal(sniffArtifactMediaType(pdf),'application/pdf');
assert.deepEqual(selectArtifactRenderer('image/png',{contentMedia:sniffArtifactMediaType(pdf)}),
  {id:'pdf',mediaType:'application/pdf',source:'bytes'},
  'a verified byte signature safely outranks a conflicting declaration');

const markdown=new TextEncoder().encode('# House design\n\nFour bedrooms.');
assert.equal(sniffArtifactMediaType(markdown),'text/plain');
assert.deepEqual(selectArtifactRenderer('text/markdown',{contentMedia:sniffArtifactMediaType(markdown)}),
  {id:'markdown',mediaType:'text/markdown',source:'declared'},
  'generic text sniffing must not erase a specific signed text format');

const json=new TextEncoder().encode('{"bedrooms":4}');
assert.equal(sniffArtifactMediaType(json),'application/json');
assert.equal(selectArtifactRenderer('',{contentMedia:sniffArtifactMediaType(json)}).id,'code');

const ifc=new TextEncoder().encode("ISO-10303-21;\nHEADER;FILE_SCHEMA(('IFC4'));ENDSEC;\nDATA;\n#1=IFCPROJECT('id');\nENDSEC;\nEND-ISO-10303-21;");
assert.equal(sniffArtifactMediaType(ifc),'model/ifc');
assert.deepEqual(selectArtifactRenderer('application/octet-stream',{
  path:'opaque-model',contentMedia:sniffArtifactMediaType(ifc),
}),{id:'cad3d',mediaType:'model/ifc',source:'bytes'});
assert.equal(artifactTypeLabel('model/ifc'),'IFC building model');

const dxf=new TextEncoder().encode('0\nSECTION\n2\nENTITIES\n0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n0\nENDSEC\n0\nEOF\n');
assert.equal(sniffArtifactMediaType(dxf),'image/vnd.dxf');
assert.equal(selectArtifactRenderer('',{path:'plan.dxf'}).id,'dxf');
assert.equal(artifactTypeLabel('image/vnd.dxf'),'DXF drawing');

const zip=Uint8Array.from([0x50,0x4b,0x03,0x04,0,0,0,0]);
assert.deepEqual(selectArtifactRenderer('',{
  path:'floor-schedule.xlsx',contentMedia:sniffArtifactMediaType(zip),
}),{
  id:'archive',
  mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  source:'path',
});
assert.equal(artifactTypeLabel('image/png'),'PNG image');
assert.equal(artifactTypeLabel('text/markdown'),'Markdown document');
assert.equal(artifactTypeLabel('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),'Excel workbook');

console.log('artifact type and verified-byte rendering tests passed');
