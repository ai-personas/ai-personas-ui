import { useState } from 'preact/hooks';
import { fields, text } from './workspace';
import { RelatedItems, Story } from './RecordReader';

export default function ContinuityView({ value, open }: { value: unknown; open: (id: string) => void }) {
  const c = fields(value), [expanded, setExpanded] = useState(false);
  if (!text(c.focus) && !text(c.learning)) return null;
  const label = ({ retain: 'Retaining a lesson', revise: 'Revising learning', organize: 'Organizing learning', no_change: 'No learning change needed', defer: 'Learning deferred' } as Record<string,string>)[text(c.disposition)] || 'Learning decision';
  return <section class="persona-continuity" aria-label="Focus and learning">
    <Story title="Current focus" value={c.focus}/>
    <p class="field-label">{label}</p><Story value={c.learning}/>
    <button class="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide learning details' : 'View learning and next context'}</button>
    {expanded && <div class="continuity-details"><RelatedItems title="Learning written or revised" value={c.changes} open={open}/><RelatedItems title="Selected for the next decision" value={c.selected} open={open}/><p class="record-caveat">These are the persona’s recorded choices. Later use and benefit need evidence from subsequent work.</p></div>}
  </section>;
}
