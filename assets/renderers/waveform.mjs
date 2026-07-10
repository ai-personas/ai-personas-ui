/* Local waveform source descriptor; no remote renderer executes with operator authority. */
export const meta={exts:['vcd','wavedrom','wave','wavejson'],media_kinds:['waveform','vcd','wavedrom','wavejson'],fetchMode:'text',label:'Waveform source'};
export async function render(ctx){
  const text=String(ctx.text??await ctx.fetchText()??''); ctx.host.textContent='';
  ctx.host.appendChild(ctx.el('div','fv-note','Verified waveform source; graphical execution is disabled in this credential-bearing page.'));
  const pre=ctx.el('pre','filview fv-code'); pre.textContent=text.slice(0,256*1024); ctx.host.appendChild(pre);
}
