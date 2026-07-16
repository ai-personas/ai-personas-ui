#!/usr/bin/env python3
"""Serve the static UI plus a deterministic PersonaOS live-artifact node fixture."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import mimetypes
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from nacl.signing import SigningKey


ROOT = Path(__file__).resolve().parents[1]
RUN = "run-fixture-live"
WORKSPACE = "ws-0123456789abcdef01234567"
ENV_WORKSPACE = "ws-shared-0123456789abcdef"
PERSONA = "01J9ZXP0RT5K8V3W6Y2N4B7C9D"
PERSONA_PEER = "01J9ZXP0RT5K8V3W6Y2N4B7C9E"
PERSONA_THIRD = "01J9ZXP0RT5K8V3W6Y2N4B7C9F"
PERSONA_INCOMPLETE = "01J9ZXP0RT5K8V3W6Y2N4B7C9G"
# Real PersonaOS births currently carry a kind-qualified signed identity. Keep
# one integration persona in that exact shape so browser admission exercises
# the DID, identity-key pin, lifecycle envelope, telemetry, and card join.
PERSONA_PENDING_SECOND = "persona:01J9ZXP0RT5K8V3W6Y2N4B7C9H"
UNSIGNED_TELEMETRY_GHOST = "telemetry-unsigned-ghost"
PUBLIC_PERSONA_MESSAGE = (
    "Public design update: revised the circulation plan after peer review."
)
# Deliberately returned by the fixture's public projection as a defensive probe.
# The real node emits an empty frame publicly; the browser must still refuse a
# non-empty one if a faulty or hostile endpoint violates that contract.
PRIVATE_THINKING_FRAME_PROBE = "PRIVATE THINKING FRAME MUST NEVER RENDER PUBLICLY"
ENV = "env:01KX5TJ1SX3B2MJ0P1N5VBTN8P"
ENV_EMPTY = "env:01KX5TJ1SX3B2MJ0P1N5VBTN8Q"
ENV_SAME_TITLE = "env:01KX5TJ1SX3B2MJ0P1N5VBTN8R"
KEY_ID = "kernel-master"
PROVIDER_OK = "provider-authority-ok"
PROVIDER_PERSONA = "provider-persona-avatar"
PROVIDER_PERSONA_PEER = "provider-persona-peer"
PROVIDER_PERSONA_THIRD = "provider-persona-third"
PROVIDER_PERSONA_INCOMPLETE = "provider-persona-incomplete"
PROVIDER_PERSONA_PENDING_SECOND = "provider-persona-pending-second"
PROVIDER_ENV = "provider-environment"
PROVIDER_ENV_EMPTY = "provider-environment-empty"
PROVIDER_ENV_SAME_TITLE = "provider-environment-same-title"
PROVIDER_AMBIGUOUS_ARTIFACT = "provider-artifact-ambiguous-environment"
PROVIDER_PROJECT = "provider-project"
PROVIDER_PROJECT_LEGACY = "provider-project-legacy"
PROVIDER_TASK = "provider-live-public-task"
PROVIDER_TASK_PUBLISHED = "provider-published-task"
PROVIDER_DISCOVER_ONLY = "provider-discover-only"
PROVIDER_EXPIRED_READ = "provider-expired-read"
PROVIDER_SCOPED_READ = "provider-scoped-read"
PROVIDER_TAMPERED = "provider-authority-tampered"
PROVIDER_BAD_SUBJECT = "provider-bad-subject"
PROVIDER_SSE = "provider-sse-current"
PROVIDER_SSE_LEGACY = "provider-sse-legacy"
PROVIDER_P2P_ONLY = "provider-p2p-only"
PROVIDER_P2P_DISCOVER_ONLY = "provider-p2p-discover-only"
PROVIDER_HISTORICAL = "provider-historical-document"
PROVIDER_REVOKED = "provider-revoked-document"
PROVIDER_UNKNOWN = "provider-unknown-document"
PROVIDER_PEER_ID = "12D3KooWProviderAuthorityFixture"
SIGNING_KEYS = {
    0: SigningKey(bytes.fromhex("06" * 32)),
    1: SigningKey(bytes.fromhex("07" * 32)),
    2: SigningKey(bytes.fromhex("08" * 32)),
    3: SigningKey(bytes.fromhex("09" * 32)),
    4: SigningKey(bytes.fromhex("0a" * 32)),
}
# The locator identity is anchored to a stable discovery key. Provider and
# document keys may rotate independently in the fixture.
NODE_ID = "kernel:" + SIGNING_KEYS[0].verify_key.encode().hex()[:16]
AVATAR_IDENTITY_SIGNING_KEY = SigningKey(bytes.fromhex("0b" * 32))
AVATAR_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)

SCALE_GIVEN_NAMES = (
    "Alden", "Amara", "Ansel", "Asha", "Auden", "Ayla", "Basil", "Celia",
    "Dario", "Elara", "Esme", "Felix", "Freya", "Hana", "Idris", "Iris",
    "Jasper", "Juno", "Kai", "Leda", "Leona", "Lucian", "Maeve", "Mira",
    "Niko", "Noa", "Oren", "Priya", "Rhea", "Rowan", "Sable", "Soren",
    "Talia", "Theo", "Una", "Vera", "Willa", "Xavi", "Yara", "Zora",
)
SCALE_FAMILY_NAMES = (
    "Ash", "Bell", "Calder", "Dune", "Ember", "Frost", "Grove", "Hale",
    "Ives", "Jade", "Keene", "Lake", "Moss", "North", "Oak", "Pike",
    "Quinn", "Rose", "Stone", "Thorne", "Umber", "Voss", "West", "Young",
    "Zane", "Arden", "Birch", "Cross", "Dawn", "Ellis", "Finch", "Gray",
    "Hart", "Isley", "James", "Knox", "Lane", "Moon", "Nash", "Owen",
    "Price", "Ray", "Shaw", "Tate", "Venn", "Wynn", "York", "Zephyr",
    "Brook", "Wren",
)

FILES = {
    1: {
        "attachments/controller.bin": b"\x00\xffPERSONAOS\x01\x02\x03\x7f\x80\xfe",
        "attachments/verified-portrait": AVATAR_BYTES,
        "documents/mislabeled-plan.png": b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n",
        "models/extensionless-step": b"ISO-10303-21;\nHEADER;ENDSEC;\nDATA;ENDSEC;\nEND-ISO-10303-21;\n",
        "design/plan.md": b"# Four bedroom concept\n\n- Entry opens to the living hall.\n- Kitchen faces the garden.\n- Bedroom count: 4\n\n![remote tracker](https://example.invalid/pixel.png)\n<img src=\"https://example.invalid/raw.png\">\n",
        "design/old-notes.csv": b"issue,status\nsite fit,open\n",
        "drawings/concept.svg": b'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#f6f7f9"/><path d="M70 60h500v240H70zM300 60v240M70 180h500" fill="none" stroke="#151b24" stroke-width="8"/><text x="95" y="120" font-family="sans-serif" font-size="24">Living</text><text x="350" y="120" font-family="sans-serif" font-size="24">Bedrooms</text></svg>',
    },
    2: {
        "attachments/controller.bin": b"\x00\xffPERSONAOS\x01\x02\x04\x7f\x80\xfe",
        "attachments/verified-portrait": AVATAR_BYTES,
        "documents/mislabeled-plan.png": b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n",
        "models/extensionless-step": b"ISO-10303-21;\nHEADER;ENDSEC;\nDATA;ENDSEC;\nEND-ISO-10303-21;\n",
        "design/plan.md": b"# Four bedroom concept\n\n- Sheltered entry opens to a defined foyer.\n- Kitchen and dining face the garden.\n- Bedroom count: 4, with a ground-floor accessible suite.\n- Egress and storage are marked on the current plan.\n",
        "design/room-schedule.csv": b"room,area_m2\nprimary bedroom,17.5\nbedroom 2,12.0\nbedroom 3,11.8\nbedroom 4,11.5\n",
        "drawings/concept.svg": b'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#f6f7f9"/><path d="M55 45h530v270H55zM285 45v270M55 170h530M430 170v145" fill="none" stroke="#151b24" stroke-width="8"/><path d="M270 65a28 28 0 0 0 28 28M415 190a28 28 0 0 0 28 28" fill="none" stroke="#2783d8" stroke-width="4"/><text x="80" y="105" font-family="sans-serif" font-size="22">Living / dining</text><text x="330" y="105" font-family="sans-serif" font-size="22">Kitchen</text><text x="80" y="235" font-family="sans-serif" font-size="22">Accessible suite</text><text x="455" y="235" font-family="sans-serif" font-size="22">Bed 2</text></svg>',
    },
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonical_bytes(value: dict) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def signature_hex(value: dict, signing_key: SigningKey) -> str:
    return signing_key.sign(canonical_bytes(value)).signature.hex()


def content_hash(value) -> str:
    return f"sha256:{hashlib.sha256(canonical_bytes(value)).hexdigest()}"


def scale_persona_id(index: int) -> str:
    return f"scale-persona-{index:05d}"


def scale_persona_label(index: int) -> str:
    given = SCALE_GIVEN_NAMES[index % len(SCALE_GIVEN_NAMES)]
    family = SCALE_FAMILY_NAMES[
        (index // len(SCALE_GIVEN_NAMES)) % len(SCALE_FAMILY_NAMES)
    ]
    return f"{given} {family}"


def persona_identity_signing_key(persona_id: str) -> SigningKey:
    if persona_id == PERSONA:
        return AVATAR_IDENTITY_SIGNING_KEY
    seed = hashlib.sha256(
        b"personaos-ui-fixture-identity/1\0" + persona_id.encode("utf-8")
    ).digest()
    return SigningKey(seed)


def provider_record_count() -> int:
    # Invalid-provider probes are not members of the atomic v3 inventory. In
    # scale mode the two materializing fixture personas are replaced by the
    # requested exact population.
    scale = STATE.get_scale()
    count = 11 + scale if scale else 18
    return count - (1 if STATE.inventory_omitted_record_id else 0)


def node_announcement_envelope(base_url: str) -> dict:
    """Return a signed locator hint for the fixture's exact node route."""

    signing_key = SIGNING_KEYS[0]
    announcement = {
        "schema": "personaos-node-announcement/1",
        "kernel_id": NODE_ID,
        "node_id": NODE_ID,
        "base_url": base_url,
        "reachability_class": "public",
        "public_discovery": True,
        "record_count": provider_record_count(),
        "issued_at": now(),
        "expires_at": "2099-01-01T00:00:00+00:00",
    }
    return {
        "schema": "personaos-node-announcement-envelope/1",
        "announcement": announcement,
        "public_key_hex": signing_key.verify_key.encode().hex(),
        "signing_key_id": KEY_ID,
        "signature_hex": signature_hex(announcement, signing_key),
    }


def access_policy(signing_key: SigningKey) -> dict:
    payload = {
        "schema": "access-policy/1",
        "policy_id": "acl:live-artifacts:fixture",
        "subject_kind": "artifact",
        "subject_id": f"{NODE_ID}:{RUN}",
        "owner_persona_id": PERSONA,
        "access_grants": [{
            "schema": "access-grant/1",
            "grantee_kind": "public",
            "grantee_id": "*",
            "access_level": "r",
            "scope_kind": "",
            "scope_id": "",
            "reason": "",
            "expires_at": "",
            "attestation_id": "",
        }],
        "outward_tier": "public",
        "cross_tenant_agreement_ref": None,
    }
    return {
        **payload,
        "signature_hex": signature_hex(payload, signing_key),
        "signing_key_id": KEY_ID,
    }


def provider_policy(
    record_id: str,
    signing_key: SigningKey,
    *,
    access_level: str | None = "r",
    expires_at: str = "",
    scope_kind: str = "",
    scope_id: str = "",
    subject_id: str | None = None,
    subject_kind: str = "artifact",
) -> dict:
    grants = []
    if access_level is not None:
        grants.append({
            "schema": "access-grant/1",
            "grantee_kind": "public",
            "grantee_id": "*",
            "access_level": access_level,
            "scope_kind": scope_kind,
            "scope_id": scope_id,
            "reason": "",
            "expires_at": expires_at,
            "attestation_id": "",
        })
    payload = {
        "schema": "access-policy/1",
        "policy_id": f"acl:provider:{record_id}",
        "subject_kind": subject_kind,
        "subject_id": subject_id or record_id,
        "owner_persona_id": PERSONA,
        "access_grants": grants,
        "outward_tier": "public",
        "cross_tenant_agreement_ref": None,
    }
    return {
        **payload,
        "signature_hex": signature_hex(payload, signing_key),
        "signing_key_id": KEY_ID,
    }


def provider_document(
    base: str,
    record_id: str,
    label: str,
    *,
    description: str | None = None,
    access_level: str | None = "r",
    expires_at: str = "",
    scope_kind: str = "",
    scope_id: str = "",
    policy_subject_id: str | None = None,
    handle: str = "",
    signing_key_generation: int | None = None,
    kind: str = "artifact",
    did: str = "",
    interfaces: list[dict] | None = None,
    avatar: dict | None = None,
    identity_signing_key_id: str = "",
    identity_public_key_hex: str = "",
    capability_summary: list[str] | None = None,
    links: dict | None = None,
    record_fields: dict | None = None,
) -> dict:
    signing_key = SIGNING_KEYS[
        STATE.signing_key_generation()
        if signing_key_generation is None else signing_key_generation
    ]
    policy = provider_policy(
        record_id,
        signing_key,
        access_level=access_level,
        expires_at=expires_at,
        scope_kind=scope_kind,
        scope_id=scope_id,
        subject_id=policy_subject_id,
        subject_kind=kind,
    )
    record = {
        "schema": "discoverable-record/1",
        "record_id": record_id,
        "did": did or f"did:personaos:{NODE_ID}/{kind}/{record_id}",
        "kind": kind,
        "label": label,
        "description": (
            f"read-gated detail for {record_id}" if description is None else description
        ),
        # DiscoverableRecord.signing_payload() canonicalises this signed field.
        # Keep the fixture wire shape faithful so consumers cannot rely on an
        # authored insertion order that production never preserves.
        "capability_summary": sorted(
            capability_summary or ["provider-authority-fixture"]
        ),
        "visibility_tier": "public",
        "access_policy_ref": policy["policy_id"],
        "content_locator_ref": f"locator:{record_id}",
    }
    if interfaces:
        record["interfaces"] = interfaces
    if avatar is not None:
        record["avatar"] = avatar
    if identity_signing_key_id and identity_public_key_hex:
        record["identity_signing_key_id"] = identity_signing_key_id
        record["identity_public_key_hex"] = identity_public_key_hex
    if handle:
        record["handle"] = handle
    if isinstance(record_fields, dict):
        record.update(record_fields)
    document = {
        "schema": record["schema"],
        "record": record,
        "signature_hex": signature_hex(record, signing_key),
        "signing_key_id": KEY_ID,
        "access_policy": policy,
        "links": links if links is not None else {"content": f"private/{record_id}.bin", "subject_id": record_id},
        "kernel_id": NODE_ID,
        "host_kernel_id": NODE_ID,
        "base": base,
    }
    grant_live = not expires_at or expires_at > now()
    scope_matches = (
        (not scope_kind or scope_kind == policy["subject_kind"])
        and (not scope_id or scope_id == policy["subject_id"])
    )
    subject_matches = policy["subject_id"] == record_id
    public_read = (
        access_level in {"r", "read", "rw", "write", "admin"}
        and grant_live and scope_matches and subject_matches
    )
    if public_read:
        return document

    # This is the fixture's publication boundary, not a browser redaction. The
    # raw anonymous HTTP/P2P document has never contained body metadata or links.
    projected_record = {
        "schema": record["schema"],
        "record_id": record["record_id"],
        "did": record["did"],
        "kind": record["kind"],
        "label": record["label"],
        "capability_summary": record["capability_summary"],
        "visibility_tier": "public",
        "access_policy_ref": record["access_policy_ref"],
        "signing_key_id": KEY_ID,
    }
    if kind == "persona" and avatar is not None:
        projected_record["avatar"] = avatar
    if kind == "persona" and identity_signing_key_id and identity_public_key_hex:
        projected_record["identity_signing_key_id"] = identity_signing_key_id
        projected_record["identity_public_key_hex"] = identity_public_key_hex
    projected_policy = {
        "schema": "access-policy/1",
        "policy_id": policy["policy_id"],
        "subject_kind": policy["subject_kind"],
        "subject_id": policy["subject_id"],
        "owner_persona_id": "",
        "access_grants": [],
        "outward_tier": "public",
        "cross_tenant_agreement_ref": None,
    }
    return {
        "schema": projected_record["schema"],
        "record": projected_record,
        "signature_hex": signature_hex(projected_record, signing_key),
        "signing_key_id": KEY_ID,
        "access_policy": {
            **projected_policy,
            "signature_hex": signature_hex(projected_policy, signing_key),
        },
        "projection": "discover",
        "kernel_id": NODE_ID,
        "host_kernel_id": NODE_ID,
        "base": base,
    }


def provider_key_cid(key: str) -> str:
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    cid_bytes = bytes((0x01, 0x55, 0x12, 0x20)) + digest
    return "b" + base64.b32encode(cid_bytes).decode("ascii").lower().rstrip("=")


def _document_signing_generation(document: dict) -> int:
    signature = bytes.fromhex(document["signature_hex"])
    payload = canonical_bytes(document["record"])
    for generation, signing_key in SIGNING_KEYS.items():
        try:
            signing_key.verify_key.verify(payload, signature)
            return generation
        except Exception:  # noqa: BLE001 - deterministic fixture candidate scan
            continue
    raise ValueError("fixture document signature is not from a known test key")


def provider_envelope(
    document: dict,
    record_url: str,
    *,
    key: str | None = None,
    document_key_status: str | None = None,
) -> dict:
    signing_key = SIGNING_KEYS[STATE.signing_key_generation()]
    document_generation = _document_signing_generation(document)
    document_signing_key = SIGNING_KEYS[document_generation]
    subject = document["record"]
    key = key or subject["did"]
    provider = {
        "schema": "provider-record/1",
        "key": key,
        "provider_cid": provider_key_cid(key),
        "record_id": subject["record_id"],
        "provider_peer_id": PROVIDER_PEER_ID,
        "host_kernel_id": NODE_ID,
        "host_multiaddrs": [
            f"/ip4/127.0.0.1/tcp/8791/ws/p2p/{PROVIDER_PEER_ID}",
        ],
        "content_locator_refs": [subject["content_locator_ref"]]
        if subject.get("content_locator_ref") else [],
        "record_url": record_url,
        "base_url": document["base"],
        "document_hash": f"sha256:{hashlib.sha256(canonical_bytes(document)).hexdigest()}",
        "access_policy_ref": subject["access_policy_ref"],
        "visibility_tier": "public",
        "signing_key_id": KEY_ID,
        "signing_key_role": "master",
        "signing_key_status": "current",
        "public_key_hex": signing_key.verify_key.encode().hex(),
        "document_signing_key_id": KEY_ID,
        "document_signing_key_status": document_key_status or (
            "archived" if document_generation == 0 else "current"
        ),
        "document_public_key_hex": document_signing_key.verify_key.encode().hex(),
    }
    return {
        "schema": "provider-record-envelope/1",
        "record": provider,
        "signature_hex": signature_hex(provider, signing_key),
        # HTTP indexes and the provider protocol carry the same atomic pair.
        # ProviderRecord.document_hash binds these exact canonical bytes.
        "document": document,
    }


def persona_avatar_descriptor(
    persona_id: str = PERSONA,
    persona_label: str = "Orin Vale",
) -> dict:
    digest = hashlib.sha256(AVATAR_BYTES).hexdigest()
    identity_signing_key = persona_identity_signing_key(persona_id)
    identity_public_key_hex = identity_signing_key.verify_key.encode().hex()
    candidate = {
        "schema": "persona-avatar/2",
        "kind": "raster",
        "body_path": f"assets/persona-avatars/sha256/{digest}.png",
        "content_ref": f"sha256:{digest}",
        "sha256": digest,
        "mime_type": "image/png",
        "byte_length": len(AVATAR_BYTES),
        "width": 1,
        "height": 1,
        "character_prompt_hash": "sha256:" + hashlib.sha256(
            b"persona-avatar-character-prompt/1\0"
            + f"fixture portrait of {persona_label}".encode("utf-8")
        ).hexdigest(),
        "provenance_hash": "sha256:" + hashlib.sha256(
            b"persona-avatar-generation-provenance/1\0"
            + canonical_bytes({
                "fixture": True,
                "generator": "external-test-raster",
                "persona_id": persona_id,
            })
        ).hexdigest(),
        "persona_id": persona_id,
        "identity_signing_key_id": f"persona:{persona_id}",
        "identity_public_key_hex": identity_public_key_hex,
    }
    signature = identity_signing_key.sign(canonical_bytes({
        "schema": "persona-avatar-admission/1",
        "descriptor": candidate,
    })).signature.hex()
    return {**candidate, "identity_signature_hex": signature}


def persona_lifecycle_card(
    persona_id: str,
    did: str,
    *,
    materialized: bool,
    issued_at: str = "2026-07-15T00:00:00+00:00",
) -> dict:
    identity_key = persona_identity_signing_key(persona_id)
    state = "materialized" if materialized else "pending"
    fields = {
        field: {"state": state, "persona_authored": materialized}
        for field in ("name", "characteristics", "avatar")
    }
    payload = {
        "schema": "personaos-persona-lifecycle-card/1",
        "persona_id": persona_id,
        "did": did,
        "lifecycle_state": "ACTIVE",
        "identity_materialization_state": state,
        "identity_fields": fields,
        "identity_signing_key_id": f"persona:{persona_id}",
        "identity_public_key_hex": identity_key.verify_key.encode().hex(),
        "identity_signature_verified": True,
        "identity_signature_hash": content_hash({
            "schema": "personaos-fixture-identity-proof/1",
            "persona_id": persona_id,
            "state": state,
        }),
        "lifecycle_chain_verified": True,
        "lifecycle_chain_head_hash": content_hash({
            "schema": "personaos-fixture-lifecycle-head/1",
            "persona_id": persona_id,
            "state": state,
            "issued_at": issued_at,
        }),
        "authority": "kernel_observed_verified_persona_lifecycle",
        "issued_at": issued_at,
        "signing_key_id": KEY_ID,
    }
    signing_key = SIGNING_KEYS[STATE.signing_key_generation()]
    return {**payload, "signature_hex": signature_hex(payload, signing_key)}


def provider_fixtures(
    base: str,
    *,
    include_scale: bool = True,
) -> tuple[list[dict], dict[str, dict]]:
    record_ids = (
        PROVIDER_OK,
        PROVIDER_PERSONA,
        PROVIDER_PERSONA_PEER,
        PROVIDER_PERSONA_THIRD,
        PROVIDER_PERSONA_INCOMPLETE,
        PROVIDER_PERSONA_PENDING_SECOND,
        PROVIDER_ENV,
        PROVIDER_ENV_EMPTY,
        PROVIDER_PROJECT,
        PROVIDER_PROJECT_LEGACY,
        PROVIDER_TASK,
        PROVIDER_TASK_PUBLISHED,
        PROVIDER_DISCOVER_ONLY,
        PROVIDER_EXPIRED_READ,
        PROVIDER_SCOPED_READ,
        PROVIDER_TAMPERED,
        PROVIDER_BAD_SUBJECT,
        PROVIDER_SSE,
        PROVIDER_SSE_LEGACY,
        PROVIDER_P2P_ONLY,
        PROVIDER_P2P_DISCOVER_ONLY,
        PROVIDER_HISTORICAL,
        PROVIDER_REVOKED,
        PROVIDER_UNKNOWN,
        PROVIDER_ENV_SAME_TITLE,
        PROVIDER_AMBIGUOUS_ARTIFACT,
    )
    urls = {record_id: f"discovery/public/records/{record_id}.json"
            for record_id in record_ids}
    valid = provider_document(base, PROVIDER_OK, "Signed provider authority accepted")
    persona = provider_document(
        base,
        PROVIDER_PERSONA,
        "Orin Vale",
        kind="persona",
        did=f"did:personaos:{NODE_ID}/persona/{PERSONA}",
        avatar=persona_avatar_descriptor(),
        identity_signing_key_id=f"persona:{PERSONA}",
        identity_public_key_hex=(
            AVATAR_IDENTITY_SIGNING_KEY.verify_key.encode().hex()
        ),
        capability_summary=["active_persona"],
        links={},
    )
    persona["persona_lifecycle_card"] = persona_lifecycle_card(
        PERSONA, persona["record"]["did"], materialized=True
    )
    persona_peer = provider_document(
        base,
        PROVIDER_PERSONA_PEER,
        "Mara Chen",
        kind="persona",
        did=f"did:personaos:{NODE_ID}/persona/{PERSONA_PEER}",
        avatar=persona_avatar_descriptor(PERSONA_PEER, "Mara Chen"),
        identity_signing_key_id=f"persona:{PERSONA_PEER}",
        identity_public_key_hex=(
            persona_identity_signing_key(PERSONA_PEER).verify_key.encode().hex()
        ),
        capability_summary=["active_persona", "lead"],
        links={},
    )
    persona_peer["persona_lifecycle_card"] = persona_lifecycle_card(
        PERSONA_PEER, persona_peer["record"]["did"], materialized=True
    )
    persona_third = provider_document(
        base,
        PROVIDER_PERSONA_THIRD,
        "Ivo Reed",
        kind="persona",
        did=f"did:personaos:{NODE_ID}/persona/{PERSONA_THIRD}",
        avatar=persona_avatar_descriptor(PERSONA_THIRD, "Ivo Reed"),
        identity_signing_key_id=f"persona:{PERSONA_THIRD}",
        identity_public_key_hex=(
            persona_identity_signing_key(PERSONA_THIRD).verify_key.encode().hex()
        ),
        capability_summary=["active_persona", "verifier"],
        links={},
    )
    persona_third["persona_lifecycle_card"] = persona_lifecycle_card(
        PERSONA_THIRD, persona_third["record"]["did"], materialized=True
    )
    incomplete_key = persona_identity_signing_key(PERSONA_INCOMPLETE)
    incomplete_persona = provider_document(
        base,
        PROVIDER_PERSONA_INCOMPLETE,
        "",
        description="",
        kind="persona",
        did=f"did:personaos:{NODE_ID}/persona/{PERSONA_INCOMPLETE}",
        identity_signing_key_id=f"persona:{PERSONA_INCOMPLETE}",
        identity_public_key_hex=incomplete_key.verify_key.encode().hex(),
        capability_summary=["active_persona"],
        links={},
    )
    incomplete_persona["persona_lifecycle_card"] = persona_lifecycle_card(
        PERSONA_INCOMPLETE,
        incomplete_persona["record"]["did"],
        materialized=False,
    )
    pending_second_key = persona_identity_signing_key(PERSONA_PENDING_SECOND)
    pending_second = provider_document(
        base,
        PROVIDER_PERSONA_PENDING_SECOND,
        "",
        description="",
        kind="persona",
        did=f"did:personaos:{NODE_ID}/persona/{PERSONA_PENDING_SECOND}",
        identity_signing_key_id=f"persona:{PERSONA_PENDING_SECOND}",
        identity_public_key_hex=pending_second_key.verify_key.encode().hex(),
        capability_summary=["active_persona"],
        links={},
    )
    pending_second["persona_lifecycle_card"] = persona_lifecycle_card(
        PERSONA_PENDING_SECOND,
        pending_second["record"]["did"],
        materialized=False,
    )
    environment = provider_document(
        base,
        PROVIDER_ENV,
        "Four Bedroom Design Studio",
        kind="env",
        did=f"did:personaos:{NODE_ID}/env/{ENV}",
        capability_summary=["workspace", "residential_design"],
        links={},
    )
    empty_environment = provider_document(
        base,
        PROVIDER_ENV_EMPTY,
        "House Planning Commons",
        kind="env",
        did=f"did:personaos:{NODE_ID}/env/{ENV_EMPTY}",
        capability_summary=["workspace"],
        links={},
    )
    project = provider_document(
        base,
        PROVIDER_PROJECT,
        "Open host topology",
        kind="project",
        did=f"did:personaos:{NODE_ID}/project/project:fixture",
        links={"export": "projects/project-fixture.json"},
    )
    legacy_project = provider_document(
        base,
        PROVIDER_PROJECT_LEGACY,
        "Legacy singular topology",
        kind="project",
        did=f"did:personaos:{NODE_ID}/project/project:legacy",
        links={"export": "projects/project-legacy.json"},
    )
    live_task = provider_document(
        base,
        PROVIDER_TASK,
        "prepare the site approval package",
        kind="task",
        did=f"did:personaos:{NODE_ID}/task/{RUN}",
        capability_summary=[
            "live_task",
            "model_pool_hash:fixture-pool",
            "task_state:awaiting peer synthesis",
        ],
        links={"live": "telemetry/live/latest.json"},
    )
    published_task = provider_document(
        base,
        PROVIDER_TASK_PUBLISHED,
        "design 4 bedroom house",
        kind="task",
        did=f"did:personaos:{NODE_ID}/task/run-canary-house",
        # Normal mode mirrors the public canary terminal projection. The model-
        # failure mode deliberately keeps this task open so the separate
        # unsigned terminal-failure overlay remains independently testable.
        capability_summary=[
            "event_driven_handoff" if STATE.is_model_failed() else "complete"
        ],
        links={},
    )
    discover_only = provider_document(
        base, PROVIDER_DISCOVER_ONLY, "Discover-only provider", access_level=None)
    expired_read = provider_document(
        base,
        PROVIDER_EXPIRED_READ,
        "Expired public-read provider",
        expires_at="2020-01-01T00:00:00Z",
    )
    scoped_read = provider_document(
        base,
        PROVIDER_SCOPED_READ,
        "Wrong-scope public-read provider",
        scope_kind="artifact",
        scope_id="different-artifact",
    )
    tampered = provider_document(base, PROVIDER_TAMPERED, "Signed provider before tamper")
    bad_subject = provider_document(
        base,
        PROVIDER_BAD_SUBJECT,
        "Mismatched policy subject",
        policy_subject_id="different-artifact",
    )
    sse = provider_document(base, PROVIDER_SSE, "SSE current ProviderRecord")
    sse_legacy = provider_document(base, PROVIDER_SSE_LEGACY, "Legacy SSE pointer must fail")
    p2p = provider_document(
        base,
        PROVIDER_P2P_ONLY,
        "P2P handle resolved by current master",
        handle="p2p-only-handle",
    )
    p2p_discover_only = provider_document(
        base,
        PROVIDER_P2P_DISCOVER_ONLY,
        "P2P discover-only projection",
        access_level=None,
    )
    historical = provider_document(
        base,
        PROVIDER_HISTORICAL,
        "Historical document accepted",
        signing_key_generation=0,
    )
    revoked = provider_document(
        base,
        PROVIDER_REVOKED,
        "Revoked document must fail",
        access_level=None,
        signing_key_generation=4,
    )
    unknown = provider_document(
        base,
        PROVIDER_UNKNOWN,
        "Unknown document must fail",
        access_level=None,
        signing_key_generation=3,
    )
    environment_same_title = provider_document(
        base,
        PROVIDER_ENV_SAME_TITLE,
        "Four Bedroom Design Studio",
        kind="env",
        did=f"did:personaos:{NODE_ID}/env/{ENV_SAME_TITLE}",
        capability_summary=["workspace", "residential_design"],
        links={},
    )
    ambiguous_artifact = provider_document(
        base,
        PROVIDER_AMBIGUOUS_ARTIFACT,
        "Unresolved multi-environment drawing",
        record_fields={"environment_ids": [ENV, ENV_SAME_TITLE]},
    )
    envelopes = [
        provider_envelope(valid, urls[PROVIDER_OK]),
        provider_envelope(persona, urls[PROVIDER_PERSONA]),
        provider_envelope(persona_peer, urls[PROVIDER_PERSONA_PEER]),
        provider_envelope(persona_third, urls[PROVIDER_PERSONA_THIRD]),
        *([] if STATE.get_scale() else [
            provider_envelope(incomplete_persona, urls[PROVIDER_PERSONA_INCOMPLETE]),
            provider_envelope(pending_second, urls[PROVIDER_PERSONA_PENDING_SECOND]),
        ]),
        provider_envelope(environment, urls[PROVIDER_ENV]),
        provider_envelope(empty_environment, urls[PROVIDER_ENV_EMPTY]),
        *([] if STATE.get_scale() else [
            provider_envelope(
                environment_same_title,
                urls[PROVIDER_ENV_SAME_TITLE],
            ),
            provider_envelope(
                ambiguous_artifact,
                urls[PROVIDER_AMBIGUOUS_ARTIFACT],
            ),
        ]),
        provider_envelope(project, urls[PROVIDER_PROJECT]),
        provider_envelope(legacy_project, urls[PROVIDER_PROJECT_LEGACY]),
        provider_envelope(live_task, urls[PROVIDER_TASK]),
        provider_envelope(published_task, urls[PROVIDER_TASK_PUBLISHED]),
        provider_envelope(discover_only, urls[PROVIDER_DISCOVER_ONLY]),
        provider_envelope(expired_read, urls[PROVIDER_EXPIRED_READ]),
        provider_envelope(scoped_read, urls[PROVIDER_SCOPED_READ]),
        provider_envelope(historical, urls[PROVIDER_HISTORICAL],
                          document_key_status="archived"),
    ]
    documents = {
        PROVIDER_OK: valid,
        PROVIDER_PERSONA: persona,
        PROVIDER_PERSONA_PEER: persona_peer,
        PROVIDER_PERSONA_THIRD: persona_third,
        PROVIDER_PERSONA_INCOMPLETE: incomplete_persona,
        PROVIDER_PERSONA_PENDING_SECOND: pending_second,
        PROVIDER_ENV: environment,
        PROVIDER_ENV_EMPTY: empty_environment,
        PROVIDER_PROJECT: project,
        PROVIDER_PROJECT_LEGACY: legacy_project,
        PROVIDER_TASK: live_task,
        PROVIDER_TASK_PUBLISHED: published_task,
        PROVIDER_DISCOVER_ONLY: discover_only,
        PROVIDER_EXPIRED_READ: expired_read,
        PROVIDER_SCOPED_READ: scoped_read,
        PROVIDER_TAMPERED: tampered,
        PROVIDER_BAD_SUBJECT: bad_subject,
        PROVIDER_SSE: sse,
        PROVIDER_SSE_LEGACY: sse_legacy,
        PROVIDER_P2P_ONLY: p2p,
        PROVIDER_P2P_DISCOVER_ONLY: p2p_discover_only,
        PROVIDER_HISTORICAL: historical,
        PROVIDER_REVOKED: revoked,
        PROVIDER_UNKNOWN: unknown,
        PROVIDER_ENV_SAME_TITLE: environment_same_title,
        PROVIDER_AMBIGUOUS_ARTIFACT: ambiguous_artifact,
    }
    if include_scale:
        for index in range(3, STATE.get_scale()):
            persona_id = scale_persona_id(index)
            label = scale_persona_label(index)
            record_id = f"sp{index:05d}"
            identity_key = persona_identity_signing_key(persona_id)
            document = provider_document(
                base,
                record_id,
                label,
                kind="persona",
                did=f"did:personaos:{NODE_ID}/persona/{persona_id}",
                avatar=persona_avatar_descriptor(persona_id, label),
                identity_signing_key_id=f"persona:{persona_id}",
                identity_public_key_hex=identity_key.verify_key.encode().hex(),
                capability_summary=["active_persona"],
                links={},
            )
            envelopes.append(provider_envelope(
                document,
                f"discovery/public/records/{record_id}.json",
                key=record_id,
            ))
            documents[record_id] = document
    if STATE.inventory_omitted_record_id:
        envelopes = [
            envelope for envelope in envelopes
            if envelope["record"]["record_id"] != STATE.inventory_omitted_record_id
        ]
    # The envelope remains correctly signed but no longer hashes the served doc.
    tampered["record"]["label"] = "Tampered provider metadata must be rejected"
    return envelopes, documents


def compact_provider_index(envelopes: list[dict]) -> dict:
    """Build one exact, durable, current-master-signed v3 inventory."""
    documents: dict[str, dict] = {}
    prepared: list[tuple[dict, dict, str]] = []
    for envelope in envelopes:
        provider = dict(envelope["record"])
        document_ref = provider["document_hash"]
        document = envelope["document"]
        prior = documents.get(document_ref)
        if prior is not None and prior != document:
            raise ValueError("fixture provider document hash collision")
        documents[document_ref] = document
        prepared.append((provider, document, document_ref))
    manifest = sorted(({
        "record_id": provider["record_id"],
        "document_hash": document_ref,
        "record_url": provider["record_url"],
    } for provider, _document, document_ref in prepared), key=lambda row: (
        row["record_id"], row["document_hash"], row["record_url"]
    ))
    manifest_hash = content_hash(manifest)
    references: list[dict] = []
    signing_key = SIGNING_KEYS[STATE.signing_key_generation()]
    for provider, _document, document_ref in prepared:
        provider["inventory_generation"] = STATE.inventory_generation
        provider["inventory_manifest_hash"] = manifest_hash
        references.append({
            "schema": "provider-record-reference/1",
            "record": provider,
            "signature_hex": signature_hex(provider, signing_key),
            "document_ref": document_ref,
        })
    generated = datetime.fromisoformat(STATE.inventory_generated_at)
    payload = {
        "schema": "dht-provider-index/3",
        "kernel_id": NODE_ID,
        "base": prepared[0][0]["base_url"] if prepared else "",
        "inventory_generation": STATE.inventory_generation,
        "previous_inventory_hash": STATE.inventory_previous_hash,
        "generated_at": STATE.inventory_generated_at,
        "expires_at": (generated + timedelta(hours=1)).isoformat(),
        "inventory_manifest": manifest,
        "inventory_manifest_hash": manifest_hash,
        "provider_count": len(references),
        "document_count": len(documents),
        "documents": documents,
        "providers": references,
        "visibility": "public",
        "version": STATE.inventory_generation,
        "signing_key_id": KEY_ID,
    }
    inventory_hash = content_hash(payload)
    signed = {**payload, "inventory_hash": inventory_hash}
    return {**signed, "signature_hex": signature_hex(signed, signing_key)}


def sse_provider_snapshot(base: str) -> dict:
    providers, _documents = provider_fixtures(base, include_scale=False)
    return {"providers": compact_provider_index(providers)}


def p2p_provider_resolution(base: str) -> tuple[dict, dict]:
    _providers, documents = provider_fixtures(base, include_scale=False)
    document = documents[PROVIDER_P2P_ONLY]
    envelope = provider_envelope(
        document,
        f"discovery/public/records/{PROVIDER_P2P_ONLY}.json",
        key="p2p-only-handle",
    )
    return envelope, document


def p2p_discover_only_resolution(base: str) -> tuple[dict, dict]:
    _providers, documents = provider_fixtures(base, include_scale=False)
    document = documents[PROVIDER_P2P_DISCOVER_ONLY]
    envelope = provider_envelope(
        document,
        f"discovery/public/records/{PROVIDER_P2P_DISCOVER_ONLY}.json",
        key=document["record"]["did"],
    )
    return envelope, document


def signed_metadata(document: dict) -> dict:
    signing_key = SIGNING_KEYS[STATE.signing_key_generation()]
    policy = access_policy(signing_key)
    result = {
        **document,
        "access_policy_ref": policy["policy_id"],
        "access_policy": policy,
        "signing_key_id": KEY_ID,
    }
    result["signature_hex"] = signature_hex(result, signing_key)
    return result


class State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.revision = 1
        self.ended = False
        self.model_failed = False
        self.stale_next = False
        self.stale_started = False
        self.tamper_next_poll = False
        self.tamper_poll_served = False
        self.key_generation = 1
        self.key_requests = 0
        self.scale_count = 0
        self.inventory_generation = 1
        self.inventory_previous_hash = ""
        self.inventory_generated_at = now()
        self.inventory_omitted_record_id = ""

    def set(self, value: int) -> None:
        with self.lock:
            self.revision = value
            self.ended = False
            self.model_failed = False

    def get(self) -> int:
        with self.lock:
            return self.revision

    def reset(self) -> None:
        with self.lock:
            self.revision = 1
            self.ended = False
            self.model_failed = False
            self.stale_next = False
            self.stale_started = False
            self.tamper_next_poll = False
            self.tamper_poll_served = False
            self.key_generation = 1
            self.key_requests = 0
            self.scale_count = 0
            self.inventory_generation = 1
            self.inventory_previous_hash = ""
            self.inventory_generated_at = now()
            self.inventory_omitted_record_id = ""

    def advance_inventory_omitting(self, previous_hash: str, record_id: str) -> None:
        with self.lock:
            self.inventory_generation += 1
            self.inventory_previous_hash = previous_hash
            self.inventory_generated_at = now()
            self.inventory_omitted_record_id = record_id

    def set_scale(self, count: int) -> None:
        with self.lock:
            self.scale_count = max(0, min(10_000, int(count)))

    def get_scale(self) -> int:
        with self.lock:
            return self.scale_count

    def arm_stale(self) -> None:
        with self.lock:
            self.stale_next = True
            self.stale_started = False

    def consume_stale(self) -> int | None:
        with self.lock:
            if not self.stale_next:
                return None
            self.stale_next = False
            self.stale_started = True
            return self.revision

    def end(self) -> None:
        with self.lock:
            self.ended = True

    def fail_model(self) -> None:
        with self.lock:
            self.ended = True
            self.model_failed = True

    def is_model_failed(self) -> bool:
        with self.lock:
            return self.model_failed

    def is_ended(self) -> bool:
        with self.lock:
            return self.ended

    def advance_with_tampered_poll(self) -> None:
        with self.lock:
            self.revision = 2
            self.ended = False
            self.model_failed = False
            self.tamper_next_poll = True
            self.tamper_poll_served = False

    def rotate_and_advance(self) -> None:
        with self.lock:
            self.key_generation = 2
            self.revision = 2
            self.ended = False
            self.model_failed = False

    def signing_key_generation(self) -> int:
        with self.lock:
            return self.key_generation

    def note_key_request(self) -> tuple[int, int]:
        with self.lock:
            self.key_requests += 1
            return self.key_generation, self.key_requests

    def consume_tampered_poll(self) -> bool:
        with self.lock:
            if not self.tamper_next_poll:
                return False
            self.tamper_next_poll = False
            self.tamper_poll_served = True
            return True


STATE = State()


def file_record(path: str, body: bytes, revision: int, *, workspace_id: str = WORKSPACE,
                persona_id: str = PERSONA) -> dict:
    digest = hashlib.sha256(body).hexdigest()
    return {
        "workspace_id": workspace_id,
        "environment_id": ENV,
        "persona_id": persona_id,
        "path": path,
        "size_bytes": len(body),
        "sha256": digest,
        "mtime": f"2026-07-10T12:00:0{revision}+00:00",
        "media_kind": mimetypes.guess_type(path)[0] or "application/octet-stream",
        "body_url": f"/runs/{RUN}/live-artifacts/body/{workspace_id}/{path}?sha256={digest}",
    }


def snapshot(revision: int | None = None, since_revision: str | None = None,
             *, active: bool = True) -> dict:
    revision = STATE.get() if revision is None else revision
    ended = not active
    files = [file_record(path, body, revision) for path, body in sorted(FILES[revision].items())]
    files.append(file_record(
        "shared/environment-brief.md",
        b"# Shared environment brief\n\nCurrent constraints and team decisions.\n",
        revision,
        workspace_id=ENV_WORKSPACE,
        persona_id="",
    ))
    manifest = [{"workspace_id": item["workspace_id"], "path": item["path"], "sha256": item["sha256"]} for item in files]
    digest = hashlib.sha256(json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return signed_metadata({
        "schema": "personaos-live-artifacts/1",
        "node_id": NODE_ID,
        "run": RUN,
        "task": "design 4 bedroom house",
        "generated_at": now(),
        "revision": f"sha256:{digest}",
        "since_revision": since_revision,
        "visibility_tier": "public",
        "active": {
            "calls": [] if ended else [{
                "schema": "model-active-call/1",
                "call_id": "call-fixture",
                "model_id": "gpt-5.5",
                "persona_id": PERSONA,
                "environment_id": ENV,
                "requested_purpose": "artifact_revision" if revision == 2 else "artifact_review",
                "role": "lead",
                "started_at": "2026-07-10T12:00:00+00:00",
                "status": "running",
                "workspace_id": WORKSPACE,
            }],
            "persona_ids": [] if ended else [PERSONA],
            "environment_ids": [] if ended else [ENV],
        },
        "workspaces": [{
            "workspace_id": WORKSPACE,
            "environment_id": ENV,
            "persona_id": PERSONA,
            "active_call_ids": [] if ended else ["call-fixture"],
            "state": "run_ended" if ended else "model_call_active",
        }, {
            "workspace_id": ENV_WORKSPACE,
            "environment_id": ENV,
            "persona_id": "",
            "active_call_ids": [],
            "state": "run_ended" if ended else "shared_environment_active",
        }],
        "file_count": len(files),
        "indexed_file_count": len(files),
        "total_size_bytes": sum(item["size_bytes"] for item in files),
        "files": files,
        "changes": {"baseline": revision == 1, "created": [], "modified": [], "deleted": []},
        "limits": {"max_files": 256, "max_file_bytes": 2_000_000, "max_total_bytes": 20_000_000},
        "truncated": False,
        "omitted_file_count": 0,
        "omitted_reasons": {},
    })


def _public_persona_summary(
    persona_id: str,
    name: str,
    *,
    materialized: bool,
    failed: bool,
    experience_tasks: int,
    reputation_score: float,
) -> dict:
    state = "materialized" if materialized else "pending"
    safe_reputation = float(reputation_score)
    if safe_reputation.is_integer():
        safe_reputation = 0.001 if safe_reputation <= 0 else 0.999
    return {
        "persona_id": persona_id,
        "name": name if materialized else "",
        "lifecycle_state": "ACTIVE",
        "identity_materialization_state": state,
        "identity_fields": {
            field: {"state": state, "persona_authored": materialized}
            for field in ("name", "characteristics", "avatar")
        },
        "experience_tasks": experience_tasks,
        "reputation_score": safe_reputation,
        "running_llm": False if failed else persona_id == PERSONA,
        "task_execution_state": "idle" if failed else (
            "running_llm" if persona_id == PERSONA else "idle"
        ),
        "llm_execution_state": "idle" if failed else (
            "running" if persona_id == PERSONA else "idle"
        ),
    }


def _signed_public_route(
    *, event_id: str, at: str, sender: str, recipients: list[str]
) -> dict:
    payload = {
        "schema": "personaos-public-persona-communication-route/1",
        "event_id": event_id,
        "at": at,
        "sender_persona_id": sender,
        "environment_id": ENV,
        "route_kind": "broadcast",
        "recipient_persona_ids": recipients,
        "persona_signature_verified": True,
        "lineage_signature_verified": True,
        "signing_key_id": KEY_ID,
    }
    key = SIGNING_KEYS[STATE.signing_key_generation()]
    return {**payload, "signature_hex": signature_hex(payload, key)}


def _signed_public_document(payload: dict) -> dict:
    key = SIGNING_KEYS[STATE.signing_key_generation()]
    signed = {**payload, "signing_key_id": KEY_ID}
    return {**signed, "signature_hex": signature_hex(signed, key)}


def public_persona_messages(
        persona_id: str = PERSONA,
        name: str = "Orin Vale",
        author_persona_id: str | None = None,
        text: str = PUBLIC_PERSONA_MESSAGE,
        output_extra: dict | None = None,
) -> dict:
    """Build the exact signed anonymous persona-message projection."""
    generated_at = now()
    output = {
        "kind": "PERSONA_COMMUNICATION_AUTHORED",
        "at": generated_at,
        "text": text,
        "environment_id": ENV,
        "author_persona_id": author_persona_id or persona_id,
        "persona_signature_verified": True,
        **(output_extra or {}),
    }
    return _signed_public_document({
        "schema": "personaos-persona-public-messages/1",
        "generated_at": generated_at,
        "persona_id": persona_id,
        "name": name,
        "lifecycle_state": "ACTIVE",
        "identity_materialization_state": "materialized",
        "identity_fields": {
            field: {"state": "materialized", "persona_authored": True}
            for field in ("name", "characteristics", "avatar")
        },
        "tier": "public",
        "recent_outputs": [output],
    })


def telemetry() -> dict:
    call = snapshot()["active"]["calls"][0]
    failed = STATE.is_model_failed()
    scale_count = STATE.get_scale()
    ordinary = [
        _public_persona_summary(PERSONA, "Orin Vale", materialized=True, failed=failed,
                                experience_tasks=3, reputation_score=0.91),
        _public_persona_summary(PERSONA_PEER, "Mara Chen", materialized=True, failed=failed,
                                experience_tasks=7, reputation_score=0.88),
        _public_persona_summary(PERSONA_THIRD, "Ivo Reed", materialized=True, failed=failed,
                                experience_tasks=4, reputation_score=0.84),
    ]
    if scale_count:
        personas = ordinary[:min(3, scale_count)]
        personas.extend(
            _public_persona_summary(
                scale_persona_id(index), scale_persona_label(index), materialized=True,
                failed=failed, experience_tasks=index % 17,
                reputation_score=round((index % 100) / 100, 2),
            )
            for index in range(3, scale_count)
        )
    else:
        personas = [
            *ordinary,
            _public_persona_summary(
                PERSONA_INCOMPLETE, "", materialized=False, failed=failed,
                experience_tasks=0, reputation_score=0.0,
            ),
            _public_persona_summary(
                PERSONA_PENDING_SECOND, "", materialized=False, failed=failed,
                experience_tasks=0, reputation_score=0.0,
            ),
        ]
    personas.append({
        **_public_persona_summary(
            UNSIGNED_TELEMETRY_GHOST, "Unsigned Telemetry Ghost", materialized=True,
            failed=failed, experience_tasks=999, reputation_score=1.0,
        ),
        "name": "Unsigned Telemetry Ghost",
    })
    generated_at = now()
    model_events = [{
        "kind": "MODEL_SELECTED", "persona_id": PERSONA,
        "environment_id": ENV, "model_id": "gpt-5.5",
        "requested_purpose": call["requested_purpose"], "role": "lead",
        "at": generated_at,
    }]
    if failed:
        model_events.append({
            "kind": "MODEL_CALL_FAILED", "persona_id": PERSONA,
            "environment_id": ENV, "model_id": "gpt-5.5",
            "requested_purpose": "persona_communication", "status": 400,
            "at": generated_at,
        })
    public_ids = [item["persona_id"] for item in personas
                  if item["persona_id"] != UNSIGNED_TELEMETRY_GHOST]
    routes = [] if scale_count and scale_count < 3 else [
        _signed_public_route(
            event_id="event:fixture-orin-broadcast", at=generated_at,
            sender=PERSONA, recipients=[PERSONA_PEER, PERSONA_THIRD],
        ),
        _signed_public_route(
            event_id="event:fixture-mara-broadcast", at=generated_at,
            sender=PERSONA_PEER,
            recipients=([PERSONA_THIRD] if scale_count else
                        [PERSONA_THIRD, PERSONA_INCOMPLETE, PERSONA_PENDING_SECOND]),
        ),
    ]
    active_calls = [] if failed else [{
        key: value for key, value in call.items()
        if key in {"call_id", "model_id", "persona_id", "environment_id",
                   "requested_purpose", "started_at", "status"}
    }]
    topology = [{
        "environment_id": ENV, "status": "active", "member_count": len(public_ids),
        "members": [{"persona_id": pid, "active": True} for pid in public_ids],
    }]
    activity: list[dict] = []
    return _signed_public_document({
        "schema": "personaos-live-telemetry-public/1",
        "generated_at": generated_at,
        "node_id": NODE_ID,
        "counts": {"active_personas": len(public_ids), "environments": 1,
                   "active_model_calls": len(active_calls), "lineage_scopes": 0,
                   "lineage_scopes_verified": 0, "lineage_events": len(routes),
                   "otel_spans": 0},
        "personas": personas,
        "topology": topology,
        "topology_hash": content_hash(topology),
        "model_status": {"active_calls": active_calls, "recent_events": model_events},
        "activity": activity,
        "activity_hash": content_hash(activity),
        "communication_routes": routes,
        "communication_routes_hash": content_hash(routes),
        "sufficiency": [],
    })


def entity_telemetry_documents() -> dict[str, dict]:
    aggregate = telemetry()
    generated_at = aggregate["generated_at"]
    summaries = [item for item in aggregate["personas"]
                 if item["persona_id"] != UNSIGNED_TELEMETRY_GHOST]
    routes = aggregate["communication_routes"]
    events = aggregate["model_status"]["recent_events"]
    documents: dict[str, dict] = {}
    index = {"schema": "personaos-telemetry-entities-public/1",
             "generated_at": generated_at, "node_id": NODE_ID,
             "personas": {}, "environments": {}}
    for summary in summaries:
        persona_id = summary["persona_id"]
        rel = f"telemetry/personas/{persona_id.split(':')[-1]}.json"
        persona_routes = [route for route in routes
                          if route["sender_persona_id"] == persona_id
                          or persona_id in route["recipient_persona_ids"]]
        documents[rel] = _signed_public_document({
            "schema": "personaos-persona-telemetry-public/1",
            "generated_at": generated_at, "node_id": NODE_ID,
            "persona_id": persona_id, "name": summary["name"],
            "tier": "public_redacted", "summary": summary,
            "model_status": [event for event in events
                             if event.get("persona_id") == persona_id],
            "activity": [], "communication_routes": persona_routes,
            "communication_routes_hash": content_hash(persona_routes),
        })
        index["personas"][persona_id] = rel
    environment_rel = f"telemetry/environments/{ENV.split(':')[-1]}.json"
    topology = aggregate["topology"][0]
    documents[environment_rel] = _signed_public_document({
        "schema": "personaos-environment-telemetry-public/1",
        "generated_at": generated_at, "node_id": NODE_ID,
        "environment_id": ENV, "tier": "public_redacted",
        "status": topology["status"], "member_count": topology["member_count"],
        "members": topology["members"], "model_status": events,
        "activity": [], "communication_routes": routes,
        "communication_routes_hash": content_hash(routes),
    })
    index["environments"][ENV] = environment_rel
    documents["telemetry/live/entities.json"] = _signed_public_document(index)
    return documents


class Handler(SimpleHTTPRequestHandler):
    server_version = "PersonaOSUIFixture/1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        if self.path.startswith("/node/events"):
            return
        super().log_message(fmt, *args)

    def json(self, status: int, body: dict) -> None:
        raw = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError):
            # Browser contexts intentionally close with bounded telemetry reads
            # in flight; that peer disconnect is not a fixture/server failure.
            return

    def bytes(self, body: bytes, content_type: str, digest: str, name: str = "artifact.bin") -> None:
        safe_name = "".join(char if char.isalnum() or char in ".-_" else "_" for char in Path(name).name)
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Disposition", f'attachment; filename="{safe_name or "artifact.bin"}"')
        self.send_header("Content-Security-Policy", "sandbox; default-src 'none'")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Content-SHA256", digest)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def empty(self, status: int = 204) -> None:
        self.send_response(status)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def node_base(self) -> str:
        host = self.headers.get("Host") or f"127.0.0.1:{self.server.server_address[1]}"
        return f"http://{host}/node"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlsplit(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path == "/v1/bootstrap":
            return self.json(200, {
                "schema": "personaos-global-discovery-bootstrap/1",
                "libp2p_multiaddrs": [],
                "relay_multiaddrs": [],
            })
        if path == "/v1/nodes":
            envelope = node_announcement_envelope(self.node_base())
            return self.json(200, {
                "schema": "personaos-node-announcement-page/1",
                "nodes": [envelope],
                "total": 1,
                "next_cursor": "",
            })
        if path in {"/.well-known/personaos-discovery.json", "/favicon.ico"}:
            return self.empty()
        if path == "/node/.well-known/personaos-discovery.json":
            return self.json(200, {
                "schema": "personaos-discovery/1.1", "kernel_id": NODE_ID,
                "providers_are_aggregate": True, "providers_url": "providers.json",
                "record_count": provider_record_count(),
                "live_telemetry_url": "telemetry.json", "discovery_stream_url": "events",
                "keys_url": "keys.json", "p2p_received_url": "discovery/p2p/received.json",
                # Legacy node bootstrap arrays may carry HTTP federation URLs.
                # The browser must never pass this value into js-libp2p's
                # multiaddr-only bootstrap parser.
                "bootstrap_peers": [
                    self.node_base(),
                ],
                "public_discovery": True,
            })
        if path == "/node/providers.json":
            providers, _documents = provider_fixtures(self.node_base())
            return self.json(200, compact_provider_index(providers))
        if path == "/node/projects/project-fixture.json":
            return self.json(200, {
                "schema": "personaos-project-export/2",
                "project_id": "project:fixture",
                "name": "Open host topology",
                "environments": [ENV, ENV_EMPTY],
                "primary_environment_id": ENV,
                "members": {
                    PERSONA: "originator",
                    PERSONA_PEER: "reviewing peer",
                },
            })
        if path == "/node/projects/project-legacy.json":
            return self.json(200, {
                "schema": "personaos-project-export/1",
                "project_id": "project:legacy",
                "name": "Legacy singular topology",
                "environment_id": "env:must-not-render-as-authority",
                "members": {},
            })
        provider_prefix = "/node/discovery/public/records/"
        if path.startswith(provider_prefix) and path.endswith(".json"):
            record_id = path[len(provider_prefix):-len(".json")]
            _providers, documents = provider_fixtures(self.node_base())
            document = documents.get(record_id)
            if document is not None:
                return self.json(200, document)
            return self.json(404, {"error": "not_found"})
        if path == "/node/keys.json":
            generation, _requests = STATE.note_key_request()
            entries = [{
                "key_id": KEY_ID,
                "role": "master",
                "public_key_hex": SIGNING_KEYS[generation].verify_key.encode().hex(),
                "status": "current",
                "rotated_at": "2026-07-10T00:10:00+00:00" if generation == 2
                else "2026-07-10T00:00:00+00:00",
            }]
            entries.append({
                "key_id": KEY_ID,
                "role": "master",
                "public_key_hex": SIGNING_KEYS[0].verify_key.encode().hex(),
                "status": "archived",
                "rotated_at": "2026-06-01T00:00:00+00:00",
            })
            if generation == 2:
                entries.append({
                    "key_id": KEY_ID,
                    "role": "master",
                    "public_key_hex": SIGNING_KEYS[1].verify_key.encode().hex(),
                    "status": "previous",
                    "rotated_at": "2026-07-10T00:10:00+00:00",
                })
            return self.json(200, {
                "schema": "personaos-keys/1",
                "kernel_id": NODE_ID,
                "keys": entries,
                "rotation_schedule": {"master_period_days": 30, "operational_period_days": 7},
            })
        avatar = persona_avatar_descriptor()
        if path == f"/node/{avatar['body_path']}":
            return self.bytes(
                AVATAR_BYTES,
                avatar["mime_type"],
                avatar["sha256"],
                Path(avatar["body_path"]).name,
            )
        if path.startswith("/node/ipfs/"):
            return self.json(200, {"Providers": []})
        if path == "/node/discovery/p2p/received.json":
            return self.json(200, {"records": []})
        if path == "/node/gossip/cache":
            return self.json(200, {"cards": {}})
        for prefix in ("/node/", "/"):
            if path.startswith(prefix + "telemetry/"):
                rel = path[len(prefix):]
                document = entity_telemetry_documents().get(rel)
                if document is not None:
                    return self.json(200, document)
        if path == "/node/telemetry.json":
            return self.json(200, telemetry())
        if path == "/node/scale":
            count = int((parse_qs(parsed.query).get("count") or ["0"])[0])
            STATE.set_scale(count)
            return self.json(200, {"scale_count": STATE.get_scale()})
        if path == "/node/advance-provider-inventory":
            providers, _documents = provider_fixtures(self.node_base())
            current = compact_provider_index(providers)
            STATE.advance_inventory_omitting(current["inventory_hash"], PROVIDER_OK)
            return self.json(200, {
                "inventory_generation": STATE.inventory_generation,
                "omitted_record_id": PROVIDER_OK,
            })
        if ((path.startswith("/node/personas/") or path.startswith("/personas/"))
                and path.endswith("/thinking")):
            persona_id = unquote(path.split("/")[-2])
            operator = self.headers.get("Authorization", "") == "Bearer fixture-token"
            if not operator and persona_id != PERSONA:
                return self.json(404, {
                    "error": "not_found",
                    "filtered_for_principal": "public_stranger",
                })
            if operator:
                return self.json(200, {
                    "schema": "personaos-persona-thinking/1",
                    "persona_id": persona_id,
                    "tier": "operator",
                    "recent_outputs": [],
                    "lessons": [],
                    "thinking_frame": "operator fixture frame",
                })
            return self.json(200, public_persona_messages())
        if path == "/node/status":
            call = snapshot()["active"]["calls"][0]
            ended = STATE.is_ended()
            failed = STATE.is_model_failed()
            return self.json(200, {
                "schema": "personaos-node-status/1", "node_id": NODE_ID, "backend": "codex",
                "active_model": "gpt-5.5", "lineage_durable": True, "artifact_tier": "public",
                "public_discovery": True, "budget_candidates": 8, "pending_budget": 0,
                "heartbeat": {"running": not ended, "busy": "complete" if ended else f"running {RUN}"},
                "stoppable_runs": [] if ended else [RUN], "paused_missions": [],
                "runs": [{"run": RUN, "status": "completed" if ended else "running"}],
                "active_model_calls": [] if ended else [call], "personas": [{
                    "persona_id": PERSONA, "name": "Orin Vale", "lifecycle_state": "ACTIVE",
                    "experience_tasks": 3,
                    "task_execution_state": "idle" if failed else "running_llm",
                    "llm_execution_state": "idle" if failed else "running",
                    "running_llm": not failed,
                }],
            })
        if path == f"/node/runs/{RUN}":
            return self.json(200, {
                "schema": "personaos-run-state/1", "run": RUN,
                "run_state": {"status": "running", "task": "design 4 bedroom house", "accepted": False,
                    "runtime": {"pressure_open": {"ready_to_complete": False,
                        "completion_block_reason": "independent plan review is still open"},
                        "review_eligibility": "eligible_after_current_revision"},
                    "answer_package": {
                        "schema": "answer/5",
                        "status": "forged-answer-accepted",
                        "artifact_bundle_ref": "bundle-unvalidated-fixture",
                        "artifact_bundle_state": "forged-bundle-shipped",
                        "signed_by": "truthy-but-not-browser-verified",
                    }},
                "durable_run_state": None, "design_history": None,
                "links": {"live_artifacts": f"/runs/{RUN}/live-artifacts"},
            })
        if path == f"/node/runs/{RUN}/artifacts":
            return self.json(200, {
                "schema": "personaos-run-artifacts/1", "package": [],
                "bundles": [{
                    "bundle_id": "bundle-unvalidated-fixture",
                    "state": "forged-index-accepted",
                    "current_content_hash": "sha256:" + "a" * 64,
                    "verifier_evidence": [{
                        "parsed_verdict": "pass",
                        "artifact_content_hash": "sha256:" + "a" * 64,
                        "signed_by_kernel": True,
                    }],
                }],
            })
        if path == f"/node/runs/{RUN}/live-artifacts":
            since_revision = (parse_qs(parsed.query).get("since") or [None])[0]
            stale_revision = STATE.consume_stale()
            if stale_revision is not None:
                time.sleep(2.0)
                return self.json(200, snapshot(stale_revision, since_revision))
            document = snapshot(
                since_revision=since_revision,
                active=not STATE.is_ended(),
            )
            if STATE.consume_tampered_poll():
                document["task"] = "tampered after signing"
            return self.json(200, document)
        if path == "/node/runs/run-canary-house/live-artifacts":
            # The second signed task intentionally has no published workspace.
            # A successful empty response exercises negative-probe backoff
            # without turning that absence into browser-console noise.
            return self.empty()
        body_prefix = f"/node/runs/{RUN}/live-artifacts/body/"
        if path.startswith(body_prefix):
            workspace_id, _, encoded_rel = path[len(body_prefix):].partition("/")
            rel = unquote(encoded_rel)
            body = (b"# Shared environment brief\n\nCurrent constraints and team decisions.\n"
                    if workspace_id == ENV_WORKSPACE and rel == "shared/environment-brief.md"
                    else FILES[STATE.get()].get(rel) if workspace_id == WORKSPACE else None)
            if body is None:
                return self.json(404, {"error": "not_found"})
            digest = hashlib.sha256(body).hexdigest()
            expected = (parse_qs(parsed.query).get("sha256") or [""])[0]
            if expected and expected != digest:
                return self.json(409, {"error": "live_artifact_revision_changed"})
            return self.bytes(body, "application/octet-stream", digest, rel)
        if path == "/node/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            last = ""
            try:
                provider_payload = sse_provider_snapshot(self.node_base())
                provider_frame = (
                    "event: discovery_snapshot\n"
                    f"data: {json.dumps(provider_payload, separators=(',', ':'))}\n\n"
                ).encode()
                self.wfile.write(provider_frame)
                self.wfile.flush()
                for _ in range(90):
                    if STATE.is_ended():
                        payload = signed_metadata({
                            "schema": "personaos-live-artifact-event/1", "node_id": NODE_ID,
                            "run": RUN, "revision": None, "previous_revision": last or snapshot()["revision"],
                            "generated_at": now(), "endpoint": f"/runs/{RUN}/live-artifacts",
                            "state": "run_ended", "active": False, "snapshot": None,
                        })
                        raw = f"event: run_ended\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n".encode()
                        self.wfile.write(raw)
                        self.wfile.flush()
                        break
                    snap = snapshot(since_revision=last or None)
                    if snap["revision"] != last:
                        payload = signed_metadata({"schema": "personaos-live-artifact-event/1", "node_id": NODE_ID,
                            "run": RUN, "revision": snap["revision"], "previous_revision": last or None,
                            "generated_at": now(), "endpoint": f"/runs/{RUN}/live-artifacts", "snapshot": snap})
                        raw = f"event: live_artifact_update\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n".encode()
                        self.wfile.write(raw)
                        self.wfile.flush()
                        last = snap["revision"]
                    time.sleep(1)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        if path == "/node/advance":
            STATE.set(2)
            return self.json(200, {"revision": 2})
        if path == "/node/arm-stale-poll":
            STATE.arm_stale()
            return self.json(200, {"armed": True})
        if path == "/node/stale-started":
            return self.json(200, {"started": STATE.stale_started})
        if path == "/node/advance-with-tampered-poll":
            STATE.advance_with_tampered_poll()
            return self.json(200, {"revision": 2, "tamper_armed": True})
        if path == "/node/rotate-and-advance":
            STATE.rotate_and_advance()
            return self.json(200, {"revision": 2, "key_generation": 2})
        if path == "/node/key-requests":
            with STATE.lock:
                requests = STATE.key_requests
            return self.json(200, {"requests": requests})
        if path == "/node/tampered-poll-served":
            return self.json(200, {"served": STATE.tamper_poll_served})
        if path == "/node/end":
            STATE.end()
            return self.json(200, {"ended": True})
        if path == "/node/fail-model":
            STATE.fail_model()
            return self.json(200, {"ended": True, "model_failed": True})
        if path == "/node/reset":
            STATE.reset()
            return self.json(200, {"revision": 1})
        if path.startswith("/node/"):
            return self.json(404, {"error": "not_found"})
        return super().do_GET()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8099)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"fixture listening at http://127.0.0.1:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
