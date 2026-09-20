import { useEffect, useRef, useState } from 'preact/hooks';
import { changed, request } from './api';
import type { ApiTypes, Connection, HttpModel } from './contract';
import { useModels } from './Models';
import Dialog from './Dialog';

type Settings = ApiTypes['provider_settings'];
type Change = ApiTypes['provider_settings_change'];
const title = (id: string) => ({ openai: 'OpenAI', anthropic: 'Anthropic Claude', gemini: 'Google Gemini', codex: 'Codex' } as Record<string, string>)[id] || id;

export function ProviderSettings() {
  const [settings, setSettings] = useState<Settings>(), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0), [editing, setEditing] = useState<{ connection: Connection; exists: boolean; custom: boolean }>();
  const [removing, setRemoving] = useState(''), [busy, setBusy] = useState(false);
  const [typesafe, setTypesafe] = useState(false);
  const models = useModels();
  useEffect(() => {
    const controller = new AbortController(); setError('');
    request<Settings>('/settings/providers', { signal: controller.signal }).then(setSettings)
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [attempt]);
  async function save(change: Change) {
    const next = await request<Settings>('/settings/providers', { method: 'POST', body: JSON.stringify(change) });
    setSettings(next); setError(''); setRemoving('');
    setNotice(change.action === 'remove' || change.action === 'remove_typesafe' ? 'Connection removed. New decisions cannot use this saved key.' : change.action === 'save_typesafe' ? 'JEV API key saved on this node.' : 'Connection saved on this node.');
    models.refresh(); changed({ kind: 'provider_settings' });
  }
  if (!settings) return <section class="provider-settings"><h2>Provider connections</h2><p role={error ? 'alert' : 'status'}>{error || 'Loading provider settings…'}</p>{error && <button onClick={() => setAttempt(n => n + 1)}>Retry settings</button>}</section>;
  const saved = settings.connections;
  const open = (connection: Connection, exists: boolean, custom: boolean) => { setNotice(''); setEditing({ connection, exists, custom }); };
  return <section class="provider-settings"><header class="page-heading"><div><h2>Provider connections</h2><p>Connect models with an API key, or use the node’s Codex login.</p></div>
    <button class="secondary" onClick={() => open({ provider: '', protocol: 'responses', config: { ...settings.templates[0].config, endpoint: '', models: [] } }, false, true)}>Add custom provider</button></header>
    <p class="micro">Keys are saved only on this node, in an owner-only file. Saved keys are never sent back to the browser or included in persona context. Provider access and task funding are separate.</p>
    {notice && <p class="notice" role="status">{notice}</p>}
    {error && <p role="alert">{error} <button class="text-button" onClick={() => setAttempt(n => n + 1)}>Reload settings</button></p>}
    <div class="provider-grid">
      {settings.templates.filter(t => !saved.some(s => s.connection.provider === t.provider) && !settings.host_providers.includes(t.provider)).map(t => <article class="operator-card provider-card" key={t.provider}><div><h3>{title(t.provider)}</h3><span class="micro">API key · Not connected</span></div><p>Use supported models available to your {title(t.provider)} API account. API usage is billed separately from chat subscriptions.</p><button onClick={() => open(t, false, false)}>Connect {title(t.provider)}</button></article>)}
      {saved.map(({ connection, updated }) => {
        const id = connection.provider, status = models.catalog?.providers.find(p => p.provider === id);
        const available = models.models.filter(m => m.provider === id);
        return <article class="operator-card provider-card" key={id}><div><h3>{title(id)}</h3><span class="micro">API key saved <span aria-hidden="true">••••••••</span></span></div>
          <p class="provider-endpoint">{connection.config.endpoint}</p>
          <p role="status">{models.loading ? 'Checking connection…' : status?.available ? `${available.length} available ${available.length === 1 ? 'model' : 'models'}` : status?.message || 'Refresh models to check this connection.'}</p>
          {available.length > 0 && <details><summary>Available models</summary><ul>{available.map(m => <li key={m.id}>{m.name || m.id}</li>)}</ul></details>}
          <p class="micro">Saved {new Date(updated).toLocaleString()}</p>
          <div class="button-row"><button class="secondary" onClick={() => open(connection, true, !settings.templates.some(t => t.provider === id))}>Edit {title(id)}</button><button class="quiet" onClick={() => setRemoving(id)}>Remove {title(id)}</button></div>
          {removing === id && <div class="notice"><p>Remove this saved connection and key? Calls already in progress may finish. Existing personas, allowances, and recorded work stay available.</p><div class="button-row"><button disabled={busy} onClick={async () => { setBusy(true); try { await save({ action: 'remove', revision: settings.revision, provider: id }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Remove connection</button><button class="quiet" disabled={busy} onClick={() => setRemoving('')}>Keep connection</button></div></div>}
        </article>;
      })}
    <article class="operator-card provider-card"><div><h3>TypeSafe.ai JEV</h3><span class="micro">Structured decision API · {settings.typesafe ? 'API key saved ••••••••' : 'Not connected'}</span></div>
      <p>Use JEV alongside the persona’s language model, which prepares its structured requests and interprets the results.</p>
      <p class="micro">API billing. Saving a key makes no evaluation call; account access is checked when used.</p>
      <div class="button-row"><button class="secondary" onClick={() => setTypesafe(true)}>{settings.typesafe ? 'Replace JEV API key' : 'Connect TypeSafe JEV'}</button>{settings.typesafe && <button class="quiet" onClick={() => setRemoving('typesafe')}>Remove JEV key</button>}</div>
      {removing === 'typesafe' && <div class="notice"><p>Remove the saved JEV key? Recorded decisions and grants remain; further requests using this key will fail until reconnected.</p><button disabled={busy} onClick={async () => { setBusy(true); try { await save({ action: 'remove_typesafe', revision: settings.revision }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Remove connection</button><button class="quiet" disabled={busy} onClick={() => setRemoving('')}>Keep connection</button></div>}
    </article>
      {settings.host_providers.map(id => <article class="operator-card provider-card" key={id}><div><h3>{title(id)}</h3><span class="micro">Managed on the node host</span></div><p>{id === 'codex' ? 'Uses the existing Codex login on this computer. No API key is needed here.' : 'Configured by the node launcher. Its credentials are managed on the host.'}</p><p>{models.catalog?.providers.find(p => p.provider === id)?.message || 'Checking connection…'}</p></article>)}
    </div>
    <div class="model-status"><p role={models.error ? 'alert' : 'status'}>{models.loading ? 'Checking available models…' : models.error || `${models.models.length} available language models.`}</p><button class="text-button" disabled={models.loading} onClick={models.refresh}>Refresh models</button></div>
    <p class="micro">Claude uses the Anthropic Messages API; Gemini uses the Google Gemini API. All saved API-key connections currently support text input. Add each model’s price and allowance before starting work with it.</p>
    {editing && <ConnectionEditor key={editing.connection.provider + editing.exists} initial={editing.connection} exists={editing.exists} custom={editing.custom} revision={settings.revision} save={save} close={() => setEditing(undefined)}/>}
    {typesafe && <TypesafeKey revision={settings.revision} save={save} close={() => setTypesafe(false)}/>}
  </section>;
}

function TypesafeKey({ revision, save, close }: { revision: string; save: (change: Change) => Promise<void>; close: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [base] = useState(revision);
  return <Dialog label="Connect TypeSafe JEV" close={() => { if (!busy) close(); }}><form class="operator-form" onSubmit={async e => {
    e.preventDefault(); if (busy || base !== revision) return; const input = e.currentTarget.elements.namedItem('key') as HTMLInputElement;
    setBusy(true); setError('');
    try { await save({ action: 'save_typesafe', revision: base, api_key: input.value.trim() }); close(); }
    catch (e) { setError((e as Error).message); } finally { input.value = ''; setBusy(false); }
  }}><header><h2>TypeSafe.ai JEV</h2><button type="button" class="quiet" disabled={busy} onClick={close}>Close form</button></header>
    <p>Connect the decision API with a TypeSafe-issued API key. The node sends it only to the official TypeSafe endpoint.</p>
    <label>JEV API key<input name="key" type="password" required maxLength={8192} autoComplete="new-password" spellcheck={false}/></label>
    <p class="micro">Stored in the node’s owner-only secret file, without application-level encryption. No evaluation or automatic permission is created.</p>
    {error && <p role="alert">{error}</p>}{base !== revision && <p role="alert">Settings changed. Close this form and reopen it before saving.</p>}
    <button disabled={busy || base !== revision}>{busy ? 'Saving…' : 'Save JEV key'}</button></form></Dialog>;
}

function whole(f: FormData, name: string, min = 1) {
  const raw = String(f.get(name) ?? ''), value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min) throw Error('Enter valid whole numbers for model limits.');
  return value;
}
function ConnectionEditor({ initial, exists, custom, revision, save, close }: {
  initial: Connection; exists: boolean; custom: boolean; revision: string; save: (change: Change) => Promise<void>; close: () => void;
}) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const next = useRef(initial.config.models.length);
  const [rows, setRows] = useState(() => initial.config.models.map((model, id) => ({ id, model })));
  const add = () => setRows(rows => [...rows, { id: next.current++, model: { id: '', context_window_tokens: 0, max_output_tokens: 0, input_tokens_per_utf8_byte_upper_bound: 1, framing_token_allowance: 4096, vision: false, image_token_upper_bound: null, allowed_reasoning_efforts: [] } }]);
  const [baseRevision] = useState(revision);
  const stale = baseRevision !== revision;
  return <Dialog label={exists ? 'Edit provider connection' : 'Connect provider'} close={() => { if (!busy) close(); }}><form class="operator-form allowance-form provider-form" onInvalidCapture={e => { const details = (e.target as HTMLElement).closest('details'); if (details) details.open = true; }} onSubmit={async e => {
    e.preventDefault(); if (busy || stale) return;
    const form = e.currentTarget, f = new FormData(form), key = form.elements.namedItem('api_key') as HTMLInputElement;
    setBusy(true); setError('');
    try {
      const models: HttpModel[] = rows.map(({ id, model }) => ({ ...model, id: String(f.get(`model.${id}.id`)).trim(),
        context_window_tokens: whole(f, `model.${id}.context`), max_output_tokens: whole(f, `model.${id}.output`),
        input_tokens_per_utf8_byte_upper_bound: whole(f, `model.${id}.token_bound`), framing_token_allowance: whole(f, `model.${id}.framing`),
        allowed_reasoning_efforts: String(f.get(`model.${id}.reasoning`) || '').split(',').map(s => s.trim()).filter(Boolean) }));
      if (!models.length) throw Error('Add at least one exact model and its documented limits.');
      if (models.some(m => !m.id || m.context_window_tokens <= m.max_output_tokens)) throw Error('Each model needs an ID and a context limit larger than its output limit.');
      const api_key = key.value.trim();
      await save({ action: 'save', revision: baseRevision, connection: { provider: String(f.get('provider')).trim(), protocol: String(f.get('protocol')) as Connection['protocol'], config: { ...initial.config,
        endpoint: String(f.get('endpoint')).trim(), api_key_env: null, trust_loopback_http: f.has('loopback'), models } }, api_key: api_key || null });
      key.value = ''; close();
    } catch (e) { setError((e as Error).message); } finally { key.value = ''; setBusy(false); }
  }}><header><div><p class="eyebrow">PROVIDER SETTINGS</p><h2>{exists ? `Edit ${title(initial.provider)}` : custom ? 'Connect a custom provider' : `Connect ${title(initial.provider)}`}</h2></div><button class="quiet" type="button" disabled={busy} onClick={close}>Close form</button></header>
    <div class="form-body">
      {error && <p role="alert">{error}</p>}{stale && <p role="alert">Settings changed while this form was open. Close it and open the current connection before saving.</p>}
      <label>Provider ID<input name="provider" required pattern="[A-Za-z0-9_-]{1,64}" maxLength={64} defaultValue={initial.provider} readOnly={exists || !custom}/></label>
      {custom ? <label>API protocol<select name="protocol" aria-label="API protocol" defaultValue={initial.protocol}><option value="responses">OpenAI Responses</option><option value="anthropic">Anthropic Messages</option><option value="gemini">Google Gemini</option></select></label> : <input type="hidden" name="protocol" value={initial.protocol}/>}
      <label>API endpoint<input name="endpoint" type="url" required defaultValue={initial.config.endpoint} readOnly={!custom} placeholder="https://provider.example/v1/responses"/></label>
      {custom && <small>Use the exact /responses or /messages endpoint, or Gemini’s /v1beta/models base endpoint.</small>}
      <label>{exists ? 'Replace API key' : 'API key'}<input name="api_key" type="password" required={!exists} maxLength={8192} autoComplete="new-password" spellcheck={false}/></label>
      <small>{exists ? 'Leave blank to keep the saved key. Changing the endpoint requires a new key.' : 'The node stores this key; the browser cannot retrieve it after saving.'}</small>
      <details open={custom}><summary>Model limits</summary><p class="micro">Only these exact models are enabled, after checking the provider’s model list. Use documented limits; prices and spending limits belong to the allowance.</p>
        {rows.map(({ id, model }) => <fieldset key={id}><legend>Model {rows.findIndex(row => row.id === id) + 1}</legend>
          <label>Model ID<input name={`model.${id}.id`} defaultValue={model.id} required maxLength={256}/></label>
          <div class="operator-grid"><label>Context tokens<input name={`model.${id}.context`} type="number" min={2} step={1} required defaultValue={model.context_window_tokens || ''}/></label><label>Maximum output tokens<input name={`model.${id}.output`} type="number" min={1} step={1} required defaultValue={model.max_output_tokens || ''}/></label></div>
          <details><summary>Token accounting and reasoning</summary><div class="operator-grid"><label>Input tokens per UTF-8 byte upper bound<input name={`model.${id}.token_bound`} type="number" min={1} step={1} required defaultValue={model.input_tokens_per_utf8_byte_upper_bound}/></label><label>Framing token allowance<input name={`model.${id}.framing`} type="number" min={1} step={1} required defaultValue={model.framing_token_allowance}/></label></div><label>Allowed reasoning efforts, separated by commas<input name={`model.${id}.reasoning`} defaultValue={model.allowed_reasoning_efforts?.join(', ') || ''}/></label></details>
          <button class="text-button" type="button" onClick={() => setRows(rows => rows.filter(row => row.id !== id))}>Remove model</button>
        </fieldset>)}<button class="secondary" type="button" onClick={add}>Add model</button>
      </details>
      {custom && <label class="check"><input type="checkbox" name="loopback" defaultChecked={initial.config.trust_loopback_http}/>Allow HTTP for a literal loopback endpoint on this node only</label>}
      <p class="micro">Saving checks model availability without making an inference call. Calls already in progress keep their selected connection.</p>
    </div><footer class="form-actions"><p class="micro">Keys are stored in an owner-only file on the node, without application-level encryption.</p><button disabled={busy || stale}>{busy ? 'Saving…' : 'Save connection'}</button></footer>
  </form></Dialog>;
}
