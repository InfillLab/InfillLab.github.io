import type { Config, Point, Segment } from "./types";
export const PATTERNS = [
  {
    id: "concentric",
    name: "Concentric",
    note: "Nested rectangular loops; direction fixed within each loop.",
  },
  {
    id: "rectilinear",
    name: "Rectilinear",
    note: "Alternating raster reference; tracks may be reordered.",
  },
  {
    id: "monotonic",
    name: "Monotonic",
    note: "Unidirectional raster; ascending sequence and direction retained.",
  },
  {
    id: "monotonic-line",
    name: "Monotonic line",
    note: "Separate inset lines; ascending order retained.",
  },
  {
    id: "global-monotonic",
    name: "Global monotonic line",
    note: "Global ascending order. Coincides with monotonic line on this single rectangular region.",
  },
  {
    id: "aligned",
    name: "Aligned Rectilinear",
    note: "Aligned raster. Same geometry as rectilinear in a single layer; fixed forward reference directions.",
  },
  {
    id: "hilbert",
    name: "Hilbert Curve",
    note: "Finite-order Hilbert polyline; curve sequence retained.",
  },
  {
    id: "archimedean",
    name: "Archimedean Chords",
    note: "Sampled elliptical Archimedean spiral; curve sequence retained.",
  },
  {
    id: "octagram",
    name: "Octagram Spiral",
    note: "Eight-point star-shaped spiral approximation; sequence retained.",
  },
  {
    id: "taii",
    name: "TAII",
    note: "Proposed staggered finger paths. Experimental geometry plus composition-aware scheduling; strength and novelty unproven.",
  },
] as const;
export type Pattern = (typeof PATTERNS)[number]["id"];
export const pathLength = (ps: Point[]) =>
  ps
    .slice(1)
    .reduce(
      (n, p, i) => n + Math.hypot(p.x - ps[i].x, p.y - ps[i].y, p.z - ps[i].z),
      0,
    );
export function slicePath(ps: Point[], from: number, to: number): Point[] {
  const out: Point[] = [];
  let v = 0;
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1],
      b = ps[i],
      d = pathLength([a, b]);
    if (d < 1e-10) continue;
    const lo = Math.max(from, v),
      hi = Math.min(to, v + d);
    if (hi > lo + 1e-10) {
      const at = (t: number) => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      });
      if (!out.length) out.push(at((lo - v) / d));
      out.push(at((hi - v) / d));
    }
    v += d;
    if (v >= to) break;
  }
  return out;
}
type Raw = { points: Point[]; chain: boolean };
export function nativePaths(c: Config): Raw[] {
  const w = c.width,
    h = c.height,
    m = c.beadWidth,
    s = Math.max(c.spacing, m * 2),
    ps: Raw[] = [];
  const p = (x: number, y: number): Point => ({ x, y, z: 0 });
  const add = (points: Point[], chain = false) => ps.push({ points, chain });
  if (c.pattern === "concentric") {
    for (let inset = m; inset < Math.min(w, h) / 2 - m; inset += s)
      add(
        [
          p(inset, inset),
          p(w - inset, inset),
          p(w - inset, h - inset),
          p(inset, h - inset),
          p(inset, inset),
        ],
        true,
      );
  } else if (c.pattern === "hilbert") {
    const order = Math.max(
        1,
        Math.min(4, Math.floor(Math.log2(Math.min(w, h) / s))),
      ),
      n = 2 ** order,
      pts: Point[] = [];
    for (let d = 0; d < n * n; d++) {
      let x = 0,
        y = 0,
        t = d;
      for (let k = 1; k < n; k *= 2) {
        const rx = 1 & (t >> 1),
          ry = 1 & (t ^ rx);
        if (ry === 0) {
          if (rx === 1) {
            x = k - 1 - x;
            y = k - 1 - y;
          }
          [x, y] = [y, x];
        }
        x += k * rx;
        y += k * ry;
        t >>= 2;
      }
      pts.push(
        p(m + (x / (n - 1)) * (w - 2 * m), m + (y / (n - 1)) * (h - 2 * m)),
      );
    }
    add(pts, true);
  } else if (c.pattern === "archimedean" || c.pattern === "octagram") {
    const turns = Math.max(1, Math.min(12, (Math.min(w, h) / 2 - m) / s)),
      steps = Math.ceil(turns * 96),
      pts: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        a = t * turns * Math.PI * 2;
      let r = t;
      if (c.pattern === "octagram") {
        const phase = (a / (Math.PI / 8)) % 2;
        r *= 0.7 + 0.3 * Math.abs(phase - 1);
      }
      pts.push(
        p(
          w / 2 + (w / 2 - m) * r * Math.cos(a),
          h / 2 + (h / 2 - m) * r * Math.sin(a),
        ),
      );
    }
    add(pts, true);
  } else if (c.pattern === "taii") {
    const rows = Math.max(1, Math.floor((h - 2 * m) / s));
    for (let row = 0; row < rows; row++) {
      const y = m + row * s;
      const left = row % 2 === 0;
      const x0 = left ? m : w - m,
        x1 = left ? w * 0.65 : w * 0.35;
      add([
        p(x0, y),
        p(x1, y),
        p(x1, Math.min(h - m, y + s * 0.45)),
        p(left ? w * 0.4 : w * 0.6, Math.min(h - m, y + s * 0.45)),
      ]);
    }
  } else {
    const rows: Point[][] = [];
    const inset = ["monotonic-line", "global-monotonic"].includes(c.pattern)
      ? m * 1.5
      : m;
    for (let y = m; y <= h - m + 1e-8; y += s)
      rows.push([p(inset, y), p(w - inset, y)]);
    if (c.pattern === "monotonic") {
      rows.forEach((r) => add(r, true));
    } else
      rows.forEach((r, i) =>
        add(
          c.pattern === "rectilinear" && i % 2 ? [...r].reverse() : r,
          ["monotonic-line", "global-monotonic"].includes(c.pattern),
        ),
      );
  }
  return ps;
}
export function patternGeometry(c: Config): Segment[] {
  const native = nativePaths(c),
    total = native.reduce((v, p) => v + pathLength(p.points), 0);
  // Equal-volume control keeps locations distributed: uniformly trims the end of each native path.
  const common =
    c.capacityMode === "equal"
      ? Math.min(
          ...PATTERNS.map((p) =>
            nativePaths({ ...c, pattern: p.id }).reduce(
              (v, r) => v + pathLength(r.points),
              0,
            ),
          ),
        )
      : total;
  const factor = total > 0 ? common / total : 1,
    unit = Math.max(2, common / 70),
    out: Segment[] = [];
  let previousGlobal: number | undefined;
  for (const raw of native) {
    const length = pathLength(raw.points) * factor;
    let prev: number | undefined;
    for (let start = 0; start < length - 1e-8; start += unit) {
      const points = slicePath(
          raw.points,
          start,
          Math.min(length, start + unit),
        ),
        len = pathLength(points);
      if (!len) continue;
      const target =
        0.15 +
        (0.7 * (points.reduce((v, p) => v + p.y, 0) / points.length)) /
          c.height;
      const ordered = [
        "monotonic",
        "monotonic-line",
        "global-monotonic",
      ].includes(c.pattern);
      const id = out.length,
        predecessor = ordered ? previousGlobal : raw.chain ? prev : undefined;
      out.push({
        id,
        label: String(id + 1),
        layer: 0,
        points,
        length: len,
        volume: len * c.beadWidth * c.layerHeight,
        low: c.acceptance === "uniform" ? 0 : Math.max(0, target - c.tolerance),
        high:
          c.acceptance === "uniform" ? 1 : Math.min(1, target + c.tolerance),
        predecessor,
        locked: raw.chain || ordered,
      });
      prev = id;
      previousGlobal = id;
    }
  }
  return out;
}
