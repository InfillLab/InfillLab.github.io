import type { Run, Result, Point } from "./types";
import { composition } from "./engine";
import { slicePath } from "./patterns";
export type Increment = {
  start: number;
  end: number;
  used: boolean;
  points: Point[];
  c: number;
  segment?: number;
};
export function increments(run: Run, r: Result): Increment[] {
  const out: Increment[] = [];
  const dv = run.config.transitionVolume / 180;
  const add = (
    a: number,
    b: number,
    points: Point[] = [],
    segment?: number,
  ) => {
    for (let v = a; v < b - 1e-9; v += dv) {
      const end = Math.min(b, v + dv),
        s = segment === undefined ? undefined : run.segments[segment];
      out.push({
        start: v,
        end,
        used: !!s,
        points: s
          ? slicePath(
              points,
              ((v - a) / (b - a)) * s.length,
              ((end - a) / (b - a)) * s.length,
            )
          : [],
        c: composition((v + end) / 2, run.config),
        segment,
      });
    }
  };
  let cursor = 0;
  for (const step of r.steps) {
    add(cursor, step.start);
    const s = run.segments[step.id];
    add(
      step.start,
      step.end,
      step.reverse ? [...s.points].reverse() : s.points,
      step.id,
    );
    cursor = step.end;
  }
  add(cursor, run.config.transitionVolume);
  return out;
}
export function accounting(
  items: Increment[],
  position: number,
  total: number,
) {
  let used = 0,
    discarded = 0;
  items.forEach((v, i) => {
    const f = Math.max(0, Math.min(1, position - i));
    if (v.used) used += (v.end - v.start) * f;
    else discarded += (v.end - v.start) * f;
  });
  return {
    used,
    discarded,
    remaining: Math.max(0, total - used - discarded),
    eta: used / total,
  };
}
