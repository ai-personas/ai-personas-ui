# AI Personas UI

A browser workspace for persistent AI collaborators: tasks, funding, messages,
requests, and evidence you can inspect. You set the purpose and boundaries;
personas choose their methods and collaborators.

## Start the node and UI

From the matching [Rust runtime checkout](https://github.com/ai-personas/ai-personas/tree/rewrite/design-first), run:

```sh
./start
```

The same command works in a built release. Open **http://127.0.0.1:19000** and
enter the node's token. See the runtime's
[setup guide](https://github.com/ai-personas/ai-personas/blob/rewrite/design-first/docs/SETUP.md)
for prerequisites and inference configuration.

## In the workspace

- **Funding:** authorize finite calls, tokens, cost, and persona creation. Prices
  are explicit inputs; an allowance does not transfer money or grant execution rights.
- **Work:** create a funded task, amend its scope, message participants, inspect
  missing owners and evidence, or archive it. Original instructions remain in history.
- **Personas and requests:** send messages, inspect decisions, pause or resume
  participation, and answer requests with observations or attachments.
- **Retention:** erase selected document, artifact, message, fragment, or perspective
  payloads separately. Archiving retains accounting, history, and actual effect outcomes.

The production Preact application uses the authenticated Rust API. Its token stays
in tab memory. Invitations, accepted responsibilities, historical reviews, and
current acceptance remain distinct.

## Develop

Use Node.js 22+ and the matching Rust binary:

```sh
npm ci
PERSONAS_BIN=../ai-personas/target/debug/personas npm run contract
npm run build
npm test
npx playwright install chromium
npm run test:workspace
PERSONAS_BIN=../ai-personas/target/debug/personas npm run test:operator
```

`test:workspace` uses synthetic HTTP records. `test:operator` starts a real,
restricted Rust node and a synthetic HTTP inference provider, then exercises the
production UI. It makes no paid model calls and writes evidence to a temporary
directory, or `PERSONAS_BROWSER_EVIDENCE` when specified. These checks do not
establish live model quality or engineering acceptance. The older `test:browser`
and `test:live` campaigns have separate runtime and model prerequisites.

For hot reload, `npm run dev` proxies API requests to the node on port 19000.
For a source launch using this checkout, run
`PERSONAS_UI_DIR=../ai-personas-ui ./start` from the runtime repository.

[API.md](API.md), [api.schema.json](api.schema.json), and
[src/contract.d.ts](src/contract.d.ts) are generated from Rust. Normative requirements
belong in the [design handbook](https://github.com/ai-personas/ai-personas-design/tree/rewrite/design-first).
The standalone [design preview](design/README.md) is separate from the production application.

Licensed under [Apache-2.0](LICENSE).
