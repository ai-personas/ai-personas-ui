import json, math, sys, pathlib
sys.path.insert(0,'third_party')
import openseespy.opensees as ops
G=json.load(open('geometry.json'))
mat=G['materials']
results=[]

def hand_beam(m):
 b,h=m['section_mm'][:2]; L=m['span_m']; w=m['line_load_kN_per_m']; E=mat['E_mpa']; I=b*h**3/12
 return {'MEd_kNm':w*L**2/8,'VEd_kN':w*L/2,'deflection_mm':5*w*(L*1000)**4/(384*E*I)}
def run_beam(m):
 b,h=m['section_mm'][:2]; L=m['span_m']; w=m['line_load_kN_per_m']; E=mat['E_mpa']*1000 # kN/m2
 A=b*h/1e6; I=b*h**3/12/1e12 # m4
 ops.wipe(); ops.model('basic','-ndm',2,'-ndf',3)
 ops.node(1,0,0); ops.node(2,L/2,0); ops.node(3,L,0)
 ops.fix(1,1,1,0); ops.fix(3,0,1,0)
 ops.geomTransf('Linear',1)
 ops.element('elasticBeamColumn',1,1,2,A,E,I,1); ops.element('elasticBeamColumn',2,2,3,A,E,I,1)
 ops.timeSeries('Linear',1); ops.pattern('Plain',1,1); ops.eleLoad('-ele',1,2,'-type','-beamUniform',-w,0)
 ops.system('BandGeneral'); ops.numberer('Plain'); ops.constraints('Plain'); ops.integrator('LoadControl',1.0); ops.algorithm('Linear'); ops.analysis('Static')
 ok=ops.analyze(1)
 return {'ok':ok==0,'midspan_deflection_mm':-ops.nodeDisp(2,2)*1000,'end_reaction_left_kN':ops.nodeReaction(1,2) if False else None}
def hand_column(m):
 b,h=m['section_mm'][:2]; A=b*h; N=m['axial_load_kN']; cap=6*A/1000
 return {'axial_load_kN':N,'capacity_kN':cap,'utilization':N/cap}
def run_column(m):
 b,h=m['section_mm'][:2]; H=m.get('height_m',2.8); N=m['axial_load_kN']; E=mat['E_mpa']*1000; A=b*h/1e6; I=b*h**3/12/1e12
 ops.wipe(); ops.model('basic','-ndm',2,'-ndf',3)
 ops.node(1,0,0); ops.node(2,0,H); ops.fix(1,1,1,1); ops.fix(2,0,0,0); ops.geomTransf('Linear',1)
 ops.element('elasticBeamColumn',1,1,2,A,E,I,1)
 ops.timeSeries('Linear',1); ops.pattern('Plain',1,1); ops.load(2,0,-N,0)
 ops.system('BandGeneral'); ops.numberer('Plain'); ops.constraints('Plain'); ops.integrator('LoadControl',1.0); ops.algorithm('Linear'); ops.analysis('Static'); ok=ops.analyze(1)
 return {'ok':ok==0,'top_axial_displacement_mm':-ops.nodeDisp(2,2)*1000}
for m in G['structural_members']:
 method=m.get('calc_method')
 if method=='timber_bending_shear_deflection':
  hand=hand_beam(m); eng=run_beam(m)
  results.append({'member':m['id'],'engine':'OpenSeesPy 3.8.0','analysis':'elasticBeamColumn, two elements, simply supported UDL','hand_calculation':hand,'engine_result':eng,'discrepancies':{k:eng['midspan_deflection_mm']-hand['deflection_mm'] for k in ['midspan_deflection_mm'] if eng['ok']}})
 elif method=='post_compression':
  hand=hand_column(m); eng=run_column(m)
  results.append({'member':m['id'],'engine':'OpenSeesPy 3.8.0','analysis':'elasticBeamColumn axial compression','hand_calculation':hand,'engine_result':eng,'discrepancies':{'axial_displacement_mm_vs_hand_elastic':eng['top_axial_displacement_mm']-(m['axial_load_kN']*m.get('height_m',2.8)*1000/(mat['E_mpa']*m['section_mm'][0]*m['section_mm'][1]))} if eng['ok'] else {}})
summary={'schema':'independent-third-party-structural-analysis/1','engine':{'name':'OpenSeesPy','version':'3.8.0','source':'PyPI','acquired_during_task':True},'member_count':len(results),'all_engine_runs_ok':all(r['engine_result']['ok'] for r in results),'results':results}
pathlib.Path('independent_opensees_comparison.json').write_text(json.dumps(summary,indent=2,sort_keys=True)+'\n')
print(json.dumps({'member_count':len(results),'all_engine_runs_ok':summary['all_engine_runs_ok'],'output':'independent_opensees_comparison.json'},sort_keys=True))
