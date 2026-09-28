import { patternGeometry, PATTERNS } from "./patterns";
import {
  DEFAULT,
  type Config,
  type Point,
  type Segment,
  type Choice,
  type Step,
  type Result,
  type Run,
} from "./types";
export const EPS = 1e-8;
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function validateConfig(c: Config): string[] {
  const errors: string[] = [];
  if (c.width < 6 * c.beadWidth || c.height < 6 * c.beadWidth)
    errors.push("Region dimensions must be at least six bead widths.");
  if (c.layers !== 1)
    errors.push("Version 2 models one receiving layer per material switch.");
  if (!["native", "equal"].includes(c.capacityMode))
    errors.push("Unknown capacity comparison mode.");
  if (!["shared", "idex"].includes(c.hardware))
    errors.push("Unknown hardware architecture.");
  if (c.mode === "multi" && c.hardware !== "shared")
    errors.push(
      "IDEX has separate melt paths. The transition-allocation model does not apply.",
    );
  if (!["single", "multi"].includes(c.mode))
    errors.push("Unknown material mode.");
  const range = (
    key: keyof Config,
    lo: number,
    hi: number,
    integer = false,
  ) => {
    const value = c[key];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < lo ||
      value > hi ||
      (integer && !Number.isInteger(value))
    )
      errors.push(
        `${key} must be ${integer ? "an integer " : ""}between ${lo} and ${hi}.`,
      );
  };
  range("width", 5, 150);
  range("height", 2, 100);
  range("spacing", 0.5, 20);
  range("beadWidth", 0.2, 2);
  range("layerHeight", 0.05, 1);
  range("layers", 1, 6, true);
  range("transitionVolume", 0.1, 3000);
  range("eligibleLow", 0, 1);
  range("eligibleHigh", 0, 1);
  range("gamma", 0.2, 5);
  range("tolerance", 0.02, 0.5);
  range("alpha", 0, 1);
  range("iterations", 10, 2000, true);
  range("seed", 0, 4294967295, true);
  range("replicates", 1, 10, true);
  range("depositSpeed", 1, 300);
  range("travelSpeed", 1, 500);
  range("purgeRate", 0.1, 50);
  if (c.eligibleLow >= c.eligibleHigh)
    errors.push("Eligibility lower limit must be below its upper limit.");
  if (c.spacing < 2 * c.beadWidth)
    errors.push("Use spacing of at least twice the bead width.");

  if (c.layerHeight > c.beadWidth)
    errors.push(
      "Layer height must not exceed bead width in this simplified bead model.",
    );
  if (!["interface", "benchmark"].includes(c.preset))
    errors.push("Unknown experiment.");
  if (!PATTERNS.some((p) => p.id === c.pattern))
    errors.push("Unknown pattern.");
  if (!["uniform", "graded"].includes(c.acceptance))
    errors.push("Unknown acceptance field.");
  if (!["AB", "BA"].includes(c.direction))
    errors.push("Unknown switch direction.");
  if (
    typeof c.materialA !== "string" ||
    typeof c.materialB !== "string" ||
    c.materialA.length > 40 ||
    c.materialB.length > 40
  )
    errors.push("Material labels must contain at most 40 characters.");
  if (
    c.preset === "interface" &&
    Math.ceil(c.height / c.spacing) * c.layers > 180
  )
    errors.push(
      "Use at most 180 segments. Increase spacing or reduce the layer count.",
    );
  return errors;
}
export function parseConfig(value: unknown): Config {
  if (!value || typeof value !== "object")
    throw new Error("Expected an InfillLab configuration or exported run.");
  const v = value as Record<string, unknown>;
  if (v.schema !== undefined && v.schema !== "infilllab/2")
    throw new Error(
      "This version accepts InfillLab 2 experiments. Recreate older experiments with the new pattern catalogue.",
    );
  const raw = (v.config ?? v) as Record<string, unknown>;
  const config = Object.fromEntries(
    Object.keys(DEFAULT).map((k) => [
      k,
      k === "mode" ? (raw[k] ?? "multi") : raw[k],
    ]),
  ) as Config;
  const issues = validateConfig(config);
  if (issues.length) throw new Error(issues.join(" "));
  if (config.preset === "benchmark") return normaliseBenchmark(config);
  return config;
}
export function normaliseBenchmark(c: Config): Config {
  return {
    ...c,
    preset: "benchmark",
    mode: "multi",
    width: 70,
    height: 10,
    layers: 1,
    beadWidth: 0.5,
    layerHeight: 0.2,
    transitionVolume: 12,
    eligibleLow: 0,
    eligibleHigh: 1,
    gamma: 1,
    direction: "AB",
  };
}
export function geometry(config: Config): Segment[] {
  const c = config.preset === "benchmark" ? normaliseBenchmark(config) : config;
  const p = (x: number, y: number, layer = 0): Point => ({
    x,
    y,
    z: layer * c.layerHeight,
  });
  if (c.preset === "benchmark")
    return [
      {
        id: 0,
        label: "A",
        layer: 0,
        points: [p(10, 0), p(70, 0)],
        length: 60,
        volume: 6,
        low: 0,
        high: 0.5,
      },
      {
        id: 1,
        label: "B",
        layer: 0,
        points: [p(0, 10), p(60, 10)],
        length: 60,
        volume: 6,
        low: 0.5,
        high: 1,
      },
    ];
  return patternGeometry(c);
}
export const startPoint = (c: Config): Point =>
  c.preset === "benchmark" ? { x: 0, y: 10, z: 0 } : { x: 0, y: 0, z: 0 };
export const composition = (v: number, c: Config) => {
  if (c.mode === "single") return 0;
  const q = Math.max(0, Math.min(1, v / c.transitionVolume)) ** c.gamma;
  return c.direction === "AB" ? q : 1 - q;
};
export const volumeAt = (fraction: number, c: Config) =>
  c.transitionVolume *
  (c.direction === "AB" ? fraction : 1 - fraction) ** (1 / c.gamma);
export function interval(
  low: number,
  high: number,
  c: Config,
): [number, number] {
  return [
    Math.min(volumeAt(low, c), volumeAt(high, c)),
    Math.max(volumeAt(low, c), volumeAt(high, c)),
  ];
}
export function bounds(c: Config, segments = geometry(c)) {
  const capacity = segments.reduce((n, s) => n + s.volume, 0);
  const [a, b] = interval(c.eligibleLow, c.eligibleHigh, c);
  const eligible = b - a;
  return {
    capacity,
    eligible,
    upperUse: Math.min(capacity, eligible),
    lowerDiscard: c.transitionVolume - Math.min(capacity, eligible),
    eligibleFraction: eligible / c.transitionVolume,
  };
}
export function place(
  s: Segment,
  reverse: boolean,
  cursor: number,
  from: Point,
  c: Config,
): Step | null {
  if (c.mode === "single") {
    const points = reverse ? [...s.points].reverse() : s.points;
    return {
      id: s.id,
      reverse,
      start: cursor,
      end: cursor + s.volume,
      purgeBefore: 0,
      travel: distance(from, points[0]),
      cStart: 0,
      cEnd: 0,
      travelFrom: from,
      travelTo: points[0],
    };
  }
  const low = Math.max(c.eligibleLow, s.low),
    high = Math.min(c.eligibleHigh, s.high);
  if (low >= high) return null;
  const [a, b] = interval(low, high, c);
  const start = Math.max(cursor, a),
    end = start + s.volume;
  if (end > b + EPS || end > c.transitionVolume + EPS) return null;
  // The analytical benchmark disallows purging, exactly as in the manuscript.
  if (c.preset === "benchmark" && start > cursor + EPS) return null;
  const points = reverse ? [...s.points].reverse() : s.points;
  return {
    id: s.id,
    reverse,
    start,
    end,
    purgeBefore: Math.max(0, start - cursor),
    travel: distance(from, points[0]),
    cStart: composition(start, c),
    cEnd: composition(end, c),
    travelFrom: from,
    travelTo: points[0],
  };
}
export function assemble(
  c: Config,
  segments: Segment[],
  steps: Step[],
  algorithm: string,
): Result {
  const used = steps.reduce((n, s) => n + segments[s.id].volume, 0);
  const travel = steps.reduce((n, s) => n + s.travel, 0);
  const depositionLength = steps.reduce((n, s) => n + segments[s.id].length, 0);
  const discarded = Math.max(0, c.transitionVolume - used);
  const capacity = bounds(c, segments).capacity;
  const reference = Math.max(
    EPS,
    segments.length * Math.hypot(c.width, c.height, c.layers * c.layerHeight),
  );
  const visited = new Set(steps.map((s) => s.id));
  const unassigned = segments
    .filter((s) => !visited.has(s.id))
    .map((s) => s.id);
  return {
    algorithm,
    steps,
    unassigned,
    complete: unassigned.length === 0,
    used,
    discarded,
    travel,
    depositionLength,
    idealTime:
      depositionLength / c.depositSpeed +
      travel / c.travelSpeed +
      discarded / c.purgeRate,
    score:
      (c.alpha * discarded) / c.transitionVolume +
      ((1 - c.alpha) * travel) / reference,
    coverage: capacity > EPS ? used / capacity : 0,
    trace: [],
    evaluations: 1,
    runtimeMs: 0,
  };
}
export function evaluate(
  c: Config,
  segments: Segment[],
  order: Choice[],
  algorithm: string,
): Result {
  const steps: Step[] = [];
  let cursor = 0,
    position = startPoint(c);
  const seen = new Set<number>();
  for (const choice of order) {
    const s = segments[choice.id];
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    // Every lower layer must be allocated before any segment of a higher layer.
    if (
      segments.some(
        (t) => t.layer < s.layer && !steps.some((p) => p.id === t.id),
      )
    )
      continue;
    if (
      s.predecessor !== undefined &&
      !steps.some((p) => p.id === s.predecessor)
    )
      continue;
    if (s.locked && choice.reverse) continue;
    const step = place(s, choice.reverse, cursor, position, c);
    if (!step) continue;
    steps.push(step);
    cursor = step.end;
    position = choice.reverse ? s.points[0] : s.points.at(-1)!;
  }
  return assemble(c, segments, steps, algorithm);
}
export const better = (a: Result, b: Result) =>
  a.complete !== b.complete
    ? a.complete
    : Math.abs(a.coverage - b.coverage) > EPS
      ? a.coverage > b.coverage
      : a.score < b.score - EPS;
export function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function construct(
  c: Config,
  segments: Segment[],
  random: (() => number) | null,
  preference: Float64Array | null,
): Result {
  const steps: Step[] = [];
  const remaining = new Set(segments.map((s) => s.id));
  let cursor = 0,
    position = startPoint(c),
    previous = segments.length;
  while (remaining.size) {
    const layer = Math.min(...[...remaining].map((i) => segments[i].layer));
    const candidates: { step: Step; cost: number; weight: number }[] = [];
    for (const id of remaining) {
      const segment = segments[id];
      if (segment.layer !== layer) continue;
      if (
        segment.predecessor !== undefined &&
        remaining.has(segment.predecessor)
      )
        continue;
      for (const reverse of segment.locked ? [false] : [false, true]) {
        const step = place(segment, reverse, cursor, position, c);
        if (!step) continue;
        const cost = step.travel + step.purgeBefore * 3;
        const prior = preference?.[previous * segments.length + id] ?? 1;
        candidates.push({ step, cost, weight: prior / (1 + cost) });
      }
    }
    if (!candidates.length) break;
    candidates.sort((a, b) => a.cost - b.cost);
    let next = candidates[0];
    if (random && random() > 0.25) {
      const top = candidates.slice(
        0,
        Math.min(
          candidates.length,
          Math.max(4, Math.ceil(candidates.length * 0.65)),
        ),
      );
      const total = top.reduce((s, q) => s + q.weight, 0);
      let ticket = random() * total;
      for (const q of top) {
        ticket -= q.weight;
        if (ticket <= 0) {
          next = q;
          break;
        }
      }
    }
    const s = segments[next.step.id];
    steps.push(next.step);
    remaining.delete(s.id);
    cursor = next.step.end;
    position = next.step.reverse ? s.points[0] : s.points.at(-1)!;
    previous = s.id;
  }
  return assemble(
    c,
    segments,
    steps,
    random ? "Adaptive search" : "Nearest feasible",
  );
}
export function baselines(c: Config, segments = geometry(c)): Result[] {
  return [
    evaluate(
      c,
      segments,
      segments.map((s) => ({ id: s.id, reverse: false })),
      "Reference order",
    ),
    construct(c, segments, null, null),
  ];
}
export function adaptive(
  c: Config,
  segments: Segment[],
  seed: number,
  progress?: (fraction: number) => void,
): Result {
  const start = performance.now();
  const random = rng(seed);
  const preferences = new Float64Array(
    (segments.length + 1) * segments.length,
  ).fill(1);
  const candidates = baselines(c, segments);
  let best = candidates.reduce((a, b) => (better(a, b) ? a : b));
  const trace: Result["trace"] = [
    { evaluation: 0, score: best.score, assigned: best.steps.length },
  ];
  for (let iteration = 1; iteration <= c.iterations; iteration++) {
    const candidate = construct(c, segments, random, preferences);
    if (better(candidate, best)) best = candidate;
    // Experimental edge reinforcement, not the canonical Slime Mould Algorithm.
    for (let i = 0; i < preferences.length; i++)
      preferences[i] = 0.98 * preferences[i] + 0.02;
    let previous = segments.length;
    for (const step of best.steps) {
      const i = previous * segments.length + step.id;
      preferences[i] = Math.min(12, preferences[i] + 0.12);
      previous = step.id;
    }
    if (iteration % 5 === 0 || iteration === c.iterations) {
      trace.push({
        evaluation: iteration,
        score: best.score,
        assigned: best.steps.length,
      });
      progress?.(iteration / c.iterations);
    }
  }
  return {
    ...best,
    algorithm: "Adaptive search",
    seed,
    trace,
    evaluations: c.iterations + 2,
    runtimeMs: performance.now() - start,
  };
}
export function exactBenchmark(c: Config, segments = geometry(c)): Result {
  const routes: Result[] = [];
  for (const order of [
    [0, 1],
    [1, 0],
  ])
    for (const a of [false, true])
      for (const b of [false, true])
        routes.push(
          evaluate(
            c,
            segments,
            [
              { id: order[0], reverse: a },
              { id: order[1], reverse: b },
            ],
            "Exact enumeration",
          ),
        );
  const best = routes.reduce((a, b) => (better(a, b) ? a : b));
  return { ...best, evaluations: 8 };
}
export function runStudy(
  raw: Config,
  progress?: (fraction: number) => void,
): Run {
  const c = raw.preset === "benchmark" ? normaliseBenchmark(raw) : { ...raw };
  const issues = validateConfig(c);
  if (issues.length) throw new Error(issues.join(" "));
  const segments = geometry(c);
  if (c.mode === "single") {
    c.transitionVolume = segments.reduce((sum, s) => sum + s.volume, 0);
    c.eligibleLow = 0;
    c.eligibleHigh = 1;
  }
  const results = baselines(c, segments);
  const replicates: Result[] = [];
  for (let i = 0; i < c.replicates; i++)
    replicates.push(
      adaptive(c, segments, (c.seed + i) >>> 0, (f) =>
        progress?.((i + f) / c.replicates),
      ),
    );
  // Show the first seed, not a cherry-picked best replicate. Full distribution is exported.
  results.push(replicates[0]);
  if (c.preset === "benchmark") results.push(exactBenchmark(c, segments));
  return {
    schema: "infilllab/2",
    modelVersion: "2.0.0",
    createdAt: new Date().toISOString(),
    config: c,
    segments,
    results,
    replicates,
  };
}
