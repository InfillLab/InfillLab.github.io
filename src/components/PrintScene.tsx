import { useEffect, useRef, useState } from "react";
import type { Config, Segment, Result, Point } from "../model/types";
import { composition } from "../model/engine";
export function PrintScene({
  config: c,
  segments,
  result,
  progress,
  colors,
  flat,
}: {
  config: Config;
  segments: Segment[];
  result?: Result;
  progress: number;
  colors: [string, string];
  flat: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    drag = useRef<number | null>(null);
  const [angle, setAngle] = useState(-0.6),
    [zoom, setZoom] = useState(1),
    [size, setSize] = useState([800, 500]);
  useEffect(() => {
    const el = canvas.current!;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize([r.width, r.height]);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = canvas.current!,
      ctx = el.getContext("2d")!;
    const [w, h] = size,
      dpr = Math.min(devicePixelRatio, 2);
    el.width = w * dpr;
    el.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const scale =
      Math.min(w / (c.width + c.height + 25), h / (c.width + c.height + 22)) *
      1.45 *
      zoom;
    const project = (p: Point) => {
      const x = p.x - c.width / 2,
        y = p.y - c.height / 2;
      const rx = x * Math.cos(angle) - y * Math.sin(angle),
        ry = x * Math.sin(angle) + y * Math.cos(angle);
      return {
        x: w / 2 + (flat ? x : rx) * scale,
        y:
          h * 0.56 +
          (flat ? -y : ry * 0.48) * scale -
          p.z * scale * (flat ? 0 : 4),
      };
    };
    const line = (a: Point, b: Point, color: string, width: number) => {
      const p = project(a),
        q = project(b);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.stroke();
    };
    const bed = [
      { x: -5, y: -5, z: -0.5 },
      { x: c.width + 5, y: -5, z: -0.5 },
      { x: c.width + 5, y: c.height + 5, z: -0.5 },
      { x: -5, y: c.height + 5, z: -0.5 },
    ];
    ctx.beginPath();
    bed.forEach((p, i) => {
      const q = project(p);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fillStyle = "#dedfd5";
    ctx.fill();
    ctx.strokeStyle = "#b6bca9";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let x = 0; x <= c.width; x += 5)
      line({ x, y: 0, z: -0.48 }, { x, y: c.height, z: -0.48 }, "#c8cdbd", 0.6);
    for (let y = 0; y <= c.height; y += 5)
      line({ x: 0, y, z: -0.48 }, { x: c.width, y, z: -0.48 }, "#c8cdbd", 0.6);
    const mix = (t: number) => {
      const a = colors[0].match(/\w\w/g)!.map((v) => parseInt(v, 16)),
        b = colors[1].match(/\w\w/g)!.map((v) => parseInt(v, 16));
      return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
    };
    segments
      .filter((s) => s.layer === 0)
      .forEach((s) =>
        s.points
          .slice(1)
          .forEach((p, i) =>
            line(s.points[i], p, "#b5bba9", Math.max(1, c.beadWidth * scale)),
          ),
      );
    let nozzle: Point | undefined;
    const count = result?.steps.length ?? 0;
    const completed = Math.floor(progress),
      fraction = progress - completed;
    result?.steps
      .slice(0, Math.min(count, completed + 1))
      .forEach((step, index) => {
        const s = segments[step.id],
          points = step.reverse ? [...s.points].reverse() : s.points;
        let remaining = s.length * (index < completed ? 1 : fraction),
          travelled = 0;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1],
            b = points[i],
            length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
          const take = Math.min(length, remaining);
          if (take <= 0) break;
          const end = {
            x: a.x + ((b.x - a.x) * take) / length,
            y: a.y + ((b.y - a.y) * take) / length,
            z: a.z,
          };
          const pieces = Math.max(1, Math.ceil(take / 1.5));
          for (let j = 0; j < pieces; j++) {
            const p = {
                x: a.x + ((end.x - a.x) * j) / pieces,
                y: a.y + ((end.y - a.y) * j) / pieces,
                z: a.z,
              },
              q = {
                x: a.x + ((end.x - a.x) * (j + 1)) / pieces,
                y: a.y + ((end.y - a.y) * (j + 1)) / pieces,
                z: a.z,
              };
            line(
              p,
              q,
              mix(
                composition(
                  step.start +
                    ((travelled + (take * (j + 0.5)) / pieces) / s.length) *
                      (step.end - step.start),
                  c,
                ),
              ),
              Math.max(2, c.beadWidth * scale),
            );
          }
          remaining -= take;
          travelled += take;
          nozzle = end;
        }
      });
    if (nozzle && progress < count) {
      const p = project(nozzle);
      ctx.fillStyle = "#343c32";
      ctx.beginPath();
      ctx.moveTo(p.x - 9, p.y - 24);
      ctx.lineTo(p.x + 9, p.y - 24);
      ctx.lineTo(p.x + 3, p.y - 5);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x - 3, p.y - 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#a5aa99";
      ctx.fillRect(p.x - 13, p.y - 46, 26, 22);
      ctx.fillStyle = "#59664d";
      ctx.fillRect(p.x - 7, p.y - 39, 14, 9);
    }
    ctx.fillStyle = "#69725f";
    ctx.font = "11px system-ui";
    ctx.fillText(
      `${c.width} × ${c.height} mm  /  ${c.layers} layer${c.layers > 1 ? "s" : ""}`,
      22,
      h - 22,
    );
  }, [c, segments, result, progress, colors, flat, angle, zoom, size]);
  return (
    <div className="scene">
      <canvas
        ref={canvas}
        aria-label="Animated deposition on a rotatable build plate"
        onPointerDown={(e) => {
          drag.current = e.clientX;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current !== null) {
            setAngle((a) => a + (e.clientX - drag.current!) * 0.008);
            drag.current = e.clientX;
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
      <div className="scene-help">
        {flat ? "Top view" : "Drag to rotate · layer height exaggerated ×4"}
      </div>
      <div className="zoom-tools">
        <button
          aria-label="Zoom out"
          onClick={() => setZoom((v) => Math.max(0.6, v - 0.15))}
        >
          −
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setAngle(-0.6);
          }}
        >
          Reset view
        </button>
        <button
          aria-label="Zoom in"
          onClick={() => setZoom((v) => Math.min(2, v + 0.15))}
        >
          +
        </button>
      </div>
    </div>
  );
}
