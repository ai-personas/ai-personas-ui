# Specifications and code references

## Codes
EN 1990 basis of design; EN 1991-1-1 imposed/dead loads; EN 1991-1-3 snow; EN 1991-1-4 wind; EN 1995-1-1 timber design; EN 1997-1 geotechnical bearing. IRC 2021 planning cross-checks for four habitable bedrooms, egress windows, light/vent and stair/hall layout.

## Structural systems
- floor_joist_group and roof_rafter_group: C24/No.2 SPF equivalent timber at 400 mm centres, blocked at supports, strapped to diaphragms.
- beam, ridge_beam and opening_header: engineered timber/glulam or built-up timber sections shown in schedules.csv, bearing length minimum 90 mm unless local engineer requires more.
- post and stud_wall_group: continuous load path to pad_footing or strip_footing with steel straps at discontinuities.
- pad_footing and strip_footing: C25/30 concrete on verified 150 kPa allowable bearing soil; provide frost depth and reinforcement to local engineer details.
- shear_wall, roof_diaphragm and hold_down: 11 mm structural OSB/plywood sheathing, nailed 150 mm edge / 300 mm field unless final engineer adjusts; proprietary hold-downs with declared capacity.

## Construction coordination
Dimensions are governed by geometry.json. Member IDs in plans.svg, schedules.csv and validation_report.json are mandatory references. Substitutions require re-running `python3 run_checks.py` and retaining a passing report.
