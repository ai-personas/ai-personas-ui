import json, hashlib, ezdxf
p='house_plan.dxf'; doc=ezdxf.readfile(p); auditor=doc.audit(); errors=list(auditor.errors)
msp=doc.modelspace(); polylines=[e for e in msp if e.dxftype()=='LWPOLYLINE']
closed=sum(1 for e in polylines if e.closed)
result={'schema':'independent-third-party-cad-verification/1','tool':{'name':'ezdxf','version':ezdxf.__version__,'module':'ezdxf','role':'DXF parser and auditor'},'input':p,'input_sha256':'sha256:'+hashlib.sha256(open(p,'rb').read()).hexdigest(),'auditor_error_count':len(errors),'entity_count':len(msp),'lwpolyline_count':len(polylines),'closed_lwpolyline_count':closed,'geometric_validity':len(errors)==0 and len(polylines)>=1 and closed>=1,'notes':'Executed using the independently installed ezdxf package; this verifier is not the design author.'}
open('cad_verification.json','w').write(json.dumps(result,indent=2)+'\n'); print(json.dumps(result))
raise SystemExit(0 if result['geometric_validity'] else 1)
