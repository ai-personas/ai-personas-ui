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
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from nacl.signing import SigningKey


ROOT = Path(__file__).resolve().parents[1]
RUN = "run-fixture-live"
WORKSPACE = "ws-0123456789abcdef01234567"
PERSONA = "01J9ZXP0RT5K8V3W6Y2N4B7C9D"
PERSONA_PEER = "01J9ZXP0RT5K8V3W6Y2N4B7C9E"
PERSONA_THIRD = "01J9ZXP0RT5K8V3W6Y2N4B7C9F"
ENV = "env:01KX5TJ1SX3B2MJ0P1N5VBTN8P"
NODE_ID = "kernel:fixture"
KEY_ID = "kernel-master"
PROVIDER_OK = "provider-authority-ok"
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

FILES = {
    1: {
        "attachments/controller.bin": b"\x00\xffPERSONAOS\x01\x02\x03\x7f\x80\xfe",
        "design/plan.md": b"# Four bedroom concept\n\n- Entry opens to the living hall.\n- Kitchen faces the garden.\n- Bedroom count: 4\n\n![remote tracker](https://example.invalid/pixel.png)\n<img src=\"https://example.invalid/raw.png\">\n",
        "design/old-notes.csv": b"issue,status\nsite fit,open\n",
        "drawings/concept.svg": b'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#f6f7f9"/><path d="M70 60h500v240H70zM300 60v240M70 180h500" fill="none" stroke="#151b24" stroke-width="8"/><text x="95" y="120" font-family="sans-serif" font-size="24">Living</text><text x="350" y="120" font-family="sans-serif" font-size="24">Bedrooms</text></svg>',
    },
    2: {
        "attachments/controller.bin": b"\x00\xffPERSONAOS\x01\x02\x04\x7f\x80\xfe",
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
        "subject_kind": "artifact",
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
    access_level: str | None = "r",
    expires_at: str = "",
    scope_kind: str = "",
    scope_id: str = "",
    policy_subject_id: str | None = None,
    handle: str = "",
    signing_key_generation: int | None = None,
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
    )
    record = {
        "schema": "discoverable-record/1",
        "record_id": record_id,
        "did": f"did:personaos:{NODE_ID}/artifact/{record_id}",
        "kind": "artifact",
        "label": label,
        "description": f"read-gated detail for {record_id}",
        "capability_summary": ["provider-authority-fixture"],
        "visibility_tier": "public",
        "access_policy_ref": policy["policy_id"],
        "content_locator_ref": f"locator:{record_id}",
    }
    if handle:
        record["handle"] = handle
    document = {
        "schema": record["schema"],
        "record": record,
        "signature_hex": signature_hex(record, signing_key),
        "signing_key_id": KEY_ID,
        "access_policy": policy,
        "links": {"content": f"private/{record_id}.bin", "subject_id": record_id},
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
    }


def provider_fixtures(base: str) -> tuple[list[dict], dict[str, dict]]:
    record_ids = (
        PROVIDER_OK,
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
    )
    urls = {record_id: f"discovery/public/records/{record_id}.json"
            for record_id in record_ids}
    valid = provider_document(base, PROVIDER_OK, "Signed provider authority accepted")
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
    envelopes = [
        provider_envelope(valid, urls[PROVIDER_OK]),
        provider_envelope(discover_only, urls[PROVIDER_DISCOVER_ONLY]),
        provider_envelope(expired_read, urls[PROVIDER_EXPIRED_READ]),
        provider_envelope(scoped_read, urls[PROVIDER_SCOPED_READ]),
        provider_envelope(tampered, urls[PROVIDER_TAMPERED]),
        provider_envelope(bad_subject, urls[PROVIDER_BAD_SUBJECT]),
        provider_envelope(historical, urls[PROVIDER_HISTORICAL],
                          document_key_status="archived"),
        provider_envelope(revoked, urls[PROVIDER_REVOKED],
                          document_key_status="revoked"),
        provider_envelope(unknown, urls[PROVIDER_UNKNOWN],
                          document_key_status="archived"),
    ]
    # The envelope remains correctly signed but no longer hashes the served doc.
    tampered["record"]["label"] = "Tampered provider metadata must be rejected"
    return envelopes, {
        PROVIDER_OK: valid,
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
    }


def sse_provider_snapshot(base: str) -> dict:
    _providers, documents = provider_fixtures(base)
    sse = documents[PROVIDER_SSE]
    return {
        "providers": {
            "providers": [
                provider_envelope(
                    sse,
                    f"discovery/public/records/{PROVIDER_SSE}.json",
                ),
                {"record_url": f"discovery/public/records/{PROVIDER_SSE_LEGACY}.json"},
            ],
        },
    }


def p2p_provider_resolution(base: str) -> tuple[dict, dict]:
    _providers, documents = provider_fixtures(base)
    document = documents[PROVIDER_P2P_ONLY]
    envelope = provider_envelope(
        document,
        f"discovery/public/records/{PROVIDER_P2P_ONLY}.json",
        key="p2p-only-handle",
    )
    return envelope, document


def p2p_discover_only_resolution(base: str) -> tuple[dict, dict]:
    _providers, documents = provider_fixtures(base)
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
        self.stale_next = False
        self.stale_started = False
        self.tamper_next_poll = False
        self.tamper_poll_served = False
        self.key_generation = 1
        self.key_requests = 0
        self.scale_count = 0

    def set(self, value: int) -> None:
        with self.lock:
            self.revision = value
            self.ended = False

    def get(self) -> int:
        with self.lock:
            return self.revision

    def reset(self) -> None:
        with self.lock:
            self.revision = 1
            self.ended = False
            self.stale_next = False
            self.stale_started = False
            self.tamper_next_poll = False
            self.tamper_poll_served = False
            self.key_generation = 1
            self.key_requests = 0
            self.scale_count = 0

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

    def is_ended(self) -> bool:
        with self.lock:
            return self.ended

    def advance_with_tampered_poll(self) -> None:
        with self.lock:
            self.revision = 2
            self.ended = False
            self.tamper_next_poll = True
            self.tamper_poll_served = False

    def rotate_and_advance(self) -> None:
        with self.lock:
            self.key_generation = 2
            self.revision = 2
            self.ended = False

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


def file_record(path: str, body: bytes, revision: int) -> dict:
    digest = hashlib.sha256(body).hexdigest()
    return {
        "workspace_id": WORKSPACE,
        "environment_id": ENV,
        "persona_id": PERSONA,
        "path": path,
        "size_bytes": len(body),
        "sha256": digest,
        "mtime": f"2026-07-10T12:00:0{revision}+00:00",
        "media_kind": mimetypes.guess_type(path)[0] or "application/octet-stream",
        "body_url": f"/runs/{RUN}/live-artifacts/body/{WORKSPACE}/{path}?sha256={digest}",
    }


def snapshot(revision: int | None = None, since_revision: str | None = None) -> dict:
    revision = STATE.get() if revision is None else revision
    files = [file_record(path, body, revision) for path, body in sorted(FILES[revision].items())]
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
            "calls": [{
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
            "persona_ids": [PERSONA],
            "environment_ids": [ENV],
        },
        "workspaces": [{
            "workspace_id": WORKSPACE,
            "environment_id": ENV,
            "persona_id": PERSONA,
            "active_call_ids": ["call-fixture"],
            "state": "model_call_active",
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


def telemetry() -> dict:
    call = snapshot()["active"]["calls"][0]
    scale_count = STATE.get_scale()
    personas = [
        {"persona_id": PERSONA, "name": "Orin Vale", "lifecycle_state": "ACTIVE",
         "experience_tasks": 3, "reputation_score": 0.91},
        {"persona_id": PERSONA_PEER, "name": "Mara Chen", "lifecycle_state": "ACTIVE",
         "experience_tasks": 7, "reputation_score": 0.88},
        {"persona_id": PERSONA_THIRD, "name": "Ivo Reed", "lifecycle_state": "ACTIVE",
         "experience_tasks": 4, "reputation_score": 0.84},
    ]
    if scale_count:
        personas = [{
            "persona_id": f"scale-persona-{index:05d}",
            "name": f"Scale Persona {index:05d}",
            "lifecycle_state": "ACTIVE",
            "experience_tasks": index % 17,
            "reputation_score": round((index % 100) / 100, 2),
        } for index in range(scale_count)]
        # Preserve the one real active-call endpoint in the large population.
        personas[0].update({"persona_id": PERSONA, "name": "Orin Vale"})
    return {
        "schema": "personaos-live-telemetry/1",
        "generated_at": now(),
        "node": {"heartbeat": {"running": True, "busy": f"running {RUN}", "interval_s": 2}},
        "kernel": {
            "active_model_calls": [call],
            "model_events": [{
                "kind": "MODEL_SELECTED", "persona_id": PERSONA, "environment_id": ENV,
                "model_id": "gpt-5.5", "requested_purpose": call["requested_purpose"], "role": "lead",
            }],
            "spans": [],
            "interactions": [
                {"actor_id": PERSONA, "actor_kind": "persona",
                 "affected": [{"id": PERSONA_PEER, "kind": "persona"}],
                 "kind": "PERSONA_COMMUNICATION_INTENT_RECORDED",
                 "scope": "environment", "scope_id": ENV, "at": now(), "signed": False},
                {"actor_id": NODE_ID, "actor_kind": "kernel",
                 "affected": [{"id": PERSONA_THIRD, "kind": "persona"}],
                 "kind": "ATTENTION_ALLOCATED", "scope": "environment", "scope_id": ENV,
                 "at": now(), "signed": False},
                {"actor_id": PERSONA_THIRD, "actor_kind": "persona", "affected": [],
                 "kind": "TASK_PROGRESS_REPORTED", "scope": "environment", "scope_id": ENV,
                 "at": now(), "signed": False},
            ],
        },
        "personas": personas,
    }


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
        self.wfile.write(raw)

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
        if path in {"/.well-known/personaos-discovery.json", "/favicon.ico"}:
            return self.empty()
        if path == "/node/.well-known/personaos-discovery.json":
            return self.json(200, {
                "schema": "personaos-discovery/1.1", "kernel_id": NODE_ID,
                "providers_are_aggregate": True, "providers_url": "providers.json",
                "live_telemetry_url": "telemetry.json", "discovery_stream_url": "events",
                "keys_url": "keys.json", "p2p_received_url": "discovery/p2p/received.json",
                "public_discovery": True,
            })
        if path == "/node/providers.json":
            providers, _documents = provider_fixtures(self.node_base())
            return self.json(200, {"providers": providers})
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
        if path.startswith("/node/ipfs/"):
            return self.json(200, {"Providers": []})
        if path == "/node/discovery/p2p/received.json":
            return self.json(200, {"records": []})
        if path == "/node/gossip/cache":
            return self.json(200, {"cards": {}})
        if path in {"/node/telemetry/live/entities.json", "/telemetry/live/entities.json"}:
            return self.json(200, {"environments": {}, "personas": {}})
        if path == "/node/telemetry.json":
            return self.json(200, telemetry())
        if path == "/node/scale":
            count = int((parse_qs(parsed.query).get("count") or ["0"])[0])
            STATE.set_scale(count)
            return self.json(200, {"scale_count": STATE.get_scale()})
        if ((path.startswith("/node/personas/") or path.startswith("/personas/"))
                and path.endswith("/thinking")):
            return self.json(200, {
                "schema": "personaos-persona-thinking/1",
                "persona_id": PERSONA,
                "recent_outputs": [],
                "lessons": [],
            })
        if path == "/node/status":
            call = snapshot()["active"]["calls"][0]
            ended = STATE.is_ended()
            return self.json(200, {
                "schema": "personaos-node-status/1", "node_id": NODE_ID, "backend": "codex",
                "active_model": "gpt-5.5", "lineage_durable": True, "artifact_tier": "public",
                "public_discovery": True, "budget_candidates": 8, "pending_budget": 0,
                "heartbeat": {"running": not ended, "busy": "complete" if ended else f"running {RUN}"},
                "stoppable_runs": [] if ended else [RUN], "paused_missions": [],
                "runs": [{"run": RUN, "status": "completed" if ended else "running"}],
                "active_model_calls": [] if ended else [call], "personas": [{
                    "persona_id": PERSONA, "name": "Orin Vale", "lifecycle_state": "ACTIVE",
                    "experience_tasks": 3, "task_execution_state": "running_llm",
                    "llm_execution_state": "running", "running_llm": True,
                }],
            })
        if path == f"/node/runs/{RUN}":
            return self.json(200, {
                "schema": "personaos-run-state/1", "run": RUN,
                "run_state": {"status": "running", "task": "design 4 bedroom house", "accepted": False,
                    "runtime": {"pressure_open": {"ready_to_complete": False,
                        "completion_block_reason": "independent plan review is still open"},
                        "review_eligibility": "eligible_after_current_revision"}},
                "durable_run_state": None, "design_history": None,
                "links": {"live_artifacts": f"/runs/{RUN}/live-artifacts"},
            })
        if path == f"/node/runs/{RUN}/artifacts":
            return self.json(200, {"schema": "personaos-run-artifacts/1", "package": [], "bundles": []})
        if path == f"/node/runs/{RUN}/live-artifacts":
            since_revision = (parse_qs(parsed.query).get("since") or [None])[0]
            stale_revision = STATE.consume_stale()
            if stale_revision is not None:
                time.sleep(2.0)
                return self.json(200, snapshot(stale_revision, since_revision))
            document = snapshot(since_revision=since_revision)
            if STATE.consume_tampered_poll():
                document["task"] = "tampered after signing"
            return self.json(200, document)
        prefix = f"/node/runs/{RUN}/live-artifacts/body/{WORKSPACE}/"
        if path.startswith(prefix):
            rel = unquote(path[len(prefix):])
            body = FILES[STATE.get()].get(rel)
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
