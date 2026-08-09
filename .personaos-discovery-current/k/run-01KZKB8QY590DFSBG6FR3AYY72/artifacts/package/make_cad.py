import json, ezdxf
from ezdxf import units
G=json.load(open('geometry.json'))
doc=ezdxf.new('R2018'); doc.units=units.M
msp=doc.modelspace()
# outer footprint and room partitions, metres in project coordinates
L,W=G['footprint']['length'],G['footprint']['width']
def rect(x,y,w,d,layer):
    pts=[(x,y),(x+w,y),(x+w,y+d),(x,y+d),(x,y)]
    msp.add_lwpolyline(pts,dxfattribs={'layer':layer,'closed':True})
rect(0,0,L,W,'A-WALL-EXT')
for x in G['footprint']['grid_x'][1:-1]: msp.add_line((x,0),(x,W),dxfattribs={'layer':'A-GRID'})
for y in G['footprint']['grid_y'][1:-1]: msp.add_line((0,y),(L,y),dxfattribs={'layer':'A-GRID'})
for r in G['rooms']:
    rect(r['x'],r['y'],r['w'],r['d'],'A-ROOM')
    msp.add_text(r['id'],dxfattribs={'height':0.25,'layer':'A-TEXT'}).set_placement((r['x']+0.2,r['y']+0.2))
# dimensions/metadata as explicit entities
msp.add_text('FOUR-BEDROOM HOUSE | LEVEL 0 PLAN | UNITS: m',dxfattribs={'height':0.35,'layer':'A-TEXT'}).set_placement((0,-1))
for x in G['footprint']['grid_x']:
    msp.add_circle((x,-0.45),0.06,dxfattribs={'layer':'A-GRID'})
for y in G['footprint']['grid_y']:
    msp.add_circle((-0.45,y),0.06,dxfattribs={'layer':'A-GRID'})
doc.saveas('house_plan.dxf')
print('created house_plan.dxf entities',len(msp))
