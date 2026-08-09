import math

def utilization(value, capacity):
    return round(value/capacity,3) if capacity else 999

def timber_bending_shear_deflection(m, mat):
    b,h = m['section_mm'][:2]; L=float(m['span_m']); w=float(m['line_load_kN_per_m'])
    E=mat['E_mpa']; fb=mat['f_bending_mpa']; fv=mat['f_shear_mpa']; Lmm=L*1000; I=b*h**3/12; Z=b*h**2/6
    MEd=w*L**2/8; VEd=w*L/2; MRd=fb*Z/1e6; VRd=fv*b*h/1500
    delta=5*w*(Lmm**4)/(384*E*I); limit=Lmm/360
    return {"member":m['id'],"kind":m['kind'],"quantity":m.get('quantity',1),"basis":"simple-span UDL; EN 1995 elastic bending, shear and L/360 deflection; repeated quantities share identical geometry/load path","span_m":L,"line_load_kN_per_m":round(w,3),"section_mm":[b,h],"MEd_kNm":round(MEd,3),"MRd_kNm":round(MRd,3),"bending_utilization":utilization(MEd,MRd),"VEd_kN":round(VEd,3),"VRd_kN":round(VRd,3),"shear_utilization":utilization(VEd,VRd),"deflection_mm":round(delta,2),"deflection_limit_mm":round(limit,2),"deflection_utilization":utilization(delta,limit),"pass":MEd<=MRd and VEd<=VRd and delta<=limit}

def post_compression(m, mat):
    b,h=m['section_mm'][:2]; A=b*h; fc=mat.get('stud_compression_mpa_allow',6.0); N=m['axial_load_kN']; cap=fc*A/1000
    return {"member":m['id'],"kind":m['kind'],"quantity":m.get('quantity',1),"basis":"axial compression using conservative braced timber column allowable stress","axial_load_kN":N,"section_mm":[b,h],"capacity_kN":round(cap,2),"utilization":utilization(N,cap),"pass":N<=cap}

def stud_wall_compression(m, mat):
    b,h=m['section_mm'][:2]; qty=m['quantity']; A=b*h*qty; fc=mat.get('stud_compression_mpa_allow',6.0); N=m['axial_load_kN']; cap=fc*A/1000
    per=N/qty
    return {"member":m['id'],"kind":m['kind'],"quantity":qty,"basis":"stud group axial compression; studs at declared spacing over wall length; local buckling and openings to be reviewed at shop drawing stage","axial_load_kN":N,"load_per_stud_kN":round(per,2),"section_mm":[b,h],"group_capacity_kN":round(cap,2),"utilization":utilization(N,cap),"pass":N<=cap}

def pad_bearing(m,G):
    L,W,D=m['section_m']; A=L*W; q=m['axial_load_kN']/A; allow=G['loads']['soil_bearing_kpa']; sw=24*L*W*D
    return {"member":m['id'],"kind":m['kind'],"quantity":1,"basis":"EN 1997 allowable soil bearing; footing self weight reported","axial_load_kN":m['axial_load_kN'],"footing_self_weight_kN":round(sw,2),"area_m2":round(A,3),"soil_pressure_kPa":round(q,2),"allowable_kPa":allow,"utilization":utilization(q,allow),"pass":q<=allow}

def strip_bearing(m,G):
    q=m['line_load_kN_per_m']/m['width_m']; allow=G['loads']['soil_bearing_kpa']
    return {"member":m['id'],"kind":m['kind'],"quantity":1,"basis":"continuous strip bearing pressure from declared line load and width","line_load_kN_per_m":m['line_load_kN_per_m'],"width_m":m['width_m'],"soil_pressure_kPa":round(q,2),"allowable_kPa":allow,"utilization":utilization(q,allow),"pass":q<=allow}

def shear_wall(m,G):
    A=G['footprint']['length']*G['floor_to_floor']; total=G['loads']['wind_kpa']*A
    walls=[x for x in G['structural_members'] if x.get('kind')=='shear_wall']; demand=total/len(walls); cap=m['sheathed_length_m']*m['unit_capacity_kN_per_m']
    return {"member":m['id'],"kind":m['kind'],"quantity":1,"basis":"EN 1991 wind line distributed to braced wall lines; OSB unit shear capacity; aspect ratio min length 3 m","wind_share_kN":round(demand,2),"capacity_kN":round(cap,2),"utilization":utilization(demand,cap),"pass":demand<=cap and m['sheathed_length_m']>=3.0}

def connector_tension(m,G):
    d=m['tension_demand_kN']; c=m['tension_capacity_kN']
    return {"member":m['id'],"kind":m['kind'],"quantity":m.get('quantity',1),"basis":"hold-down tension capacity exceeds uplift/overturning demand from braced wall analysis","tension_demand_kN":d,"tension_capacity_kN":c,"utilization":utilization(d,c),"pass":d<=c}

def diaphragm_shear(m,G):
    d=m['shear_demand_kN']; c=m['shear_capacity_kN']
    return {"member":m['id'],"kind":m['kind'],"quantity":1,"basis":"roof diaphragm shear and collector capacity to wall lines","shear_demand_kN":d,"shear_capacity_kN":c,"utilization":utilization(d,c),"pass":d<=c}

def calculate(G):
    mat=G['materials']; out=[]
    dispatch={'timber_bending_shear_deflection':lambda m:timber_bending_shear_deflection(m,mat),'post_compression':lambda m:post_compression(m,mat),'stud_wall_compression':lambda m:stud_wall_compression(m,mat),'pad_bearing':lambda m:pad_bearing(m,G),'strip_bearing':lambda m:strip_bearing(m,G),'shear_wall':lambda m:shear_wall(m,G),'connector_tension':lambda m:connector_tension(m,G),'diaphragm_shear':lambda m:diaphragm_shear(m,G)}
    for m in G['structural_members']:
        if m.get('calc_method') not in dispatch: out.append({'member':m.get('id'),'kind':m.get('kind'),'pass':False,'error':'unknown calc_method'})
        else: out.append(dispatch[m['calc_method']](m))
    return out
if __name__=='__main__':
    import json; print(json.dumps(calculate(json.load(open('geometry.json'))),indent=2))
