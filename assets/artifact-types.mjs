/* Safe, data-only artifact dispatch. Peer content may select only one of these
 * repository-owned adapters; a peer can never provide executable module URLs. */

export const LOCAL_RENDERER_MANIFEST=Object.freeze([
  {file:'gerber.mjs',label:'Gerber / drill',exts:['gbr','ger','gtl','gbl','gto','gts','gko','gm1','drl','xln'],mediaKinds:['gerber','excellon','drill','pcb'],fetchMode:'text'},
  {file:'kicad.mjs',label:'KiCad',exts:['kicad_pcb','kicad_sch','kicad_pro','kicad_mod'],mediaKinds:['kicad','schematic'],fetchMode:'text'},
  {file:'netlist.mjs',label:'netlist / SPICE',exts:['cir','net','spice','sp','ckt','asc','scs','spc','subckt'],mediaKinds:['netlist','spice','circuit','eda'],fetchMode:'text'},
  {file:'waveform.mjs',label:'waveform',exts:['vcd','wavedrom','wave','wavejson'],mediaKinds:['waveform','vcd','wavedrom','wavejson'],fetchMode:'text'},
  {file:'dxf.mjs',label:'DXF',exts:['dxf'],mediaKinds:['dxf','drawing','mechanical_drawing'],fetchMode:'text'},
  {file:'cad3d.mjs',label:'CAD / 3D',exts:['step','stp','ifc','stl','3mf','obj','gltf','glb','ply'],mediaKinds:['cad','cad3d','mesh','3d','model','step','ifc','stl','gltf','glb','obj','ply','3mf'],fetchMode:'bytes'},
  {file:'pdf.mjs',label:'PDF',exts:['pdf'],mediaKinds:['pdf','application/pdf'],fetchMode:'bytes'},
  {file:'table.mjs',label:'table',exts:['csv','tsv','bom'],mediaKinds:['table','bom','csv','tsv'],fetchMode:'text'},
  {file:'datatree.mjs',label:'structured data',exts:['json','ndjson'],mediaKinds:['json','ndjson','datatree','structured','data'],fetchMode:'text'},
  {file:'mdrich.mjs',label:'Markdown',exts:['md','markdown'],mediaKinds:['md','markdown'],fetchMode:'text'},
].map((entry)=>Object.freeze({...entry,exts:Object.freeze(entry.exts),mediaKinds:Object.freeze(entry.mediaKinds)})));

const BUILTIN_BY_EXT=Object.freeze({
  md:'markdown',markdown:'markdown',csv:'csv',tsv:'csv',
  png:'image',jpg:'image',jpeg:'image',gif:'image',webp:'image',svg:'image',avif:'image',bmp:'image',ico:'image',tif:'image',tiff:'image',
  mp3:'audio',wav:'audio',ogg:'audio',oga:'audio',m4a:'audio',flac:'audio',aac:'audio',opus:'audio',
  mp4:'video',webm:'video',mov:'video',m4v:'video',ogv:'video',
  py:'code',js:'code',jsx:'code',ts:'code',tsx:'code',sh:'code',bash:'code',zsh:'code',json:'code',jsonl:'code',ndjson:'code',ipynb:'code',
  yaml:'code',yml:'code',toml:'code',spice:'code',cir:'code',net:'code',ini:'code',xml:'code',html:'code',htm:'code',css:'code',scss:'code',
  sql:'code',rs:'code',go:'code',java:'code',c:'code',h:'code',cpp:'code',hpp:'code',rb:'code',php:'code',swift:'code',kt:'code',cfg:'code',log:'code',txt:'plain',
  stl:'model3d','3mf':'model3d',obj:'model3d',gltf:'model3d',glb:'model3d',step:'descriptor',stp:'descriptor',ifc:'descriptor',kicad_pcb:'descriptor',kicad_sch:'descriptor',
  zip:'descriptor',gz:'descriptor',tgz:'descriptor',bz2:'descriptor',xz:'descriptor','7z':'descriptor',rar:'descriptor',
  doc:'descriptor',docx:'descriptor',xls:'descriptor',xlsx:'descriptor',ppt:'descriptor',pptx:'descriptor',pdf:'pdf',
});
const BUILTIN_BY_KIND=Object.freeze({
  md:'markdown',markdown:'markdown',csv:'csv',table:'csv',image:'image',png:'image',svg:'image',json:'code',code:'code',source:'code',yaml:'code',
  model:'model3d',cad:'model3d',mesh:'model3d',step:'descriptor',ifc:'descriptor',pdf:'pdf','application/pdf':'pdf',audio:'audio',video:'video',text:'plain',
  binary:'generic',archive:'descriptor',
});

const extIndex=new Map(), kindIndex=new Map();
for(const entry of LOCAL_RENDERER_MANIFEST){
  for(const ext of entry.exts) if(!extIndex.has(ext)) extIndex.set(ext,entry);
  for(const kind of entry.mediaKinds) if(!kindIndex.has(kind)) kindIndex.set(kind,entry);
}

export function artifactExtension(title){
  const value=String(title||'').toLowerCase().split(/[?#]/,1)[0];
  for(const ext of extIndex.keys()) if(ext.includes('_')&&value.endsWith('.'+ext)) return ext;
  const leaf=value.slice(value.lastIndexOf('/')+1), dot=leaf.lastIndexOf('.');
  return dot>=0?leaf.slice(dot+1):'';
}

export function selectLocalArtifactModule(title,mediaKind){
  const ext=artifactExtension(title); if(ext&&extIndex.has(ext)) return {entry:extIndex.get(ext),ext};
  const kind=String(mediaKind||'').trim().toLowerCase();
  return kindIndex.has(kind)?{entry:kindIndex.get(kind),ext}:null;
}

export function selectBuiltinArtifactRenderer(title,mediaKind){
  const ext=artifactExtension(title); if(ext&&BUILTIN_BY_EXT[ext]) return {id:BUILTIN_BY_EXT[ext],ext};
  const kind=String(mediaKind||'').trim().toLowerCase();
  return {id:BUILTIN_BY_KIND[kind]||'generic',ext};
}

export function artifactDispatch(title,mediaKind){
  const local=selectLocalArtifactModule(title,mediaKind);
  if(local) return {adapterId:`local:${local.entry.file}`,module:local.entry.file,
    fetchMode:local.entry.fetchMode,label:local.entry.label,ext:local.ext};
  const builtin=selectBuiltinArtifactRenderer(title,mediaKind);
  return {adapterId:`builtin:${builtin.id}`,module:null,
    fetchMode:['image','audio','video','model3d','descriptor','pdf','generic'].includes(builtin.id)?'bytes':'text',
    label:builtin.id,ext:builtin.ext};
}

/* Bounded, data-only format recognition for bytes whose advertised SHA-256 was
 * already checked by the caller. This never loads a peer-selected module: the
 * detected extension/media kind is fed back through the closed repository
 * manifest above. Unknown bytes stay on their declared/generic renderer. */
export const ARTIFACT_SNIFF_LIMITS=Object.freeze({binaryBytes:256*1024,textBytes:64*1024});

const _byteView=(value)=>{
  if(value instanceof Uint8Array) return value;
  if(value instanceof ArrayBuffer) return new Uint8Array(value);
  if(ArrayBuffer.isView(value)) return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  return new Uint8Array();
};
const _starts=(bytes,signature)=>signature.every((value,index)=>bytes[index]===value);
const _ascii=(bytes,limit=ARTIFACT_SNIFF_LIMITS.textBytes)=>{
  const head=bytes.subarray(0,Math.min(bytes.length,limit));
  try{ return new TextDecoder('utf-8',{fatal:true}).decode(head).replace(/^\ufeff/,''); }
  catch(_){ return ''; }
};
const _found=(format,ext,mediaKind,label,evidence)=>Object.freeze({
  format,ext,mediaKind,label,evidence,
});

function _zipContainerFormat(bytes){
  if(!_starts(bytes,[0x50,0x4b,0x03,0x04])&&!_starts(bytes,[0x50,0x4b,0x05,0x06])
      &&!_starts(bytes,[0x50,0x4b,0x07,0x08])) return null;
  // Entry names are ASCII inside the ZIP headers. Inspect a fixed prefix only;
  // absence of a 3MF marker means merely "ZIP", never "not 3MF".
  const sample=bytes.subarray(0,Math.min(bytes.length,ARTIFACT_SNIFF_LIMITS.binaryBytes));
  let names=''; for(const byte of sample) names+=byte>=0x20&&byte<=0x7e?String.fromCharCode(byte):' ';
  if(/3D[\\/]3dmodel\.model(?:\s|$)/i.test(names)
      ||/3dmanufacturing-3dmodel\+xml/i.test(names))
    return _found('3mf','3mf','model/3mf','3MF model','ZIP container + 3MF model entry');
  return _found('zip','zip','archive','ZIP archive','ZIP container magic');
}

function _binaryStl(bytes){
  if(bytes.length<84) return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const triangles=view.getUint32(80,true);
  // Exact container length is a strong, bounded discriminator. A zero-triangle
  // file is allowed by the container shape but is not useful enough to infer.
  if(triangles>0&&84+(triangles*50)===bytes.length)
    return _found('stl','stl','stl','binary STL mesh','80-byte header + exact triangle table');
  return null;
}

/** Recognise a small set of common image/document/CAD/mesh byte formats. */
export function sniffArtifactFormat(value){
  const bytes=_byteView(value); if(!bytes.length) return null;
  if(_starts(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
    return _found('png','png','image/png','PNG image','PNG magic');
  if(_starts(bytes,[0xff,0xd8,0xff]))
    return _found('jpeg','jpg','image/jpeg','JPEG image','JPEG SOI marker');
  if(bytes.length>=12&&_starts(bytes,[0x52,0x49,0x46,0x46])
      &&_starts(bytes.subarray(8),[0x57,0x45,0x42,0x50]))
    return _found('webp','webp','image/webp','WebP image','RIFF WEBP header');
  if(_starts(bytes,[0x25,0x50,0x44,0x46,0x2d]))
    return _found('pdf','pdf','application/pdf','PDF document','PDF header');
  if(bytes.length>=12&&_starts(bytes,[0x67,0x6c,0x54,0x46]))
    return _found('glb','glb','glb','binary glTF model','glTF binary magic');
  const archive=_zipContainerFormat(bytes); if(archive) return archive;
  const stl=_binaryStl(bytes); if(stl) return stl;

  const text=_ascii(bytes); if(!text) return null;
  const trimmed=text.trimStart(), upper=trimmed.toUpperCase();
  if(/^<\?xml\b[^>]*>\s*<svg\b|^<svg\b/i.test(trimmed))
    return _found('svg','svg','image/svg+xml','SVG image','SVG document root');
  if(upper.startsWith('ISO-10303-21;')){
    if(/FILE_SCHEMA\s*\(\s*\([^)]*['"]IFC/i.test(upper))
      return _found('ifc','ifc','ifc','IFC building model','STEP exchange header + IFC schema');
    return _found('step','step','step','STEP CAD model','ISO-10303-21 header');
  }
  if(/^\s*solid(?:\s|$)/i.test(text)&&/\bfacet\s+normal\b/i.test(text)&&/\bouter\s+loop\b/i.test(text))
    return _found('stl','stl','stl','ASCII STL mesh','solid/facet/outer loop headers');
  if(/^ply\r?\nformat\s+(?:ascii|binary_(?:little|big)_endian)\s+1\.0\b/i.test(trimmed))
    return _found('ply','ply','ply','PLY mesh','PLY format header');
  const objLines=text.split(/\r?\n/).slice(0,2048);
  const objVertices=objLines.filter((line)=>/^\s*v\s+[-+.0-9eE]+\s+[-+.0-9eE]+\s+[-+.0-9eE]+(?:\s|$)/.test(line)).length;
  const objFaces=objLines.filter((line)=>/^\s*f\s+\d+(?:\/\S*)?\s+\d+(?:\/\S*)?\s+\d+(?:\/\S*)?/.test(line)).length;
  if(objVertices>=3&&objFaces>=1)
    return _found('obj','obj','obj','Wavefront OBJ mesh','vertex and face records');
  if(/^\s*0\s*\r?\nSECTION\b/i.test(text)
      &&/\r?\n\s*2\s*\r?\n(?:HEADER|ENTITIES|TABLES|BLOCKS)\b/i.test(text))
    return _found('dxf','dxf','dxf','DXF drawing','DXF SECTION header');
  if(/^\s*\((?:kicad_pcb|kicad_sch)\b/i.test(text)){
    const format=/^\s*\(kicad_sch\b/i.test(text)?'kicad_sch':'kicad_pcb';
    return _found(format,format,'kicad','KiCad design',`${format} document root`);
  }
  if(/^(?:G04\b|%FS[LT]A)/i.test(trimmed)&&/(?:%MO(?:MM|IN)\*%|D0[123]\*)/i.test(text))
    return _found('gerber','gbr','gerber','Gerber artwork','Gerber format/aperture commands');
  if(/^M48\b/im.test(text)&&/(?:^|\r?\n)(?:METRIC|INCH)(?:,|\r?$)/im.test(text))
    return _found('excellon','drl','excellon','Excellon drill','M48 drill header');
  if(/^\s*\{/.test(text)&&/"asset"\s*:\s*\{[^}]*"version"\s*:\s*"2(?:\.0)?"/s.test(text)
      &&/(?:"meshes"|"nodes"|"scenes")\s*:/s.test(text))
    return _found('gltf','gltf','gltf','glTF model','glTF 2 asset object');
  return null;
}

const _equivalentFormat=(value)=>({jpeg:'jpeg',jpg:'jpeg',step:'step',stp:'step'}[value]||value);
const _declaredFormat=(title,mediaKind)=>{
  const ext=artifactExtension(title);
  const kind=String(mediaKind||'').trim().toLowerCase();
  const extFormat=_equivalentFormat(ext);
  if(extFormat&&Object.hasOwn(BUILTIN_BY_EXT,ext)) return extFormat;
  if(ext&&extIndex.has(ext)) return extFormat;
  const kindAliases={
    'image/png':'png','image/jpeg':'jpeg','image/webp':'webp','image/svg+xml':'svg',
    'application/pdf':'pdf',png:'png',jpeg:'jpeg',jpg:'jpeg',webp:'webp',svg:'svg',pdf:'pdf',
    cad:'cad',cad3d:'cad',mesh:'mesh',model:'model',model3d:'model',archive:'archive',
  };
  return kindAliases[kind]||'';
};
const _declaredCompatible=(declared,detected)=>{
  if(!declared) return true;
  const exact=_equivalentFormat(detected.format);
  if(_equivalentFormat(declared)===exact) return true;
  if(declared==='cad') return ['step','ifc','dxf','kicad_pcb','kicad_sch'].includes(exact);
  if(declared==='mesh'||declared==='model') return ['stl','obj','ply','gltf','glb','3mf'].includes(exact);
  if(declared==='archive') return ['zip','3mf'].includes(exact);
  return false;
};

/** Resolve renderer dispatch only after the caller verified these exact bytes. */
export function resolveVerifiedArtifactDispatch(title,mediaKind,value){
  const detected=sniffArtifactFormat(value);
  const declared=artifactDispatch(title,mediaKind);
  if(!detected) return Object.freeze({detected:null,declared,effective:declared,
    selectionTitle:String(title||''),selectionMediaKind:String(mediaKind||''),inferred:false,contradiction:false});
  const selectionTitle=`verified-artifact.${detected.ext}`;
  const effective=artifactDispatch(selectionTitle,detected.mediaKind);
  const declaredFormat=_declaredFormat(title,mediaKind);
  return Object.freeze({detected,declared,effective,selectionTitle,
    selectionMediaKind:detected.mediaKind,inferred:!declaredFormat,
    contradiction:!!declaredFormat&&!_declaredCompatible(declaredFormat,detected)});
}
