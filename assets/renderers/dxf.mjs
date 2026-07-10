/* Local-only DXF descriptor; rich CAD execution is intentionally isolated. */
export const meta={exts:['dxf'],media_kinds:['dxf','drawing','mechanical_drawing'],fetchMode:'text',label:'DXF descriptor'};
export async function render(ctx){
  const text=String(ctx.text??await ctx.fetchText()??'');
  ctx.host.textContent='';
  ctx.host.appendChild(ctx.el('div','fv-note','Verified DXF text preview; open the verified download in an isolated CAD tool.'));
  const pre=ctx.el('pre','filview'); pre.textContent=text.slice(0,64*1024); ctx.host.appendChild(pre);
}
