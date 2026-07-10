#!/usr/bin/env python3
"""Serve the static UI plus a deterministic PersonaOS live-artifact node fixture."""

from __future__ import annotations

import argparse
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
ENV = "env:01KX5TJ1SX3B2MJ0P1N5VBTN8P"
NODE_ID = "kernel:fixture"
KEY_ID = "kernel-master"
SIGNING_KEYS = {
    1: SigningKey(bytes.fromhex("07" * 32)),
    2: SigningKey(bytes.fromhex("08" * 32)),
}

FILES = {
    1: {
        "design/plan.md": b"# Four bedroom concept\n\n- Entry opens to the living hall.\n- Kitchen faces the garden.\n- Bedroom count: 4\n\n![remote tracker](https://example.invalid/pixel.png)\n<img src=\"https://example.invalid/raw.png\">\n",
        "design/old-notes.csv": b"issue,status\nsite fit,open\n",
        "drawings/concept.svg": b'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#f6f7f9"/><path d="M70 60h500v240H70zM300 60v240M70 180h500" fill="none" stroke="#151b24" stroke-width="8"/><text x="95" y="120" font-family="sans-serif" font-size="24">Living</text><text x="350" y="120" font-family="sans-serif" font-size="24">Bedrooms</text></svg>',
    },
    2: {
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
            "interactions": [{
                "actor_id": PERSONA, "actor_kind": "persona", "affected": [],
                "kind": "TASK_PROGRESS_REPORTED", "scope": "environment", "scope_id": ENV,
                "at": now(), "signed": False,
            }],
        },
        "personas": [{
            "persona_id": PERSONA, "name": "Orin Vale", "lifecycle_state": "ACTIVE",
            "experience_tasks": 3, "reputation_score": 0.91,
        }],
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
            return self.json(200, {"providers": []})
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
