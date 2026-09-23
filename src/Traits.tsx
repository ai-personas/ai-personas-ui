import { TRAITS, traitNumber, traitReading, type TraitGroup } from './identity';

export default function Traits({ value }: { value: unknown }) {
  return <div class="identity-descriptors">
    {(['ocean', 'vad'] as TraitGroup[]).map(group => <section key={group} aria-label={group === 'ocean' ? 'OCEAN dispositions' : 'VAD modeled affect'}>
      <h4>{group === 'ocean' ? 'OCEAN dispositions' : 'VAD modeled affect'}</h4>
      <p class="micro">{group === 'ocean' ? 'Scale: 0 to 1. Current dispositions, distinct from the starting seed.' : 'Scale: −1 to 1. Current situation-sensitive modeled affect, not a claim of feelings.'}</p>
      <dl class="descriptor-list">{TRAITS.filter(trait => trait.group === group).map(trait => {
        const reading = traitReading(value, trait);
        return <div key={trait.key} class="descriptor-row">
          <dt>{trait.label}<small>{trait.meaning}</small></dt>
          <dd>{reading.state === 'authored' ? <>
            <span class="descriptor-number">{traitNumber(reading.value)}</span>
            <meter min={trait.min} max={trait.max} value={reading.value} aria-label={`${trait.label}: ${traitNumber(reading.value)} on a ${trait.min} to ${trait.max} scale`}/>
          </> : <span class={reading.state === 'invalid' ? 'descriptor-invalid' : 'descriptor-missing'}>{reading.state === 'invalid' ? 'Invalid recorded value' : 'Not recorded'}</span>}</dd>
        </div>;
      })}</dl>
    </section>)}
    <p class="micro">Values may originate from the user, synthetic initialization or an attributed revision. Missing historical values are not reconstructed. Traits do not establish expertise, permissions, professions, voting power or priorities. Learning does not require a score to change.</p>
  </div>;
}
