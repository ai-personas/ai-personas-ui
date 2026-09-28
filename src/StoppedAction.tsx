import { type Action } from './api';
import { useResource } from './hooks';
import { actionTitle } from './reading';
import ActionReader from './ActionReader';
import { actionBelongsToCall, stoppedActionReference, type StoppedActionReference } from './inference-evidence';

function Receipt({ reference, open }: { reference: StoppedActionReference; open: (id: string) => void }) {
  const { value, error } = useResource<Action>('/actions/' + reference.id, e => e.entity === reference.id);
  if (error) return <p role="alert">Could not load this call's action outcome: {error}</p>;
  if (!value) return <p class="micro">Loading action outcome…</p>;
  if (!actionBelongsToCall(value, reference)) return <p role="alert">The action receipt does not belong to this model call.</p>;
  if (value.state === 'succeeded') return null;
  const label = ({ failed: 'Action failed', conflict: 'Action could not be applied', uncertain: 'Action outcome uncertain',
    interrupted: 'Action interrupted', cancelled: 'Action cancelled', running: 'Action still running', pending: 'Action pending' } as Record<string, string>)[value.state] || 'Action outcome not confirmed';
  return <section class="notice" aria-label="Decision action outcome">
    <p><strong>{label}</strong> · {actionTitle(value.request.kind)}</p>
    {value.error && <p role="alert">{value.error}</p>}
    <details><summary>Inspect action receipt</summary><ActionReader action={value} open={open}/></details>
  </section>;
}

export default function StoppedAction({ call, open }: { call: unknown; open: (id: string) => void }) {
  const reference = stoppedActionReference(call);
  return reference ? <Receipt key={reference.call + ':' + reference.id} reference={reference} open={open}/> : null;
}
