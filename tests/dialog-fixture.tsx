/** Synthetic content around the production Dialog; no API, storage or provider calls. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import Dialog from '../src/Dialog';
import '../src/style.css';
import '../src/workspace.css';

const observations = [
  'Make the purpose clear before choosing the method.',
  'Keep claims linked to evidence that another person can inspect.',
  'Record uncertainty instead of presenting assumptions as conclusions.',
  'Separate a submitted result from a result that has been accepted.',
];
function Fixture() {
  const [editor, setEditor] = useState(false), [preview, setPreview] = useState(false);
  const [drawer, setDrawer] = useState(false), [saved, setSaved] = useState(false);
  return <main class="main workspace" style={{ maxWidth: '1080px', paddingBottom: '110px' }}>
    <p class="eyebrow">AI PERSONAS / COMPONENT FIXTURE</p>
    <h1>Room to think.<br/>Work you can inspect.</h1>
    <p class="section-description">Synthetic content for checking dialogs. No runtime is connected and nothing is sent or stored.</p>
    {saved && <p role="status">Form submitted in this fixture only.</p>}
    <div class="status-axes"><div><span>Purpose</span><strong>A responsible launch</strong></div><div><span>Activity</span><strong>Researching options</strong></div><div><span>Evidence</span><strong>Draft observations</strong></div><div><span>Acceptance</span><strong>Not established</strong></div></div>
    {Array.from({ length: 12 }, (_, i) => <section class="workspace-section" key={i}>
      <p class="eyebrow">OBSERVATION {String(i + 1).padStart(2, '0')}</p>
      <h2>{observations[i % observations.length]}</h2>
      <p class="section-description">This is a synthetic reading surface. Open the editor, scroll its contents, and preview a document without losing your place in the workspace.</p>
    </section>)}
    <div style={{ position: 'fixed', bottom: '16px', right: '16px', left: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', zIndex: 3 }}>
      <button class="secondary" onClick={() => setDrawer(true)}>Open activity drawer</button>
      <button onClick={() => setEditor(true)}>Open work editor</button>
    </div>
    {editor && <Dialog label="Work editor" close={() => setEditor(false)}>
      <form class="create-panel" onSubmit={e => { e.preventDefault(); setSaved(true); setEditor(false); }}>
        <header><div><p class="eyebrow">PURPOSE & BOUNDARIES</p><h2>Shape the work</h2></div><button type="button" class="quiet" aria-label="Close editor" onClick={() => setEditor(false)}>Close</button></header>
        <p class="section-description">Give your collaborators a clear purpose and room to choose their approach.</p>
        <p class="notice">Preview fixture only. Submitting this form does not change a work record.</p>
        <label>Short title<input name="title" defaultValue="Research a responsible launch"/></label>
        <label>Your instructions<textarea name="brief" rows={4} defaultValue="Compare the available approaches, identify important tradeoffs, and explain which evidence would change the recommendation."/></label>
        <button type="button" class="secondary" onClick={() => setPreview(true)}>Preview evidence</button>
        <label>Acceptance criterion<input name="criterion" defaultValue="A recommendation with inspectable sources and explicit uncertainty"/></label>
        <fieldset><legend>Working boundaries</legend><label class="check"><input type="checkbox" defaultChecked/>Keep the original instructions in history</label><label class="check"><input type="checkbox" defaultChecked/>Keep final acceptance with the user</label><p class="micro">These controls exercise the form layout only.</p></fieldset>
        <label>What is already known<textarea rows={4} defaultValue="The audience values clarity, a small initial scope, and an honest account of what is not yet known."/></label>
        <label>Questions worth exploring<textarea rows={4} defaultValue="Which option is easiest to reverse? Which claims need stronger evidence? What should be tested before proceeding?"/></label>
        <label>Additional context<textarea rows={4} placeholder="Add useful context for this fixture…"/></label>
        <div class="button-row"><button type="submit">Submit fixture form</button><button type="button" class="secondary" onClick={() => setEditor(false)}>Cancel</button></div>
      </form>
      {preview && <Dialog label="Evidence preview" close={() => setPreview(false)}>
        <article class="viewer"><header><div><p class="eyebrow">DOCUMENT / SYNTHETIC</p><h2>Notes for a responsible launch</h2></div><button type="button" class="quiet" aria-label="Close preview" onClick={() => setPreview(false)}>Close</button></header>
          <p class="notice">Synthetic evidence. This is not an accepted result.</p>
          {Array.from({ length: 14 }, (_, i) => <section key={i}><h3>{i + 1}. {observations[i % observations.length]}</h3><p>Distinguish what was observed from what is inferred. Preserve enough context for another reader to assess the finding, its limits, and the next useful question.</p></section>)}
          <pre>{'a-very-long-reference-'.repeat(25)}</pre>
        </article>
      </Dialog>}
    </Dialog>}
    {drawer && <Dialog label="Activity drawer" drawer close={() => setDrawer(false)}><aside class="drawer"><header><h2>Activity</h2><button class="quiet" onClick={() => setDrawer(false)}>Close activity</button></header><div class="drawer-body">{Array.from({ length: 20 }, (_, i) => <section class="workspace-section" key={i}><h3>Observation {i + 1}</h3><p>{observations[i % observations.length]}</p></section>)}</div></aside></Dialog>}
  </main>;
}
const root = document.getElementById('app')!;
render(<Fixture/>, root);
Object.assign(window, { unmountDialogFixture: () => render(null, root) });
