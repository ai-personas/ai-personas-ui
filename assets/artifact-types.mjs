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
  if(mediaType==='text/markdown') id='markdown';
  else if(mediaType==='text/csv'||mediaType==='text/tab-separated-values') id='csv';
  else if(mediaType.startsWith('image/')) id='image';
  else if(mediaType.startsWith('audio/')) id='audio';
  else if(mediaType.startsWith('video/')) id='video';
  else if(mediaType==='application/pdf') id='pdf';
  else if(mediaType==='application/json'||mediaType.endsWith('+json')) id='code';
  else if(mediaType.startsWith('text/')) id='plain';
  return Object.freeze({id,mediaType});
}
