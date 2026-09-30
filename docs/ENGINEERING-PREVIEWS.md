# Engineering file previews

The production `FilePreview` router lazy-loads a bounded engineering renderer
for files and entries selected through the existing archive browser. It uses
Canvas 2D, a module parsing worker and no new dependencies. There is no new API,
conversion service, script execution, machine control or Rust runtime change.

## What actually renders

| Input | Implemented view | Important limits |
| --- | --- | --- |
| `.dxf` | ASCII DXF LINE, CIRCLE, ARC and LWPOLYLINE, including signed bulges and closure; named layers | ENTITIES section only, XY outline projection in drawing units. Blocks/INSERT, legacy POLYLINE, splines, dimensions, text, fills and non-default extrusion are omitted. Omitted entities are counted. |
| `.gcode`, `.nc`, `.tap` | G0/G1 paths and G2/G3 XY circular/helical arcs; I/J or signed R; mm/inch, absolute/incremental; XY/XZ/YZ viewing projections | Restricted inspection dialect, not simulation. Defaults to XYZ 0, mm and absolute mode, disclosed on screen. G18/G19, coordinate/work offsets, compensation, canned cycles, macros, unsupported axes and unknown machine commands fail with a line-numbered error. |
| `.kicad_pcb` | Modern s-expression board outline, tracks/arcs, basic footprint graphics, pad outlines, vias, circular drill indicators and zone boundaries | 2D layout sketch, not copper plotting or DRC. Round-rect pads simplified; custom pads, slotted holes, text, images, 3D references and advanced shapes omitted. Layer groups follow file geometry; not a physical stackup simulation. |
| `.kicad_mod` | Modern footprint graphics and basic pad outlines | Same outline limitations; not a footprint verification tool. |
| `.kicad_sch` | Wires, buses, junctions, symbol/label/no-connect anchor markers and child-sheet boundaries | **Connectivity sketch only.** Full symbol graphics, text, pin connectivity and hierarchical child sheets are not rendered. Export SVG from KiCad for a complete schematic. |

Every engineering view identifies itself as partial and read-only. Arc
rendering uses bounded two-degree tessellation; display strokes can be clamped
for legibility. No sketch is suitable for manufacturing approval, machine
collision checking, electrical verification or precision measurement.

## Native application formats

This does not claim to render arbitrary file formats. Blender `.blend` remains
an explicit unsupported native project, now with actionable guidance to export
a static, uncompressed GLB, embedded glTF, OBJ or STL for the existing geometry
viewer. No Blender code or scripts are executed. STEP/IGES/FreeCAD/DWG and other
native CAD formats require a tessellated mesh or supported ASCII DXF export.
Gerber, Excellon drill programs and legacy electronics formats require the
original application or a safe SVG export. These are instructions, not buttons
pretending that an unimplemented conversion service exists.

Existing STL/OBJ/OFF/PLY/glTF/GLB, CSV/TSV, source text and media viewers are
unchanged. STEP and other previously recognized source files keep source view;
unsupported binary files keep the original download/open-in-application path.

## Interaction and safety boundaries

Drag to pan; use the labelled zoom buttons or focus the canvas and use arrow
keys, plus/minus and Home. Wheel events are captured only when the canvas has
focus. Reset restores fit and visible layers. Layer checkboxes and G-code
projection controls provide inspection views. Show source is available for
malformed inputs and unsupported dialects as well as successful drawings.

Limits: 4 MiB input, UTF-8/ASCII decoding, 100,000 generated points, 10,000 paths,
128 layer groups, 250,000 KiCad tokens and 64 nested expressions. Parsing has a
ten-second wall-clock deadline in a worker. Workers are terminated on success,
error, timeout, replacement and unmount. Canvas backing dimensions are capped
at 4096 pixels, resize observers/listeners are removed, and the backing store
is released when the drawing unmounts. There is no perpetual animation loop.
Layer names are literal Preact text, not injected HTML/SVG. No parser fetches
external models, libraries, resources or URLs.

## Validation

Run `npm run test:engineering` for the focused unit and production-component
browser suites. Engineering unit checks also run with `npm test`, and browser
checks run with `npm run test:workspace` and `npm run test:previews`, alongside
the existing suites. No workflow permissions or dependencies changed.

At implementation time, **40 focused Node tests** and strict TypeScript checks
of the new parsing/worker/Canvas renderer modules and the modified format router
passed locally. TSX/browser-file syntax was checked separately. The 12 added
Playwright checks exercise the real production ESM components with synthetic
blobs, including archive routing, controls, mobile layout, source fallback,
literal layer names, rapid switching, limits, worker cleanup and missing Canvas.
They are not a competing prototype or a live-node test.

Direct cloning failed and the app's dependencies were unavailable in the
editing environment, so a complete application build and Playwright execution were
**not verified locally**. Check the commit's CI for full application results.
No Rust implementation or Rust integration test was run or changed.

## Format references

- KiCad board format: https://dev-docs.kicad.org/en/file-formats/sexpr-pcb/
- KiCad schematic format: https://dev-docs.kicad.org/en/file-formats/sexpr-schematic/
- KiCad common s-expression syntax: https://dev-docs.kicad.org/en/file-formats/sexpr-intro/
- LinuxCNC G-code reference (the implemented subset is explicitly smaller): https://linuxcnc.org/docs/stable/html/gcode/g-code.html
