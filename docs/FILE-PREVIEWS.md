# File previews: 3D geometry and tabular data

The production `FilePreview` router now lazy-loads model and table renderers.
The artifact viewer and files selected inside existing ZIP/TAR/TAR.GZ browsing
use the same router. Existing Markdown, safe image/SVG, PDF, audio, video and
source-text readers remain in place. No dependencies or backend APIs changed.

## Supported additions

| Format | Preview scope |
| --- | --- |
| STL | Binary and ASCII triangle meshes, including binary headers beginning with `solid` |
| OBJ | Polygon geometry; positive and relative indices; concave face triangulation |
| OFF | Vertex/face geometry, with comments and optional per-face fields ignored |
| PLY | ASCII and little-/big-endian binary polygon meshes; unrelated scalar properties ignored |
| glTF / GLB | Self-contained glTF 2.0 static triangle geometry; scene hierarchy, matrix/TRS transforms, unsigned indices and interleaved positions |
| CSV / TSV | Literal accessible cells, quoted delimiters, multiline cells, escaped quotes, BOM and CRLF support; switchable source view |

3D previews deliberately show **geometry only**, not material appearance:
textures, materials, vertex colors, custom normals and animations are not
rendered. The original file is unchanged. glTF requires float VEC3 positions
and dense accessors. Skins, morph targets, required extensions, compressed
geometry, point clouds and line-only models are rejected with explanatory
errors. Export an uncompressed, static, self-contained mesh for these cases.
External buffers are never fetched. OBJ material references are never loaded.

This is not a claim to render every file format. Blender, FBX, USD, native CAD,
Office documents and other unsupported binary formats retain the existing
explicit download/open-in-application fallback. STEP/DXF and other recognized
source formats remain source text rather than pretending to be CAD renderings.

## Interaction and resource boundaries

Drag to orbit, use the labelled rotation/zoom controls, or focus the canvas and
use arrow keys, `+`/`-`, `Home` and `W`. Scroll zoom only captures wheel events
when the canvas has focus. Reset restores the fitted view. Wireframe is optional.
No autoplay or perpetual animation loop runs. ResizeObserver updates the canvas.
A missing/lost WebGL context gives an actionable message rather than a blank box.

Models are parsed in a module worker, limited to 16 MiB input, 300,000 vertices,
100,000 output triangles, 128 vertices per polygon and a ten-second wall-clock
budget. glTF buffers have a separate aggregate 16 MiB bound; scene traversal,
accessor ranges and indices are checked. These are browser preview limits, not
storage or original-download limits. Workers are terminated after completion,
error, timeout or unmount. GPU buffers, programs and shaders are disposed and
the graphics context released on unmount. No model preview uses a CDN.

Tables read at most 128 KiB through the existing encoding-aware text reader and
display at most 500 rows and 50 columns. A byte-truncated last row is omitted.
Partial previews are labelled. Row 1 stays data because headers cannot be
reliably inferred. Markup and formulas remain literal strings, never HTML or
executable spreadsheet expressions. Malformed quoting leaves source view usable.

## Validation and reproduction

Run `npm run test:previews` for the focused unit and browser suites. `npm test`
includes the unit suite, and `npm run test:workspace` includes the production
ESM component browser suite, so the existing workflow picks both up without
workflow-permission changes. Browser screenshots and results go under
`.qa/file-previews/` (or `PERSONAS_BROWSER_EVIDENCE`).

The browser fixture builds and mounts production components against synthetic
blobs; it does not create a competing implementation or contact a Rust node.
It checks lazy loading, controls, mobile layout, archive routing, cleanup,
malformed/oversized files, CSV escaping, rapid switching and WebGL failure.

At implementation time, 24 focused Node tests and strict TypeScript checks of
the parsing/renderer/worker modules passed locally. The execution environment
could not install dependencies or provide WebGL, so a complete application build
and the Preact browser suite were not claimed as locally verified. Consult the
commit's CI results for those checks. Rust integration was not run or changed.

Format references used during implementation:
- Khronos glTF 2.0 specification: https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc
- PLY format specification: https://www.paulbourke.org/dataformats/ply/
