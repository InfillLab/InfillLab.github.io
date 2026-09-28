# Verification record

Model 2.0.0, 28 September 2026.

## Automated checks

18 Vitest tests cover the eight-schedule exact benchmark, volume conservation and upper bounds, forward/reverse composition and nonlinear inverse curves, deterministic seeded search, replicate reporting, input validation, single-material allocation, all ten pattern geometries, predecessor constraints, equal nominal capacity, and live accounting at intermediate playback positions.

The exact feasible benchmark allocates 12 mm3, discards 0 mm3 and travels 28.284271 mm. The shorter B-first geometric route is rejected. These are mathematical results, not experimental measurements.

TypeScript and Vite production build are checked before deployment. GitHub Actions repeats tests and build.

## Limits

Patterns are simplified centreline models; bead overlap and physical clearance are not validated. Equal-capacity comparisons trim native paths. Mechanical properties, material compatibility and real printer behaviour remain unvalidated. Browser checks are smoke tests, not a full accessibility or cross-browser certification.

## Browser checks

The desktop UI completed the default study and ten-pattern comparison, displayed the rejected shortcut and feasible benchmark results, and opened the pattern picker and Methods page. At a 390 px viewport, the document width matched its scroll width and the pattern dialog remained within the viewport. No warning or error messages were observed in the browser console. JSON, CSV and SVG were downloaded through the UI and parsed: schema infilllab/2, three comparison results, six CSV data rows and valid SVG XML.
