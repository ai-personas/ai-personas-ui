"""v1.1 discovery surface for the DC-to-AC run (09_PROTOCOLS §3G / §4.1).

Projects the run's persona, environment, artifact bundle + each artifact, and the persona's
telemetry feed as **signed, uniform `DiscoverableRecord`s** (cards are projected to the common
shape and re-signed), publishes them across the two discovery planes — a Kademlia DHT
(internet) + an mDNS LAN segment (intranet) — under one ``AccessPolicy`` model, then *probes*
discovery as owner / federated-peer / public-stranger to prove discovery works AND that
access-gating holds. Also emits a **DHT provider index** (key → record pointer) so a runtime
client (the browser portal) resolves + verifies each record itself rather than reading a blob.

Everything is signed by the run's ``kernel-master`` key, so records verify against the same
``.well-known/personaos-keys.json`` the page publishes.
"""

from __future__ import annotations

import json
from pathlib import Path

from personaos.protocols.access import AccessPolicy, AccessPrincipal, can_discover, can_read
from personaos.projects.artifacts import AccessGrant
from personaos.protocols.discovery import (
    DiscoverableRecord,
    DiscoveryLayer,
    DiscoveryTransport,
    KademliaDHT,
    LANSegment,
    mint_artifact_card,
    mint_discoverable_record,
    verify_discoverable_record,
)
from personaos.protocols.telemetry_feed import mint_telemetry_card


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def export_v11_discovery(
    kernel,
    persona,
    env,
    domain,
    project,
    bundle,
    artifact_records: list[dict],
    *,
    run_dir: Path,
    task: str,
) -> dict:
    """Build, publish, and verify the v1.1 discovery surface; return a summary dict."""
    ks = kernel.keystore
    key_id = "kernel-master"
    pub = ks.public_key(key_id)
    kernel_id = kernel.kernel_id

    def _signed_policy(**kw) -> AccessPolicy:
        pol = AccessPolicy(owner_persona_id=persona.persona_id, **kw)
        pol.signed_by = ks.sign(key_id, pol.signing_payload())
        return pol

    persona_policy = _signed_policy(subject_kind="persona", subject_id=persona.persona_id,
                                    outward_tier="federation")
    env_policy = _signed_policy(subject_kind="env", subject_id=env.environment_id,
                                outward_tier="federation")
    artifact_policy = _signed_policy(
        subject_kind="artifact", subject_id=bundle.bundle_id, outward_tier="federation",
        access_grants=[
            AccessGrant(grantee_kind="persona", grantee_id=persona.persona_id, access_level="rw"),
            AccessGrant(grantee_kind="principal", grantee_id="fab", access_level="r"),
        ],
    )
    telemetry_policy = _signed_policy(subject_kind="telemetry", subject_id=persona.persona_id,
                                      outward_tier="federation")

    def _resign(rec: DiscoverableRecord) -> DiscoverableRecord:
        rec.signing_key_id = key_id
        rec.signature = ks.sign(key_id, rec.signing_payload())
        return rec

    # --- Project every entity to a UNIFORM, signed DiscoverableRecord ------------
    # entries: (discovery_kind, DiscoverableRecord, AccessPolicy)
    entries: list[tuple[str, DiscoverableRecord, AccessPolicy]] = []

    entries.append(("persona", mint_discoverable_record(
        ks, signing_key_id=key_id, kind="persona",
        did=f"did:personaos:{persona.persona_id}", label=persona.persona_id,
        description=f"DC-to-AC designer persona ({domain.name})",
        capability_summary=["dc_to_ac_design", "pcb_package_generation"],
        access_policy_ref=persona_policy.policy_id, visibility_tier="federation",
        interfaces=[{"kind": "A2A", "endpoint": f".well-known/personas/{persona.persona_id}.json"}],
    ), persona_policy))

    entries.append(("env", mint_discoverable_record(
        ks, signing_key_id=key_id, kind="env",
        did=f"did:personaos:{env.environment_id}", label=env.name,
        description=f"{env.type} for the DC-to-AC inverter design",
        capability_summary=["project_workspace", domain.name],
        access_policy_ref=env_policy.policy_id, visibility_tier="federation",
    ), env_policy))

    # Artifact bundle: an ArtifactCard projected + re-signed to the uniform record.
    media_kinds = sorted({r.get("media_kind", "") for r in artifact_records if r.get("media_kind")})
    bundle_anchor = next((r["content_hash"] for r in artifact_records if r.get("content_hash")), "")
    bundle_card = mint_artifact_card(
        ks, signing_key_id=key_id, bundle_id=bundle.bundle_id,
        label=bundle.title or bundle.bundle_id,
        description=f"Ready-to-order PCB package ({len(artifact_records)} files)",
        media_kinds=media_kinds, content_hash=bundle_anchor,
        sharing_policy_ref=bundle.sharing_policy_ref or "",
        version_chain_head=str(bundle.version),
        access_policy_ref=artifact_policy.policy_id, visibility_tier="federation",
    )
    bundle_rec = bundle_card.to_record()
    bundle_rec.description = f"Ready-to-order PCB package ({len(artifact_records)} files)"
    entries.append(("artifact_bundle", _resign(bundle_rec), artifact_policy))

    for rec in artifact_records:
        entries.append(("artifact", mint_discoverable_record(
            ks, signing_key_id=key_id, kind="artifact", label=rec.get("title", ""),
            description=f"{rec.get('media_kind', '')} artifact in {bundle.bundle_id}",
            capability_summary=[rec.get("media_kind", "")],
            content_hash=rec.get("content_hash", ""),
            access_policy_ref=artifact_policy.policy_id, visibility_tier="federation",
        ), artifact_policy))

    telemetry_card = mint_telemetry_card(
        ks, signing_key_id=key_id, subject_persona_id=persona.persona_id,
        feed_endpoint="telemetry/snapshot.json",
        access_policy_ref=telemetry_policy.policy_id, visibility_tier="federation",
        presence_resolution_enabled=False,
    )
    tel_rec = telemetry_card.to_record()
    tel_rec.label = f"telemetry:{persona.persona_id}"
    tel_rec.capability_summary = ["otel_spans", "presence", "lifecycle_transitions"]
    entries.append(("telemetry", _resign(tel_rec), telemetry_policy))

    # Every published record is a uniform DiscoverableRecord signed by kernel-master.
    sig_ok = all(verify_discoverable_record(rec, pub) for _k, rec, _p in entries)

    # --- Publish across both planes (home kernel) + probe from a peer kernel -----
    dht, lan = KademliaDHT(), LANSegment()
    layer = DiscoveryLayer(DiscoveryTransport(kernel_id=kernel_id), ks, key_id, dht=dht, lan=lan)
    querier = DiscoveryLayer(DiscoveryTransport(kernel_id="discovery-client"), ks, key_id, dht=dht, lan=lan)
    bridged = 0
    for _k, rec, policy in entries:
        if layer.publish(rec, policy) is not None:
            bridged += 1

    owner = AccessPrincipal(persona_id=persona.persona_id, tenancy="owner")
    peer = AccessPrincipal(peer_kernel_id="peer-kernel", tenancy="federated_peer")
    stranger = AccessPrincipal(peer_kernel_id="stranger", tenancy="public_stranger")

    def _probe(principal: AccessPrincipal) -> dict:
        mdns = querier.resolve_mdns(principal)
        dht_hits = set()
        for _k, rec, _p in entries:
            key = rec.content_hash or rec.record_id
            dht_hits.update(r.record_id for r in querier.resolve_dht(key, principal))
        return {
            "mdns_count": len(mdns),
            "dht_count": len(dht_hits),
            "can_read_artifact_body": can_read(artifact_policy, principal),
            "can_discover_telemetry": can_discover(telemetry_policy, principal),
        }

    probes = {"owner": _probe(owner), "federated_peer": _probe(peer),
              "public_stranger": _probe(stranger)}
    total = len(entries)
    verification = {
        "schema": "personaos-v11-discovery-verification/1",
        "task": task, "kernel_id": kernel_id,
        "planes": {"internet_dht": True, "intranet_mdns": True},
        "records_published": total, "records_bridged_to_dht": bridged,
        "all_record_signatures_valid": sig_ok, "probes": probes,
        "checks": {
            "owner_discovers_all_on_mdns": probes["owner"]["mdns_count"] == total,
            "federated_peer_discovers_all_federation_records": probes["federated_peer"]["mdns_count"] == total,
            "public_stranger_enumerates_nothing": probes["public_stranger"]["mdns_count"] == 0
            and probes["public_stranger"]["dht_count"] == 0,
            "artifact_body_owner_only": probes["owner"]["can_read_artifact_body"]
            and not probes["federated_peer"]["can_read_artifact_body"],
            "telemetry_card_discoverable_to_peer": probes["federated_peer"]["can_discover_telemetry"],
            "all_signatures_valid": sig_ok,
        },
    }
    verification["passed"] = all(verification["checks"].values())

    # --- Write the discovery surface (clean: only this run's records) ------------
    v11 = run_dir / "discovery" / "v11"
    records_dir = v11 / "records"
    if records_dir.exists():
        for old in records_dir.glob("*.json"):
            old.unlink()

    providers = []
    directory_records = []
    index_records = []
    for kind, rec, policy in entries:
        rid = rec.record_id
        doc = {
            "schema": rec.schema,
            "discovery_kind": kind,
            "kind": rec.kind,
            "visibility_tier": rec.visibility_tier,
            "record": rec.signing_payload(),
            "signature_hex": bytes(rec.signature or b"").hex(),
            "signing_key_id": rec.signing_key_id,
            "access_policy": {**policy.signing_payload(),
                              "signature_hex": bytes(policy.signed_by or b"").hex()},
        }
        rel = f"discovery/v11/records/{rid}.json"
        _write_json(records_dir / f"{rid}.json", doc)
        peer_can_read = can_read(policy, peer)
        index_records.append({"kind": kind, "id": rid, "visibility_tier": rec.visibility_tier,
                              "path": rel, "schema": rec.schema})
        directory_records.append({
            "id": rid, "did": rec.did or f"did:personaos:{rid}", "kind": rec.kind,
            "label": rec.label, "description": rec.description,
            "capability_summary": list(rec.capability_summary),
            "visibility_tier": rec.visibility_tier,
            "planes": ["internet", "intranet"] if rec.visibility_tier in ("federation", "public") else ["intranet"],
            "kernel_id": kernel_id, "signing_key_id": rec.signing_key_id,
            "access": {"min_to_discover": "discover", "min_to_read": "r",
                       "federated_peer_can_read": peer_can_read,
                       "public_stranger_can_discover": can_discover(policy, stranger)},
            "resolve": {"record": rel},
        })
        if rec.visibility_tier in ("federation", "public"):
            providers.append({"key": rec.content_hash or rec.did or f"did:personaos:{rid}",
                              "did": rec.did or f"did:personaos:{rid}",
                              "record_url": rel, "host_kernel_id": kernel_id})

    handles = {k: rec.record_id for k, rec, _p in entries if k in ("persona", "env", "artifact_bundle", "telemetry")}
    _write_json(v11 / "index.json", {
        "schema": "personaos-v11-discovery-index/1", "task": task, "kernel_id": kernel_id,
        "transport": {"internet": ["well-known", "gossip", "kademlia_dht"], "intranet": ["mdns"]},
        "access_model": "discover < read (r) < write (rw) < admin; outward visibility tiers",
        "handles": handles, "records": index_records,
    })
    _write_json(v11 / "verification.json", verification)
    _write_json(v11 / "directory.json", {
        "schema": "discovery-directory/1", "kernel_id": kernel_id,
        "planes": {"internet": {"transports": [".well-known", "gossip", "kademlia_dht"]},
                   "intranet": {"transports": ["mdns"]}},
        "access_model": ["discover", "r", "rw", "admin"],
        "visibility_tiers": ["persona_only", "project_only", "tenant", "federation", "public"],
        "kernels": [{"kernel_id": kernel_id, "keys": ".well-known/personaos-keys.json"}],
        "counts_by_kind": {k: sum(1 for r in directory_records if r["kind"] == k)
                           for k in sorted({r["kind"] for r in directory_records})},
        "record_count": len(directory_records), "records": directory_records,
    })
    _write_json(v11 / "providers.json", {
        "schema": "dht-provider-index/1", "kernel_id": kernel_id,
        "keys_url": ".well-known/personaos-keys.json",
        "provider_count": len(providers), "providers": providers,
    })

    return {
        "index": (v11 / "index.json").as_posix(),
        "verification": (v11 / "verification.json").as_posix(),
        "directory": (v11 / "directory.json").as_posix(),
        "providers": (v11 / "providers.json").as_posix(),
        "records_published": total, "records_bridged_to_dht": bridged,
        "passed": verification["passed"], "probes": probes,
    }
