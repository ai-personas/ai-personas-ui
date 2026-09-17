# Existing preview relocation

The standalone `design/` preview and its four tests were copied from
`ai-personas/ai-personas-design@9b1fd0a82ee4c5c6eb6f87aac4f2f9495f14d41d`.
This is a relocation, not a UI redesign, production integration, or Rust
implementation. Original code and evidence remain in Git history.

`design/migration.json` records original copied hashes before README link
adjustments. Browser source and tests are unchanged. `design/package.json`
preserves the CommonJS boundary expected by the existing Node tests without
changing the production ESM package. The temporary migration workflow is
removed after the checked relocation.

Run from the UI root:

```sh
node --test tests/design-state.test.cjs tests/reference-screens.test.cjs
python3 tests/browser_design.py
python3 tests/browser_reference.py
```

Browser tests need Python Playwright and Chromium. They test illustrative
fixtures, not real personas or engineering results.
