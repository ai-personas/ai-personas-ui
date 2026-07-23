/*
 * Generic artifact presentation policy.
 *
 * A filename is an opaque persona-authored path, not a type declaration. The
 * browser therefore never infers semantics from a suffix or from domain words
 * in the bytes. Rich presentation is selected only from media metadata carried
 * by the already-admitted signed record/snapshot. Everything else stays in the
 * byte-first generic inspector.
 */

const MEDIA_TYPE_LIMIT = 256;
const MEDIA_TYPE = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/;
const GENERIC_MEDIA_TYPES = new Set(['application/octet-stream','binary/octet-stream']);
const PATH_MEDIA_TYPES = Object.freeze({
  svg:'image/svg+xml',
  dxf:'image/vnd.dxf',
  obj:'model/obj',
  json:'application/json',
  md:'text/markdown',
  markdown:'text/markdown',
  csv:'text/csv',
  tsv:'text/tab-separated-values',
  txt:'text/plain',
  xml:'application/xml',
  png:'image/png',
  jpg:'image/jpeg',
  jpeg:'image/jpeg',
  gif:'image/gif',
  webp:'image/webp',
  pdf:'application/pdf',
});

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
  if(['image/vnd.dxf','image/x-dxf','application/dxf','application/x-dxf','model/obj']
    .includes(mediaType)) id='plain';
  else if(mediaType==='text/markdown') id='markdown';
  else if(mediaType==='text/csv'||mediaType==='text/tab-separated-values') id='csv';
  else if(mediaType.startsWith('image/')) id='image';
  else if(mediaType.startsWith('audio/')) id='audio';
  else if(mediaType.startsWith('video/')) id='video';
  else if(mediaType==='application/pdf') id='pdf';
  else if(mediaType==='application/json'||mediaType.endsWith('+json')) id='code';
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

/**
 * Resolve presentation metadata without inspecting peer-authored content.
 * Exact declared media wins. A generic/absent declaration may be enriched by
 * the fetched response Content-Type, then by the already signed file path.
 */
export function selectArtifactRenderer(mediaKind,{path='',responseMedia=''}={}) {
  const declared=selectDeclaredArtifactRenderer(mediaKind);
  if(declared.mediaType&&!GENERIC_MEDIA_TYPES.has(declared.mediaType))
    return Object.freeze({...declared,source:'declared'});
  const response=selectDeclaredArtifactRenderer(responseMedia);
  if(response.mediaType&&!GENERIC_MEDIA_TYPES.has(response.mediaType))
    return Object.freeze({...response,source:'response'});
  const fallback=selectDeclaredArtifactRenderer(pathMediaType(path));
  if(fallback.mediaType) return Object.freeze({...fallback,source:'path'});
  if(declared.mediaType) return Object.freeze({...declared,source:'declared'});
  if(response.mediaType) return Object.freeze({...response,source:'response'});
  return Object.freeze({...fallback,source:'none'});
}
