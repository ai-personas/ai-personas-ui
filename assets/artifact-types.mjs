/* Safe, data-only artifact dispatch. Peer content may select only one of these
 * repository-owned adapters; a peer can never provide executable module URLs. */

export const LOCAL_RENDERER_MANIFEST=Object.freeze([
  {file:'gerber.mjs',label:'Gerber / drill',exts:['gbr','ger','gtl','gbl','gto','gts','gko','gm1','drl','xln'],mediaKinds:['gerber','excellon','drill','pcb'],fetchMode:'text'},
  {file:'kicad.mjs',label:'KiCad',exts:['kicad_pcb','kicad_sch','kicad_pro','kicad_mod'],mediaKinds:['kicad','schematic'],fetchMode:'text'},
  {file:'netlist.mjs',label:'netlist / SPICE',exts:['cir','net','spice','sp','ckt','asc','scs','spc','subckt'],mediaKinds:['netlist','spice','circuit','eda'],fetchMode:'text'},
  {file:'waveform.mjs',label:'waveform',exts:['vcd','wavedrom','wave','wavejson'],mediaKinds:['waveform','vcd','wavedrom','wavejson'],fetchMode:'text'},
  {file:'dxf.mjs',label:'DXF',exts:['dxf'],mediaKinds:['dxf','drawing','mechanical_drawing'],fetchMode:'text'},
  {file:'cad3d.mjs',label:'CAD / 3D',exts:['step','stp','stl','3mf','obj','gltf','glb','ply'],mediaKinds:['cad','cad3d','mesh','3d','model','step','stl','gltf','glb','obj','ply','3mf'],fetchMode:'bytes'},
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
  stl:'model3d','3mf':'model3d',obj:'model3d',gltf:'model3d',glb:'model3d',step:'descriptor',stp:'descriptor',kicad_pcb:'descriptor',kicad_sch:'descriptor',
  zip:'descriptor',gz:'descriptor',tgz:'descriptor',bz2:'descriptor',xz:'descriptor','7z':'descriptor',rar:'descriptor',
  doc:'descriptor',docx:'descriptor',xls:'descriptor',xlsx:'descriptor',ppt:'descriptor',pptx:'descriptor',pdf:'pdf',
});
const BUILTIN_BY_KIND=Object.freeze({
  md:'markdown',markdown:'markdown',csv:'csv',table:'csv',image:'image',png:'image',svg:'image',json:'code',code:'code',source:'code',yaml:'code',
  model:'model3d',cad:'model3d',mesh:'model3d',step:'descriptor',pdf:'pdf','application/pdf':'pdf',audio:'audio',video:'video',text:'plain',
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

