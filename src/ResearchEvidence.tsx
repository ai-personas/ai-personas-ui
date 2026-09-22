import { fields, text } from './workspace';
import RichText from './RichText';
function sourceURL(value: unknown): string | undefined {
  try { const url = new URL(String(value)); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export default function ResearchEvidence({ kind, args, result }: { kind: string; args: Record<string, any>; result: Record<string, any> }) {
  if (kind === 'model.invoke') {
    if (result.capability !== 'knowledge') return null;
    const answer = fields(result.result);
    return <section class="reader-section"><h3>Assigned-model knowledge</h3><p class="reader-muted">Ideas from the persona’s assigned model. This is not web research, a tested result or demonstrated experience.</p>
      {text(answer.answer) && <RichText text={text(answer.answer)}/>}
      {(['assumptions', 'unknowns', 'suggested_checks'] as const).map(key => Array.isArray(answer[key]) && answer[key].length > 0 && <section key={key}><h4>{{assumptions:'Assumptions',unknowns:'What remains unknown',suggested_checks:'Suggested checks'}[key]}</h4><ul>{answer[key].slice(0,32).filter((v: unknown) => typeof v === 'string').map((value: string) => <li key={value}>{value}</li>)}</ul></section>)}
    </section>;
  }
  return <section class="reader-section"><h3>{kind === 'browser.search' ? 'Web research' : 'Source page'}</h3>
    {text(args.query) && <p>Searched for: <strong>{args.query}</strong></p>}
    {text(result.engine) && <p>Search engine: {result.engine}</p>}
    {text(result.retrieved_at) && <p class="reader-muted">Observed {new Date(result.retrieved_at).toLocaleString()}</p>}
    {Array.isArray(result.results) && <div class="research-sources">{result.results.slice(0,10).map((item: unknown, index: number) => { const row=fields(item), url=sourceURL(row.url); return <article key={url || index}><h4>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{text(row.title,'Source')}</a> : text(row.title,'Source')}</h4>{url && <small>{new URL(url).hostname}</small>}<p>{text(row.excerpt)}</p></article>; })}</div>}
    {sourceURL(result.url) && <p><a href={sourceURL(result.url)} target="_blank" rel="noopener noreferrer">{text(result.title,'Open original page')}</a></p>}
    {text(result.text) && <details><summary>Read the captured excerpt</summary><p style={{whiteSpace:'pre-wrap'}}>{result.text}</p></details>}
    {result.truncated === true && <p class="reader-muted">This result is a bounded excerpt. Open the original source for full context.</p>}
    <p class="record-caveat">Web content is attributed source material. It does not establish correctness, authority or practical experience.</p>
  </section>;
}
