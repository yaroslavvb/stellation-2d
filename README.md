# Stellation & Facetting 2D

An interactive, one-dimension-lower counterpart to Vladimir Bulatov's stellation app, with separate polar-dual construction modes.

## Modes

- **Stellation** (default) extends a regular polygon's sides to infinite lines and combines the bounded cells they create. New vertices appear where extended sides meet.
- **Facetting** keeps the polygon's original vertices fixed and reconnects them into closed `{n/k}` chord circuits. Chord crossings are not vertices.

The polygon and current mode are shareable in the URL. Switching modes preserves each mode's independent construction.

## Stellation explorer

- A regular polygon's sides are extended to infinite lines.
- The resulting bounded planar cells are grouped into cyclic or dihedral symmetry orbits.
- The selected cell union is shown in the main 2D view.
- A true one-dimensional arrangement along one side appears directly beneath it.
- Shift and Control/Option gestures expose the relation between individual orbits and their lower support closure.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm test
npm run build:pages
```

`npm run build:pages` creates the static `out/` tree used by GitHub Pages. The workflow in `.github/workflows/deploy-pages.yml` publishes it from `main`.

## Dimensional correspondence

This project reduces the original app by one dimension:

| Original stellation app | 2D Stellation |
| --- | --- |
| polyhedron faces | polygon sides |
| planes in 3D | lines in 2D |
| bounded 3D cells | bounded 2D cells |
| 3D solid view | 2D selected-cell view |
| 2D stellation diagram | 1D segmented-line diagram |

In Facetting mode, an edge step `k` connects every original vertex `i` to `i + k`. Coprime steps form one star circuit; non-coprime steps form a compound of closed circuits. The even diameter step is excluded because it does not close into polygonal circuits.

The 3D reference app is available at <https://yaroslavvb.github.io/stellation/>.
