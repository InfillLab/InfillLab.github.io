import { useId } from "react";
import type { Config, Segment, Result, Point } from "../model/types";
import { composition, startPoint } from "../model/engine";
export function blend(f: number) {
  const a = [42, 103, 151],
    b = [192, 91, 47];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(",")})`;
}
export function ToolpathPlot({
  config: c,
  segments,
  result,
  visibleSteps,
  layer,
  stack,
  travel,
  labels,
  inspected,
  onInspect,
}: {
  config: Config;
  segments: Segment[];
  result?: Result;
  visibleSteps: number;
  layer: number;
  stack: boolean;
  travel: boolean;
  labels: boolean;
  inspected: number | null;
  onInspect: (id: number) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const w = c.width,
    h = c.height,
    W = 820,
    H = 460,
    shift = stack ? (c.layers - 1) * 13 : 0;
  const scale = Math.min((W - 145 - shift) / w, (H - 105 - shift) / h);
  const left = (W - w * scale - shift) / 2,
    bottom = (H + h * scale + shift) / 2 - 4;
  const project = (p: Point) => ({
    x: left + p.x * scale + (stack ? (p.z / c.layerHeight) * 13 : 0),
    y: bottom - p.y * scale - (stack ? (p.z / c.layerHeight) * 13 : 0),
  });
  const path = (ps: Point[]) =>
    ps
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${project(p).x.toFixed(3)},${project(p).y.toFixed(3)}`,
      )
      .join(" ");
  const steps = result?.steps.slice(0, visibleSteps) ?? [];
  const done = new Map(steps.map((s) => [s.id, s]));
  const shown = segments.filter((s) => stack || s.layer === layer);
  const active = steps.at(-1);
  const stroke = Math.max(2.3, Math.min(9, c.beadWidth * scale));
  const start = project(startPoint(c));
  const ticks = Array.from({ length: 5 }, (_, i) => i / 4);
  return (
    <svg
      id="toolpath-figure"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Deposition path with composition colouring, travel moves and millimetre axes"
    >
      <title>InfillLab deposition geometry</title>
      <desc>
        Colour represents the assumed fraction of material B, not strength.
        Dashed lines represent direct non-deposition travel. This is a geometric
        model.
      </desc>
      <defs>
        {steps.map((step) => {
          const s = segments[step.id],
            points = step.reverse ? [...s.points].reverse() : s.points;
          const a = project(points[0]),
            b = project(points.at(-1)!);
          return (
            <linearGradient
              key={step.id}
              id={`${uid}-g${step.id}`}
              gradientUnits="userSpaceOnUse"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
            >
              {Array.from({ length: 11 }, (_, i) => (
                <stop
                  key={i}
                  offset={`${i * 10}%`}
                  stopColor={blend(
                    composition(
                      step.start + ((step.end - step.start) * i) / 10,
                      c,
                    ),
                  )}
                />
              ))}
            </linearGradient>
          );
        })}
      </defs>
      <rect width={W} height={H} fill="#fcfcfa" />
      {ticks.map((f, i) => (
        <g
          key={i}
          fill="#68736f"
          fontFamily="system-ui,sans-serif"
          fontSize="11"
        >
          <path
            d={`M${left + f * w * scale} ${bottom + 5}V${bottom - h * scale}`}
            stroke="#e3e7e3"
            strokeDasharray="2 4"
          />
          <path
            d={`M${left - 5} ${bottom - f * h * scale}H${left + w * scale}`}
            stroke="#e3e7e3"
            strokeDasharray="2 4"
          />
          <text x={left + f * w * scale} y={bottom + 23} textAnchor="middle">
            {+(w * f).toFixed(1)}
          </text>
          <text x={left - 14} y={bottom - f * h * scale + 4} textAnchor="end">
            {+(h * f).toFixed(1)}
          </text>
        </g>
      ))}
      <text
        x={left + (w * scale) / 2}
        y={bottom + 43}
        textAnchor="middle"
        fill="#68736f"
        fontFamily="system-ui,sans-serif"
        fontSize="11"
      >
        x / mm
      </text>
      <text
        x={left - 45}
        y={bottom - (h * scale) / 2}
        transform={`rotate(-90 ${left - 45} ${bottom - (h * scale) / 2})`}
        textAnchor="middle"
        fill="#68736f"
        fontFamily="system-ui,sans-serif"
        fontSize="11"
      >
        y / mm
      </text>
      {Array.from({ length: stack ? c.layers : 1 }, (_, i) => (
        <rect
          key={i}
          x={left + (stack ? i * 13 : 0)}
          y={bottom - h * scale - (stack ? i * 13 : 0)}
          width={w * scale}
          height={h * scale}
          fill="none"
          stroke="#b8c4bd"
          strokeWidth="1"
        />
      ))}
      {c.preset !== "benchmark" && (
        <path
          d={`M${left + (w * scale) / 2} ${bottom + 1}V${bottom - h * scale}`}
          stroke="#bac3bf"
          strokeDasharray="4 5"
        />
      )}
      {shown.map((s) => (
        <path
          key={`planned${s.id}`}
          d={path(s.points)}
          fill="none"
          stroke="#d8ded9"
          strokeWidth={stroke}
          strokeLinecap="round"
          opacity={0.65}
        />
      ))}
      {travel &&
        steps
          .filter((s) => stack || segments[s.id].layer === layer)
          .map((step, i) => (
            <path
              key={`t${step.id}`}
              d={path([step.travelFrom, step.travelTo])}
              fill="none"
              stroke="#8a7863"
              strokeWidth="1.3"
              strokeDasharray="4 4"
              opacity={0.65}
            >
              <title>
                Travel {i + 1}: {step.travel.toFixed(3)} mm
              </title>
            </path>
          ))}
      {shown.map((s) => {
        const step = done.get(s.id),
          chosen = inspected === s.id;
        return (
          <g
            key={s.id}
            role="button"
            tabIndex={0}
            aria-label={`Inspect segment ${s.label}`}
            onClick={() => onInspect(s.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onInspect(s.id);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <path
              d={path(s.points)}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(16, stroke + 10)}
            />
            {chosen && (
              <path
                d={path(s.points)}
                fill="none"
                stroke="#193b40"
                strokeWidth={stroke + 5}
                strokeLinecap="round"
                opacity={0.24}
              />
            )}
            {step && (
              <path
                d={path(s.points)}
                fill="none"
                stroke={`url(#${uid}-g${s.id})`}
                strokeWidth={stroke}
                strokeLinecap="round"
              />
            )}
            {labels && (
              <text
                x={project(s.points[0]).x - 8}
                y={project(s.points[0]).y - 7}
                fill="#56635e"
                fontSize="10"
                textAnchor="end"
                fontFamily="monospace"
              >
                {s.label}
              </text>
            )}
            <title>
              {s.label}: {s.volume.toFixed(3)} mm³; B acceptance{" "}
              {Math.round(s.low * 100)}-{Math.round(s.high * 100)}%
            </title>
          </g>
        );
      })}
      <g stroke="#263d36" strokeWidth="1.3">
        <path
          d={`M${start.x - 6} ${start.y}h12M${start.x} ${start.y - 6}v12`}
        />
        <circle cx={start.x} cy={start.y} r="9" fill="none" />
      </g>
      {active &&
        (stack || segments[active.id].layer === layer) &&
        (() => {
          const s = segments[active.id],
            pos = project(active.reverse ? s.points[0] : s.points.at(-1)!);
          return (
            <g>
              <circle
                cx={pos.x}
                cy={pos.y}
                r="6"
                fill="#fff"
                stroke="#193b40"
                strokeWidth="2.5"
              />
              <circle cx={pos.x} cy={pos.y} r="2" fill="#193b40" />
            </g>
          );
        })()}
      <text x="18" y="23" fill="#68736f" fontSize="10" fontFamily="monospace">
        {stack ? "OBLIQUE LAYER PROJECTION" : `PLAN VIEW · LAYER ${layer + 1}`}
      </text>
      <text
        x={W - 18}
        y="23"
        textAnchor="end"
        fill="#68736f"
        fontSize="10"
        fontFamily="monospace"
      >
        {c.preset === "benchmark" ? "ANALYTICAL CASE" : "IDEALISED GEOMETRY"}
      </text>
    </svg>
  );
}
export function TransitionPlot({
  config: c,
  result,
  visibleSteps,
}: {
  config: Config;
  result?: Result;
  visibleSteps: number;
}) {
  const W = 760,
    H = 178,
    x = (v: number) => 45 + (v / c.transitionVolume) * 690,
    y = (f: number) => 117 - f * 96;
  const curve = Array.from(
    { length: 101 },
    (_, i) =>
      `${i ? "L" : "M"}${x((i / 100) * c.transitionVolume)},${y(composition((i / 100) * c.transitionVolume, c))}`,
  ).join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Assumed composition curve and allocated transition volume"
    >
      <rect
        x="45"
        y={y(c.eligibleHigh)}
        width="690"
        height={(c.eligibleHigh - c.eligibleLow) * 96}
        fill="#e9f0ea"
      />
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <path d={`M45 ${y(f)}H735`} stroke="#dce3de" strokeDasharray="3 4" />
          <text
            x="34"
            y={y(f) + 4}
            textAnchor="end"
            fontSize="10"
            fill="#6b756e"
          >
            {f * 100}%
          </text>
        </g>
      ))}
      <path d={curve} stroke="#244c50" fill="none" strokeWidth="2" />
      <rect x="45" y="132" width="690" height="9" rx="1" fill="#e4dfd7" />
      {result?.steps.map((s, i) => (
        <rect
          key={s.id}
          x={x(s.start)}
          y="132"
          width={((s.end - s.start) / c.transitionVolume) * 690}
          height="9"
          fill={i < visibleSteps ? "#3d786b" : "#aabeb4"}
        >
          <title>
            Segment {s.id + 1}: {s.start.toFixed(2)}-{s.end.toFixed(2)} mm³
          </title>
        </rect>
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <text
          key={i}
          x={x((c.transitionVolume * i) / 4)}
          y="158"
          textAnchor="middle"
          fontSize="10"
          fill="#6b756e"
        >
          {+((c.transitionVolume * i) / 4).toFixed(1)}
        </text>
      ))}
      <text x="389" y="175" textAnchor="middle" fontSize="10" fill="#6b756e">
        Cumulative discharge / mm³
      </text>
    </svg>
  );
}
