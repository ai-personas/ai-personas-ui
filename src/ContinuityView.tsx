import { useState } from 'preact/hooks';
import { fields, text } from './workspace';
import { RelatedItems, Story } from './RecordReader';

export default function ContinuityView({ value, open }: { value: unknown; open: (id: string) => void }) {
  const c = fields(value), [expanded, setExpanded] = useState(false);
  if (!text(c.focus) && !text(c.learning)) return null;
  const intent = fields(c.intent), unknowns = Array.isArray(intent.unknowns) ? intent.unknowns : [];
  const label = ({ retain: 'Retaining a lesson', revise: 'Revising learning', organize: 'Organizing learning', no_change: 'No fragment written', defer: 'Learning deferred' } as Record<string,string>)[text(c.disposition)] || 'Learning decision';
  return <section class="persona-continuity" aria-label="Focus and learning">
    <Story title="Current focus" value={c.focus}/>
    <p class="field-label">{label}</p><Story value={c.learning}/>
    <button class="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide learning details' : 'View learning and next context'}</button>
    {expanded && <div class="continuity-details"><Story title="Intended outcome" value={fields(c.intent).outcome}/><Story title="Intended level of detail" value={fields(c.intent).fidelity}/><Story title="Next evidence to seek" value={fields(c.intent).next_evidence}/><Story title="Working with others" value={fields(c.intent).collaboration}/>{unknowns.length > 0 && <section><h3>Open uncertainties</h3><ul>{unknowns.map((item: unknown, i: number) => <li key={i}>{text(item)}</li>)}</ul></section>}{Array.isArray(c.learning_resolutions) && c.learning_resolutions.map((value: unknown, i: number) => <Story key={i} title="Learning opportunity considered" value={fields(value).reason}/>)}{Array.isArray(c.deferred) && c.deferred.map((v: unknown, i: number) => { const item = fields(v); return <article key={i}><Story title="Idea to reconsider" value={item.cue}/><Story title="Why it was deferred" value={item.reason}/><Story title="Reconsider when" value={item.reconsider_when}/></article>; })}<RelatedItems title="Learning written or revised" value={c.changes} open={open}/><RelatedItems title="Selected for the next decision" value={c.selected} open={open}/><p class="record-caveat">These are the persona’s recorded choices. Later use and benefit need evidence from subsequent work.</p></div>}
  </section>;
}
