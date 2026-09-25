import { describe, it, expect } from "vitest";
import { DEFAULT, BENCHMARK } from "./types";
import {
  adaptive,
  bounds,
  composition,
  evaluate,
  exactBenchmark,
  geometry,
  interval,
  normaliseBenchmark,
  parseConfig,
  runStudy,
  validateConfig,
  volumeAt,
} from "./engine";
describe("analytical verification", () => {
  const c = normaliseBenchmark(BENCHMARK),
    s = geometry(c);
  it("recovers the exact feasible manuscript solution by enumerating all eight schedules", () => {
    const best = exactBenchmark(c, s);
    expect(best.evaluations).toBe(8);
    expect(best.complete).toBe(true);
    expect(best.travel).toBeCloseTo(2 * Math.sqrt(200), 10);
    expect(best.used).toBeCloseTo(12, 10);
    expect(best.discarded).toBeCloseTo(0, 10);
    expect(best.steps.map((t) => t.id)).toEqual([0, 1]);
  });
  it("rejects the shorter geometric order rather than reporting a false complete route", () => {
    const r = evaluate(
      c,
      s,
      [
        { id: 1, reverse: false },
        { id: 0, reverse: true },
      ],
      "test",
    );
    expect(r.complete).toBe(false);
    expect(r.unassigned).toContain(1);
  });
  it("matches the four capacity bounds in the manuscript", () => {
    for (const [eligible, capacity, upper] of [
      [0.25, 12, 5],
      [0.5, 12, 10],
      [0.75, 12, 12],
      [0.5, 20, 10],
    ]) {
      const cc = {
        ...DEFAULT,
        transitionVolume: 20,
        eligibleLow: 0,
        eligibleHigh: eligible,
        gamma: 1,
      };
      const ss = [{ ...s[0], volume: capacity }];
      expect(bounds(cc, ss).upperUse).toBeCloseTo(upper, 10);
    }
  });
});
describe("material accounting and feasibility", () => {
  it("conserves volume and honours every deposited track window over multiple curves and directions", () => {
    for (const direction of ["AB", "BA"] as const)
      for (const gamma of [0.2, 0.7, 1, 3, 5]) {
        const c = {
            ...DEFAULT,
            direction,
            gamma,
            iterations: 20,
            replicates: 1,
          },
          s = geometry(c),
          r = adaptive(c, s, 73);
        expect(r.used + r.discarded).toBeCloseTo(c.transitionVolume, 8);
        expect(r.used).toBeLessThanOrEqual(bounds(c, s).upperUse + 1e-7);
        let last = 0;
        for (const t of r.steps) {
          const seg = s[t.id];
          expect(t.start).toBeGreaterThanOrEqual(last - 1e-8);
          expect(t.end - t.start).toBeCloseTo(seg.volume, 9);
          for (const frac of [t.cStart, t.cEnd]) {
            expect(frac).toBeGreaterThanOrEqual(
              Math.max(seg.low, c.eligibleLow) - 1e-8,
            );
            expect(frac).toBeLessThanOrEqual(
              Math.min(seg.high, c.eligibleHigh) + 1e-8,
            );
          }
          last = t.end;
        }
        expect(new Set(r.steps.map((t) => t.id)).size).toBe(r.steps.length);
      }
  });
  it("inverts the composition curve exactly for both switching directions", () => {
    for (const direction of ["AB", "BA"] as const)
      for (const gamma of [0.2, 1, 5])
        for (const f of [0, 0.05, 0.4, 0.95, 1]) {
          const c = { ...DEFAULT, direction, gamma };
          expect(composition(volumeAt(f, c), c)).toBeCloseTo(f, 9);
        }
    const [a, b] = interval(0.2, 0.8, { ...DEFAULT, direction: "BA" });
    expect(a).toBeLessThan(b);
  });
  it("never prints an upper layer before completing every lower-layer track", () => {
    const c = {
        ...DEFAULT,
        layers: 3,
        transitionVolume: 500,
        acceptance: "uniform" as const,
        iterations: 20,
      },
      s = geometry(c),
      r = adaptive(c, s, 9);
    const done = new Set<number>();
    for (const step of r.steps) {
      expect(
        s
          .filter((q) => q.layer < s[step.id].layer)
          .every((q) => done.has(q.id)),
      ).toBe(true);
      done.add(step.id);
    }
  });
  it("reports unassigned tracks if transition volume cannot contain even one track", () => {
    const c = { ...DEFAULT, transitionVolume: 0.1, iterations: 10 },
      s = geometry(c),
      r = adaptive(c, s, 1);
    expect(r.used).toBe(0);
    expect(r.complete).toBe(false);
    expect(r.discarded).toBe(0.1);
  });
  it("is deterministic for identical parameters and seed", () => {
    const c = { ...DEFAULT, iterations: 40 },
      s = geometry(c),
      a = adaptive(c, s, 42),
      b = adaptive(c, s, 42);
    expect(a.steps).toEqual(b.steps);
    expect(a.trace).toEqual(b.trace);
    expect(a.score).toBe(b.score);
  });
  it("preserves the first replicate rather than silently selecting the best seed", () => {
    const run = runStudy({ ...DEFAULT, iterations: 10, replicates: 3 });
    expect(run.results[2]).toEqual(run.replicates[0]);
    expect(run.replicates.map((r) => r.seed)).toEqual([42, 43, 44]);
  });
});
describe("input validation", () => {
  it("rejects invalid and oversized experiments", () => {
    expect(
      validateConfig({ ...DEFAULT, eligibleLow: 0.9, eligibleHigh: 0.1 })
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateConfig({ ...DEFAULT, transitionVolume: NaN }).length,
    ).toBeGreaterThan(0);
    expect(
      validateConfig({ ...DEFAULT, height: 100, spacing: 0.5, layers: 6 })
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateConfig({ ...DEFAULT, spacing: 0.5, beadWidth: 1 }).length,
    ).toBeGreaterThan(0);
    expect(
      validateConfig({
        ...DEFAULT,
        pattern: "chevron",
        spacing: 0.5,
        beadWidth: 0.5,
      }).length,
    ).toBeGreaterThan(0);
  });
  it("validates imported configuration and ignores stored results", () => {
    expect(
      parseConfig({
        schema: "infilllab/1",
        config: DEFAULT,
        results: ["not trusted"],
      }),
    ).toEqual(DEFAULT);
    expect(() => parseConfig({ schema: "unknown", config: DEFAULT })).toThrow();
    expect(() =>
      parseConfig({ config: { ...DEFAULT, iterations: 1e8 } }),
    ).toThrow();
    expect(() =>
      parseConfig({ config: { ...DEFAULT, materialA: 42 } }),
    ).toThrow();
  });
  it("locks the analytical benchmark to its published assumptions", () => {
    const imported = parseConfig({
      config: {
        ...BENCHMARK,
        gamma: 3,
        direction: "BA",
        transitionVolume: 100,
      },
    });
    expect(imported.gamma).toBe(1);
    expect(imported.direction).toBe("AB");
    expect(imported.transitionVolume).toBe(12);
  });
});

describe('single material mode',()=>{
 it('allocates every layer with no transition purge or composition change',()=>{
 const run=runStudy({...DEFAULT,mode:'single',layers:3,transitionVolume:0.1,iterations:10});
 for(const r of run.results){expect(r.complete).toBe(true);expect(r.discarded).toBeCloseTo(0);expect(r.used).toBeCloseTo(run.segments.reduce((sum,s)=>sum+s.volume,0));expect(r.steps.every(s=>s.purgeBefore===0&&s.cStart===0&&s.cEnd===0)).toBe(true);}
 });
 it('imports previous multi-material configurations without a mode field',()=>{
 const {mode,...legacy}=DEFAULT;expect(parseConfig(legacy).mode).toBe('multi');
 });
});
