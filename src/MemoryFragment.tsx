import { useResource } from './hooks';
import { currentRead, readMemoryDetail, readMemoryUsage } from './memoryDetails';
import RecordReader from './RecordReader';
export default function MemoryFragment({ id, revision, owner, open }: { id: string; revision: number; owner: string; open: (id: string) => void }) {
  const detail = useResource<unknown>('/records/' + encodeURIComponent(id), e => e.entity === id || e.kind === 'information_policy');
  const current = currentRead(detail, value => readMemoryDetail(value, { id, revision, owner, kind: 'fragment' }));
  const evidence = useResource<unknown>(`/personas/${encodeURIComponent(owner)}/memory/usage/${encodeURIComponent(id)}`, e => ['run', 'call', 'information_policy'].includes(e.kind), !!current.value);
  const usage = currentRead(evidence, readMemoryUsage);
  return <div class="memory-fragment" aria-busy={current.loading}>
    {current.error && <p role="alert">Could not read the fragment. {current.error} <button class="text-button" onClick={detail.retry}>Retry fragment</button></p>}
    {current.loading && <p role="status">Loading fragment…</p>}
    {current.value && <><p class="field-label">Retained prompt fragment · revision {revision}</p><RecordReader record={current.value} open={open}/>
      {usage.error && <p role="alert">Usage evidence unavailable. {usage.error} <button class="text-button" onClick={evidence.retry}>Retry usage evidence</button></p>}
      {usage.loading && <p role="status">Loading usage evidence…</p>}
      {usage.value && <><p>Selected in {usage.value.selected_participations} participation{usage.value.selected_participations === 1 ? '' : 's'}.</p><p>Included in {usage.value.admitted_calls} admitted model call{usage.value.admitted_calls === 1 ? '' : 's'}. Admission records the supplied context; application and benefit need further evidence.</p>
        <p class="micro">These counts span retained revisions of this fragment, not only the displayed revision.</p>
        {usage.value.recent_calls.length > 0 && <button class="text-button" onClick={() => open(usage.value!.recent_calls[0])}>Inspect recorded inclusion ↗</button>}</>}
    </>}
  </div>;
}
