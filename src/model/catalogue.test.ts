import { describe, it, expect } from "vitest";
import { PATTERNS, pathLength } from "./patterns";
import { DEFAULT, BENCHMARK } from "./types";
import { geometry, runStudy, bounds, validateConfig } from "./engine";
import { increments, accounting } from "./timeline";
describe("v2 catalogue and accounting", () => {
  it("gives all ten controlled variants equal nominal capacity with finite in-bounds paths", () => {
    let capacity: number | undefined;
    for (const p of PATTERNS) {
      const c = { ...DEFAULT, pattern: p.id, capacityMode: "equal" as const },
        ss = geometry(c);
      expect(ss.length).toBeGreaterThan(0);
      const v = ss.reduce((n, s) => n + s.volume, 0);
      capacity ??= v;
      expect(v).toBeCloseTo(capacity, 7);
      for (const s of ss) {
        expect(s.length).toBeCloseTo(pathLength(s.points), 8);
        expect(s.volume).toBeGreaterThan(0);
        for (const q of s.points) {
          expect(q.x).toBeGreaterThanOrEqual(0);
          expect(q.x).toBeLessThanOrEqual(c.width);
          expect(q.y).toBeGreaterThanOrEqual(0);
          expect(q.y).toBeLessThanOrEqual(c.height);
        }
      }
    }
  });
  it("honours all predecessor constraints and conserves animation volume for every catalogue entry", () => {
    for (const p of PATTERNS) {
      const run = runStudy({
          ...DEFAULT,
          pattern: p.id,
          iterations: 10,
          replicates: 1,
        }),
        r = run.results[2],
        seen = new Set<number>();
      for (const step of r.steps) {
        const s = run.segments[step.id];
        if (s.predecessor !== undefined)
          expect(seen.has(s.predecessor)).toBe(true);
        if (s.locked) expect(step.reverse).toBe(false);
        seen.add(step.id);
      }
      expect(r.used).toBeLessThanOrEqual(
        bounds(run.config, run.segments).upperUse + 1e-7,
      );
      const list = increments(run, r);
      let lastU = 0,
        lastD = 0;
      for (let n = 0; n <= list.length; n += 0.5) {
        const a = accounting(list, n, run.config.transitionVolume);
        expect(a.used + a.discarded + a.remaining).toBeCloseTo(
          run.config.transitionVolume,
          7,
        );
        expect(a.used).toBeGreaterThanOrEqual(lastU);
        expect(a.discarded).toBeGreaterThanOrEqual(lastD);
        lastU = a.used;
        lastD = a.discarded;
      }
      const end = accounting(list, list.length, run.config.transitionVolume);
      expect(end.used).toBeCloseTo(r.used, 7);
      expect(end.discarded).toBeCloseTo(r.discarded, 7);
      expect(end.remaining).toBeCloseTo(0, 7);
      expect(
        list.every(
          (v) => v.end - v.start <= run.config.transitionVolume / 180 + 1e-8,
        ),
      ).toBe(true);
    }
  });
  it("excludes separate nozzle blending and obsolete multilayer settings", () => {
    expect(
      validateConfig({ ...DEFAULT, hardware: "idex" }).length,
    ).toBeGreaterThan(0);
    expect(validateConfig({ ...DEFAULT, layers: 2 }).length).toBeGreaterThan(0);
  });
  it("accounts for exact benchmark with no external purge", () => {
    const run = runStudy({ ...BENCHMARK, iterations: 10, replicates: 1 }),
      r = run.results[3],
      a = accounting(increments(run, r), 1000, 12);
    expect(a.used).toBeCloseTo(12);
    expect(a.discarded).toBeCloseTo(0);
    expect(r.travel).toBeCloseTo(28.2842712475);
  });
});
