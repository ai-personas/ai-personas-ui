#!/usr/bin/env python3
"""Fail CI when the UI drifts from selected normative design guarantees."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


REVIEWED_DESIGN_COMMIT = '009e4e0da5a2ad916033b7a1b2d8bf572adf1614'
REVIEWED_MARKDOWN_COUNT = 22
REVIEWED_MARKDOWN_MANIFEST_SHA256 = '15731a8c0dd24a18a12d2db7f65f087accb349546e986eba022151dd289499be'


DESIGN_ANCHORS = {
    '00_VISION.md': [
        'hard-code only the safety and identity core',
        'one global object space',
    ],
    '07_ARTIFACTS.md': [
        'mandatory sha-256',
        'content_integrity_failed',
        'discoverable over the internet',
    ],
    '09_PROTOCOLS.md': [
        'without a central authority',
        'kademlia dht',
        'mdns / multicast',
        'discover < read (r) < write (rw) < admin',
        'no infrastructure *whatsoever*',
    ],
    '03_TASKS.md': [
        'never kernel tie-breakers',
        'routing_context_pressure remains open',
        'ambiguity is never interpreted as an ephemeral route',
    ],
    '04_PROJECT.md': [
        'never give the kernel or caller authority',
        'unresolved project-host-choice pressure/refusal',
    ],
    '13_DESIGN_VALIDATION.md': [
        'global discovery layer',
        'globally-verifiable lineage',
    ],
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('design_root', type=Path)
    args = parser.parse_args()
    design_root = args.design_root.resolve()
    ui_root = Path(__file__).resolve().parents[1]
    failures: list[str] = []

    try:
        revision = subprocess.check_output(
            ['git', '-C', str(design_root), 'rev-parse', 'HEAD'], text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        revision = 'unknown'
    if revision != REVIEWED_DESIGN_COMMIT:
        failures.append(
            f'design HEAD is {revision}, reviewed commit is {REVIEWED_DESIGN_COMMIT}; '
            'review every upstream Markdown diff, then update the pinned commit, manifest hash, '
            'semantic anchors, and README in the same UI change'
        )

    markdown = sorted(path for path in design_root.rglob('*.md') if '.git' not in path.parts)
    manifest = hashlib.sha256()
    for path in markdown:
        relative = path.relative_to(design_root).as_posix()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest.update(f'{digest}  ./{relative}\n'.encode('utf-8'))
    manifest_hex = manifest.hexdigest()
    if len(markdown) != REVIEWED_MARKDOWN_COUNT or manifest_hex != REVIEWED_MARKDOWN_MANIFEST_SHA256:
        failures.append(
            f'design Markdown manifest changed: {len(markdown)} files, sha256 {manifest_hex}; '
            f'expected {REVIEWED_MARKDOWN_COUNT} files, sha256 {REVIEWED_MARKDOWN_MANIFEST_SHA256}. '
            'Review all added, removed, and modified design Markdown before updating the pin'
        )

    for relative, anchors in DESIGN_ANCHORS.items():
        path = design_root / relative
        if not path.is_file():
            failures.append(f'missing design document: {relative}')
            continue
        body = path.read_text(encoding='utf-8').lower()
        for anchor in anchors:
            if anchor not in body:
                failures.append(f'{relative}: normative anchor changed or disappeared: {anchor!r}')

    portal = (ui_root / 'assets/discovery.js').read_text(encoding='utf-8')
    routing_authority = (ui_root / 'assets/routing-authority.mjs').read_text(encoding='utf-8')
    live_signatures = (ui_root / 'assets/live-signatures.mjs').read_text(encoding='utf-8')
    readme = (ui_root / 'README.md').read_text(encoding='utf-8').lower()
    index = (ui_root / 'index.html').read_text(encoding='utf-8')
    p2p_hints = json.loads((ui_root / 'p2p-bootstrap-hints.json').read_text(encoding='utf-8'))
    ui_checks = {
        'decentralized first contact with explicit optional resolvers': (
            'DEFAULT_GLOBAL_DISCOVERY_ENDPOINT' not in portal
            and "return [...new Set(p.getAll('resolver')" in portal
            and "p.get('no_global_discovery')==='1'" in portal
            and isinstance(p2p_hints, list)
            and len(p2p_hints) >= 2
            and all(isinstance(value, str) and '/wss/p2p/' in value for value in p2p_hints)
            and 'async function verifyGlobalEnvelope(env)' in portal
            and 'exp<=Date.now()' in portal
            and 'ed.verifyAsync' in portal
            and "Object.prototype.hasOwnProperty.call(env,'public_bundle')" in portal
            and 'if(!verified.ok)' in portal
        ),
        'durable operator credential storage': "localStorage.setItem('personaos_operator'" not in portal,
        'tokenized EventSource URL': 'new EventSource(esUrl)' not in portal,
        'kernel-signed live metadata verification': (
            'verifyLiveArtifactSnapshot' in portal
            and 'verifyLiveArtifactEvent' in portal
            and 'WORKSPACE SNAPSHOT · SIGNATURE CHECKED' in portal
            and 'ArtifactBundle lifecycle is unknown' in portal
            and 'KERNEL-SIGNED · VERIFIED' not in portal
        ),
        'signed live AccessPolicy verification': (
            'access_policy_signature_invalid' in live_signatures
            and 'public_read_not_granted' in live_signatures
        ),
        'current kernel master live key': (
            "entry?.role === 'master'" in live_signatures
            and "entry?.status === 'current'" in live_signatures
            and "keyId !== 'kernel-master'" in live_signatures
            and '_verifyLiveWithKeyRefresh' in portal
        ),
        'terminal live revision binding': 'broken_terminal_revision_chain' in portal,
        'failed/refused versus unavailable live bytes': (
            'BYTES CHECK FAILED/REFUSED' in portal
            and 'BYTES NOT CHECKED' in portal
        ),
        'run bundle lifecycle fails closed': (
            'bundle-lifecycle-unknown' in portal
            and 'Run status and artifact-index JSON are not browser-validated' in portal
            and 'Signed AnswerPackage (answer/5)' not in portal
            and 'ap.signed_by' not in portal
        ),
        'unsigned non-artifact telemetry label': 'UNSIGNED TRANSPORT' in index,
        'exact-byte integrity check': 'fetchVerifiedLiveBody' in portal and 'safeRenderMime' in portal,
        'remote executable renderer import': 'https://esm.sh' not in portal and 'cdn.jsdelivr.net' not in portal,
        'hard-coded delegated IPFS commons': 'delegated-ipfs.dev' not in portal and 'https://ipfs.io' not in portal,
        'honest commons disclosure': 'still infrastructure' in readme and 'relay / bootstrap' in readme,
        'reviewed design pin documented': REVIEWED_DESIGN_COMMIT in readme,
        'ambiguous environments remain unresolved': (
            'resolveEnvironmentAuthority' in portal
            and 'resolveUniqueRunEnvironment' in portal
            and 'routing_context_pressure' in routing_authority
            and 'activity_recency' not in routing_authority
            and 'const _dgroups=' not in portal
        ),
        'signed records badge': 'SIGNED RECORDS · VERIFIED' in index,
    }
    failures.extend(label for label, passed in ui_checks.items() if not passed)

    if failures:
        raise SystemExit('design reference validation failed:\n- ' + '\n- '.join(failures))
    print(f'design reference validation: ok ({revision}; {len(markdown)} Markdown files; {manifest_hex})')


if __name__ == '__main__':
    main()
