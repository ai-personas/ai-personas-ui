# AI Personas UI — Rust design-first

Preact UI for the Rust `rewrite/design-first` runtime, with the v1.2 design's
individual perspectives, collective commitments, consent/birth records and
version-bound evidence views. It does not select professions or prescribe a
workflow. No production fixtures or simulated personas are included.

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:workspace
```

Serve `dist/` using the matching Rust node's `--ui` option. Enter that node's token
in the connection screen; it stays in tab memory. Runtime actions and file reads
use the existing authenticated HTTP API. Development: `npm run dev`.

## Backend compatibility

The checked-in generated contract remains `ai-personas/1`. Workspaces use its
paged record API and keep existing create/message/request/run/review/upload
operations. New coordination records have explicit read-only presentation
adapters; absent backend state is displayed as not reported, never a pass.
Scope-bound acceptance, grants, protected budgets, consent, bounded births and
release sealing still need the Rust v2 authoring contract before their controls
can be enabled. This is a frontend update, not a backend implementation.

See [the implementation and verification boundary](docs/RUST-V1.2-UI.md) and
[the generated HTTP contract](API.md). Regenerate types only from the matching
Rust binary:

```sh
PERSONAS_BIN=../ai-personas/target/release/personas npm run contract
```

`npm run test:workspace` uses a synthetic HTTP fixture, with no models or Rust
process. The existing `test:browser` and `test:live` have separate runtime/model
prerequisites and must be rerun with the matching Rust node; fixture success is
not evidence that those campaigns passed. CI uploads fixture screenshots and
results, not engineering acceptance evidence.


## Standalone design references

The screen fixture now lives in [design/](design/README.md), with
[relocation provenance](docs/PREVIEW-MIGRATION.md). It is separate from
the production Preact application. Rust implementation belongs to
`ai-personas/ai-personas`; normative documentation belongs to
`ai-personas/ai-personas-design`, all on `rewrite/design-first`.
