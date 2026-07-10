/* Local bounded delimited-text viewer. */
export const meta={exts:['csv','tsv','bom'],media_kinds:['table','bom','csv','tsv'],fetchMode:'text',label:'Table'};
export async function render(ctx){
  const text=String(ctx.text??await ctx.fetchText()??''); const delimiter=ctx.ext==='tsv'?'\t':',';
  const rows=text.split(/\r?\n/).filter(Boolean).slice(0,500).map((line)=>line.split(delimiter).slice(0,128));
  ctx.host.textContent=''; const table=ctx.el('table','fv-table');
  rows.forEach((row,index)=>{ const tr=ctx.el('tr'); row.forEach((cell)=>tr.appendChild(ctx.el(index?'td':'th',null,cell.slice(0,8192)))); table.appendChild(tr); });
  const wrap=ctx.el('div','fv-tablewrap'); wrap.appendChild(table); ctx.host.appendChild(wrap);
}
