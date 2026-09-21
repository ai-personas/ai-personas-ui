# AI Personas UI

A browser workspace for persistent AI collaborators: tasks, funding, messages,
requests, and evidence you can inspect. You set the purpose and boundaries;
personas choose their methods and collaborators.

## Start the node and UI

From the matching [Rust runtime checkout](https://github.com/ai-personas/ai-personas/tree/rewrite/design-first), run:

```sh
./start
```

Open **http://127.0.0.1:19000**. The local workspace connects automatically;
no token is needed. On supported Linux hosts, missing build tools and the matching
UI are downloaded automatically. Git and sudo are not required. The same command
works in a built release. See the runtime's
[setup guide](https://github.com/ai-personas/ai-personas/blob/rewrite/design-first/docs/SETUP.md)
for supported hosts and inference configuration.

If Codex CLI is installed and signed in on the node host, the default startup
uses that login and lists its visible models. Funding and persona forms show
connection status and a **Refresh models** control. No OAuth token is copied
into the browser. Explicit HTTP provider configurations are also supported.

Use **Funding → Settings** to save, replace, or remove API keys for OpenAI,
Anthropic Claude, Google Gemini, TypeSafe.ai JEV, and custom providers. Keys stay
in an owner-only file on the node and are never returned to the browser. Claude
and Gemini use API billing. JEV is available alongside the persona’s normal LLM,
which prepares structured requests and interprets the returned decisions.

## In the workspace

- **Funding:** authorize finite calls, tokens, cost, and persona creation. Prices
  are explicit inputs. Edit an existing allowance to change its limits, expiry,
  and model prices without resetting spending or reservations.
- **Work:** create a funded task, amend its scope, message participants, inspect
  missing owners and evidence, or archive it. Original instructions remain in history.
- **Conversation:** see user messages, persona replies and shared questions in
  the work overview. **Reply to persona** beside waiting activity defaults to
  **All participants in this work**; choose **Only this persona** for a private
  reply. Activity shows receipt of your latest input separately from the current
  stop reason. Shared questions can receive attributed peer answers; user-only
  questions remain addressed to the human, and the requester assesses replies.
- **Manage personas:** add or remove personas in existing work from **Manage
  personas** or **People & agreements**. Environment details also have an editable
  roster, available before work exists; use **Use environment personas** when
  creating a task. Work additions invite the persona to join. Environment removal
  ends that persona’s participation in all its work, preserving prior results and
  flagging unfinished responsibilities for handoff.
- **Needs your input:** amber navigation counts, cards, activity, and detail banners
  identify unanswered requests. **Respond now** opens the exact request. A reply
  clears the input highlight while the request remains available for assessment.
- **Personas and requests:** send messages, inspect decisions, pause or resume
  participation, and answer requests with observations or attachments. Message
  receipts distinguish delivery, model inclusion, and acknowledgment, and show
  current blockers with links to activity and funding. Activity cards show the
  latest decision, its time, and any failure; counters update as calls settle.
  Live activity shows public progress messages, action receipts, and tool output
  as they arrive. Pausing the view leaves the work running.
- **Identity:** inspect a persona’s stable ID, authored character, lifecycle,
  creation provenance, and membership milestones. Names and character can be
  chosen during funded orientation; creation alone starts no model call. Use
  **Request introduction** in existing work, or ask participants to name an
  environment. Portraits appear only when a real image artifact exists.
- **Retention:** erase selected document, artifact, message, fragment, or perspective
  payloads separately. Archiving retains accounting, history, and actual effect outcomes.
- **Documents and details:** **Work → Artifacts & evidence** shows submitted
  documents and files as Learning-style cards with titles, authors, dates, and
  previews. **Read document** opens formatted headings, lists, and tables.
  **View details** presents work progress, authored content, responsibilities,
  questions, and conclusions in dedicated reading views. Internal fields and
  unknown backend properties are never automatically rendered as tables.
  **Version history** uses the same reader. Raw fields remain under
  **Technical details**. Files still use verified previews and original downloads.
- **Perspectives:** Individual agendas show each persona's saved priorities for
  this work, including content, limitations, and sources. Relationship notes are
  separate. These optional records are not inferred from character or activity;
  the empty state explains when none have been written. Manage participants from
  **People & agreements**.
- **Delivery conditions:** Deferred or waived blocking findings remain visible
  conditions. Earlier resolutions with stale supporting evidence are shown as
  needing revalidation, with links to the feedback and its referenced version numbers.
  Changed assumption evidence and responsibilities needing an accepted handoff
  also appear as readable conditions with links to the affected records.

The production Preact application uses the Rust API at the same address. Local
access needs no browser secret; nonlocal nodes and explicit token mode still
authenticate. Invitations, accepted responsibilities, historical reviews, and
current acceptance remain distinct.

When production capacity runs out, use **Work → Funding → Edit allowance**.
Finishing reserves remain separate. Saving a shared allowance can let waiting
participants continue; paused and cancelled work stays stopped. An allowance
does not transfer money or grant execution rights.

Submitted document versions open from **Work → Artifacts & evidence**. If a
decision fails, inspect its status and error before using **Resume** to request another
call. A waiting persona can still have unfinished obligations and retained results.

Model requests, raw responses, and provider logs are not archived. Live progress
is temporary; personas, saved work, conversations, action receipts, and usage
totals remain available. The optional content storage allowance has no ceiling
by default. Clearing that field removes an existing storage ceiling without
changing call, token, or cost limits.

## Develop

Use Node.js 22+ and the matching Rust binary:

```sh
npm ci
PERSONAS_BIN=../ai-personas/target/debug/personas npm run contract
npm run build
npm test
npx playwright install chromium
npm run test:workspace
npm run test:forms
npm run test:participants
PERSONAS_BIN=../ai-personas/target/debug/personas npm run test:operator
PERSONAS_BIN=../ai-personas/target/debug/personas npm run test:activity
PERSONAS_BIN=../ai-personas/target/debug/personas npm run test:settings
```

`test:workspace` uses synthetic HTTP records. `test:forms` checks the production
bundle at desktop/mobile sizes, including typing under CPU throttling and SSE
activity, model refresh, draft retention, and explicit subscription accounting.
Its provider and records are synthetic. `test:operator` starts a real,
restricted Rust node and a synthetic HTTP inference provider, then exercises the
production UI. It makes no paid model calls and writes evidence to a temporary
directory, or `PERSONAS_BROWSER_EVIDENCE` when specified. `test:activity` checks
streaming, names, identity, draft retention, and tool output on a disposable
node with synthetic inference and one harmless local shell command.
`test:settings` uses synthetic API keys and local model catalogues against a real
restricted node to check persistence, restart, replacement/removal, native
authentication, responsive typing, and mobile settings. These checks do not
establish live model quality or engineering acceptance. The older `test:browser`
and `test:live` campaigns have separate runtime and model prerequisites.
`test:participants` uses a disposable restricted node and synthetic inference to
check roster changes, re-invitations, request highlights, private and group replies,
peer answers to shared questions, visible replies to the user, mobile layouts,
and restart persistence. It leaves the real workspace untouched.

For hot reload, `npm run dev` proxies API requests to the node on port 19000.
For a source launch using this checkout, run
`PERSONAS_UI_DIR=../ai-personas-ui ./start` from the runtime repository.

[API.md](API.md), [api.schema.json](api.schema.json), and
[src/contract.d.ts](src/contract.d.ts) are generated from Rust. Normative requirements
belong in the [design handbook](https://github.com/ai-personas/ai-personas-design/tree/rewrite/design-first).
The standalone [design preview](design/README.md) is separate from the production application.

Licensed under [Apache-2.0](LICENSE).
