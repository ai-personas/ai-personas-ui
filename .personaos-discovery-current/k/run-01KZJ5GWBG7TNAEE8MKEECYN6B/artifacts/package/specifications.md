# Specifications

C24 timber, C25 concrete, B500 reinforcement; 2,800 mm floor-to-floor. Structural member IDs and sizes are authoritative in `geometry.json` and reconciled by `run_checks.py` to `schedules.csv`. Foundations require verified 150 kPa soil.

Design basis: EN 1990, EN 1991, EN 1995-1-1, EN 1997-1, and applicable IBC/IRC provisions. Provide engineered connections, lateral sheathing/hold-downs, fire stopping, envelope, egress, stairs, guards, alarms and MEP to jurisdictional code. Any change to geometry, loads, schedule or member sizes requires rerunning `python3 run_checks.py`; the mutation tests demonstrate that checks can fail. Licensed local engineering review remains required before construction.
