# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo.

## What this is

**realmathAR** is a web AR graphing tool for multivariable calculus. You pass it a set of math objects (implicit surfaces, points, vectors, vector fields, space curves) as LaTeX in the URL. It builds three.js geometry for them and places that geometry in the room with 8th Wall world tracking (SLAM). A lil-gui panel adjusts ranges, colors, visibility, and the curve parameter `t`.

The project was forked from 8th Wall's `threejs-world-effects-example` template (`src/app.js`'s pipeline setup still comes from it). A student worker wrote it, and it is mid-refactor: functional modules are being converted to classes.

## Commands

```bash
npm install
npm run serve      # vite dev server at http://localhost:5173/realmathAR/
npm run build      # production build -> dist/
npm run preview    # serve dist/
npm run deploy     # build + push dist/ to the gh-pages branch (GitHub Pages)
npm test           # vitest, runs headless in Node (tests/)
```

- Tests in `tests/` cover parsing, evaluation, and geometry building (no AR or rendering). Add a test when you fix a math or geometry bug. There's no linter or formatter. (Stray `eslint-disable` comments are left over from an earlier setup.)
- AR needs a phone camera and HTTPS. `vite.config.js` allows `.ngrok-free.dev` hosts, so tunnel the dev server with ngrok to test on a device.
- Deployment is manual on purpose: there's no CI, and the maintainers want to keep it that way. `npm run deploy` publishes to GitHub Pages (Settings → Pages must be set to serve the `gh-pages` branch). Long-term hosting is still undecided, so `dist/` from `npm run build` can go on any static host.

## Runtime flow

```
index.html
  ├─ <script src="xr/xr.js">        8th Wall engine, self-hosted from public/xr/ (copied verbatim to dist/)
  ├─ XRExtras + LandingPage          from jsDelivr CDN
  └─ src/app.js                      waits for `xrloaded`, registers camera pipeline modules, XR8.run()
       └─ src/threejs-scene-init.js  initScenePipelineModule(): onStart builds the scene + GUI
            ├─ Parser()              src/input-processing/Parser.js    URL -> {inputs, error} (defaults if missing/invalid)
            ├─ Processor(inputs)     src/input-processing/Processor.js -> {components: [[name, component]], errors: [{name, message}]}
            │    └─ GeometryContainer(type, props)  src/geometry-gen/GeometryContainer.js
            └─ GuiInit(folder, component)  per-component lil-gui controls
```

### Input format (Parser.js)

The input page is the separate `ND-DAC-DOME/realmath` site (https://nd-dac-dome.github.io/realmath/). It sends `?z=<lz-string compressToEncodedURIComponent(json)>`, with components grouped by type (`{"Func": {"Func 1": {...}}}`). `Parser` decompresses that payload and flattens it. A hand-written `?eqs=<encodeURIComponent(json)>` with flat keys also works, as does the legacy format (encoded JSON appended right after `https://ndlearning.8thwall.app/realmath/`). If you change the payload shape, change both repos. If there is no input or it fails to parse, Parser falls back to the hard-coded `defaults` (and returns an `error` for bad JSON).

The first word of each key sets the component type (`"Func 1"`, `"Vec 2"`, etc.):

| Key prefix | Value shape | Type int | Class/factory |
|---|---|---|---|
| `Func` | `{left, right}`: implicit surface `left = right` in x,y,z | 0 | `complex-geometry/FunctionClass.js` (marching cubes) |
| `Pt` | `{x, y, z}` | 1 | `base-geometry/Point.js` |
| `Vec` | `{vec: {x,y,z}, init: {x,y,z}}` | 2 | `base-geometry/Vector.js` (Line2 shaft + cone head) |
| `VFld` | `{x, y, z}`: field components in x,y,z | 3 | `complex-geometry/VectorFieldClass.js` |
| `SCrv` | `{x, y, z}`: parametric in t | 4 | `complex-geometry/SpaceCurveClass.js` |

LaTeX in the URL writes `//` where it means `\` (for example `//left(x+1//right)^2`). Processor converts `//` back to `\` before passing the string to `@cortex-js/compute-engine`'s `parse()`. `ParseEquation` appends `+(0*x)+(0*y)+(0*z)` (or `+(0*t)`) so every expression references every variable. Invalid LaTeX doesn't throw in compute-engine (it returns an expression with `isValid === false`), so `ParseLatex` checks validity and throws. `Processor` catches per component, and the errors appear in an "Input Errors" GUI folder. `Pt`/`Vec` coordinates must evaluate to finite constants.

### Expression evaluation

`Processor` compiles every equation once with compute-engine's `compile()` (`CompileFunction` in `src/input-processing/Evaluate.js`) into a plain JS function: `f({x, y, z})` for surfaces and fields, `f({t})` for curves. That makes evaluation about 150× faster than evaluating through compute-engine at each sample. Point and vector coordinates are constants and use `EvaluateNumber`, which calls `.N()`. Both helpers return NaN where the result is undefined or complex.

**Never call compute-engine's `assign()`.** `compile()` bakes globally assigned values into the code as constants, so one stray `assign('x', …)` silently breaks every function compiled after it. Tests included.

### Component contract

Every component returned by `GeometryContainer` has:
- `out`: the `THREE.Object3D` (usually a `Group`) that gets added to the scene
- `type`: the int above, which `GuiInit` uses in a `switch`

Class-based components extend `GeometryParent`, which provides `scale` (default 10, max 75), `size = scale + 20` (marching-cubes grid resolution), `eqs` (compiled functions), `out`, and `checkRedundant()`. Their arrow-function callbacks are called by the GUI:
- `Function`:
  - `functionCallback()` rebuilds the mesh when `scale` (the GUI's "window width") changes.
  - `setFocus(v)` resamples the window around the focal point.
  - `focusTarget()` returns the drawn surface's center.
  - `lowColor`/`highColor` are the gradient colors, shared with the shader uniforms.
- `SpaceCurve`:
  - `tRangeCallback()` redraws for t in [−`tRange`, `tRange`] (default 10, max 100).
  - `tCallback()` moves the point to `t`.
  - `focusTarget()` returns the point's position.
- `VectorField`:
  - `vecsCallback(coord)` re-lays-out arrows when `slices.{x,y,z}` (arrows per side of the center, 0–10) changes.
  - `setFocus(v)` re-centers the grid on the grid point nearest the focal point.
  - All arrows are drawn by one `InstancedMesh`, and field values are cached per absolute grid point.

Point and Vector are still plain factories that return `{out, type}`.

**To add a component type:** add a `Process*` function and a `PROCESSORS` entry in `Processor.js`, a `case` in `GeometryContainer.js`, and a `case` in `GuiInit` in `threejs-scene-init.js`. Return an object with `out` and `type`.

## Viewer controls (`threejs-scene-init.js`)

Scene graph: `scene` > `mathSpace` (rotated into Y-up, scaled by the global scale) > `focusGroup` (positioned at −focus) > axes + `Components` > one wrapper `Group` per component > `component.out`.

- **Global scale:** 0.05–3×, set by the slider or a two-finger pinch on the canvas. A quick single-finger tap recenters the AR anchor.
- **Focal point:** x/y/z sliders, plus a "center on" dropdown that snaps to a point, a vector's start, a curve's current point, or a surface's center. While a slider is dragging, content only translates. When the drag ends, components with `setFocus` (surfaces, vector fields) resample around the new focal point. A surface is drawn only inside its window around the focal point, so moving far away can make a surface leave its window; raise that surface's "window width" to bring it back.
- **Per component:** visibility and "display size" (0.1–3×). Display size scales the component's wrapper about the focal point, so it changes how large the component looks, not its math.

## Coordinate conventions

All geometry is built in **math coordinates (z up)**. Don't swap axes inside components. In `threejs-scene-init.js`, the components and the axes sit in a `mathSpace` group rotated −90° about x. That group maps math (x, y, z) to scene (x, z, −y) in 8th Wall's Y-up world, and because it's a rotation, handedness is preserved. The floor grid sits outside that group so it stays horizontal.

## Vendored 8th Wall engine

`public/xr/` is the self-hosted 8th Wall engine (the `dist/` of the `@8thwall/engine-binary` npm package). `XR8.Threejs` expects three.js on `window.THREE`, which `app.js` sets. To update the engine, replace `public/xr/` with a newer package's `dist/`.

## Known issues / gotchas

- Vite `base` is `/realmathAR/` to match the GitHub Pages path. Change it if you host somewhere else.
- XR8's three.js pipeline module renders every frame, so components never need to call `renderer.render()` after changing.
- `Vec` means displacement: the arrow's tail is at `init` and its tip at `init + vec`.
- Ranges are inconsistent. A surface's `scale` covers [−scale/2, scale/2], while a space curve's covers t ∈ [−scale, scale]. The GUI labels both "axis +-range".
- Marching cubes cost grows with `size³` (`size = scale + 20`): about 27k evaluations at the default and about 860k at the max scale of 75.
- Import three.js add-ons by their specific path (for example `three/examples/jsm/lines/Line2.js`), not from `Addons.js`, which pulls in every add-on. Use the WebGL versions of add-ons, not the `webgpu/` ones.
- The marching-cubes and lookup-table code is adapted from MIT-licensed tamani-coding and from stemkoski/Paul Bourke. Keep those attribution headers.
- `public/xr/` is the 8th Wall / Niantic XR Engine under its own license (`public/xr/LICENSE`). Don't edit it.

## Style

Plain ES modules with no TypeScript and no semicolons in most files. Comments use `/* ... */`, and indentation is 4 spaces, except `app.js` and `threejs-scene-init.js`, which use 2. three.js imports are named imports from `'three'`, and addons come from `'three/examples/jsm/...'`. Match the file you're editing.
