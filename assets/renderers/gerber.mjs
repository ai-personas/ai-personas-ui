/* Local-only Gerber descriptor; no third-party parser executes in this realm. */
export const meta={exts:['gbr','ger','gtl','gbl','gto','gts','gko','gm1','drl','xln'],media_kinds:['gerber','excellon','drill','pcb'],fetchMode:'text',label:'Gerber descriptor'};
export async function render(ctx){
  const text=String(ctx.text??await ctx.fetchText()??'');
  ctx.host.textContent='';
  ctx.host.appendChild(ctx.el('div','fv-note','Verified manufacturing-file preview; use an isolated EDA tool for geometry.'));
  const pre=ctx.el('pre','filview'); pre.textContent=text.slice(0,64*1024); ctx.host.appendChild(pre);
}
