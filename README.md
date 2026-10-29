# RealMath AR

Web AR graphing for multivariable calculus. Pass in surfaces, points, vectors, vector fields, and space curves as LaTeX, and they're placed in the room around you using [8th Wall](https://8thwall.org/) world tracking and [three.js](https://threejs.org/). An on-screen panel controls ranges, colors, visibility, and the curve parameter `t`.

## Usage

Open the app with an `eqs` query parameter containing URL-encoded JSON:

```
https://nd-dac-dome.github.io/realmathAR/?eqs=<encodeURIComponent(JSON)>
```

Each key's first word picks the object type:

```json
{
  "Func 1": {"left": "x^2+y^2", "right": "z"},
  "Pt 1":   {"x": "1", "y": "1", "z": "1"},
  "Vec 1":  {"vec": {"x": "0", "y": "0", "z": "1"}, "init": {"x": "0", "y": "0", "z": "-1"}},
  "SCrv 1": {"x": "//cos//left(t//right)", "y": "//sin//left(t//right)", "z": "0.1t"},
  "VFld 1": {"x": "x-xy", "y": "x-y", "z": "0"}
}
```

| Prefix | Meaning |
|---|---|
| `Func` | implicit surface `left = right` in x, y, z |
| `Pt` | point |
| `Vec` | vector `vec` starting at `init` |
| `SCrv` | parametric space curve in `t` |
| `VFld` | vector field in x, y, z |

LaTeX backslashes are written as `//` (e.g. `//left(x+1//right)^2`). Without an `eqs` parameter a built-in example is shown. The legacy format (`https://ndlearning.8thwall.app/realmath/<encoded JSON>`) is still accepted.

## Development

```bash
npm install
npm run serve     # dev server at http://localhost:5173/realmathAR/
npm run build     # production build -> dist/
npm run preview   # serve the production build
```

AR needs a phone camera over HTTPS. Tunnel the dev server (e.g. with ngrok; `.ngrok-free.dev` hosts are allowed in `vite.config.js`) and open it on a device. See [testing on mobile](https://8th.io/test-on-mobile).

See [AGENTS.md](./AGENTS.md) for architecture notes and known issues.

## Deployment

Pushing to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Credits

- Started from 8th Wall's [three.js World Effects example](https://github.com/8thwall/threejs-world-effects-example).
- The 8th Wall XR Engine in `public/xr/` is distributed under its own license (`public/xr/LICENSE`). XRExtras and the landing page load from jsDelivr.
- Marching cubes code adapted from [tamani-coding](https://github.com/tamani-coding/threejs-marching-cubes-example) (MIT) and [stemkoski](https://github.com/stemkoski/stemkoski.github.com); lookup tables from Paul Bourke via three.js.
- Math parsing and evaluation by [Cortex Compute Engine](https://cortexjs.io/compute-engine/).
