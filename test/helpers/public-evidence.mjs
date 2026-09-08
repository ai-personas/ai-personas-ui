// Supply the real disabled diagnostic producer to source-extraction fixtures.
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const assetRoot = process.env.UI_PRESENTATION_ASSETS
  || fileURLToPath(new URL('../../assets/', import.meta.url));
export const {canonicalJson, parseSignedJson} = await import(
  pathToFileURL(resolve(assetRoot, 'canonical-json.mjs')));
export const {createPublicEvidence} = await import(
  pathToFileURL(resolve(assetRoot, 'public-evidence.mjs')));

export function disabledPublicEvidenceDependencies() {
  return {
    _publicEvidence: createPublicEvidence({canon: canonicalJson}).producer,
    _publicEvidenceAttempt: Symbol('public evidence fixture attempt'),
    _publicEvidenceRegistry: Symbol('public evidence fixture registry'),
  };
}
