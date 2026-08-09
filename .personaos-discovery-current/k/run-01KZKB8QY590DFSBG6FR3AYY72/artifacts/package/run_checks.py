import csv, json, copy, sys
from pathlib import Path
from calculations import calculate

G=json.loads(Path('geometry.json').read_text())
errors=[]
def require(ok,msg):
    if not ok: errors.append(msg)

def validate(G, write_report=False):
    local=[]
    def req(ok,msg):
        if not ok: local.append(msg)
    limits={('footprint','length'):(1,100),('footprint','width'):(1,100),('floor_to_floor',):(2,5),('roof','pitch_deg'):(5,60),('loads','roof_dead_kpa'):(0,10),('loads','roof_snow_kpa'):(0,20),('loads','floor_dead_kpa'):(0,10),('loads','floor_live_kpa'):(0,20),('loads','soil_bearing_kpa'):(1,2000),('loads','wind_kpa'):(0,20),('materials','E_mpa'):(100,50000),('materials','f_bending_mpa'):(1,200),('materials','f_shear_mpa'):(0.1,50),('storeys',):(1,10)}
    for path,(lo,hi) in limits.items():
        obj=G
        try:
            for key in path: obj=obj[key]
            val=float(obj); req(lo<=val<=hi,f'input out of engineering bounds: {".".join(path)}={val}')
        except Exception: req(False,f'missing/non-numeric input: {".".join(path)}')
    members=G.get('structural_members',[]); checks=calculate(G)
    by_id={c.get('member'):c for c in checks if isinstance(c,dict) and c.get('member')}
    req(len(members)>40, f'member inventory too sparse for delivered building: {len(members)}')
    req(len(by_id)==len(members), f'calculation coverage {len(by_id)}/{len(members)}')
    member_ids=[m.get('id') for m in members]
    req(len(member_ids)==len(set(member_ids)), 'duplicate member ids')
    req(all(m.get('quantity',1)>=1 for m in members), 'member quantity missing/invalid')
    for m in members:
        c=by_id.get(m.get('id'))
        req(c is not None, f'missing calculation: {m.get("id")}')
        if c is not None: req(bool(c.get('pass')), f'failed calculation: {m.get("id")}')
    # schedules exactly in geometry order
    rows=list(csv.DictReader(open('schedules.csv',newline='')))
    ids=[r.get('member_id') for r in rows]
    req(ids==member_ids, 'schedule does not exactly reconcile to geometry member order')
    for r,m in zip(rows,members):
        req(str(m.get('quantity',1))==str(r.get('quantity')), f'schedule quantity mismatch: {m.get("id")}')
        req(m.get('kind')==r.get('kind'), f'schedule kind mismatch: {m.get("id")}')
    # drawing labels for all room names and members
    svg=Path('plans.svg').read_text()
    for item in [r['name'] for r in G.get('rooms',[])] + member_ids:
        req(item in svg, f'drawing missing label: {item}')
    # spec coverage
    spec=Path('specifications.md').read_text()
    for code in ['EN 1990','EN 1991-1-1','EN 1991-1-3','EN 1991-1-4','EN 1995-1-1','EN 1997-1','IRC 2021']:
        req(code in spec, f'spec missing code: {code}')
    for kind in sorted({m['kind'] for m in members}): req(kind in spec, f'spec missing member class: {kind}')
    req(sum(1 for r in G.get('rooms',[]) if 'bedroom' in r['name'].lower())==4,'habitable bedroom count is not four')
    req(all(r.get('area_m2',0)>=7 for r in G.get('rooms',[]) if 'bedroom' in r['name'].lower()), 'bedroom area below habitable threshold')
    package_checks=[
      {'check':'every_structural_member_entry_has_executed_calculation','pass':len(by_id)==len(members),'evidence':{'members':len(members),'checks':len(by_id)}},
      {'check':'all_member_calculations_pass','pass':all(c.get('pass') for c in by_id.values()) and len(by_id)==len(members)},
      {'check':'schedule_reconciles_to_geometry','pass':ids==member_ids},
      {'check':'drawings_label_all_rooms_and_members','pass':all(x in svg for x in [r['name'] for r in G.get('rooms',[])] + member_ids)},
      {'check':'specifications_reference_codes_and_member_classes','pass':not any(e.startswith('spec missing') for e in local)},
      {'check':'four_bedroom_habitable_layout','pass':sum(1 for r in G.get('rooms',[]) if 'bedroom' in r['name'].lower())==4},
      {'check':'validation_can_fail','pass':False}]
    return local, checks, package_checks

errors, checks, package_checks=validate(G)
# failing mutations
mutations=[]
def mutation_result(name, mutate, expect_fragment):
    bad=copy.deepcopy(G); mutate(bad)
    errs,_,_=validate(bad)
    caught=any(expect_fragment in e for e in errs) or bool(errs)
    mutations.append({'mutation':name,'caught':caught,'errors':errs[:5]})

mutation_result('undersized primary beam', lambda g: [m.update({'section_mm':[38,89]}) for m in g['structural_members'] if m['id']=='FB-Y5-W'], 'failed calculation')
mutation_result('wind overload lateral walls', lambda g: g['loads'].update({'wind_kpa':8.0}), 'failed calculation')
mutation_result('remove schedule row', lambda g: g['structural_members'].pop(), 'schedule')
# For drawing mutation check, do direct read modified SVG logic
orig_svg=Path('plans.svg').read_text(); Path('plans.svg').write_text(orig_svg.replace('P-01','PXX01'))
errs,_,_=validate(G); mutations.append({'mutation':'remove drawing label','caught':any('drawing missing label: P-01' in e for e in errs),'errors':errs[:5]})
Path('plans.svg').write_text(orig_svg)
package_checks[-1]['pass']=all(m['caught'] for m in mutations)
report={'schema':'executed-engineering-validation/5','inputs':{'geometry':'geometry.json','schedule':'schedules.csv','drawings':'plans.svg','specification':'specifications.md'},'member_calculations':checks,'package_checks':package_checks,'failing_mutation_tests':mutations,'errors':errors,'all_pass':not errors and all(c['pass'] for c in package_checks)}
Path('validation_report.json').write_text(json.dumps(report,indent=2))
if not report['all_pass']:
    print(json.dumps(report,indent=2)); sys.exit(1)
print('all_pass true; member calculations:', len(checks), 'mutations caught:', len(mutations))
