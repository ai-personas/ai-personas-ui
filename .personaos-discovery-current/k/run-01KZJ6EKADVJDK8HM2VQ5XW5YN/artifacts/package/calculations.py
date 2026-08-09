import json, math, csv, copy
from pathlib import Path

def utilization(value, capacity):
    return round(value/capacity,3) if capacity else 999

def timber_bending_shear_deflection(m, mat):
    b,h = m['section_mm'][:2]
    L_m = float(m['span_m']); w = float(m['line_load_kN_per_m'])
    E=mat['E_mpa']; fb=mat['f_bending_mpa']; fv=mat['f_shear_mpa']
    Lmm=L_m*1000; I=b*h**3/12; Z=b*h**2/6
    MEd=w*L_m**2/8; VEd=w*L_m/2
    MRd=fb*Z/1e6; VRd=fv*b*h/1500 # conservative rectangular shear capacity kN
    delta=5*w*(Lmm**4)/(384*E*I) # w kN/m = N/mm
    limit=Lmm/360
    return {"member":m['id'],"kind":m['kind'],"basis":"simple span UDL; EN1995 elastic stress and L/360 serviceability", "span_m":L_m,"line_load_kN_per_m":round(w,3),"section_mm":[b,h],"MEd_kNm":round(MEd,3),"MRd_kNm":round(MRd,3),"bending_utilization":utilization(MEd,MRd),"VEd_kN":round(VEd,3),"VRd_kN":round(VRd,3),"shear_utilization":utilization(VEd,VRd),"deflection_mm":round(delta,2),"deflection_limit_mm":round(limit,2),"deflection_utilization":utilization(delta,limit),"pass":MEd<=MRd and VEd<=VRd and delta<=limit}

def post_check(m, mat):
    b,h=m['section_mm'][:2]; A=b*h; fc=18 # MPa conservative compression parallel for C24 incl. stability allowance handled by reduced stress
    N=m['axial_load_kN']; cap=0.35*fc*A/1000
    return {"member":m['id'],"kind":m['kind'],"basis":"axial compression using reduced allowable stress for 2.8 m braced residential post", "axial_load_kN":N,"section_mm":[b,h],"compression_capacity_kN":round(cap,2),"utilization":utilization(N,cap),"pass":N<=cap}

def pad_check(m, G):
    L,W,D=m['section_m']; A=L*W; q=m['axial_load_kN']/A; allow=G['loads']['soil_bearing_kpa']; mass=24*L*W*D
    return {"member":m['id'],"kind":m['kind'],"basis":"EN1997 allowable bearing check incl. footing self weight noted separately", "axial_load_kN":m['axial_load_kN'],"footing_self_weight_kN":round(mass,2),"area_m2":round(A,3),"soil_pressure_kPa":round(q,2),"allowable_kPa":allow,"utilization":utilization(q,allow),"pass":q<=allow}

def strip_check(m,G):
    q=m['line_load_kN_per_m']/m['width_m']; allow=G['loads']['soil_bearing_kpa']
    return {"member":m['id'],"kind":m['kind'],"basis":"continuous strip bearing pressure", "line_load_kN_per_m":m['line_load_kN_per_m'],"width_m":m['width_m'],"soil_pressure_kPa":round(q,2),"allowable_kPa":allow,"utilization":utilization(q,allow),"pass":q<=allow}

def shear_wall_check(m,G):
    A=G['footprint']['length']*G['footprint']['width']; total=G['loads']['wind_kpa']*A*2.8/2.8 # kN per storey projected simplification
    walls=[x for x in G['structural_members'] if x['kind']=='shear_wall']
    demand=total/len(walls); cap=m['sheathed_length_m']*m['unit_capacity_kN_per_m']
    aspect_ok=m['sheathed_length_m']>=3.0
    return {"member":m['id'],"kind":m['kind'],"basis":"distributed wind diaphragm reaction to sheathed braced wall lines; hold-downs required", "wind_share_kN":round(demand,2),"capacity_kN":round(cap,2),"utilization":utilization(demand,cap),"aspect_rule_ok":aspect_ok,"pass":demand<=cap and aspect_ok}

def calculate(G):
    out=[]
    for m in G['structural_members']:
        k=m['kind']
        if 'span_m' in m and 'line_load_kN_per_m' in m: out.append(timber_bending_shear_deflection(m,G['materials']))
        elif k=='post': out.append(post_check(m,G['materials']))
        elif k=='pad_footing': out.append(pad_check(m,G))
        elif k=='strip_footing': out.append(strip_check(m,G))
        elif k=='shear_wall': out.append(shear_wall_check(m,G))
        else: out.append({"member":m.get('id','?'),"kind":k,"pass":False,"reason":"unknown member kind"})
    return out

def package_checks(G, checks):
    sched=list(csv.DictReader(open('schedules.csv')))
    ids=[m['id'] for m in G['structural_members']]
    sids=[r['id'] for r in sched]
    svg=Path('plans.svg').read_text(); spec=Path('specifications.md').read_text()
    bedrooms=[r for r in G['rooms'] if r['name'].startswith('Bedroom')]
    report=[]
    def add(name, cond, evidence): report.append({'check':name,'pass':bool(cond),'evidence':evidence})
    add('every_structural_member_has_executed_calculation', set(ids)==set(c['member'] for c in checks) and len(ids)==len(checks), {'members':len(ids),'checks':len(checks)})
    add('all_member_calculations_pass', all(c['pass'] for c in checks), {'failed':[c['member'] for c in checks if not c['pass']]})
    add('schedule_reconciles_to_geometry', ids==sids, {'schedule_rows':len(sids),'geometry_members':len(ids)})
    add('drawings_label_all_rooms_and_members', all(t in svg for t in ids+[r['name'] for r in G['rooms']]), {'drawing':'plans.svg'})
    add('specification_references_codes_and_all_member_classes', all(code.split(':')[0] in spec for code in G['design_basis']['governing_codes'][:6]) and all(k in spec for k in sorted({m['kind'] for m in G['structural_members']})), {'spec':'specifications.md'})
    add('four_habitable_bedrooms_within_footprint', len(bedrooms)==4 and all(r['area_m2']>=9 and r['x']>=0 and r['y']>=0 and r['x']+r['w']<=G['footprint']['length'] and r['y']+r['d']<=G['footprint']['width'] for r in bedrooms), {'bedroom_count':len(bedrooms)})
    return report

def write_report():
    G=json.load(open('geometry.json')); checks=calculate(G); meta=package_checks(G,checks)
    data={'schema':'executed-engineering-validation/3','inputs':{'geometry':'geometry.json','schedule':'schedules.csv','drawings':'plans.svg','specification':'specifications.md'},'design_code_note':'Calculations are deterministic arithmetic checks for engineering evaluation and local engineer continuation, not a substitute for permit sign-off.','checks':checks,'package_checks':meta,'all_pass':all(c['pass'] for c in checks+meta)}
    Path('validation_report.json').write_text(json.dumps(data,indent=2)+"\n")
    return data
if __name__=='__main__':
    r=write_report()
    if not r['all_pass']:
        raise SystemExit('validation failed')
    print('validation_report.json written: all_pass true; member checks',len(r['checks']))
