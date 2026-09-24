import { useResource } from './hooks';
import { type Entity } from './api';
import RecordReader from './RecordReader';
export default function MemoryFragment({ id, owner, open }: { id: string; owner: string; open: (id: string) => void }) {
  const { value, error } = useResource<Entity>('/records/' + id, e => e.entity === id || e.kind === 'information_policy');
  const { value: usage, error: usageError } = useResource<{selected_participations:number;admitted_calls:number;recent_calls:string[]}>(`/personas/${owner}/memory/usage/${id}`, e => ['run','call'].includes(e.kind));
  return <div class="memory-fragment">{error && <p role="alert">Could not read the fragment. {error}</p>}{!value && !error && <p role="status">Loading fragment…</p>}
    {value && <><p class="field-label">Retained prompt fragment</p><RecordReader record={value} open={open}/>{usageError && <p role="alert">Usage evidence unavailable. {usageError}</p>}{usage && <><p>Selected in {usage.selected_participations} participation{usage.selected_participations === 1 ? '' : 's'}.</p><p>Included in {usage.admitted_calls} admitted model call{usage.admitted_calls === 1 ? '' : 's'}. Admission records the supplied context; application and benefit need further evidence.</p>{usage.recent_calls.length > 0 && <button class="text-button" onClick={() => open(usage.recent_calls[0])}>Inspect recorded inclusion ↗</button>}</>}</>}
  </div>;
}
