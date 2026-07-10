/* Safe local Markdown renderer. Peer HTML/media is never executed or fetched. */
export const meta={exts:['md','markdown'],media_kinds:['md','markdown'],fetchMode:'text',label:'Markdown'};
const clean=(line)=>String(line||'')
  .replace(/!\[[^\]]*\]\([^)]*\)/g,'[embedded/remote image omitted]')
  .replace(/<\/?(?:img|video|audio|source|picture|iframe|object|embed|script|style)\b[^>]*>/gi,'[remote resource omitted]')
  .replace(/<[^>]+>/g,'');
export async function render(ctx){
  const text=String(ctx.text??await ctx.fetchText()??'').slice(0,8*1024*1024);
  ctx.host.textContent=''; const root=ctx.el('article','fv-md fv-mdrich');
  let code=null,list=null,table=null;
  const flushTable=()=>{ if(!table) return; const wrap=ctx.el('div','fv-tablewrap'), el=ctx.el('table','fv-table');
    table.forEach((cells,index)=>{ const tr=ctx.el('tr'); cells.forEach((cell)=>tr.appendChild(ctx.el(index?'td':'th',null,cell))); el.appendChild(tr); });
    wrap.appendChild(el); root.appendChild(wrap); table=null; };
  for(const raw of text.split(/\r?\n/)){
    if(/^```/.test(raw)){ flushTable(); list=null; if(code){ root.appendChild(code); code=null; } else code=ctx.el('pre','filview fv-code'); continue; }
    if(code){ code.textContent+=(code.textContent?'\n':'')+raw; continue; }
    const line=clean(raw), cells=/^\s*\|.*\|\s*$/.test(line)?line.trim().slice(1,-1).split('|').map((v)=>v.trim()):null;
    if(cells){ if(cells.every((v)=>/^:?-{3,}:?$/.test(v))) continue; (table||(table=[])).push(cells); continue; }
    flushTable();
    const heading=/^(#{1,4})\s+(.*)$/.exec(line); if(heading){ list=null; root.appendChild(ctx.el('h'+heading[1].length,null,heading[2])); continue; }
    const item=/^\s*[-*+]\s+(.*)$/.exec(line); if(item){ if(!list){ list=ctx.el('ul'); root.appendChild(list); } list.appendChild(ctx.el('li',null,item[1])); continue; }
    list=null; if(/^>\s?/.test(line)){ root.appendChild(ctx.el('blockquote',null,line.replace(/^>\s?/,''))); continue; }
    if(!line.trim()){ root.appendChild(ctx.el('br')); continue; }
    root.appendChild(ctx.el('p',null,line));
  }
  flushTable(); if(code) root.appendChild(code); ctx.host.appendChild(root);
}
