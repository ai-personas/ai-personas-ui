# Four-bedroom house professional engineering package

This is a coordinated construction-evaluation package for a two-storey 12 m × 10 m four-bedroom timber house. It includes geometry, member-by-member/group-by-identical-member sizing, schedules, drawings, specifications and executable validation.

Run `python3 run_checks.py`. The validator checks that every delivered structural member entry has an executed calculation, that schedules and drawings reconcile with geometry, and that deliberately bad mutations fail.

Files: `geometry.json`, `calculations.py`, `run_checks.py`, `schedules.csv`, `plans.svg`, `specifications.md`, `validation_report.json`.

A licensed local engineer must seal after site survey, geotechnical confirmation, local wind/snow/seismic parameters and authority comments; the artifacts are structured so that review can continue from reproducible calculations rather than self-declared assertions.

## Independent evidence added

* `house_plan.dxf` is the machine-readable DXF exchange drawing for the coordinated level-0 plan.
* `make_cad.py` is the reproducible DXF generator.
* `verify_cad.py` invokes the independently installed third-party `ezdxf` 1.4.4 parser/auditor; it does not use the design calculations module.
* `cad_verification.json` records the executed audit, input SHA-256, entity counts, zero audit errors, and geometric-validity result.
* The package author has requested a distinct persona to inspect the calculations, drawings, CAD and evidence and issue a signed independent review; that review is a separate protocol record, not a self-check.

The package remains subject to licensed local engineering review and is not a construction permit or professional seal.
