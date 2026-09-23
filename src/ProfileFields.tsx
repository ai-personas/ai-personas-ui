import { PROFILE_TRAITS } from './profile';

export default function ProfileFields({ disabled }: { disabled: boolean }) {
  return <fieldset disabled={disabled}>
    <legend>Starting character</legend>
    <label>Character text <small>Optional starting approach; do not invent experience or qualifications.</small>
      <textarea name="profile.character" rows={3}/>
    </label>
    <p>Leave any numeric field blank to initialize it randomly once on the server. Entering zero preserves zero. The original seed remains separate from later changes.</p>
    <details><summary>Optional OCEAN and VAD values</summary>
      {PROFILE_TRAITS.map(([group, key, label, low, high]) => <label key={key}>{group.toUpperCase()} · {label}
        <input name={`profile.${group}.${key}`} type="number" min={low} max={high} step="any" placeholder={`Random within ${low} to ${high}`}/>
      </label>)}
    </details>
    <label class="check"><input type="checkbox" name="profile.self_authorship" defaultChecked/>Let this persona shape its character</label>
    <p class="micro">When disabled, narrative character, OCEAN and VAD stay user-controlled. Learning methods and retaining experience remain possible. Synthetic values do not establish expertise or human psychology.</p>
    <p class="micro">Personal exploration is not enabled by this form. It requires a separately supported policy with explicit funding, recurrence and expiry.</p>
  </fieldset>;
}
