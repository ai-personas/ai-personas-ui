/* Local structured-data viewer. No executable or data dependency leaves the origin. */
export const meta={exts:['json','ndjson'],media_kinds:['json','ndjson','datatree','structured','data'],fetchMode:'text',label:'Structured data'};
export async function render(ctx){
  const text=String(ctx.text??await ctx.fetchText()??'');
  let output=text;
  if(ctx.ext==='json'){ try{ output=JSON.stringify(JSON.parse(text),null,2); }catch(_){} }
  else if(ctx.ext==='ndjson'){ output=text.split(/\r?\n/).filter(Boolean).slice(0,2000).map((line)=>{
    try{return JSON.stringify(JSON.parse(line));}catch(_){return line;}
  }).join('\n'); }
  ctx.host.textContent='';
  const pre=ctx.el('pre','filview fv-code'); pre.textContent=output.slice(0,1024*1024);
  ctx.host.appendChild(pre);
}
