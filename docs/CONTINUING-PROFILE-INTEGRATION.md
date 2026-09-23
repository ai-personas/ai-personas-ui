# Continuing profile integration status

This UI change is a foundation candidate, not a complete development/exploration interface or a deployed feature.

The persona creation form accepts optional narrative and numeric values, preserves zero, leaves missing values for server initialization, and defaults the self-authorship checkbox on. It requires the connected server's canonical `operations/2` creation fields before submission; an unavailable or older contract is not silently treated as support. No random values are generated in the browser.

Identity views distinguish the initial seed, current values and profile-control policy. Revision history distinguishes exact operator attribution from persona attribution and rejects inherited stamps. Operator receipt inspection verifies an actual `persona.configure` request for the selected subject rather than accepting a persona-actor update as an operator edit. Reading the views does not start inference or create background work.

Local validation executed `node --experimental-strip-types --test tests/identity.test.mjs tests/profile.test.mjs`: 51 tests passed, including 43 existing identity cases and eight new profile cases. Full TypeScript/Vite build and browser integration have not been executed in this session.

Before merge, generate `API.md`, `api.schema.json` and `src/contract.d.ts` from the matching compiled Rust contract, update fixtures and run the existing generation-diff, build and browser checks. They remain unchanged in this candidate; no handwritten replacement schema or loosened contract check is provided.

The operator configuration form, personal perspective records, exploration settings/activity, experience-review views, retained/later-used lesson evidence and behavioral evaluation are not completed here. The form explicitly leaves optional personal exploration disabled instead of presenting unsupported funding or scheduling controls. Do not package this candidate as a fully integrated release until these gates are resolved.
