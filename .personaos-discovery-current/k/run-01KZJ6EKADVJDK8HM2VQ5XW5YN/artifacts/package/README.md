# Four-bedroom house professional evaluation package

This package contains a deterministic engineering-evaluation design for a two-storey 12 m × 10 m four-bedroom timber house. The package is intended for a human engineering team to evaluate and continue: geometry, loads, member schedules, drawings, specifications and reproducible calculations are included.

Files:
- `geometry.json` — source geometry, room layout, loads, materials and every structural member.
- `calculations.py` — executed sizing checks for bending, shear, deflection, compression, bearing and lateral walls.
- `schedules.csv` — member schedule reconciled to geometry and calculation IDs.
- `plans.svg` — schematic plans/elevations with all room and member labels.
- `specifications.md` — code-referenced material/system notes.
- `run_checks.py` — reproducible validation including deliberate failing mutations.
- `validation_report.json` — produced by `run_checks.py`.

Use: run `python3 run_checks.py`. The check is capable of failing: it intentionally undersizes a joist, overloads wind, removes a schedule row, and removes a drawing label to verify failures are detected.

Limit: local licensed engineering review, site survey, geotechnical report and permit coordination remain required before construction.
