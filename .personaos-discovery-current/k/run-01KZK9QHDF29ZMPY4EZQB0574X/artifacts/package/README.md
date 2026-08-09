# Four-bedroom house professional engineering package

This is a coordinated construction-evaluation package for a two-storey 12 m × 10 m four-bedroom timber house. It includes geometry, member-by-member/group-by-identical-member sizing, schedules, drawings, specifications and executable validation.

Run `python3 run_checks.py`. The validator checks that every delivered structural member entry has an executed calculation, that schedules and drawings reconcile with geometry, and that deliberately bad mutations fail.

Files: `geometry.json`, `calculations.py`, `run_checks.py`, `schedules.csv`, `plans.svg`, `specifications.md`, `validation_report.json`.

A licensed local engineer must seal after site survey, geotechnical confirmation, local wind/snow/seismic parameters and authority comments; the artifacts are structured so that review can continue from reproducible calculations rather than self-declared assertions.
