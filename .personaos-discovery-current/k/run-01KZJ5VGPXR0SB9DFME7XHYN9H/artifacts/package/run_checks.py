import json, copy, subprocess, sys, csv
import calculations
from pathlib import Path
G=json.load(open('geometry.json'))
# Baseline calculation and package validation must pass.
report=calculations.write_report()
assert report['all_pass'], 'baseline package validation failed'
# Fail-capability tests: deliberate mutations must be caught by executable checks.
bad=copy.deepcopy(G); bad['structural_members'][0]['section_mm']=[20,50]
assert not calculations.timber_bending_shear_deflection(bad['structural_members'][0],bad['materials'])['pass'], 'undersized joist mutation did not fail'
bad=copy.deepcopy(G); bad['loads']['wind_kpa']=20
assert not all(c['pass'] for c in calculations.calculate(bad) if c['kind']=='shear_wall'), 'wind overload mutation did not fail lateral checks'
# Schedule omission must fail reconciliation.
orig=Path('schedules.csv').read_text(); lines=orig.splitlines(); Path('schedules.csv').write_text('\n'.join(lines[:-1])+'\n')
try:
    r=calculations.write_report(); assert not next(c for c in r['package_checks'] if c['check']=='schedule_reconciles_to_geometry')['pass'], 'schedule omission did not fail'
finally:
    Path('schedules.csv').write_text(orig); calculations.write_report()
# Drawing label omission must fail reconciliation.
orig=Path('plans.svg').read_text(); first=G['structural_members'][0]['id']; Path('plans.svg').write_text(orig.replace(first,'REMOVED_LABEL',1))
try:
    r=calculations.write_report(); assert not next(c for c in r['package_checks'] if c['check']=='drawings_label_all_rooms_and_members')['pass'], 'drawing label omission did not fail'
finally:
    Path('plans.svg').write_text(orig); calculations.write_report()
print('ALL CHECKS PASS: baseline plus undersized-member, wind-overload, schedule-omission, and drawing-label failure tests')
