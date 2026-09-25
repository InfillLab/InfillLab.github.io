# Verification record

Version 1.0.0, 25 September 2026.

- TypeScript compilation and Vite production build passed.
- All 12 model tests passed under Vitest 4.1.11.
- Dependency audit reported zero known vulnerabilities at installation time.
- Browser checks covered default calculation, benchmark comparison, parameter changes, zero-assignment case, start/pause controls, track inspection, methods and references.
- At a 390 px viewport the document had no horizontal overflow.
- Production preview loaded and completed worker calculations.
- JSON, CSV and SVG were downloaded through the production UI and parsed successfully. The default JSON contained three compared methods; CSV contained three comparisons and three replicate rows.

## Numerical checks

The exact two-track case gives 12 mm3 allocated, 0 mm3 discarded and 28.284271 mm travel. The forward raster gives 84.852814 mm travel. These are idealised mathematical results, not experimental measurements.

Tests cover the volume upper bound, conservation, both switch directions and nonlinear composition curves, inverse composition, layer precedence, insufficient volume, seed repeatability, benchmark normalisation and rejection of invalid imports. Chevron spacing below twice bead width is rejected to prevent adjacent-path overlap in the simplified geometry.

## Limits

No real-printer validation, mechanical validation or live GitHub deployment was performed. Browser checks are a manual smoke test, not a complete cross-browser accessibility certification. The application must not be used to claim improved material strength without independent evidence.

## Simplified workspace update

- Main workspace uses material dialogs, three basic sample controls and collapsed advanced sections.
- Added smooth schematic deposition on a rotatable projected build plate, custom filament colours, single-material mode, PNG export and colour metadata in JSON exports.
- 14 model tests pass, including complete single-material allocation without transition waste and compatibility with older JSON configurations.
- Production build passed. Browser checks verified single-material execution, addition of a second material, colour selection, rerunning, comparison and collapsed settings.
- At a 390 px mobile viewport there was no document overflow, and the material dialog remained usable. No browser console errors were observed.
- Playback speed is illustrative, not physical print time. Layer height is exaggerated by four in perspective view.
