import { useState } from 'preact/hooks';
import { operate } from './api';
import type { ApiTypes } from './contract';

type Budget = NonNullable<ApiTypes['provider_settings']['typesafe_budget']>;
const dollars = (value: number | null | undefined) => value == null ? 'Unavailable' : `$${(value / 1_000_000).toFixed(6)}`;
export default function JevBudget({ value, refresh }: { value?: Budget | null; refresh: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!value) return <p>Jev spending information is unavailable.</p>;
  return <form class="jev-budget" onSubmit={async e => {
    e.preventDefault(); if (busy || value.error) return;
    const form = new FormData(e.currentTarget), amount = Number(form.get('limit')), units = Math.round(amount * 1_000_000);
    setError('');
    if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(units)) { setError('Enter a nonnegative dollar amount.'); return; }
    setBusy(true);
    try { await operate('provider.budget.configure', { revision: value.revision, limit_micro_usd: units, reason: String(form.get('reason')) }); refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    <h4>Jev spending limit</h4>
    {value.error ? <p role="alert">{value.error}</p> : <p class="micro">Limit: {value.limit_micro_usd == null ? 'No additional node limit' : dollars(value.limit_micro_usd)} · Accounted: {dollars(value.accounted_micro_usd)} · Remaining: {value.limit_micro_usd == null ? 'Work allowance applies' : dollars(value.remaining_micro_usd)}</p>}
    <label>Total Jev limit (USD)<input name="limit" aria-label="Total Jev limit (USD)" type="number" min="0" step="0.000001" required defaultValue={value.limit_micro_usd == null ? '' : value.limit_micro_usd / 1_000_000}/></label>
    <label>Reason for Jev limit<input name="reason" required/></label>
    <p class="micro">Applies across this node’s work allowances. Includes reserved and uncertain usage. Editing the limit or replacing the key preserves spending. Each work still needs funded USD pricing and processing permission.</p>
    {error && <p role="alert">{error}</p>}<button disabled={busy || Boolean(value.error)}>{busy ? 'Saving…' : 'Save Jev limit'}</button>
  </form>;
}
