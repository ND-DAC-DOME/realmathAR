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
```

- There are no tests, linter, or formatter configured. (Stray `eslint-disable` comments are left over from an earlier setup.)
- AR needs a phone camera and HTTPS. `vite.config.js` allows `.ngrok-free.dev` hosts, so tunnel the dev server with ngrok to test on a device.
- Deploys to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`.

## Runtime flow

```
index.html
  ├─ <script src="xr/xr.js">        8th Wall engine, self-hosted from public/xr/ (copied verbatim to dist/)
  ├─ XRExtras + LandingPage          from jsDelivr CDN
  └─ src/app.js                      waits for `xrloaded`, registers camera pipeline modules, XR8.run()
       └─ src/threejs-scene-init.js  initScenePipelineModule(): onStart builds the scene + GUI
            ├─ Parser()              src/input-processing/Parser.js   URL -> JSON (or defaults)
            ├─ Processor(json)       src/input-processing/Processor.js JSON -> [[name, component], ...]
            │    └─ GeometryContainer(type, props)  src/geometry-gen/GeometryContainer.js
            └─ GuiInit(folder, component)  per-component lil-gui controls
```

### Input format (Parser.js)

The input JSON is URL-encoded in the `eqs` query parameter (`<app url>?eqs=<encodeURIComponent(json)>`). The legacy format, with the encoded JSON appended right after `https://ndlearning.8thwall.app/realmath/`, is still accepted. The page that generates these URLs lives elsewhere, not in this repo. If there is no input or it fails to parse, Parser returns the hard-coded `defaults` object.

The first word of each key sets the component type (`"Func 1"`, `"Vec 2"`, etc.):

| Key prefix | Value shape | Type int | Class/factory |
|---|---|---|---|
| `Func` | `{left, right}`: implicit surface `left = right` in x,y,z | 0 | `complex-geometry/FunctionClass.js` (marching cubes) |
| `Pt` | `{x, y, z}` | 1 | `base-geometry/Point.js` |
| `Vec` | `{vec: {x,y,z}, init: {x,y,z}}` | 2 | `base-geometry/Vector.js` (Line2 shaft + cone head) |
| `VFld` | `{x, y, z}`: field components in x,y,z | 3 | `complex-geometry/VectorFieldClass.js` |
| `SCrv` | `{x, y, z}`: parametric in t | 4 | `complex-geometry/SpaceCurveClass.js` |

LaTeX in the URL writes `//` where it means `\` (for example `//left(x+1//right)^2`). Processor converts `//` back to `\` before passing the string to `@cortex-js/compute-engine`'s `parse()`. `EquationHelper` appends `+(0*x)+(0*y)+(0*z)` (or `+(0*t)`) so every expression references every variable.

### Expression evaluation

Expressions are evaluated with compute-engine's **global** `assign('x', v)` followed by `expr.evaluate()`, and the result is stringified and then converted with `Number()`. Each evaluation costs about 0.02 ms in Node. Nested loops over these calls are where load time goes.

### Component contract

Every component returned by `GeometryContainer` has:
- `out`: the `THREE.Object3D` (usually a `Group`) that gets added to the scene
- `type`: the int above, which `GuiInit` uses in a `switch`

Class-based components extend `GeometryParent`, which provides `scale` (default 10, max 75), `size = scale + 20` (marching-cubes grid resolution), `eqs`, `out`, and `checkRedundant()`. The class also exposes arrow-function callbacks that the GUI calls:
- `Function.functionCallback()`: rebuilds the mesh when `scale` changes
- `SpaceCurve.curveCallback()` rebuilds the curve when `scale` changes; `tCallback()` moves the point to `t`
- `VectorField.vecsCallback(coord)`: re-selects cached arrows when `slices.{x,y,z}` changes

Point and Vector are still plain factories that return `{out, type}`.

**To add a component type:** add a `Process*` function and a `case` in `Processor.js`, a `case` in `GeometryContainer.js`, and a `case` in `GuiInit` in `threejs-scene-init.js`. Return an object with `out` and `type`.

## Coordinate conventions (inconsistent, so check before changing)

- `app.js` sets `THREE.Object3D.DEFAULT_UP = (0,0,1)`, and the camera's `up` is set to z.
- `Processor.js` says "FOR ALL, YOU MUST SWITCH Y AND Z SINCE 8TH WALL TREATS Y AS UP AXIS". Not every component follows this:
  - swapped: Vec (in Processor), Function vertices, SpaceCurve curve points, `SpaceCurve.tCallback`
  - **not swapped:** Pt, the initial SpaceCurve point at t=0, VectorField positions (only its colors are swapped)

Decide on one convention before fixing individual cases.

## Vendored 8th Wall engine

`public/xr/` is the self-hosted 8th Wall engine (the `dist/` of the `@8thwall/engine-binary` npm package). `XR8.Threejs` expects three.js on `window.THREE`, which `app.js` sets. To update the engine, replace `public/xr/` with a newer package's `dist/`.

## Known issues / gotchas

- Vite `base` is `/realmathAR/` to match the GitHub Pages path. Change it if you host somewhere else.
- **Vector field load time** (the open TODO from the last commit): the `VectorField` constructor eagerly builds every arrow on a 750³ grid (`(MAXSIZE*2)/STEP` per axis). That is about 4×10⁸ points × 3 evaluations, so it never finishes. Other VectorField problems:
  - `getVecs()` is never called in the constructor, so nothing appears until a slider moves.
  - `getVecs()` indexes from the grid corner (-75), not the origin.
  - Arrows are positioned at the field *value* (`init: dir`) instead of the grid point.
  - There's a typo, `this.vecsize`, where `this.vecSize` was meant.
- `animate()` in `threejs-scene-init.js` calls `renderer.render()` with no arguments, which will throw. XR8's pipeline already renders every frame, so it is probably unnecessary.
- `SpaceCurveClass.js` imports `Line2` from `three/examples/jsm/lines/webgpu/Line2.js` but uses the WebGL `LineGeometry`/`LineMaterial`. `Vector.js` uses the WebGL `Line2`.
- `Point` ignores its `color` prop and is always yellow.
- `Vector` arrow length is `init.distanceTo(vec)` while `vec` is used as a direction, so it's unclear whether `vec` means a direction or an endpoint.
- `MarchingCubes.js` keeps `size`/`scale` as mutable module-level state. Its cost grows with `size³`: about 27k evaluations at the default and about 860k at max scale.
- The marching-cubes and lookup-table code is adapted from MIT-licensed tamani-coding and from stemkoski/Paul Bourke. Keep those attribution headers.
- `public/xr/` is the 8th Wall / Niantic XR Engine under its own license (`public/xr/LICENSE`). Don't edit it.

## Style

Plain ES modules with no TypeScript and no semicolons in most files. Comments use `/* ... */`, and indentation is 4 spaces, except `app.js` and `threejs-scene-init.js`, which use 2. three.js imports are named imports from `'three'`, and addons come from `'three/examples/jsm/...'`. Match the file you're editing.
