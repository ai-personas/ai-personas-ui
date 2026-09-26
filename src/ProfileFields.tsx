import { TRAITS, object } from './identity';
import './identity.css';

export function profileInput(form: FormData, creation = false) {
  const character = String(form.get('character') ?? '');
  const descriptors: Record<string, Record<string, number>> = {};
  for (const trait of TRAITS) {
    const raw = String(form.get(`${trait.group}.${trait.key}`) ?? '').trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < trait.min || value > trait.max) throw new Error(`${trait.label} must be between ${trait.min} and ${trait.max}.`);
    (descriptors[trait.group] ??= {})[trait.key] = value;
  }
  return { ...(form.has('character') && (character || !creation) ? { character } : {}), ...descriptors };
}
export default function ProfileFields({ value = {}, creation = false }: { value?: unknown; creation?: boolean }) {
  const d = object(value);
  return <fieldset class="profile-fields"><legend>{creation ? 'Starting character (optional)' : 'Current character'}</legend>
    {d.self_model && !creation ? <p>Current character is supplied by the designated self-fragments. Ask the persona to revise them through a message; the graph lets you inspect them. This form controls traits and authorship permission.</p> : <label>Character<textarea name="character" aria-label="Character" rows={3} maxLength={8192} defaultValue={typeof d.character === 'string' ? d.character : ''} placeholder="Preferences, interests, and approach…"/></label>}
    <p class="micro">{creation ? 'Leave numeric fields blank for random starting values. These describe tendencies, not experience or qualifications.' : 'These edits are attributed to you. The original starting values remain in history.'}</p>
    <details><summary>{creation ? 'Choose starting traits and affect' : 'Edit traits and affect'}</summary><div class="profile-trait-fields">
      {TRAITS.map(t => <label key={t.key}>{t.label}<input type="number" name={`${t.group}.${t.key}`} min={t.min} max={t.max} step="any" defaultValue={typeof object(d[t.group])[t.key] === 'number' ? String(object(d[t.group])[t.key]) : ''} placeholder={creation ? 'Random' : 'Keep current'}/><small>{t.meaning} · {t.min} to {t.max}</small></label>)}
    </div></details>
    <label class="check"><input type="checkbox" name="self_authorship" defaultChecked={d.self_authorship !== false}/>Let this persona shape its character</label>
    <p class="micro">When off, character and affect stay under your control. The persona can still learn methods, develop interests, and make work decisions.</p>
    {creation && <p class="micro">Personal exploration between tasks starts disabled. You can enable it later with an environment, funding and explicit limits.</p>}
  </fieldset>;
}
