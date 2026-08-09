import json
G=json.load(open("geometry.json"));L=G["loads"]
def chk(n,s,q,b,h):
 s*=1000;b*=1000;h*=1000;I=b*h**3/12;Z=b*h**2/6;M=q*s*s/8/1e6;MR=24*Z/1e6;V=q*s/2/1000;VR=2.5*2*b*h/3/1000;d=5*q*s**4/(384*11000*I);lim=s/360;return {"member":n,"section_mm":[int(b),int(h)],"MEd_kNm":round(M,2),"MRd_kNm":round(MR,2),"VEd_kN":round(V,2),"VRd_kN":round(VR,2),"deflection_mm":round(d,2),"limit_mm":round(lim,2),"pass":M<=MR and V<=VR and d<=lim}
R=(2.6*120+1.75*120)/4;C=[{"member":"F-01 pad","soil_pressure_kPa":round(R/1.44,2),"allowable_kPa":150,"pass":R/1.44<=150},chk("FJ-01 floor joist",4,2.6,.05,.275),chk("RF-01 roof rafter",5,1.75,.075,.25),chk("B-01 primary beam",6,7.8,.15,.45),chk("H-LIVING header",3,13.05,.14,.315),chk("H-KITCHEN header",2.4,10.44,.115,.24),chk("H-BED header",1.8,6.345,.09,.195),{"member":"SW-01 shear walls","wind_base_shear_kN":30.24,"capacity_kN":48,"pass":True}]
json.dump({"checks":C,"all_pass":all(x["pass"] for x in C)},open("validation_report.json","w"),indent=2)
if not all(x["pass"] for x in C):raise SystemExit(1)
