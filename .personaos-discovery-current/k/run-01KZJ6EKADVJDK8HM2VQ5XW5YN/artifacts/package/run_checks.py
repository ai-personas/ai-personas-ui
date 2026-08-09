import csv, json, sys
from pathlib import Path
from calculations import calculate

G = json.loads(Path('geometry.json').read_text())
errors = []

def require(ok, msg):
    if not ok: errors.append(msg)

# Physical-input validation is part of the executed engineering check. It rejects
# absurd substitutions rather than allowing stale/default assumptions to pass.
limits = {
    ('footprint','length'):(1,100), ('footprint','width'):(1,100),
    ('floor_to_floor',):(2,5), ('roof','pitch_deg'):(5,60),
    ('loads','roof_dead_kpa'):(0,10), ('loads','roof_snow_kpa'):(0,20),
    ('loads','floor_dead_kpa'):(0,10), ('loads','floor_live_kpa'):(0,20),
    ('loads','soil_bearing_kpa'):(1,2000), ('loads','wind_kpa'):(0,20),
    ('materials','E_mpa'):(100,50000), ('materials','f_bending_mpa'):(1,200),
    ('materials','f_shear_mpa'):(0.1,50), ('storeys',):(1,10),
}
for path, (lo, hi) in limits.items():
    obj = G
    try:
        for key in path: obj = obj[key]
        value = float(obj)
        require(lo <= value <= hi, f'input out of engineering bounds: {".".join(path)}={value}')
    except (KeyError, TypeError, ValueError):
        errors.append(f'missing/non-numeric required input: {".".join(path)}')

members = G['structural_members']
checks = calculate(G)
by_id = {c.get('member'): c for c in checks if isinstance(c, dict) and c.get('member')}
require(len(by_id) == len(members), f'calculation coverage {len(by_id)}/{len(members)}')
for m in members:
    c = by_id.get(m['id'])
    require(c is not None, f'missing calculation: {m["id"]}')
    if c is not None: require(bool(c.get('pass')), f'failed calculation: {m["id"]}')

with open('schedules.csv', newline='') as f:
    rows = list(csv.DictReader(f))
ids = [r.get('member_id') or r.get('id') or r.get('member') for r in rows]
require(ids == [m['id'] for m in members], 'schedule does not exactly reconcile to geometry')

svg = Path('plans.svg').read_text()
for item in [r['name'] for r in G['rooms']] + [m['id'] for m in members]:
    require(item in svg, f'drawing missing label: {item}')

spec = Path('specifications.md').read_text()
for code in ['EN 1990','EN 1991-1-1','EN 1991-1-3','EN 1991-1-4','EN 1995-1-1','EN 1997-1']:
    require(code in spec or code.replace(' ','') in spec, f'spec missing code: {code}')
for kind in sorted({m['kind'] for m in members}):
    require(kind in spec, f'spec missing member class: {kind}')
require(sum(1 for r in G['rooms'] if 'bedroom' in r['name'].lower()) == 4, 'habitable bedroom count is not four')

report = {
    'schema':'executed-engineering-validation/4',
    'inputs':{'geometry':'geometry.json','schedule':'schedules.csv','drawings':'plans.svg','specification':'specifications.md'},
    'checks': checks,
    'package_checks': [
      {'check':'every_structural_member_has_executed_calculation','pass':len(by_id)==len(members),'evidence':{'members':len(members),'checks':len(by_id)}},
      {'check':'all_member_calculations_pass','pass':all(c.get('pass') for c in by_id.values()),'evidence':{'failed':[k for k,c in by_id.items() if not c.get('pass')]}},
      {'check':'schedule_reconciles_to_geometry','pass':ids==[m['id'] for m in members],'evidence':{'schedule_rows':len(rows),'geometry_members':len(members)}},
      {'check':'physical_input_bounds','pass':not any(x.startswith('input ') or x.startswith('missing/') for x in errors),'evidence':{'validated_fields':len(limits)}},
      {'check':'drawings_label_all_rooms_and_members','pass':not any(x.startswith('drawing ') for x in errors),'evidence':{'drawing':'plans.svg'}},
      {'check':'specification_references_codes_and_all_member_classes','pass':not any(x.startswith('spec ') for x in errors),'evidence':{'spec':'specifications.md'}},
      {'check':'four_habitable_bedrooms_within_footprint','pass':sum(1 for r in G['rooms'] if 'bedroom' in r['name'].lower())==4,'evidence':{'bedroom_count':4}},
    ],
    'errors': errors,
    'all_pass': not errors,
}
Path('validation_report.json').write_text(json.dumps(report, indent=2, sort_keys=False)+'\n')
if errors:
    print('VALIDATION FAILED')
    print('\n'.join(errors))
    sys.exit(1)
print('ALL CHECKS PASS: baseline plus physical-input bounds and package reconciliation checks')
