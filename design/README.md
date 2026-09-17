> Relocated from `ai-personas-design@9b1fd0a82ee4c5c6eb6f87aac4f2f9495f14d41d`. Browser scripts, styles, markup and fixture tests are byte-identical. A local CommonJS package boundary preserves Node test behavior inside the ESM UI repository. Production Preact source is unchanged.

# AI Personas visual design preview

[UI specification](https://github.com/ai-personas/ai-personas-design/blob/rewrite/design-first/technical/UI.md) · [Canonical Rust specification](https://github.com/ai-personas/ai-personas-design/blob/rewrite/design-first/technical/SPEC.md) · [Implementation status](https://github.com/ai-personas/ai-personas-design/blob/rewrite/design-first/STATUS.md) · [Seven-screen reviewer](references.html)

This is an interactive reference for the seven supplied designs. It is intentionally independent of the production Preact UI and Rust node. It runs no personas, models, simulations, installations or external actions, and stores nothing outside the current page's memory.

## Open it

From the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/design/references.html` to review all seven references, or `http://127.0.0.1:8080/design/index.html` for the application itself. No npm installation or build is needed. The source uses only local HTML, CSS and JavaScript, system fonts, initials and inline line icons. GitHub's file viewer displays source; it is not a deployed application.

The reviewer creates one isolated, interactive frame at the selected reference width and scales it to fit. Switching references disposes the previous frame and its in-memory edits. The full-size link opens the normal fixture in a new tab. These are renders of the fixture, not copies of the original PNGs or a claim of pixel-identical reproduction.

| Route after `index.html` | View |
|---|---|
| `#/work` | Desktop/mobile Work overview, search, filters and response dialog |
| `#/personas` | Continuing persona cards and local presentation drafts |
| `#/persona/mira` | Character, current attention, retained experience and explicit absence of capability/model evidence |
| `#/work/home` | Work detail with all six canonical views |
| `#/environments` | Compact environment references |
| `#/learning` | Attributed illustrative notes and their limitations |
| `#/settings` and `#/tools` | Explicit unconnected state; no fake authorization or installation controls |
| `#/workspace/house/3` | Evolving-work reference with the model-change/stale-evidence snapshot |
| `#/workspace/dataset/3` | Same renderer, one-person/no-birth example |
| `#/workspace/story/3` | Same renderer, creative work and author acceptance |

For the mobile information-request screen, open `index.html?preview=request#/work`. This allowlisted option opens only the illustrative information dialog. It cannot dispatch arbitrary actions, resolve a question, or grant authority. The Skip to content link preserves the application's hash route while moving keyboard focus to the main region.

## What the interactions mean

Search and filters operate on the local records. New work records an unowned draft; it does not recruit people. New persona creates a presentation draft with no invented biography, learning or real birth. Pause/resume changes a preview activity label only. Recording an answer changes an open request to **answered**, never resolved or approved. Reload or an explicitly confirmed reset restores the starting records.

The scoped-approval dialog is explanatory only and has no Approve control. There is no artifact download because this fixture contains no native artifacts. Replay buttons select authored snapshots; they do not launch a simulation or prescribe a runtime workflow. Calls are illustrative root allowances, not dollars or quality percentages. Protected closeout is unknown where not supplied.

The FINAL family defines the application shell. The WORKSPACE family defines the standalone evolving-work composition. The six-view detail and explicit authored-priority labels are deliberate refinements explained in [UI.md](https://github.com/ai-personas/ai-personas-design/blob/rewrite/design-first/technical/UI.md). Tools is grouped under Settings in the pictured compact fixture only; its first-class production destination remains specified.

## Source provenance and capture dimensions

[Source image fingerprints](source-images.json) identify the seven original user-supplied PNGs by exact filename, dimensions, byte size and SHA-256. This manifest does not reclassify screenshots as generated persona portraits or runtime evidence. The original attachments are not fetched from an external service by the prototype.

[Reference definitions](reference-screens.js) map every source image to its local route and review viewport. Source canvas height is not assumed to be browser viewport height: a full-page capture may be taller. The request case deliberately captures a 390 × 1100 viewport instead of reproducing the supplied full-page screenshot's visible content below the modal backdrop. The narrow replay remains 266 px wide, with a full-page QA capture.

The Rust-only v1.2 specification supersedes v1.1 and the older proposals for behavior. The [existing canonical repository specification](https://github.com/ai-personas/ai-personas-design/blob/rewrite/design-first/technical/SPEC.md) is retained, not replaced by a screenshot interpretation. No runtime or sibling UI repository is modified by this preview.

## Validate

The state and reference suites need Node.js 22, with no packages:

```sh
for file in design/*.js; do node --check "$file"; done
node --test tests/*.test.cjs
```

The browser suites use Python Playwright and Chromium. CI pins Playwright 1.57.0 for reproducibility. Install it in your preferred isolated Python environment and install its Chromium, then run:

```sh
python3 -m pip install playwright==1.57.0
python3 -m playwright install chromium
python3 tests/browser_design.py
python3 tests/browser_reference.py
# Or use an existing Chromium executable:
python3 tests/browser_reference.py --chromium /path/to/chromium
# Optional output location:
python3 tests/browser_reference.py --output .qa/reference-screens
```

The original browser harness injects the checked-in HTML/CSS/JS into an empty page. It covers 266, 320, 390, 700, 768, 1024 and 1440 px viewports, eight routes, request state, literal hostile-looking text, modal focus, short-viewport scrolling, filters/caret, drafts, keyboard tabs, replay and non-granting approval previews. Results are written to `.qa/design-browser-checks.json`.

The additional reference harness serves the actual repository from a temporary loopback HTTP server. It loads all seven reference states, captures their screenshots, checks route-preserving skip links, exercises the request deep link and answered-not-resolved behavior, and switches all seven isolated frames at 1440, 390 and 266 px outer widths. It rejects external requests, browser errors and missing page assets. Results and captures are written to `.qa/reference-screens/` and uploaded by the visual-reference CI job. It does not perform pixel-difference comparisons with the original PNGs.

Design-document validation tooling belongs to `ai-personas/ai-personas`, under `tools/design_docs`; it is not part of this UI fixture.

[verification.json](verification.json) retains the original publication's verification history. New CI run artifacts record the added checks for their exact commit. Fixture checks are not Rust protocol tests, live behavioral evaluation, a complete accessibility audit or proof that all browser resources are leak-free.
