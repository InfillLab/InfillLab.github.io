# InfillLab 2

A browser-based research demonstrator for chronological transition-material allocation in a single shared-melt-path receiving layer. React, TypeScript, Vite and a local Web Worker. No server, API key or external computation service.

## Run locally

Node.js 22.12+ is required.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Open the HTTP address printed by Vite. Do not open index.html directly.

## Workflow

1. Choose one or two material labels and display colours.
2. Select one of nine reference pattern families or experimental TAII.
3. Set region size, spacing and transition volume. Advanced settings expose composition, acceptance and seeded search parameters.
4. Generate a schedule. Follow pure A, transition increments and pure B, then inspect final allocation and travel.
5. Compare all ten patterns on the Compare tab. Export CSV summaries or the complete versioned JSON.
6. Use the fixed two-segment example to compare the infeasible 14.142 mm shortcut against the feasible 28.284 mm schedule.

## Scope

The nine reference families are Concentric, Rectilinear, Monotonic, Monotonic line, Global monotonic line, Aligned Rectilinear, Hilbert Curve, Archimedean Chords and Octagram Spiral. These are simplified centreline constructions, not exact slicer replicas. Some coincide in one rectangular layer. TAII is a proposed staggered finger geometry, not experimentally proven reinforcement.

Native mode preserves each generated pattern. Equal-volume mode proportionally trims every native path to the minimum catalogue capacity. Those controlled variants can lose the full native appearance. Capacity is nominal centreline length times bead cross section; overlapping bead volumes and manufacturing feasibility are not resolved.

The composition model is an assumed monotonic power law. Windows are user-defined design constraints, not measured adhesion criteria. Allocation preserves chronology and reference-specific ordering. Unused receiver segments remain empty. Animation increments are at most Vtr/180 and preserve material accounting. Actual discard accumulates; avoided discard grows with accepted volume.

Only shared melt paths use the transition model. Separate-nozzle systems such as IDEX are excluded from multi-material calculations. Material labels do not enable hardware compatibility or mechanical property presets. There is no strength simulation, physical calibration or G-code generation.

The seeded adaptive heuristic reinforces promising path edges. It is not the canonical Slime Mould Algorithm. It prioritises coverage, then a weighted discard/travel score. All seed results are exported; the UI shows the first seed. See the in-app Methods tab for exact definitions and source links.

## Versioning and publishing

JSON schema is `infilllab/2`, model version `2.0.0`. Version 1 exports must be recreated because their geometry and multilayer assumptions differ. Imported results are discarded and recalculated.

Push main to trigger `.github/workflows/deploy.yml`, which runs tests and production build before deploying to GitHub Pages. Pages must use GitHub Actions. `node_modules` and `dist` are generated locally and excluded by `.gitignore`; neither belongs in a commit. User backup archives should not be committed.

Live site: https://infilllab.github.io/
