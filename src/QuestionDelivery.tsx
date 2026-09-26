import { fields } from './workspace';

export default function QuestionDelivery({ value, status }: { value: unknown; status: unknown }) {
  const d = fields(value);
  const submission = d.schema === 'submission-delivery/1';
  const file = d.schema === 'artifact-delivery/1';
  if ((!submission && !file && (d.schema !== 'question-delivery/1' || !['open', 'answered'].includes(String(status)))) || !(Number(d.restricted_peers) > 0)) return null;
  const subject = file ? 'file' : submission ? 'submission' : 'question';
  return <p class="notice question-sharing" role="status">
    <strong>{d.readable_peers === 0 ? `Peers cannot read this ${subject}.` : `Some peers cannot read this ${subject}.`}</strong>{' '}
    Its sources have sharing restrictions. The author needs to decide what can be shared; silence does not mean the peers declined to respond.{!submission && !file && ' You can still reply.'}
  </p>;
}
