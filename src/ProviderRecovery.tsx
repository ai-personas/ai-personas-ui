import { fields, text } from './workspace';
import { timestamp } from './identity';

export default function ProviderRecovery({ value }: { value: unknown }) {
  const recovery = fields(value), state = text(recovery.status);
  if (!state) return null;
  const stopped = state === 'quota_exhausted', credentials = state === 'credentials_required';
  return <section class="notice" role="status" aria-label="Provider recovery">
    <strong>{stopped ? 'Provider quota exhausted' : credentials ? 'Provider sign-in needs repair' : 'Waiting for the provider to recover'}</strong>
    <p>{stopped ? 'Automatic retries have stopped. Restore the provider allowance, then resume.' : credentials ? 'Repair the provider sign-in on the node host. The persona will check again automatically.' : 'The persona will continue automatically when the provider responds. You do not need to repeat your request.'}</p>
    {!stopped && text(recovery.next_at) && <p>Next check: <time dateTime={text(recovery.next_at)}>{timestamp(text(recovery.next_at))}</time></p>}
    <p class="micro">Earlier usage remains accounted. Completed actions are not repeated.</p>
  </section>;
}
