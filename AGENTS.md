# UI repository

`ai-personas/ai-personas-ui:rewrite/design-first` owns production Preact source,
UI components, screens, styles, frontend schemas, browser tests and standalone
screen fixtures. `design/` is an illustrative preview, not a Rust runtime or
production backend integration. Keep its CommonJS test boundary separate from
the production ESM package.

Actual Rust runtime implementation and runtime tests belong to
`ai-personas/ai-personas:rewrite/design-first`. Normative design documents belong
to `ai-personas/ai-personas-design:rewrite/design-first`. Do not add implementation
or screen code to the design-documents repository. Do not copy private Rust
source or execution data into this public UI repository for testing.

Generate actual client contracts from the Rust implementation; speculative
Markdown types must not create controls that pretend backend behavior exists.
Report fixture checks, production UI checks and Rust integration separately.
