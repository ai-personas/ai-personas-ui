/*
 * Generic artifact presentation policy.
 *
 * A filename is an opaque persona-authored path, not a semantic declaration.
 * The browser may use its suffix as a low-trust presentation hint, but it never
 * infers what an artifact means from its name or body. After an artifact body
 * has passed its advertised SHA-256 check, a bounded magic-byte inspection may
 * identify its container/media format. That is presentation metadata only: it
 * grants no authority and never enables peer-authored code.
 */

const MEDIA_TYPE_LIMIT = 256;
const MEDIA_TYPE = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/;
const GENERIC_MEDIA_TYPES = new Set(['application/octet-stream','binary/octet-stream']);
// `text/plain` describes a transport-safe byte family, not a format. It is a
// common fallback for source formats whose server does not carry a registered
// media type. A verified, format-specific suffix may therefore refine it for
// presentation in the same way that a suffix refines an octet-stream response.
// Specific declared media types still outrank every path hint.
const AMBIGUOUS_MEDIA_TYPES = new Set([...GENERIC_MEDIA_TYPES,'text/plain']);
const PATH_MEDIA_TYPES = Object.freeze({
  svg:'image/svg+xml',
  avif:'image/avif',
  bmp:'image/bmp',
  ico:'image/x-icon',
  tif:'image/tiff',
  tiff:'image/tiff',
  dxf:'image/vnd.dxf',
  scad:'model/openscad',
  obj:'model/obj',
  stl:'model/stl',
  step:'model/step',
  stp:'model/step',
  ifc:'model/ifc',
  ply:'model/ply',
  gltf:'model/gltf+json',
  glb:'model/gltf-binary',
  json:'application/json',
  jsonl:'application/x-ndjson',
  ndjson:'application/x-ndjson',
  geojson:'application/geo+json',
  md:'text/markdown',
  markdown:'text/markdown',
  csv:'text/csv',
  tsv:'text/tab-separated-values',
  cir:'text/x-spice',
  spice:'text/x-spice',
  sp:'text/x-spice',
  asc:'text/x-spice',
  sch:'text/plain',
  brd:'text/plain',
  kicad_sch:'text/x-kicad-schematic',
  kicad_pcb:'text/x-kicad-pcb',
  kicad_sym:'text/x-kicad-symbol',
  kicad_mod:'text/x-kicad-footprint',
  kicad_dru:'text/plain',
  kicad_pro:'application/json',
  kicad_prl:'application/json',
  gbr:'text/x-gerber',
  ger:'text/x-gerber',
  pho:'text/x-gerber',
  drl:'text/x-excellon',
  xln:'text/x-excellon',
  gbrjob:'application/json',
  ibs:'text/plain',
  s1p:'text/plain',
  s2p:'text/plain',
  s3p:'text/plain',
  s4p:'text/plain',
  v:'text/x-verilog',
  sv:'text/x-systemverilog',
  vhd:'text/x-vhdl',
  vhdl:'text/x-vhdl',
  txt:'text/plain',
  log:'text/plain',
  xml:'application/xml',
  html:'text/html',
  htm:'text/html',
  css:'text/css',
  js:'text/javascript',
  mjs:'text/javascript',
  cjs:'text/javascript',
  ts:'text/typescript',
  tsx:'text/typescript',
  jsx:'text/javascript',
  py:'text/x-python',
  rb:'text/x-ruby',
  go:'text/x-go',
  rs:'text/x-rust',
  java:'text/x-java-source',
  c:'text/x-c',
  h:'text/x-c',
  cc:'text/x-c++',
  cpp:'text/x-c++',
  hpp:'text/x-c++',
  sh:'text/x-shellscript',
  bash:'text/x-shellscript',
  zsh:'text/x-shellscript',
  sql:'application/sql',
  yaml:'application/yaml',
  yml:'application/yaml',
  toml:'application/toml',
  ini:'text/plain',
  png:'image/png',
  jpg:'image/jpeg',
  jpeg:'image/jpeg',
  gif:'image/gif',
  webp:'image/webp',
  pdf:'application/pdf',
  mp3:'audio/mpeg',
  wav:'audio/wav',
  flac:'audio/flac',
  ogg:'audio/ogg',
  oga:'audio/ogg',
  m4a:'audio/mp4',
  aac:'audio/aac',
  mp4:'video/mp4',
  m4v:'video/mp4',
  mov:'video/quicktime',
  webm:'video/webm',
  ogv:'video/ogg',
  avi:'video/x-msvideo',
  zip:'application/zip',
  gz:'application/gzip',
  tgz:'application/gzip',
  tar:'application/x-tar',
  rar:'application/vnd.rar',
  '7z':'application/x-7z-compressed',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt:'application/vnd.oasis.opendocument.text',
  ods:'application/vnd.oasis.opendocument.spreadsheet',
  odp:'application/vnd.oasis.opendocument.presentation',
  epub:'application/epub+zip',
});

const ARCHIVE_MEDIA_TYPES = new Set([
  'application/zip','application/gzip','application/x-gzip','application/x-tar',
  'application/vnd.rar','application/x-rar-compressed','application/x-7z-compressed',
  'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]);

// These formats have unambiguous bounded signatures. Once the bytes have been
// hash-checked, their observed signature outranks transport/path hints for safe
// renderer selection. Text detection remains a fallback so a Markdown/CSV
// declaration is not weakened to generic text.
const STRONG_CONTENT_MEDIA_TYPES = new Set([
  'image/png','image/jpeg','image/gif','image/webp','image/bmp','image/tiff','image/x-icon','image/avif','image/heif',
  'application/pdf','application/zip','application/gzip','application/x-7z-compressed','application/vnd.rar',
  'audio/mpeg','audio/wav','audio/flac','audio/ogg','audio/mp4',
  'video/mp4','video/quicktime','video/webm','video/ogg','video/x-msvideo',
  'font/woff','font/woff2','application/wasm','application/vnd.sqlite3',
  'image/vnd.dxf','model/step','model/ifc','model/stl','model/obj','model/ply',
  'model/gltf+json','model/gltf-binary',
]);

function declaredMediaType(value) {
  const raw=String(value||'').trim().toLowerCase();
  if(!raw || raw.length>MEDIA_TYPE_LIMIT) return '';
  const media=raw.split(';',1)[0].trim();
  return MEDIA_TYPE.test(media)?media:'';
}

/**
 * Select a repository-owned, non-executable presentation family from declared
 * media metadata. This is intentionally a small set of generic Web media
 * families, not a catalog of task domains or artifact filename conventions.
 */
export function selectDeclaredArtifactRenderer(mediaKind) {
  const mediaType=declaredMediaType(mediaKind);
  let id='generic';
  if(['image/vnd.dxf','image/x-dxf','application/dxf','application/x-dxf']
    .includes(mediaType)) id='dxf';
  else if(['model/step','application/step','application/x-step','model/ifc',
    'application/x-ifc','model/obj','model/stl','model/ply','model/gltf+json',
    'model/gltf-binary'].includes(mediaType)) id='cad3d';
  else if(['model/openscad','application/x-openscad'].includes(mediaType)) id='openscad';
  else if(mediaType==='text/markdown') id='markdown';
  else if(mediaType==='text/csv'||mediaType==='text/tab-separated-values') id='csv';
  else if(mediaType.startsWith('image/')) id='image';
  else if(mediaType.startsWith('audio/')) id='audio';
  else if(mediaType.startsWith('video/')) id='video';
  else if(mediaType==='application/pdf') id='pdf';
  else if(ARCHIVE_MEDIA_TYPES.has(mediaType)) id='archive';
  else if(mediaType==='application/geo+json') id='geojson';
  else if(mediaType==='application/json'||mediaType==='application/x-ndjson'
    ||mediaType==='application/sql'||mediaType==='application/yaml'
    ||mediaType==='application/toml'||mediaType.endsWith('+json')) id='code';
  else if(mediaType==='text/x-spice') id='spice';
  else if(mediaType.startsWith('text/')) id='plain';
  return Object.freeze({id,mediaType});
}

function pathMediaType(path) {
  const clean=String(path||'').split(/[?#]/,1)[0];
  const leaf=clean.slice(Math.max(clean.lastIndexOf('/'),clean.lastIndexOf('\\'))+1);
  const dot=leaf.lastIndexOf('.');
  if(dot<=0||dot===leaf.length-1) return '';
  return PATH_MEDIA_TYPES[leaf.slice(dot+1).toLowerCase()]||'';
}

/** Resolve safe presentation metadata from declarations, response/path hints,
 * and (only when supplied by the caller) a bounded hash-checked byte format. */
export function selectArtifactRenderer(mediaKind,{path='',responseMedia='',contentMedia=''}={}) {
  const declared=selectDeclaredArtifactRenderer(mediaKind);
  const response=selectDeclaredArtifactRenderer(responseMedia);
  const fallback=selectDeclaredArtifactRenderer(pathMediaType(path));
  const content=selectDeclaredArtifactRenderer(contentMedia);
  // OOXML, OpenDocument and EPUB are ZIP containers. Preserve their more useful
  // signed/filename subtype after the byte signature confirms the container.
  if(content.mediaType==='application/zip'){
    if(ARCHIVE_MEDIA_TYPES.has(declared.mediaType)) return Object.freeze({...declared,source:'declared'});
    if(ARCHIVE_MEDIA_TYPES.has(response.mediaType)) return Object.freeze({...response,source:'response'});
    if(ARCHIVE_MEDIA_TYPES.has(fallback.mediaType)) return Object.freeze({...fallback,source:'path'});
  }
  if(STRONG_CONTENT_MEDIA_TYPES.has(content.mediaType))
    return Object.freeze({...content,source:'bytes'});
  if(declared.mediaType&&!AMBIGUOUS_MEDIA_TYPES.has(declared.mediaType))
    return Object.freeze({...declared,source:'declared'});
  if(response.mediaType&&!AMBIGUOUS_MEDIA_TYPES.has(response.mediaType))
    return Object.freeze({...response,source:'response'});
  if(fallback.mediaType) return Object.freeze({...fallback,source:'path'});
  if(content.mediaType&&!GENERIC_MEDIA_TYPES.has(content.mediaType))
    return Object.freeze({...content,source:'bytes'});
  if(declared.mediaType) return Object.freeze({...declared,source:'declared'});
  if(response.mediaType) return Object.freeze({...response,source:'response'});
  return Object.freeze({...fallback,source:'none'});
}

function bytesStartWith(bytes, signature, offset=0) {
  if(bytes.length<offset+signature.length) return false;
  return signature.every((value,index)=>bytes[offset+index]===value);
}

function ascii(bytes,start=0,end=bytes.length) {
  return String.fromCharCode(...bytes.subarray(start,Math.min(end,bytes.length)));
}

function isoBaseMediaType(bytes) {
  if(bytes.length<12||ascii(bytes,4,8)!=='ftyp') return '';
  const brands=[];
  for(let offset=8;offset+4<=Math.min(bytes.length,64);offset+=4)
    brands.push(ascii(bytes,offset,offset+4));
  if(brands.some((brand)=>['avif','avis'].includes(brand))) return 'image/avif';
  if(brands.some((brand)=>['heic','heix','hevc','hevx','mif1','msf1'].includes(brand))) return 'image/heif';
  if(brands.some((brand)=>['M4A ','M4B ','M4P '].includes(brand))) return 'audio/mp4';
  if(brands.includes('qt  ')) return 'video/quicktime';
  return 'video/mp4';
}

function textualMediaType(bytes) {
  const sample=bytes.subarray(0,Math.min(bytes.length,64*1024));
  if(!sample.length) return 'text/plain';
  let controls=0;
  for(const byte of sample){
    if(byte===0) return '';
    if(byte<9||(byte>13&&byte<32)) controls++;
  }
  if(controls/sample.length>.02) return '';
  let text='';
  try{ text=new TextDecoder('utf-8',{fatal:true}).decode(sample).replace(/^\uFEFF/,'').trimStart(); }
  catch(_){ return ''; }
  if(!text) return 'text/plain';
  if(/^ISO-10303-21;/i.test(text))
    return /FILE_SCHEMA\s*\(\s*\([^)]*['"]IFC/i.test(text)?'model/ifc':'model/step';
  if(/^\s*0\s*\r?\nSECTION\b/i.test(text)
      &&/\r?\n\s*2\s*\r?\n(?:HEADER|ENTITIES|TABLES|BLOCKS)\b/i.test(text))
    return 'image/vnd.dxf';
  if(/^\s*solid(?:\s|$)/i.test(text)&&/\bfacet\s+normal\b/i.test(text)
      &&/\bouter\s+loop\b/i.test(text)) return 'model/stl';
  const objLines=text.split(/\r?\n/).slice(0,2048);
  if(objLines.filter((line)=>/^\s*v\s+[-+.0-9eE]+\s+[-+.0-9eE]+\s+[-+.0-9eE]+(?:\s|$)/.test(line)).length>=3
      &&objLines.some((line)=>/^\s*f\s+\d+(?:\/\S*)?\s+\d+(?:\/\S*)?\s+\d+(?:\/\S*)?/.test(line)))
    return 'model/obj';
  if(/^ply\r?\nformat\s+(?:ascii|binary_(?:little|big)_endian)\s+1\.0\b/i.test(text))
    return 'model/ply';
  if(/^%YAML(?:\s|$)/.test(text)) return 'application/yaml';
  if(/^<\?xml(?:\s|\?>)/i.test(text)) return 'application/xml';
  if(/^<!doctype\s+html\b/i.test(text)||/^<html\b/i.test(text)) return 'text/html';
  if(/^<svg(?:\s|>)/i.test(text)||/^<\?xml[\s\S]{0,512}<svg(?:\s|>)/i.test(text)) return 'image/svg+xml';
  if(/^[{[]/.test(text)){
    try{ const document=JSON.parse(text);
      if(document?.asset?.version&&Array.isArray(document?.meshes)
          &&Array.isArray(document?.accessors)) return 'model/gltf+json';
      return 'application/json'; }catch(_){}
  }
  return 'text/plain';
}

/**
 * Inspect only a bounded prefix of already hash-checked bytes and return an
 * observed file/container media type. This function does not parse, execute,
 * or assign semantic meaning to the artifact.
 */
export function sniffArtifactMediaType(value) {
  const source=value instanceof Uint8Array?value:new Uint8Array(value||0);
  const bytes=source.subarray(0,Math.min(source.length,64*1024));
  if(bytesStartWith(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) return 'image/png';
  if(bytesStartWith(bytes,[0xff,0xd8,0xff])) return 'image/jpeg';
  if(['GIF87a','GIF89a'].includes(ascii(bytes,0,6))) return 'image/gif';
  if(ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,12)==='WEBP') return 'image/webp';
  if(ascii(bytes,0,2)==='BM') return 'image/bmp';
  if(bytesStartWith(bytes,[0x49,0x49,0x2a,0x00])||bytesStartWith(bytes,[0x4d,0x4d,0x00,0x2a])) return 'image/tiff';
  if(bytesStartWith(bytes,[0x00,0x00,0x01,0x00])) return 'image/x-icon';
  if(ascii(bytes,0,5)==='%PDF-') return 'application/pdf';
  if(bytesStartWith(bytes,[0x50,0x4b,0x03,0x04])||bytesStartWith(bytes,[0x50,0x4b,0x05,0x06])
      ||bytesStartWith(bytes,[0x50,0x4b,0x07,0x08])) return 'application/zip';
  if(bytesStartWith(bytes,[0x1f,0x8b])) return 'application/gzip';
  if(bytesStartWith(bytes,[0x37,0x7a,0xbc,0xaf,0x27,0x1c])) return 'application/x-7z-compressed';
  if(ascii(bytes,0,7)==='Rar!\u001a\u0007\u0000'||ascii(bytes,0,8)==='Rar!\u001a\u0007\u0001\u0000') return 'application/vnd.rar';
  if(ascii(bytes,0,4)==='fLaC') return 'audio/flac';
  if(ascii(bytes,0,3)==='ID3'||(bytes.length>1&&bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0)) return 'audio/mpeg';
  if(ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,12)==='WAVE') return 'audio/wav';
  if(ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,12)==='AVI ') return 'video/x-msvideo';
  if(ascii(bytes,0,4)==='OggS'){
    const header=ascii(bytes,0,Math.min(bytes.length,128));
    return header.includes('theora')?'video/ogg':'audio/ogg';
  }
  if(bytesStartWith(bytes,[0x1a,0x45,0xdf,0xa3])) return 'video/webm';
  const iso=isoBaseMediaType(bytes); if(iso) return iso;
  if(ascii(bytes,0,4)==='wOFF') return 'font/woff';
  if(ascii(bytes,0,4)==='wOF2') return 'font/woff2';
  if(ascii(bytes,0,4)==='glTF'&&bytes.length>=12){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(view.getUint32(4,true)===2&&view.getUint32(8,true)>=12) return 'model/gltf-binary';
  }
  if(bytesStartWith(bytes,[0x00,0x61,0x73,0x6d])) return 'application/wasm';
  if(ascii(bytes,0,16)==='SQLite format 3\u0000') return 'application/vnd.sqlite3';
  if(bytes.length>=84){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const triangles=view.getUint32(80,true);
    if(triangles>0&&84+(triangles*50)===bytes.length) return 'model/stl';
  }
  return textualMediaType(bytes);
}

export function artifactTypeLabel(mediaKind) {
  const media=declaredMediaType(mediaKind);
  const exact={
    'text/markdown':'Markdown document','text/csv':'CSV table','text/tab-separated-values':'TSV table',
    'application/json':'JSON data','application/x-ndjson':'newline-delimited JSON',
    'application/pdf':'PDF document','application/zip':'ZIP archive','application/gzip':'Gzip archive',
    'application/x-tar':'Tar archive','application/x-7z-compressed':'7-Zip archive','application/vnd.rar':'RAR archive',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'Word document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'Excel workbook',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':'PowerPoint presentation',
    'application/vnd.oasis.opendocument.text':'OpenDocument text','application/vnd.oasis.opendocument.spreadsheet':'OpenDocument spreadsheet',
    'application/vnd.oasis.opendocument.presentation':'OpenDocument presentation','application/epub+zip':'EPUB book',
    'image/vnd.dxf':'DXF drawing','image/x-dxf':'DXF drawing','application/dxf':'DXF drawing',
    'application/x-dxf':'DXF drawing','model/step':'STEP CAD model','application/step':'STEP CAD model',
    'application/x-step':'STEP CAD model','model/ifc':'IFC building model','application/x-ifc':'IFC building model',
    'model/openscad':'OpenSCAD parametric model source','application/x-openscad':'OpenSCAD parametric model source',
    'model/obj':'OBJ 3D model','model/stl':'STL 3D model','model/ply':'PLY 3D model',
    'model/gltf+json':'glTF 3D model','model/gltf-binary':'GLB 3D model',
    'text/x-spice':'SPICE circuit netlist','text/x-kicad-schematic':'KiCad schematic',
    'text/x-kicad-pcb':'KiCad PCB layout','text/x-kicad-symbol':'KiCad symbol library',
    'text/x-kicad-footprint':'KiCad footprint','text/x-gerber':'Gerber fabrication layer',
    'text/x-excellon':'Excellon drill data','text/x-verilog':'Verilog source',
    'text/x-systemverilog':'SystemVerilog source','text/x-vhdl':'VHDL source',
  };
  if(exact[media]) return exact[media];
  if(media.startsWith('image/')) return `${media.slice(6).replace('jpeg','JPEG').replace('png','PNG').replace('svg+xml','SVG').replace('webp','WebP').replace('avif','AVIF').toUpperCase()} image`;
  if(media.startsWith('audio/')) return `${media.slice(6).toUpperCase()} audio`;
  if(media.startsWith('video/')) return `${media.slice(6).toUpperCase()} video`;
  if(media.startsWith('model/')) return `${media.slice(6).toUpperCase()} 3D model`;
  if(media.startsWith('text/')) return media==='text/plain'?'Text document':`${media.slice(5).toUpperCase()} source`;
  if(media.endsWith('+json')) return 'JSON data';
  if(GENERIC_MEDIA_TYPES.has(media)||!media) return 'File';
  return media;
}
