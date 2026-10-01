import { useEffect, useRef, useState } from 'preact/hooks';
import { changes } from './api';
import type { ApiTypes, Command } from './contract';
import type { Act } from './main';

type Selection = Extract<Command, { kind: 'model.selection.preview' }>['args'];
type Readiness = ApiTypes['model_selection_readiness'];

export function useModelReadiness(selection: Selection, act: Act, enabled: boolean, catalogVersion: unknown) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([selection, catalogVersion, attempt]);
  const current = useRef(key); current.current = key;
  const action = useRef(act); action.current = act;
  const mounted = useRef(true);
  const generation = useRef(0);
  const [state, setState] = useState<{ key: string; value?: Readiness; error: string; loading: boolean }>({ key, error: '', loading: enabled });
  useEffect(() => {
    mounted.current = true;
    const invalidate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && ['provider_settings', 'resource_root', 'budget_charge', 'reservation'].includes(detail.kind)) setAttempt(n => n + 1);
    };
    changes.addEventListener('change', invalidate);
    return () => { mounted.current = false; generation.current++; changes.removeEventListener('change', invalidate); };
  }, []);
  async function check() {
    const started = ++generation.current;
    setState({ key, error: '', loading: true });
    try {
      const value = (await action.current('model.selection.preview', selection)).result as Readiness;
      if (value?.schema !== 'model-selection-readiness/1' || typeof value.ready !== 'boolean'
        || value.selection?.provider !== selection.provider || value.selection?.model !== selection.model
        || (value.selection?.effort || null) !== (selection.effort || null)
        || selection.resource_root && value.scope?.resource_root !== selection.resource_root
        || selection.persona && value.scope?.persona !== selection.persona
        || selection.run && value.scope?.run !== selection.run
        || value.inference_dispatched !== false || value.reservation_created !== false || value.future_request_fit_guaranteed !== false) throw Error('Unrecognized model readiness response.');
      if (!mounted.current || current.current !== key || generation.current !== started) throw Error('The model or funding changed during this check. Try again.');
      setState({ key, value, error: '', loading: false });
      return value;
    } catch (e) {
      if (mounted.current && current.current === key && generation.current === started) setState({ key, error: (e as Error).message, loading: false });
      throw e;
    }
  }
  useEffect(() => {
    if (!enabled) { generation.current++; return; }
    void check().catch(() => {});
    return () => { generation.current++; };
  }, [key, enabled]);
  return { ...(enabled && state.key === key ? state : { value: undefined, error: '', loading: enabled }), check, retry: () => setAttempt(n => n + 1) };
}

export function ModelReadiness({ value, error, loading, retry, authoredCharacter = false }: ReturnType<typeof useModelReadiness> & { authoredCharacter?: boolean }) {
  return <section class="model-readiness notice" aria-label="Model and funding readiness" aria-busy={loading}>
    {loading ? <p role="status">Checking this model and allowance…</p> : error ? <p role="alert">Could not check model readiness: {error}</p>
      : value ? <div role="status"><p>{value.ready ? value.price_required === false && !value.price ? 'Model selection checks passed in test mode. Funding is not enforced.' : 'Model selection checks passed for this allowance.' : authoredCharacter && value.blocker?.code === 'MODEL_PRICE_REQUIRED' ? 'Your supplied character skips the initialization call. Funded decisions remain unavailable for this model.' : 'Model selection checks did not pass for this allowance.'}</p>
        {value.blocker && <><p>{value.blocker.message}</p><p>{value.blocker.remediation}</p></>}
        {value.price && <p class="micro">Exact price policy: {value.price.provider} / {value.price.model} · {value.price.evidence}</p>}
      </div> : <p>Choose a model and funding allowance to check readiness.</p>}
    <p class="micro">Checking makes no inference call and reserves no capacity. Each future request must fit its latest allowance.</p>
    {(value || error) && <button type="button" class="text-button" disabled={loading} onClick={retry}>Refresh readiness</button>}
  </section>;
}
