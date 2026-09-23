import { fields, text } from './workspace';
import { PROFILE_TRAITS } from './profile';

function number(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Not recorded'; }
export default function ProfileSeed({ value }: { value: Record<string, any> }) {
  const seed = fields(value.profile_seed), initial = fields(seed.values), origins = fields(seed.origins);
  return <section aria-label="Starting profile and authorship">
    <p><strong>Profile control:</strong> {value.self_authorship === true ? 'This persona may shape its character.' : value.self_authorship === false ? 'Character, OCEAN and VAD are user-controlled.' : 'Authorship policy not recorded.'}</p>
    <p class="micro">Learning and work-specific judgments are separate from permission to edit the profile. VAD is situation-sensitive modeled affect, not lasting disposition.</p>
    {seed.schema !== 'persona-profile-seed/1' ? <p class="notice">A starting seed is not available. It has not been reconstructed from the current profile.</p> : <details>
      <summary>Compare starting seed and current values</summary>
      <p><strong>Starting character:</strong> {text(initial.character) || 'Unspecified'}</p>
      <p class="micro">Character origin: {text(origins.character, 'Not recorded')}. The original seed is not rewritten by current changes.</p>
      <dl>{PROFILE_TRAITS.map(([group, key, label]) => <div key={key}>
        <dt>{group.toUpperCase()} · {label}</dt><dd>Started at {number(fields(initial[group])[key])} ({text(fields(origins[group])[key], 'origin not recorded')}); current {number(fields(value[group])[key])}.</dd>
      </div>)}</dl>
      <p class="micro">Generator: {text(seed.generator, 'Not recorded')}</p>
      <p class="micro">Reproducibility seed: <code>{text(seed.reproducibility_seed, 'Not recorded')}</code></p>
      <p class="record-caveat">Synthetic starting values are not personal experience, qualification, demonstrated learning or a validated psychological distribution.</p>
    </details>}
  </section>;
}
