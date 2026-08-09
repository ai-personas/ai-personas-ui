# Specifications - four-bedroom timber house

## Governing references
Design basis cites EN 1990, EN 1991-1-1, EN 1991-1-3, EN 1991-1-4, EN 1995-1-1 and EN 1997-1. IRC 2021 habitable-room and egress provisions are used as planning cross-checks. Local amendments, site-specific wind/snow/seismic/geotechnical data, fire/acoustic/energy compliance and licensed engineer seal remain required before construction.

## Structural system
- `floor_joist_ground_typ` and `floor_joist_level1_typ`: C24/No.2 timber joists at 400 mm centres, continuous blocking at supports, fastened to rim boards and bearing walls.
- `primary_floor_beam_grid_y5` and `stair_trimmer`: engineered timber/glulam or built-up timber beams sized by `calculations.py`; provide squash blocks and joist hangers rated above reactions.
- `roof_rafter_typ` and `ridge_beam`: gable roof members with hurricane ties at eaves and ridge straps; roof diaphragm sheathing nailed to braced wall lines.
- `opening_header`: headers above all scheduled exterior openings; king/jack studs to transfer reactions to foundations.
- `post`: braced compression posts tied top and bottom with approved connectors.
- `pad_footing`, `strip_footing`: C25 concrete on verified bearing soil; reinforcement, frost depth and drainage to be finalized by local engineer.
- `shear_wall`: 11 mm structural panel sheathing with edge nailing and hold-downs; walls SW-N, SW-S, SW-E, SW-W and SW-INT form the lateral system.

## Reconciliation requirements
`geometry.json` is the source of geometry, loads and structural members. `schedules.csv` must list exactly those members in the same order. `plans.svg` must label all rooms and all member IDs. `validation_report.json` is produced only by executing `python3 run_checks.py`.
