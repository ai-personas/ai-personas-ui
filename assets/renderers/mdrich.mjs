/* Local Markdown fallback. Remote media and executable extensions are never resolved. */
export const meta={exts:['md','markdown'],media_kinds:['md','markdown'],fetchMode:'text',label:'Markdown text'};
export async function render(ctx){
  const text=String(ctx.text??await ctx.fetchText()??'')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,'[remote image omitted]')
    .replace(/<\/?(?:img|video|audio|source|picture|iframe|object|embed)\b[^>]*>/gi,'[remote resource omitted]');
  ctx.host.textContent='';
  const pre=ctx.el('pre','filview'); pre.textContent=text; ctx.host.appendChild(pre);
}
