/*
 * Lazily loaded DOM renderers for technical artifact formats. Parsing helpers
 * and byte authority are supplied by the caller; this module never imports,
 * executes, or follows peer-authored code or URLs.
 */

export function createTechnicalRenderers(runtime){
  const {
    artifactBytes,artifactTypeLabel,cadFormat,cadMeshBounds,cadMeshFromBytes,
    dxfGeometry,dxfLayerColour,el,fmtBytes,gunzipBounded,inspectCadBytes,
    maxArchiveInspectionBytes,mountCadMeshPreview,parseDxfEntities,plainPre,
    svgEl,tarDirectoryEntries,zipDirectoryEntries,cadFormatNumber,
  }=runtime;

  async function renderDxf(host,ctx){
    ctx.assertCurrent?.();
    const text=String(ctx.text||''),parsed=parseDxfEntities(text),drawing=dxfGeometry(parsed);
    ctx.assertCurrent?.(); host.innerHTML='';
    const card=el('div','fv-card'); card.appendChild(el('div','fv-cardhd','DXF drawing · verified-byte preview'));
    const add=(label,value)=>{ const row=el('div','row'); row.appendChild(el('span','l2',label)); row.appendChild(el('span','v2',value)); card.appendChild(row); };
    add('Entities read',parsed.entities.length+(parsed.truncated?' · first 5,000':''));
    add('Geometry shown',drawing.geometry.length+(drawing.truncated?' · bounded preview':'')); add('Layers',drawing.layers.length||'none'); add('Drawing units',parsed.units);
    card.appendChild(el('div','fv-note','The browser drew supported DXF primitives from the hash-checked file. This preview is for inspection; the verified download remains the source for CAD editing and fabrication checks.'));
    host.appendChild(card);
    if(!drawing.points.length){ host.appendChild(plainPre(text.slice(0,64*1024),'No supported LINE, LWPOLYLINE, CIRCLE, ARC, TEXT, or MTEXT geometry was found; showing bounded DXF source.')); return; }
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const point of drawing.points){ minX=Math.min(minX,point.x); maxX=Math.max(maxX,point.x);
      minY=Math.min(minY,point.y); maxY=Math.max(maxY,point.y); }
    if(maxX===minX){ minX-=1; maxX+=1; } if(maxY===minY){ minY-=1; maxY+=1; }
    const width=1000,padding=32,aspect=(maxY-minY)/(maxX-minX),height=Math.max(360,Math.min(760,Math.round((width-padding*2)*aspect+padding*2)));
    const scale=Math.min((width-padding*2)/(maxX-minX),(height-padding*2)/(maxY-minY));
    const px=(x)=>padding+(x-minX)*scale,py=(y)=>height-padding-(y-minY)*scale;
    const svg=svgEl('svg',{class:'fv-dxf',viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`${ctx.title} DXF geometry preview`});
    svg.appendChild(svgEl('rect',{x:0,y:0,width,height,class:'fv-dxf-bg'}));
    for(const item of drawing.geometry){ const stroke=dxfLayerColour(item.layer);
      if(item.type==='line') svg.appendChild(svgEl('line',{x1:px(item.x1),y1:py(item.y1),x2:px(item.x2),y2:py(item.y2),stroke,class:'fv-dxf-line'}));
      else if(item.type==='polyline'){
        const path=item.vertices.map((point,index)=>`${index?'L':'M'}${px(point.x)} ${py(point.y)}`).join(' ')+(item.closed?' Z':'');
        svg.appendChild(svgEl('path',{d:path,stroke,fill:'none',class:'fv-dxf-line'}));
      }else if(item.type==='circle') svg.appendChild(svgEl('circle',{cx:px(item.x),cy:py(item.y),r:item.r*scale,stroke,fill:'none',class:'fv-dxf-line'}));
      else if(item.type==='arc'){
        const start=(Number.isFinite(item.start)?item.start:0)*Math.PI/180,end=(Number.isFinite(item.end)?item.end:360)*Math.PI/180;
        const a={x:px(item.x+item.r*Math.cos(start)),y:py(item.y+item.r*Math.sin(start))};
        const b={x:px(item.x+item.r*Math.cos(end)),y:py(item.y+item.r*Math.sin(end))};
        let delta=(Number.isFinite(item.end)?item.end:360)-(Number.isFinite(item.start)?item.start:0); while(delta<0) delta+=360;
        svg.appendChild(svgEl('path',{d:`M${a.x} ${a.y} A${item.r*scale} ${item.r*scale} 0 ${delta>180?1:0} 0 ${b.x} ${b.y}`,stroke,fill:'none',class:'fv-dxf-line'}));
      }else if(item.type==='text'){
        const label=svgEl('text',{x:px(item.x),y:py(item.y),fill:stroke,'font-size':Math.max(7,Math.min(24,item.height*scale)),'data-layer':item.layer});
        label.textContent=item.value; svg.appendChild(label);
      }
    }
    host.appendChild(svg);
    const legend=el('div','fv-dxf-legend'); drawing.layers.slice(0,16).forEach((layer)=>{ const item=el('span');
      const swatch=el('i'); swatch.style.background=dxfLayerColour(layer); item.appendChild(swatch); item.appendChild(document.createTextNode(layer)); legend.appendChild(item); });
    if(drawing.layers.length>16) legend.appendChild(el('span',null,`+${drawing.layers.length-16} more layers`)); host.appendChild(legend);
    const details=document.createElement('details'); details.className='fv-source';
    const summary=document.createElement('summary'); summary.textContent='DXF entity summary and bounded source'; details.appendChild(summary);
    const counts=el('div','fv-entity-grid'); [...drawing.typeCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([type,count])=>{
      const row=el('span'); row.appendChild(el('b',null,type)); row.appendChild(el('small',null,count)); counts.appendChild(row); });
    details.appendChild(counts); details.appendChild(plainPre(text.slice(0,64*1024),text.length>64*1024?'first 64 KB':'')); host.appendChild(details);
  }

  async function renderCad3d(host,ctx){
    ctx.assertCurrent?.();
    const bytes=await artifactBytes(ctx,'CAD model'); ctx.assertCurrent?.();
    const format=cadFormat(ctx),inspection=inspectCadBytes(bytes,format);
    const mesh=cadMeshFromBytes(bytes,format),bounds=cadMeshBounds(mesh);
    ctx.assertCurrent?.();
    if(mesh){ inspection.facts.push(['Renderable vertices',mesh.vertices.length],['Triangle faces',mesh.triangles.length]);
      if(bounds) inspection.facts.push(['Model bounds',`X ${cadFormatNumber(bounds.size[0])} · Y ${cadFormatNumber(bounds.size[1])} · Z ${cadFormatNumber(bounds.size[2])}`]);
      if(mesh.truncated) inspection.warning=[inspection.warning,'The interactive preview is bounded; the verified original contains additional geometry.'].filter(Boolean).join(' ');
      if(mesh.warnings.length) inspection.warning=[inspection.warning,...mesh.warnings].filter(Boolean).join(' '); }
    host.innerHTML=''; const card=el('div','fv-card'); card.appendChild(el('div','fv-cardhd',`${format.toUpperCase()} · verified-byte model inspection`));
    for(const [label,value] of inspection.facts){ const row=el('div','row'); row.appendChild(el('span','l2',label)); row.appendChild(el('span','v2',value)); card.appendChild(row); }
    if(inspection.warning) card.appendChild(el('div','fv-warn',inspection.warning));
    card.appendChild(el('div','fv-note','Model facts and any interactive preview were derived locally from the hash-checked file. Embedded code and external model dependencies were not loaded. Use the verified original in a compatible CAD/BIM tool for authoritative geometry and fabrication review.'));
    host.appendChild(card);
    if(mesh&&mesh.triangles.length) mountCadMeshPreview(host,mesh,ctx.title);
    else if(['obj','stl','ply','gltf','glb'].includes(format)) host.appendChild(el('div','fv-warn','No directly renderable triangle geometry was found in the verified model bytes.'));
    if(inspection.types.size){ const typeWrap=el('div','fv-entity-grid');
      [...inspection.types.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([type,count])=>{ const item=el('span'); item.appendChild(el('b',null,type)); item.appendChild(el('small',null,count)); typeWrap.appendChild(item); });
      host.appendChild(el('div','fv-note','Entity inventory · most frequent types')); host.appendChild(typeWrap); }
    if(inspection.preview){ const details=document.createElement('details'); details.className='fv-source';
      const summary=document.createElement('summary'); summary.textContent='Bounded model source/header'; details.appendChild(summary);
      details.appendChild(plainPre(inspection.preview,inspection.preview.length>=20000?'first 20 KB':'')); host.appendChild(details); }
  }

  async function renderArchive(host,ctx){
    const bytes=await artifactBytes(ctx,'archive'); ctx.assertCurrent?.(); host.innerHTML='';
    const media=String(ctx.detectedMedia||ctx.kind||'').toLowerCase();
    const label=artifactTypeLabel(media);
    const card=el('div','fv-card'); card.appendChild(el('div','fv-cardhd',label));
    const zipContainer=media==='application/zip';
    const gzipContainer=['application/gzip','application/x-gzip'].includes(media);
    const tarContainer=media==='application/x-tar';
    let entries=[],containerLabel='archive';
    if(zipContainer){ entries=zipDirectoryEntries(bytes); containerLabel='ZIP'; }
    else if(tarContainer){ entries=tarDirectoryEntries(bytes); containerLabel='Tar'; }
    else if(gzipContainer){
      containerLabel='Gzip';
      try{ const expanded=await gunzipBounded(bytes,maxArchiveInspectionBytes,{signal:ctx.signal});
        ctx.assertCurrent?.();
        if(expanded){ const tarEntries=tarDirectoryEntries(expanded);
          if(tarEntries.length){ entries=tarEntries; containerLabel='Gzip-compressed tar'; } }
      }catch(error){ if(error?.name==='AbortError') throw error;
        card.appendChild(el('div','fv-warn',String(error?.message||'Archive expansion was refused.'))); }
    }
    card.appendChild(el('p','fv-note',entries.length
      ?`${containerLabel} contents are listed after bounded local inspection. Embedded files were not opened or run.`
      :'This packaged format is kept intact. Download the verified original to open it in a compatible application.'));
    host.appendChild(card);
    if(!entries.length){
      if(zipContainer||tarContainer||gzipContainer)
        host.appendChild(el('div','fv-note',`No readable ${containerLabel} directory was found in the bounded preview. The original file is still available above.`));
      return;
    }
    const list=el('div','fv-archive-list');
    entries.forEach((entry)=>{ const row=el('div','fv-archive-entry');
      row.appendChild(el('span',null,entry.name)); row.appendChild(el('small',null,entry.directory?'folder':fmtBytes(entry.size)));
      list.appendChild(row); });
    host.appendChild(el('div','fv-note',`${entries.length} contained item${entries.length===1?'':'s'}${entries.length===200?' · first 200 shown':''}`));
    host.appendChild(list);
  }

  return Object.freeze({renderDxf,renderCad3d,renderArchive});
}
