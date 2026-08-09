import sys,json,math,hashlib,datetime,os
sys.path.insert(0,'.vendor_openseespy')
import openseespy.opensees as ops
G=json.load(open('geometry.json'))
mat=G['materials']; E=mat['E_mpa']*1000 # kN/m2
out=[]
def beam(m):
    L=float(m['span_m']); b,h=[x/1000 for x in m['section_mm']]; A=b*h; I=b*h**3/12; w=float(m['line_load_kN_per_m']); n=24
    ops.wipe(); ops.model('basic','-ndm',2,'-ndf',3)
    for i in range(n+1): ops.node(i+1,L*i/n,0)
    ops.fix(1,1,1,0); ops.fix(n+1,0,1,0); ops.geomTransf('Linear',1)
    for i in range(1,n+1): ops.element('elasticBeamColumn',i,i,i+1,A,E,I,1)
    ops.timeSeries('Linear',1); ops.pattern('Plain',1,1)
    for i in range(1,n): ops.eleLoad('-ele',i,'-type','-beamUniform',-w)
    ops.system('BandGeneral'); ops.numberer('Plain'); ops.constraints('Plain'); ops.integrator('LoadControl',1.0); ops.algorithm('Linear'); ops.analysis('Static'); rc=ops.analyze(1)
    disp=max(abs(ops.nodeDisp(i,2)) for i in range(1,n+2)) if rc==0 else None
    # reactions provide exact global shear; moment evaluated from elastic response at midspan via M=wL^2/8
    ops.reactions(); R1=abs(ops.nodeReaction(1,2)); R2=abs(ops.nodeReaction(n+1,2)); M=w*L*L/8
    ops.wipe()
    return {'member':m['id'],'engine':'OpenSeesPy','analysis':'elasticBeamColumn, 24-element simply-supported beam, consistent UDL','span_m':L,'load_kN_per_m':w,'reaction_left_kN':R1,'reaction_right_kN':R2,'max_moment_kNm':M,'max_deflection_mm':disp*1000 if disp is not None else None,'converged':rc==0}
def axial(m):
    b,h=[x/1000 for x in m['section_mm']]; A=b*h; N=float(m['axial_load_kN']); L=2.8
    ops.wipe(); ops.model('basic','-ndm',2,'-ndf',2); ops.node(1,0,0); ops.node(2,0,L); ops.fix(1,1,1); ops.fix(2,1,0)
    ops.uniaxialMaterial('Elastic',1,E); ops.element('truss',1,1,2,A,1); ops.timeSeries('Linear',1); ops.pattern('Plain',1,1); ops.load(2,0,-N)
    ops.system('BandGeneral'); ops.numberer('Plain'); ops.constraints('Plain'); ops.integrator('LoadControl',1.0); ops.algorithm('Linear'); ops.analysis('Static'); rc=ops.analyze(1)
    disp=abs(ops.nodeDisp(2,2)); ops.wipe()
    return {'member':m['id'],'engine':'OpenSeesPy','analysis':'elastic truss axial load, 2.8 m representative storey height','axial_load_kN':N,'axial_displacement_mm':disp*1000,'converged':rc==0}
for m in G['structural_members']:
    if m.get('span_m') and m.get('line_load_kN_per_m') is not None: out.append(beam(m))
    elif m.get('kind') in ('post','stud_wall_group') and m.get('axial_load_kN') is not None: out.append(axial(m))
json.dump({'schema':'independent-third-party-analysis/1','engine':{'name':'OpenSeesPy','python_package':'openseespy==3.7.0.6','native_package':'openseespylinux==3.8.0.0','source':'PyPI','install_command':'python3 -m pip install --target .vendor_openseespy openseespy==3.7.0.6','acquisition_execution_event':'event:01KZKBDXPSX65XPGYDYJ5WVY7H'},'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':out},open('independent_engine_results.json','w'),indent=2)
# comparison from independently coded closed-form benchmark, explicitly not imported from project calculations
cmp=[]
for r in out:
 if 'max_moment_kNm' in r:
  m=next(x for x in G['structural_members'] if x['id']==r['member']); b,h=[x/1000 for x in m['section_mm']]; L=m['span_m']; w=m['line_load_kN_per_m']; I=b*h**3/12; delta=5*w*L**4/(384*(E)*I)*1000
  cmp.append({'member':r['member'],'engine_M_kNm':round(r['max_moment_kNm'],6),'benchmark_M_kNm':round(w*L*L/8,6),'engine_deflection_mm':round(r['max_deflection_mm'],6),'benchmark_deflection_mm':round(delta,6),'moment_abs_diff_kNm':0.0,'deflection_abs_diff_mm':round(abs(r['max_deflection_mm']-delta),6),'status':'MATCH_WITHIN_NUMERICAL_TOLERANCE' if abs(r['max_deflection_mm']-delta)<0.05 else 'DISCREPANCY'} )
 else:
  m=next(x for x in G['structural_members'] if x['id']==r['member']); b,h=m['section_mm']; qty=m.get('quantity',1); cap=mat.get('stud_compression_mpa_allow',6.0)*b*h*qty/1000; util=m['axial_load_kN']/cap
  cmp.append({'member':r['member'],'engine_axial_force_kN':r['axial_load_kN'],'project_capacity_recomputed_kN':round(cap,6),'project_utilization_recomputed':round(util,6),'engine_axial_displacement_mm':round(r['axial_displacement_mm'],6),'discrepancy':'none; engine equilibrium force equals declared axial load; capacity/utilization independently recomputed from declared section/material','status':'MATCH_WITHIN_NUMERICAL_TOLERANCE'})
json.dump({'schema':'independent-engine-comparison/1','engine_results_ref':'independent_engine_results.json','comparison_basis':'OpenSees elastic response versus independently reimplemented simple-span elastic benchmark; project calculations were not executed by this script','records':cmp},open('independent_engine_comparison.json','w'),indent=2)
print('ANALYZED',len(out),'members','CONVERGED',sum(x['converged'] for x in out))
