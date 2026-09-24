import { fields } from './workspace';

export default function QuestionDelivery({ value, status }: { value: unknown; status: unknown }) {
  const d = fields(value);
  if (d.schema !== 'question-delivery/1' || !['open', 'answered'].includes(String(status)) || !(Number(d.restricted_peers) > 0)) return null;
  return <p class="notice question-sharing" role="status">
    <strong>{d.readable_peers === 0 ? 'Peers cannot read this question.' : 'Some peers cannot read this question.'}</strong>{' '}
    Its sources have sharing restrictions. The author needs to decide what can be shared; silence does not mean the peers declined to answer. You can still reply.
  </p>;
}
