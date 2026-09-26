/** Real Preact UI against synthetic HTTP records, not live personas or engineering. */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const port = 4176, origin = `http://127.0.0.1:${port}`, id = n => n.toString(16).padStart(32, '0');
const work = id(1), person = id(2), file = id(7), badFile = id(8), nativeFile = id(9);
const stamp = '2026-09-16T00:00:00Z';
const record = (n, kind, data, scope = work) => ({ id: id(n), kind, scope, revision: 1, created: stamp, updated: stamp, data });
const bytes = Buffer.from('Exact fixture bytes. Not a real engineering result.\n');
const digest = createHash('sha256').update(bytes).digest('hex');
const documentText = '# A clear plan\n\nA **shared baseline** with readable steps.\n\n## Rooms\n\n- Four bedrooms\n- Two bathrooms\n\n| Room | Count |\n| --- | --- |\n| Bedroom | 4 |\n\n## Checklist\n\n- [ ] Gather materials\n- [x] **Confirm details**\n\n- [ ] Review notes\n\n  Keep this paragraph with the task.\n\n  - [X] Nested check\n\nOrdinary [ ] text stays literal.\n\n[Unsafe link](javascript:alert(1))\n\n![External image](https://example.invalid/tracker.png)\n\n<img src="x" onerror="window.readerInjected=true">\n\n```text\nA code example\n```';
const records = [
  record(1, 'work', { title: 'Fixture house', brief: 'A fixture need, not a generated house.', personas: [person], activity: { running: 1 }, submissions: 1, assessments: { accepted: 1 }, pending_requests: 1, input_requests: 1, mandate: { id: id(19), revision: 1 }, core: { binding: 'adopted', continuation: { status: 'awaiting_acceptance', owners: [] }, coverage: { outcomes: [], scope_review_current: false, scope_review_required: false }, acceptance: null, blocking_feedback: [{ id: id(25), revision: 1 }], stale_resolutions: [{ id: id(25), revision: 1 }], deferred_feedback: [{ id: id(26), revision: 1 }], stale_assumptions: [{ id: id(27), revision: 1 }], handoff_gaps: [{ commitment: { id: id(28), revision: 1 }, owner: person, continuation: true }] }, last_operation: id(99), participant_ids: [person], runtime_only: { kind: 'INTERNAL_ENVELOPE', schema: 'transport/99' } }, ''),
  record(2, 'persona', { name: 'Mira fixture', character: 'Interested in comparing alternatives.', model: 'fixture-only' }, ''),
  record(3, 'run', { persona: person, status: 'running', continuity: { focus: 'Compare alternatives on a common basis.' }, working_intent: { outcome: 'An explained comparison.', fidelity: 'Comparable room schedules.', collaboration: 'Invite Rowan to challenge my assumptions.' } }),
  record(4, 'commitment', { title: 'Unaccepted offer', status: 'offered', owner: person, offered_to: person, draft: { kind: 'INTERNAL_DRAFT', description: 'Compare two layouts for daylight.', criterion: 'Explain the daylight trade-offs clearly.', internal_flag: 'do-not-display' } }),
  record(5, 'submission', { title: 'Fixture submission', artifacts: [file, badFile, nativeFile], documents: [id(16), id(16)] }),
  record(6, 'finding', { title: 'Historical fixture review', verdict: 'accepted', submission: id(5), checks: [] }),
  record(7, 'artifact', { name: 'verified.txt', media_type: 'text/plain', digest, size: bytes.length }, person),
  record(8, 'artifact', { name: 'tampered.txt', media_type: 'text/plain', digest: '0'.repeat(64), size: bytes.length }, person),
  record(9, 'artifact', { name: 'large-native.cad', media_type: 'application/octet-stream', digest, size: 100_000_000 }, person),
  record(10, 'assumption', { title: 'Exploratory assumption', status: 'authorized_for_exploration', summary: 'Not a confirmed site fact.' }),
  record(11, 'birth', { title: 'Proposed peer', status: 'proposed', reason: 'Investigate uncertainty', parent: person, initialization_status: 'pending', membership_status: 'invited' }),
  record(12, 'working_agreement', { title: 'Same comparison basis', terms: 'Compare equivalent inputs.', endorsements: [] }),
  record(13, 'request', { purpose: 'Fixture clarification', status: 'open', evidence_required: 'An actual answer, not an acknowledgement.', artifacts: [] }),
  record(14, 'fragment', { title: 'A candidate lesson', content: 'Bind analysis to source versions.', applicability: 'When generating derived outputs', limitations: 'Usefulness not demonstrated.' }),
  record(16, 'document', { title: 'Readable house concept', content: documentText, owner: person, environment: id(17),
    information_sources: [{ id: id(18), revision: 1 }], design_details: { conceptual: true, bedrooms: 4 } }, person),
  record(17, 'environment', { name: 'Shared design room' }, ''),
  record(18, 'work_entry', { entry_kind: 'proposal', status: 'proposed', author: person, draft: { kind: 'proposal', text: 'Compare daylight before choosing a layout.', alternatives: ['Courtyard', 'Compact plan'], expected_result: 'A clear comparison.', possible_regressions: 'Less room for storage.', check: 'Compare room schedules.', reconsider_if: 'The site changes.', sources: [] }, causal_operation: id(99), internal_data: { kind: 'INTERNAL_ENVELOPE' } }),
  record(19, 'work_mandate', { original_need: 'Create a practical comparison.', mandate: { outcomes: [{ key: 'INTERNAL_OUTCOME_KEY', description: 'Two comparable layouts', criterion: 'Show the trade-offs', required: true, evidence: 'user_judgment' }], constraints: ['Keep four bedrooms'], preferences: [], unresolved_inputs: [], completion_agreement: 'User accepts the comparison' }, status: 'adopted', causal_operation: id(99) }),
  record(20, 'request', { purpose: 'Choose a comparison basis', instructions: 'Tell us which priorities matter.', evidence_required: 'Your priorities', status: 'resolved', resolution: { id: id(29), revision: 1 }, owner: person }),
  record(29, 'request_resolution', { request: id(20), resolution: { conclusion: 'Use equal floor areas for both concepts.', evidence: [], request: id(20) }, owner: person }, id(20)),
  record(23, 'run', { persona: person, continuity: { focus: 'OTHER_WORK_PRIVATE_INTENTION' } }, id(100)),
  record(24, 'persona', { name: 'Rowan fixture' }, ''),
  record(25, 'work_feedback', { title: 'Check revised dimensions', status: 'resolved' }),
  record(26, 'work_feedback', { title: 'Confirm site access', status: 'deferred' }),
  record(27, 'work_entry', { title: 'Site observation changed', entry_kind: 'assumption', status: 'confirmed_by_evidence' }),
  record(28, 'commitment', { title: 'Carry the comparison forward', status: 'blocked', owner: person }),
  record(21, 'message', { from: person, to: 'user', text: 'The comparison is ready to read.', origin: { kind: 'INTERNAL_ORIGIN' } }),
];
const sampleAction = { request: { id: id(40), kind: 'message.send', args: { to: 'user', text: 'The comparison is ready to read.', internal_flag: 'do-not-display' } }, state: 'succeeded', result: records.find(r => r.id === id(21)) };
let serverLog = '', browser, checks = 0, activePage;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', b => { serverLog += b; }); server.stderr.on('data', b => { serverLog += b; });
async function step(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function ready() {
  for (let n = 0; n < 100; n++) { try { if ((await fetch(origin)).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Vite did not start: ' + serverLog);
}
try {
  await mkdir('.qa', { recursive: true }); await ready();
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport }); activePage = page; const errors = [], calls = [], writes = [], externalReads = []; let approachMode = 'normal';
    page.on('request', request => { if (request.url().startsWith('https://example.invalid/')) externalReads.push(request.url()); });
    await page.route('https://example.invalid/**', route => route.abort());
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const req = route.request(), u = new URL(req.url()); calls.push(u.pathname + u.search);
      if (u.pathname === '/api/session') return route.fulfill({ json: {} });
      if (u.pathname === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': fixture keepalive\n\n' });
      if (u.pathname === `/api/work/${work}/readiness`) return route.fulfill({ json: {
        schema: 'work-readiness/1', observed: stamp, funding: { binding: 'unfunded', observed_tokens: { input: 24000, output: 1200 } },
        work_usage: { calls: 4, running: 0, uncertain: 1, observed_tokens: { input: 9000, output: 600 } },
        jev_budget: { limit_micro_usd: 5000000, accounted_micro_usd: 42, remaining_micro_usd: 4999958 },
        participants: [{ persona: person, run: id(3), name: 'Mira fixture', status: 'running', provider: 'fixture', model: 'Fixture model', provider_configured: true, model_discovered: true, character_ready: true, avatar: 'unavailable', self_fragments: 1, retained_fragments: 3, selector_policy: 'disabled', last_selector: { call: id(40), result: { status: 'deterministic_fallback', diagnostic: { stage: 'exposure_check', attempt_admitted: false, quoted_tokens: { input: 65536, output: 65536 }, approved_tokens: { input: 64000, output: 8192 } } } }, publications: 0, submissions: 0 }, { persona: id(42), run: id(43), name: 'Unknown assessment fixture', last_selector: { result: { status: 'validated', counts: { match: 0, no_match: 0, unknown: 1 } } } }]
      } });
      if (u.pathname === `/api/work/${work}/files`) return route.fulfill({json:{items:records.filter(r=>[file,badFile,nativeFile,id(16)].includes(r.id)).map(record=>({record,status:'submitted',submissions:[{id:id(5),revision:1}],adopted_in:null,acceptance_established:false})),next:null,sequence:0}});
      if (u.pathname === '/api/network') return route.fulfill({ json: { id: 'fixture-peer', peers: [], addresses: [] } });
      if (/^\/api\/work\/[^/]+\/messages$/.test(u.pathname)) return route.fulfill({ json: { items: [], next: null, sequence: 0 } });
      if (/^\/api\/runs\/[^/]+\/activity$/.test(u.pathname)) return route.fulfill({ json: [] });
      if (u.pathname === '/api/inference') return route.fulfill({ json: { models: [], providers: [], checked: null } });
      if (u.pathname === '/api/models' || u.pathname === '/api/curricula') return route.fulfill({ json: [] });
      if (u.pathname === '/api/operations') { const body = req.postDataJSON(); writes.push(body); return route.fulfill({ json: { request: body, state: 'succeeded', result: {} } }); }
      if (u.pathname === '/api/records') {
        const q = u.searchParams, kinds = (q.get('kind') || '').split(',');
        const rows = records.filter(r => (approachMode !== 'empty' || r.kind !== 'run') && (!q.get('kind') || kinds.includes(r.kind)) && (!q.get('scope') || r.scope === q.get('scope')) && (!q.get('owner') || r.data.owner === q.get('owner') || r.data.persona === q.get('owner')) && (!q.get('status') || r.data.status === q.get('status')) && (!q.get('query') || JSON.stringify(r.data).toLowerCase().includes(q.get('query').toLowerCase())));
        // Real list projections omit authored drafts; detail fetches restore them.
        const summaries = rows.map(r => ['work_entry', 'commitment', 'run'].includes(r.kind) ? { ...r, data: Object.fromEntries(Object.entries(r.data).filter(([key]) => !['draft', 'continuity', 'working_intent'].includes(key))) } : r);
        return route.fulfill({ json: { items: summaries, next: null, sequence: 0 } });
      }
      if (/\/records\/[^/]+\/revisions$/.test(u.pathname)) return route.fulfill({ json: { items: u.pathname.includes(id(16)) ? [records.find(r => r.id === id(16))] : [], next: null, sequence: 0 } });
      if (u.pathname === '/api/actions') return route.fulfill({ json: { items: [sampleAction], next: null, sequence: 0 } });
      if (approachMode === 'failed' && u.pathname === '/api/records/' + id(3)) return route.fulfill({ status: 503, json: { error: 'Fixture participation temporarily unavailable' } });
      if (u.pathname.startsWith('/api/records/')) { const r = records.find(x => x.id === u.pathname.split('/').at(-1)); return route.fulfill({ status: r ? 200 : 404, json: r || { error: 'Missing fixture record' } }); }
      if (u.pathname.startsWith('/api/artifacts/')) return route.fulfill({ contentType: 'text/plain', body: bytes });
      return route.fulfill({ status: 404, json: { error: 'No such fixture endpoint' } });
    });
    await page.goto(origin); await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible(); await expect(page.getByLabel('Node token')).toHaveCount(0);
    await step(`${viewport.width}: work opens in workspace`, async () => { await page.getByRole('button', { name: 'Open workspace ↗', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Fixture house', exact: true })).toBeVisible(); });
    await expect(page.getByRole('button', { name: 'Manage personas', exact: true })).toHaveCount(0);
    await step(`${viewport.width}: no invented acceptance or balance`, async () => {
      await expect(page.getByLabel('Independent work status')).toContainText('Not established');
      await expect(page.getByText('No allowance is bound.', { exact: false })).toBeVisible();
    });
    await step(`${viewport.width}: component state distinguishes configuration, usage and useful outputs`, async () => {
      const state = page.getByLabel('Component status', { exact: true });
      await expect(state).toContainText('Disabled for this work');
      await expect(state).toContainText('Selector was not called: deployment needs 65536 input + 65536 output token reservations');
      await expect(state).toContainText('Latest selector assessment: 0 match · 0 no match · 1 unknown');
      await expect(state).toContainText('$5.000000');
      await expect(state).toContainText('$0.000042');
      await expect(state).toContainText('24,000 input + 1,200 output tokens');
      await expect(state).toContainText('This work: 9,000 input + 600 output tokens');
      await expect(state).toContainText('1 with uncertain usage');
      await expect(state).toContainText('0 published versions · 0 submissions');
      await expect(state).toContainText('does not establish useful work');
    });
    for (const tab of ['Overview', 'Perspectives', 'Work & outcomes', 'People & agreements', 'Artifacts & evidence', 'Decisions & learning']) {
      await step(`${viewport.width}: ${tab}`, async () => {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#workspace-panel')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      });
    }
    await step(`${viewport.width}: authored intentions use participation records and respect work scope`, async () => {
      await page.getByRole('tab', { name: 'Perspectives', exact: true }).click();
      const approaches = page.getByLabel('Individual approaches', { exact: true });
      await expect(approaches).toContainText('Compare alternatives on a common basis.');
      await expect(approaches).toContainText('An explained comparison.');
      await expect(approaches).toContainText('Mira fixture');
      await expect(approaches).toContainText('Invite Rowan to challenge my assumptions.');
      await expect(page.locator('#workspace-panel')).not.toContainText('OTHER_WORK_PRIVATE_INTENTION');
      await approaches.getByRole('button', { name: 'View participation', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Record details', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: absent intentions do not invent character or commitments`, async () => {
      approachMode = 'empty'; await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      await page.getByRole('tab', { name: 'Perspectives', exact: true }).click();
      await expect(page.getByLabel('Individual approaches', { exact: true })).toContainText('No working intentions recorded on this page');
      await expect(page.getByLabel('Individual approaches', { exact: true })).toContainText('Trait values and activity do not supply an inferred intention.');
      approachMode = 'normal';
    });
    await step(`${viewport.width}: failed participation reads remain visible and can be retried`, async () => {
      approachMode = 'failed'; await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      await page.getByRole('tab', { name: 'Perspectives', exact: true }).click();
      const approaches = page.getByLabel('Individual approaches', { exact: true });
      await expect(approaches.getByRole('alert')).toContainText('Some participations could not be loaded.');
      await expect(approaches).not.toContainText('No working intentions');
      approachMode = 'normal'; await approaches.getByRole('button', { name: 'Try again', exact: true }).click();
      await expect(approaches).toContainText('Compare alternatives on a common basis.');
    });
    await step(`${viewport.width}: reconciled completion conditions stay visible`, async () => {
      await page.getByRole('tab', { name: 'Work & outcomes', exact: true }).click();
      const conditions = page.getByLabel('Current obligations').getByLabel('Delivery conditions');
      await expect(conditions).toContainText('Earlier resolutions need another check');
      await expect(conditions).toContainText('Delivery still has conditions');
      await expect(conditions).toContainText('Check revised dimensions');
      await expect(conditions).toContainText('Confirm site access');
      await expect(conditions).toContainText('Assumptions need new evidence');
      await expect(conditions).toContainText('Site observation changed');
      await expect(conditions).toContainText('Responsibilities need a handoff');
      await expect(conditions).toContainText('Carry the comparison forward');
    });
    await step(`${viewport.width}: offers and assumptions qualified`, async () => {
      await page.getByRole('tab', { name: 'Work & outcomes', exact: true }).click();
      await expect(page.getByLabel('Responsibilities & dependencies')).toContainText('acceptance not established');
      await expect(page.getByLabel('Conditional assumptions')).toContainText('not confirmation');
    });
    await step(`${viewport.width}: birth is not expertise`, async () => {
      await page.getByRole('tab', { name: 'People & agreements', exact: true }).click();
      await expect(page.getByLabel('Births & contributions')).toContainText('Birth is not membership');
    });
    await step(`${viewport.width}: historical acceptance unverifiable`, async () => {
      await page.getByRole('tab', { name: 'Artifacts & evidence', exact: true }).click();
      await expect(page.getByLabel('Assessments & applicability')).toContainText('unverifiable');
      await expect(page.getByLabel('Assessments & applicability').locator('.tone-neutral')).toContainText('accepted');
    });
    await step(`${viewport.width}: verified preview and focus return`, async () => {
      await page.getByLabel('Documents & files', { exact: true }).getByRole('article', { name: 'verified.txt', exact: true }).getByRole('button', { name: 'Open file ↗', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Artifact viewer', exact: true });
      await expect(dialog).toContainText('File loaded · bytes verified'); await expect(dialog.locator('.file-source')).toContainText('Exact fixture bytes');
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
      expect(await page.evaluate(() => document.activeElement?.textContent?.includes('Open file'))).toBe(true);
    });
    await step(`${viewport.width}: tampered bytes never render`, async () => {
      await page.getByLabel('Documents & files', { exact: true }).getByRole('article', { name: 'tampered.txt', exact: true }).getByRole('button', { name: 'Open file ↗', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Artifact viewer', exact: true });
      await expect(dialog.getByRole('alert')).toContainText('digest mismatch'); await expect(dialog.locator('pre')).toHaveCount(0); await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: native preview is not fetched`, async () => {
      const before = calls.filter(c => c === '/api/artifacts/' + nativeFile).length;
      await page.getByLabel('Documents & files', { exact: true }).getByRole('article', { name: 'large-native.cad', exact: true }).getByRole('button', { name: 'Open file ↗', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Artifact viewer', exact: true })).toContainText('Preview unavailable');
      expect(calls.filter(c => c === '/api/artifacts/' + nativeFile).length).toBe(before); await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: submitted documents have named Learning-style cards`, async () => {
      const library = page.getByLabel('Documents & files', { exact: true });
      await expect(library.locator('.compact-records > .content-card')).toHaveCount(4);
      const card = library.getByRole('article', { name: 'Readable house concept', exact: true });
      await expect(card).toContainText('Mira fixture'); await expect(card).toContainText('A shared baseline');
      await card.getByRole('button', { name: 'Read document ↗', exact: true }).click();
      const detail = page.getByRole('dialog', { name: 'Record details', exact: true });
      await expect(detail.getByRole('heading', { name: 'A clear plan', exact: true })).toBeVisible();
      await expect(detail.locator('strong').filter({ hasText: 'shared baseline' })).toBeVisible();
      await expect(detail.getByRole('columnheader', { name: 'Room', exact: true })).toBeVisible();
      await expect(detail.locator('.reader-prose li').filter({ hasText: 'Four bedrooms' })).toBeVisible();
      await expect(detail.locator('.reader-task[aria-label=Unchecked]')).toHaveCount(2);
      await expect(detail.locator('.reader-task[aria-label=Checked]')).toHaveCount(2);
      for (const text of ['Gather materials', 'Confirm details', 'Review notes', 'Nested check']) {
        const item = detail.locator('.reader-prose li').filter({ hasText: text }).last();
        await expect(item).not.toContainText(/\[[ xX]\]/);
      }
      await expect(detail.locator('.reader-prose')).toContainText('Ordinary [ ] text stays literal.');
      await expect(detail.locator('code').filter({ hasText: 'A code example' })).toBeVisible();
      await expect(detail.locator('.reader-context-links')).toContainText('Shared design room');
      await expect(detail.locator('.reader-fields, .reader-properties')).toHaveCount(0);
      await expect(detail.locator('.record-reader')).not.toContainText('Conceptual');
      await expect(detail.locator('.record-reader')).not.toContainText('Design details');
      await expect(detail.locator('.record-reader img, .record-reader script, a[href^="javascript:"]')).toHaveCount(0);
      expect(await page.evaluate(() => window.readerInjected)).toBeUndefined(); expect(externalReads).toEqual([]);
      await expect(detail.getByRole('button', { name: 'Technical details +', exact: true })).toHaveAttribute('aria-expanded', 'false');
      expect(await detail.locator('.drawer-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: `.qa/document-reader-${viewport.width}.png`, fullPage: true });
      await detail.getByRole('button', { name: 'Version history +', exact: true }).click();
      await detail.getByRole('button', { name: /^Version 1 ·/ }).click();
      await expect(detail.locator('.reader-history .reader-prose table')).toHaveCount(1);
      await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: assumptions show the explanation without backend fields`, async () => {
      await page.getByRole('tab', { name: 'Work & outcomes', exact: true }).click();
      await page.getByLabel('Conditional assumptions').getByRole('button', { name: 'View details ↗', exact: true }).click();
      const detail = page.getByRole('dialog', { name: 'Record details', exact: true });
      await expect(detail.locator('.record-reader')).toContainText('Not a confirmed site fact.');
      await expect(detail.getByRole('button', { name: 'Technical details +', exact: true })).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: 'Artifacts & evidence', exact: true }).click();
    });
    await step(`${viewport.width}: work details show only useful progress and controls`, async () => {
      await page.getByRole('button', { name: 'Work details & activity ↗', exact: true }).click();
      const detail = page.getByRole('dialog', { name: 'Record details', exact: true });
      await expect(detail.getByRole('heading', { name: 'Your request', exact: true })).toBeVisible();
      await expect(detail.locator('.reader-stats')).toContainText('Submitted work');
      await expect(detail.locator('.reader-stats')).toContainText('Acceptance');
      await expect(detail).not.toContainText('INTERNAL_ENVELOPE');
      await expect(detail).not.toContainText('Participant ids');
      await expect(detail.locator('.reader-fields, .reader-properties')).toHaveCount(0);
      await detail.getByRole('button', { name: 'Technical details +', exact: true }).click();
      await expect(detail.locator('pre')).toContainText('INTERNAL_ENVELOPE');
      await detail.getByRole('button', { name: 'Read the agreed scope ↗', exact: true }).click();
      await expect(detail).toContainText('Two comparable layouts');
      await expect(detail).toContainText('Show the trade-offs');
      await expect(detail).not.toContainText('INTERNAL_OUTCOME_KEY');
      await expect(detail.getByText('Kind', { exact: true })).toHaveCount(0);
      await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: proposals and responsibilities have meaningful reading views`, async () => {
      await page.getByRole('tab', { name: 'Perspectives', exact: true }).click();
      await expect(page.getByLabel('Shared opportunity board')).toContainText('Compare daylight before choosing a layout.');
      const update = page.getByLabel('Shared opportunity board').locator('.work-record').filter({ hasText: 'Compare daylight before choosing a layout.' });
      const byline = await update.locator('.work-reference').boundingBox(), readAction = await update.getByRole('button', { name: 'View details ↗', exact: true }).boundingBox();
      expect(readAction.y).toBeGreaterThan(byline.y + byline.height);
      await update.getByRole('button', { name: 'View details ↗', exact: true }).click();
      let detail = page.getByRole('dialog', { name: 'Record details', exact: true });
      await expect(detail).toContainText('Compare daylight before choosing a layout.');
      await expect(detail.getByRole('heading', { name: 'Possible drawbacks', exact: true })).toBeVisible();
      await expect(detail).toContainText('Less room for storage.');
      await expect(detail.getByText('Kind', { exact: true })).toHaveCount(0);
      await expect(detail).not.toContainText('INTERNAL_ENVELOPE');
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: 'Work & outcomes', exact: true }).click();
      await page.getByLabel('Responsibilities & dependencies').locator('.work-record').filter({ hasText: 'Unaccepted offer' }).getByRole('button', { name: 'View details ↗', exact: true }).click();
      detail = page.getByRole('dialog', { name: 'Record details', exact: true });
      await expect(detail).toContainText('Compare two layouts for daylight.');
      await expect(detail).toContainText('Explain the daylight trade-offs clearly.');
      await expect(detail).not.toContainText('INTERNAL_DRAFT');
      await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: a resolved question shows its conclusion`, async () => {
      await page.getByRole('button', { name: 'Work details & activity ↗', exact: true }).click();
      let detail = page.getByRole('dialog', { name: 'Record details', exact: true });
      await detail.getByRole('button', { name: 'Requests', exact: true }).click();
      await detail.getByRole('button', { name: /Choose a comparison basis/ }).click();
      detail = page.getByRole('dialog', { name: 'Record details', exact: true });
      await expect(detail.getByRole('heading', { name: 'Conclusion', exact: true })).toBeVisible();
      await detail.locator('.reader-related').filter({ has: page.getByRole('heading', { name: 'Conclusion', exact: true }) }).getByRole('button').click();
      await expect(detail).toContainText('Use equal floor areas for both concepts.');
      await expect(detail.getByText('Kind', { exact: true })).toHaveCount(0);
      await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: action details explain content and result without JSON tables`, async () => {
      await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      await page.getByLabel('Persona activity', { exact: true }).getByRole('button', { name: 'View details ↗', exact: true }).click();
      const detail = page.getByRole('dialog', { name: 'Record details', exact: true });
      await detail.getByRole('button', { name: 'Send a message · succeeded +', exact: true }).click();
      await expect(detail.locator('.action-reader')).toContainText('The comparison is ready to read.');
      await expect(detail.locator('.action-reader')).toContainText('To you');
      await expect(detail.getByText('Kind', { exact: true })).toHaveCount(0);
      await expect(detail.locator('.action-reader')).not.toContainText('do-not-display');
      await expect(detail.getByRole('button', { name: 'Technical action details +', exact: true })).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: 'Artifacts & evidence', exact: true }).click();
    });
    await step(`${viewport.width}: card text and reading actions align`, async () => {
      const card = page.getByLabel('Documents & files', { exact: true }).getByRole('article', { name: 'Readable house concept', exact: true });
      const summary = await card.locator('.card-summary').boundingBox();
      const action = await card.locator('.content-actions').boundingBox();
      expect(Math.abs(summary.x - action.x)).toBeLessThanOrEqual(1);
      if (viewport.width > 800) {
        const title = await card.locator('.card-title').boundingBox();
        expect(Math.abs(summary.x - title.x)).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
    await step(`${viewport.width}: detail Escape cleanup`, async () => {
      await page.getByRole('button', { name: 'Historical fixture review', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Record details', exact: true })).toContainText('Reported applicability');
      await page.keyboard.press('Escape'); await expect(page.locator('dialog')).toHaveCount(0);
    });
    await page.getByRole('tab', { name: 'Perspectives', exact: true }).click();
    await expect(page.getByLabel('Individual approaches')).toContainText('Compare alternatives');
    await page.screenshot({ path: `.qa/workspace-${viewport.width}.png`, fullPage: true });
    await step(`${viewport.width}: keyboard tabs`, async () => {
      await page.getByRole('tab', { name: 'Perspectives', exact: true }).focus(); await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('tab', { name: 'Work & outcomes', exact: true })).toBeFocused();
    });
    await step(`${viewport.width}: tools and persona creation explain funded character generation`, async () => {
      await page.getByRole('button', { name: 'Tools', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Tools', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Personas', exact: true }).click(); await page.getByRole('button', { name: '+ New persona', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Create', exact: true })).toContainText('Creating starts a funded call');
      await expect(page.getByRole('dialog', { name: 'Create', exact: true })).toContainText('Providing your own character skips generation');
      await page.keyboard.press('Escape');
    });
    await step(`${viewport.width}: no invented writes, token storage or page errors`, async () => {
      expect(writes).toEqual([]); expect(await page.evaluate(() => sessionStorage.getItem('personas-token'))).toBe(null); expect(errors).toEqual([]);
    });
    await page.close(); activePage = undefined;
  }
  await writeFile('.qa/workspace-results.json', JSON.stringify({ fixtureOnly: true, checks, result: 'passed', backend: 'mock HTTP records; no Rust or model execution' }, null, 2));
  console.log(`${checks} browser fixture checks passed.`);
} catch (error) {
  console.error(error); if (activePage) await activePage.screenshot({ path: '.qa/failure.png', fullPage: true }).catch(() => {});
  await writeFile('.qa/workspace-failure.log', String(error) + '\n' + serverLog); process.exitCode = 1;
} finally { await browser?.close(); server.kill('SIGTERM'); }
