import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Settings2,
  X,
  ArrowRight,
  Download,
  RotateCcw,
  Plus,
} from "lucide-react";
import { DEFAULT, BENCHMARK, type Config, type Run } from "./model/types";
import { geometry, validateConfig, bounds, parseConfig } from "./model/engine";
import {
  PATTERNS,
  nativePaths,
  slicePath,
  pathLength,
  type Pattern,
} from "./model/patterns";
import { increments, accounting } from "./model/timeline";
import { download, summaryCSV, exportSVG } from "./io";
import Methods from "./components/Methods";
import "./studio.css";
const initial: Config = {
  ...DEFAULT,
  materialA: "PLA",
  materialB: "TPU",
  iterations: 80,
  replicates: 3,
};
const fmt = (v: number, n = 1) => v.toFixed(n);
function Preview({ pattern }: { pattern: Pattern }) {
  const paths = nativePaths({ ...DEFAULT, pattern });
  return (
    <svg viewBox="-2 -2 44 22" aria-hidden="true">
      {paths.map((p, i) => (
        <polyline
          key={i}
          points={p.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth=".35"
        />
      ))}
    </svg>
  );
}
const blend = (a: string, b: string, t: number) => {
  const rgb = (s: string) =>
    [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  return `rgb(${rgb(a)
    .map((x, i) => Math.round(x + (rgb(b)[i] - x) * t))
    .join(",")})`;
};
export default function Studio() {
  const [config, setConfig] = useState(initial),
    [colors, setColors] = useState<[string, string]>(["#be6944", "#71824e"]);
  const [page, setPage] = useState("workspace"),
    [modal, setModal] = useState<string | null>(null),
    [draft, setDraft] = useState(initial);
  const [run, setRun] = useState<Run | null>(null),
    [matrix, setMatrix] = useState<Run[]>([]),
    [selected, setSelected] = useState(2),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  const [position, setPosition] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [diagnostic, setDiagnostic] = useState(false),
    [travels, setTravels] = useState(false);
  const worker = useRef<Worker | null>(null),
    dialog = useRef<HTMLDialogElement>(null),
    file = useRef<HTMLInputElement>(null);
  const issues = validateConfig(config),
    c = run?.config ?? config;
  const segments = useMemo(
    () => (issues.length ? [] : (run?.segments ?? geometry(config))),
    [config, run, issues.join()],
  );
  const result = run?.results[selected];
  const items = useMemo(
    () => (run && result ? increments(run, result) : []),
    [run, result],
  );
  const multi = c.mode === "multi",
    lead = multi ? 14 : 0,
    total = items.length + lead * 2,
    transitionPosition = Math.max(0, Math.min(items.length, position - lead));
  const bound = segments.length ? bounds(c, segments) : null,
    live = accounting(
      items,
      transitionPosition,
      multi ? c.transitionVolume : bound?.capacity || 1,
    );
  const phase = !run
    ? "Ready"
    : !multi
      ? "Single material"
      : position < lead
        ? "Pure material " + (c.direction === "AB" ? "A" : "B")
        : position < lead + items.length
          ? "Transition interval"
          : "Pure material " + (c.direction === "AB" ? "B" : "A");
  const pattern = PATTERNS.find((p) => p.id === config.pattern)!;
  const patch = (p: Partial<Config>) => {
    worker.current?.terminate();
    setBusy(false);
    setConfig((v) => ({ ...v, ...p }));
    setRun(null);
    setMatrix([]);
    setPlaying(false);
    setPosition(0);
    setDiagnostic(false);
    setError("");
  };
  const open = (m: string) => {
    setDraft({ ...config });
    setModal(m);
  };
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    if (!playing || !run || page !== "workspace" || modal) return;
    let last = performance.now(),
      id = 0;
    const tick = (now: number) => {
      setPosition((v) =>
        Math.min(total, v + (Math.min(100, now - last) / 1000) * speed * 22),
      );
      last = now;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, run, page, modal, total, speed]);
  useEffect(() => {
    if (position >= total) setPlaying(false);
  }, [position, total]);
  function launch(all = false) {
    if (issues.length) {
      setError(issues.join(" "));
      return;
    }
    worker.current?.terminate();
    setBusy(true);
    setProgress(0);
    setPlaying(false);
    setError("");
    const w = new Worker(new URL("./model/worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (e) => {
      const v = e.data;
      if (v.type === "progress") {
        setProgress(v.fraction);
        return;
      }
      setBusy(false);
      w.terminate();
      if (v.type === "error") setError(v.message);
      else if (v.type === "matrix") setMatrix(v.runs);
      else {
        setRun(v.run);
        setPosition(0);
        setSelected(2);
        setDiagnostic(false);
        setPlaying(true);
      }
    };
    w.onerror = () => {
      setError("Calculation interrupted. Check settings and run again.");
      setBusy(false);
      w.terminate();
    };
    w.postMessage({ config, matrix: all });
  }
  const number = (
    key: keyof Config,
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={
          Number.isFinite(draft[key] as number) ? (draft[key] as number) : ""
        }
        onChange={(e) =>
          setDraft((v) => ({
            ...v,
            [key]: e.target.value === "" ? NaN : Number(e.target.value),
          }))
        }
      />
    </label>
  );
  const active =
    items[Math.min(items.length - 1, Math.floor(transitionPosition))];
  const currentPoint = active?.used
    ? slicePath(
        active.points,
        0,
        pathLength(active.points) * (transitionPosition % 1),
      ).at(-1)
    : undefined;
  const changeResult = (i: number) => {
    setSelected(i);
    setPosition(0);
    setPlaying(false);
    setDiagnostic(false);
  };
  return (
    <div className="app">
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("workspace");
          }}
        >
          <span className="brand-mark">≋</span>InfillLab
          <span className="version">2.0</span>
        </a>
        <nav aria-label="Main navigation">
          {["workspace", "compare", "methods"].map((p) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => setPage(p)}
            >
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </nav>
        <span className="header-note">COMPUTATIONAL RESEARCH STUDIO</span>
      </header>
      <main>
        {page === "methods" ? (
          <Methods />
        ) : page === "compare" ? (
          <section className="comparison">
            <div className="section-heading">
              <div>
                <div className="eyebrow">CONTROLLED COMPARISON</div>
                <h1>Nine references. One proposal.</h1>
                <p>
                  Compare reference order and adaptive scheduling on each
                  pattern under the same input assumptions.
                </p>
              </div>
              <button
                className="primary"
                disabled={
                  busy || !!issues.length || config.preset === "benchmark"
                }
                onClick={() => launch(true)}
              >
                {busy
                  ? `Calculating ${Math.round(progress * 100)}%`
                  : "Compare all 10 patterns"}
              </button>
            </div>
            <div className="notice">
              {config.capacityMode === "equal"
                ? "Equal nominal volume: each native path is trimmed proportionally to the smallest catalogue capacity. These are budget-controlled variants, not full slicer patterns."
                : "Native geometry: capacities differ. Compare utilisation and coverage alongside absolute volumes."}{" "}
              Single layer,{" "}
              {config.mode === "multi" ? "shared melt path" : "single material"}
              , {config.replicates} seeds per pattern. Material names are
              labels.
            </div>
            {config.preset === "benchmark" && (
              <p>
                Return to Workspace and choose Pattern study to compare the
                catalogue.
              </p>
            )}
            {matrix.length > 0 ? (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Pattern</th>
                        <th>Capacity mm³</th>
                        <th>Reference use mm³</th>
                        <th>Adaptive use mm³</th>
                        <th>Coverage</th>
                        <th>Travel mm</th>
                        <th>Seed range mm³</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((r) => {
                        const a = r.results[2];
                        return (
                          <tr key={r.config.pattern}>
                            <th>
                              {
                                PATTERNS.find((p) => p.id === r.config.pattern)
                                  ?.name
                              }
                            </th>
                            <td>
                              {fmt(bounds(r.config, r.segments).capacity)}
                            </td>
                            <td>{fmt(r.results[0].used)}</td>
                            <td>{fmt(a.used)}</td>
                            <td>{fmt(a.coverage * 100)}%</td>
                            <td>{fmt(a.travel)}</td>
                            <td>
                              {fmt(
                                Math.min(...r.replicates.map((v) => v.used)),
                              )}{" "}
                              -{" "}
                              {fmt(
                                Math.max(...r.replicates.map((v) => v.used)),
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="actions">
                  <button
                    onClick={() =>
                      download(
                        "infilllab-pattern-comparison.json",
                        JSON.stringify(
                          {
                            schema: "infilllab-matrix/2",
                            colors,
                            runs: matrix,
                          },
                          null,
                          2,
                        ),
                        "application/json",
                      )
                    }
                  >
                    <Download size={16} /> Full comparison JSON
                  </button>
                  <button
                    onClick={() =>
                      download(
                        "infilllab-pattern-comparison.csv",
                        matrix
                          .map(
                            (r, i) =>
                              (i ? "" : "pattern,") +
                              summaryCSV(r)
                                .split("\r\n")
                                .filter((_, j) => !i || j > 0)
                                .map((line, j) =>
                                  !i && j === 0
                                    ? line
                                    : `${r.config.pattern},${line}`,
                                )
                                .join("\r\n"),
                          )
                          .join("\r\n"),
                        "text/csv",
                      )
                    }
                  >
                    CSV
                  </button>
                </div>
                <p className="muted">
                  Displayed adaptive result uses the first seed, not the best
                  seed. Empty receiver segments are not completed with pure
                  material in this transition-only study. No mechanical strength
                  ranking is implied.
                </p>
              </>
            ) : (
              <div className="empty">
                <h2>A reproducible comparison</h2>
                <p>
                  Set your materials and geometry in Workspace, then run the
                  catalogue here. Each pattern receives the same search budget
                  and seeds.
                </p>
                <div className="mini-catalogue">
                  {PATTERNS.map((p) => (
                    <div key={p.id}>
                      <Preview pattern={p.id} />
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <div className="workspace">
            <aside className="setup">
              <div className="eyebrow">01 / DEFINE THE EXPERIMENT</div>
              <h1>Material to motion.</h1>
              <p className="muted">
                Explore where transition material can go, and when it can get
                there.
              </p>
              <div className="segmented">
                <button
                  className={config.preset === "interface" ? "active" : ""}
                  onClick={() =>
                    patch({
                      ...initial,
                      materialA: config.materialA,
                      materialB: config.materialB,
                    })
                  }
                >
                  Pattern study
                </button>
                <button
                  className={config.preset === "benchmark" ? "active" : ""}
                  onClick={() =>
                    patch({
                      ...BENCHMARK,
                      materialA: config.materialA,
                      materialB: config.materialB,
                    })
                  }
                >
                  14.14 mm example
                </button>
              </div>
              <h3>Materials</h3>
              {[0, ...(multi ? [1] : [])].map((i) => (
                <button
                  className="material-card"
                  key={i}
                  onClick={() => open("material" + i)}
                >
                  <span className="spool" style={{ color: colors[i] }}>
                    ◉
                  </span>
                  <span>
                    <small>MATERIAL {i ? "B" : "A"}</small>
                    <strong>{i ? config.materialB : config.materialA}</strong>
                  </span>
                  <Settings2 size={16} />
                </button>
              ))}
              {config.preset !== "benchmark" && (
                <button
                  className="text-button"
                  onClick={() => patch({ mode: multi ? "single" : "multi" })}
                >
                  {multi ? (
                    "Use one material"
                  ) : (
                    <>
                      <Plus size={15} /> Add second material
                    </>
                  )}
                </button>
              )}
              <div className="architecture">
                {multi
                  ? "Shared melt path · one receiving layer"
                  : "Single material · one layer"}
              </div>
              <h3>Receiving pattern</h3>
              <button
                disabled={config.preset === "benchmark"}
                className="pattern-card"
                onClick={() => open("patterns")}
              >
                <Preview pattern={config.pattern} />
                <span>
                  <strong>
                    {config.preset === "benchmark"
                      ? "Two analytical segments"
                      : pattern.name}
                  </strong>
                  <small>
                    {config.preset === "benchmark"
                      ? "Analytical benchmark"
                      : config.pattern === "taii"
                        ? "Experimental proposal"
                        : "Reference family"}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
              <p className="small">
                {config.preset === "benchmark"
                  ? "Fixed segment windows isolate the scheduling constraint."
                  : pattern.note}
              </p>
              <button
                className="settings-button"
                onClick={() => open("settings")}
              >
                <Settings2 size={17} />
                {fmt(config.width, 0)} × {fmt(config.height, 0)} mm · Experiment
                settings
              </button>
              <button
                className="primary run-button"
                disabled={busy || !!issues.length}
                onClick={() => launch()}
              >
                <Play size={17} />
                {busy
                  ? `Computing ${Math.round(progress * 100)}%`
                  : "Generate & simulate"}
              </button>
              {busy && (
                <button
                  className="text-button"
                  onClick={() => {
                    worker.current?.terminate();
                    setBusy(false);
                  }}
                >
                  Cancel calculation
                </button>
              )}
              <div className="import-export">
                <button onClick={() => file.current?.click()}>
                  Import experiment
                </button>
                <button
                  onClick={() => {
                    patch(initial);
                    setColors(["#be6944", "#71824e"]);
                  }}
                >
                  Reset
                </button>
              </div>
              <input
                ref={file}
                hidden
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const v = JSON.parse(await f.text());
                    patch(parseConfig(v));
                    if (
                      Array.isArray(v.colors) &&
                      v.colors.length === 2 &&
                      v.colors.every(
                        (x: unknown) =>
                          typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x),
                      )
                    )
                      setColors(v.colors);
                  } catch (err) {
                    setError(String(err));
                  }
                  e.target.value = "";
                }}
              />
            </aside>
            <section className="experiment">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">02 / FOLLOW THE EXTRUSION</div>
                  <h2>
                    {config.preset === "benchmark"
                      ? "Shorter is not always feasible"
                      : pattern.name}
                  </h2>
                </div>
                <span className="status">
                  {busy
                    ? "Calculating"
                    : run
                      ? "Simulation ready"
                      : "Geometry preview"}
                </span>
              </div>
              <div className="scene-toolbar">
                {run ? (
                  <select
                    aria-label="Scheduling method"
                    value={selected}
                    onChange={(e) => changeResult(Number(e.target.value))}
                  >
                    {run.results.map((r, i) => (
                      <option key={r.algorithm} value={i}>
                        {r.algorithm}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>Generate a schedule to start</span>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={travels}
                    onChange={(e) => setTravels(e.target.checked)}
                  />{" "}
                  Travel moves
                </label>
                {config.preset === "benchmark" && (
                  <label>
                    <input
                      type="checkbox"
                      checked={diagnostic}
                      onChange={(e) => {
                        setDiagnostic(e.target.checked);
                        setPlaying(false);
                      }}
                    />{" "}
                    Show invalid shortcut
                  </label>
                )}
              </div>
              <div className="scene">
                <div className="scene-label">
                  <span className={playing ? "pulse" : ""} />{" "}
                  {diagnostic ? "REJECTED SCHEDULE" : phase.toUpperCase()}
                </div>
                <svg
                  id="toolpath-figure"
                  role="img"
                  aria-label="Two dimensional receiving paths and extrusion animation"
                  viewBox={`-8 -10 ${c.width + 16} ${c.height + 22}`}
                >
                  <defs>
                    <pattern
                      id="grid"
                      width="5"
                      height="5"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M5 0H0V5"
                        fill="none"
                        stroke="#e4e4da"
                        strokeWidth=".08"
                      />
                    </pattern>
                  </defs>
                  <rect
                    x="0"
                    y="0"
                    width={c.width}
                    height={c.height}
                    fill="url(#grid)"
                    stroke="#bfc3b3"
                    strokeWidth=".15"
                  />
                  {segments.map((s) => (
                    <polyline
                      key={s.id}
                      points={s.points
                        .map((p) => `${p.x},${c.height - p.y}`)
                        .join(" ")}
                      fill="none"
                      stroke={diagnostic ? "#b34435" : "#cbd0c3"}
                      strokeWidth={c.beadWidth}
                      opacity={diagnostic ? 1 : 0.65}
                    />
                  ))}
                  {multi && !diagnostic && (
                    <>
                      <path
                        d={`M0 ${c.height + 4}H${c.width * Math.min(1, position / lead)}`}
                        stroke={colors[c.direction === "AB" ? 0 : 1]}
                        strokeWidth={c.beadWidth}
                      />
                      <path
                        d={`M0 -4H${c.width * Math.max(0, Math.min(1, (position - lead - items.length) / lead))}`}
                        stroke={colors[c.direction === "AB" ? 1 : 0]}
                        strokeWidth={c.beadWidth}
                      />
                    </>
                  )}
                  {!diagnostic &&
                    items.map((v, i) => {
                      if (i >= transitionPosition || !v.used) return null;
                      return (
                        <polyline
                          key={i}
                          points={slicePath(
                            v.points,
                            0,
                            pathLength(v.points) *
                              Math.min(1, transitionPosition - i),
                          )
                            .map((p) => `${p.x},${c.height - p.y}`)
                            .join(" ")}
                          fill="none"
                          stroke={blend(colors[0], colors[1], v.c)}
                          strokeWidth={c.beadWidth}
                          opacity={1}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  {travels &&
                    !diagnostic &&
                    result?.steps
                      .filter((s) => s.start <= (active?.start ?? 0))
                      .map((s, i) => (
                        <line
                          key={i}
                          x1={s.travelFrom.x}
                          y1={c.height - s.travelFrom.y}
                          x2={s.travelTo.x}
                          y2={c.height - s.travelTo.y}
                          stroke="#756d60"
                          strokeWidth=".1"
                          strokeDasharray=".7 .5"
                        />
                      ))}
                  {diagnostic && (
                    <>
                      <line
                        x1="60"
                        y1="0"
                        x2="70"
                        y2="10"
                        stroke="#b34435"
                        strokeWidth=".25"
                        strokeDasharray="1 .6"
                      />
                      <text x="28" y="-2" fontSize="2.2" fill="#a53629">
                        B first: c = 0 to 0.5 is rejected
                      </text>
                      <text x="28" y="14" fontSize="2.2" fill="#a53629">
                        A second: c = 0.5 to 1 is rejected
                      </text>
                    </>
                  )}
                  {!diagnostic &&
                    playing &&
                    currentPoint &&
                    position >= lead &&
                    position < lead + items.length && (
                      <circle
                        cx={currentPoint.x}
                        cy={c.height - currentPoint.y}
                        r=".9"
                        fill="#30372c"
                        stroke="white"
                        strokeWidth=".25"
                      />
                    )}
                  <text x="0" y={c.height + 8} fontSize="1.7" fill="#777d70">
                    {c.width} mm · top view · nominal centreline geometry
                  </text>
                </svg>
                <div className="scene-footer">
                  <span>
                    <i style={{ background: colors[0] }} /> {config.materialA}
                  </span>
                  {multi && (
                    <span>
                      <i style={{ background: colors[1] }} /> {config.materialB}
                    </span>
                  )}
                  <span>
                    <i style={{ background: "#cbd0c3" }} /> Unfilled receiver
                  </span>
                </div>
              </div>
              {diagnostic ? (
                <div className="notice danger">
                  <strong>14.14 mm travel · infeasible</strong>
                  <p>
                    The B-first shortcut violates both composition windows.
                    These are attempted deposits, not accepted allocations. The
                    complete feasible A-first route requires 28.28 mm.
                    Inter-segment purging is disabled in this analytical
                    example.
                  </p>
                </div>
              ) : (
                <>
                  <div className="playback">
                    <button
                      aria-label={
                        playing ? "Pause animation" : "Play animation"
                      }
                      disabled={!run}
                      onClick={() => {
                        if (position >= total) setPosition(0);
                        setPlaying(!playing);
                      }}
                    >
                      {playing ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      aria-label="Restart animation"
                      disabled={!run}
                      onClick={() => {
                        setPosition(0);
                        setPlaying(false);
                      }}
                    >
                      <RotateCcw size={16} />
                    </button>
                    <input
                      aria-label="Animation position"
                      type="range"
                      min="0"
                      max={total || 1}
                      step=".1"
                      value={position}
                      disabled={!run}
                      onChange={(e) => {
                        setPosition(Number(e.target.value));
                        setPlaying(false);
                      }}
                    />
                    <select
                      aria-label="Animation speed"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                    >
                      {[0.5, 1, 2, 4].map((s) => (
                        <option key={s} value={s}>
                          {s}×
                        </option>
                      ))}
                    </select>
                  </div>
                  {multi && (
                    <div className="phase-strip">
                      <span
                        className={
                          phase.startsWith("Pure") && position < lead
                            ? "active"
                            : ""
                        }
                      >
                        Pure {c.direction === "AB" ? "A" : "B"}
                      </span>
                      <span
                        className={
                          phase === "Transition interval" ? "active" : ""
                        }
                      >
                        Transition · ΔV ≤ {fmt(c.transitionVolume / 180, 3)} mm³
                      </span>
                      <span
                        className={
                          phase.startsWith("Pure") && position >= lead
                            ? "active"
                            : ""
                        }
                      >
                        Pure {c.direction === "AB" ? "B" : "A"}
                      </span>
                    </div>
                  )}
                  <div className="metrics">
                    <div>
                      <small>{multi ? "TRANSITION REUSED" : "DEPOSITED"}</small>
                      <strong>
                        {fmt(live.used)} <em>mm³</em>
                      </strong>
                    </div>
                    <div>
                      <small>EXTERNAL DISCARD</small>
                      <strong>
                        {fmt(live.discarded)} <em>mm³</em>
                      </strong>
                    </div>
                    <div>
                      <small>REMAINING</small>
                      <strong>
                        {fmt(live.remaining)} <em>mm³</em>
                      </strong>
                    </div>
                    <div>
                      <small>{multi ? "UTILISATION η" : "PROGRESS"}</small>
                      <strong>
                        {fmt(live.eta * 100)}
                        <em>%</em>
                      </strong>
                    </div>
                  </div>
                  <p className="accounting-note">
                    {multi
                      ? `η upper bound: ${fmt(((bound?.upperUse ?? 0) / c.transitionVolume) * 100)}% · Avoided discard so far: ${fmt(live.used)} mm³. Pure A/B strokes show context outside this budget.`
                      : "Single-material mode has no transition blend or purge budget."}{" "}
                    {run && position >= lead && position < lead + items.length
                      ? `Current increment: ${active?.used ? "accepted (y = 1)" : "external purge (y = 0)"}, cB = ${fmt(active?.c ?? 0, 3)}.`
                      : ""}
                  </p>
                </>
              )}
              <div className="results">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">03 / INSPECT THE OUTCOME</div>
                    <h2>
                      {diagnostic
                        ? "Feasible schedule results"
                        : "Schedule results"}
                    </h2>
                  </div>
                  {run && (
                    <div className="actions">
                      <button
                        onClick={() =>
                          download(
                            "infilllab-experiment.json",
                            JSON.stringify({ ...run, colors }, null, 2),
                            "application/json",
                          )
                        }
                      >
                        <Download size={15} />
                        JSON
                      </button>
                      <button
                        onClick={() =>
                          download(
                            "infilllab-results.csv",
                            summaryCSV(run),
                            "text/csv",
                          )
                        }
                      >
                        CSV
                      </button>
                      <button onClick={exportSVG}>SVG</button>
                    </div>
                  )}
                </div>
                {result ? (
                  <>
                    <div className="result-summary">
                      <span>
                        <strong>{fmt(result.used)} mm³</strong> final accepted
                        volume
                      </span>
                      <span>
                        <strong>{fmt(result.travel)} mm</strong> non-extruding
                        travel
                      </span>
                      <span>
                        <strong>{fmt(result.coverage * 100)}%</strong> receiver
                        coverage
                      </span>
                      <span>
                        <strong>{result.unassigned.length}</strong> unfilled
                        segments
                      </span>
                    </div>
                    <p className="small">
                      {result.complete
                        ? "All receiver segments are scheduled."
                        : "Partial allocation: the remaining geometry is not filled in this model."}{" "}
                      This is a path and material-accounting simulation, not a
                      mechanical test. Adaptive search prioritises coverage,
                      then the weighted discard/travel objective.
                    </p>
                    <details>
                      <summary>Inspect allocation schedule</summary>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Segment</th>
                              <th>Volume interval mm³</th>
                              <th>cB interval</th>
                              <th>Local window</th>
                              <th>Purge before mm³</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.steps.map((step) => {
                              const s = segments[step.id];
                              return (
                                <tr key={step.id}>
                                  <th>{s.label}</th>
                                  <td>
                                    {fmt(step.start, 2)} - {fmt(step.end, 2)}
                                  </td>
                                  <td>
                                    {fmt(step.cStart, 3)} - {fmt(step.cEnd, 3)}
                                  </td>
                                  <td>
                                    {fmt(s.low, 3)} - {fmt(s.high, 3)}
                                  </td>
                                  <td>{fmt(step.purgeBefore, 2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="small">
                        All listed allocations passed the whole-segment
                        composition check. Unassigned segment IDs:{" "}
                        {result.unassigned
                          .map((id) => segments[id].label)
                          .join(", ") || "none"}
                        . In single-material mode windows are inactive.
                      </p>
                    </details>
                  </>
                ) : (
                  <p className="muted">
                    Generate a schedule to inspect its accepted volume, travel
                    and unfilled receiving segments.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
        {(error || issues.length > 0) && (
          <div role="alert" className="error">
            {error || issues.join(" ")}
          </div>
        )}
      </main>
      <footer>
        InfillLab / Model 2.0 · Reproducible scheduling, explicit assumptions.
        <span>No predicted strength. No machine-ready G-code.</span>
      </footer>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
      >
        <div className="dialog-heading">
          <h2>
            {modal === "patterns"
              ? "Choose a receiving pattern"
              : modal === "settings"
                ? "Experiment settings"
                : "Material " + (modal === "material1" ? "B" : "A")}
          </h2>
          <button aria-label="Close dialog" onClick={() => setModal(null)}>
            <X size={20} />
          </button>
        </div>
        {modal === "patterns" ? (
          <>
            <p className="muted">
              Nine reference families and one experimental proposal. Geometry is
              a simplified model, not a slicer replica.
            </p>
            <div className="pattern-grid">
              {PATTERNS.map((p, i) => (
                <button
                  key={p.id}
                  className={config.pattern === p.id ? "selected" : ""}
                  onClick={() => {
                    patch({ pattern: p.id });
                    setModal(null);
                  }}
                >
                  <Preview pattern={p.id} />
                  <small>
                    {String(i + 1).padStart(2, "0")}
                    {i === 9 ? " / PROPOSAL" : ""}
                  </small>
                  <strong>{p.name}</strong>
                  <span>{p.note}</span>
                </button>
              ))}
            </div>
          </>
        ) : modal?.startsWith("material") ? (
          <>
            <p className="muted">
              Names and colours identify materials. They do not set measured
              adhesion, transition volume or mechanical properties.
            </p>
            <div className="material-options">
              {["PLA", "PETG", "TPU", "ABS", "Nylon", "Custom"].map((m) => (
                <button
                  key={m}
                  className={
                    (modal === "material1"
                      ? draft.materialB
                      : draft.materialA) === m
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setDraft((v) => ({
                      ...v,
                      [modal === "material1" ? "materialB" : "materialA"]: m,
                    }))
                  }
                >
                  {m}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Material label</span>
              <input
                maxLength={40}
                value={
                  modal === "material1" ? draft.materialB : draft.materialA
                }
                onChange={(e) =>
                  setDraft((v) => ({
                    ...v,
                    [modal === "material1" ? "materialB" : "materialA"]:
                      e.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Display colour</span>
              <input
                type="color"
                value={colors[modal === "material1" ? 1 : 0]}
                onChange={(e) =>
                  setColors((v) =>
                    modal === "material1"
                      ? [v[0], e.target.value]
                      : [e.target.value, v[1]],
                  )
                }
              />
            </label>
            <button
              className="primary"
              onClick={() => {
                patch({
                  materialA: draft.materialA,
                  materialB: draft.materialB,
                });
                setModal(null);
              }}
            >
              Apply material
            </button>
          </>
        ) : modal === "settings" ? (
          <>
            <p className="muted">
              One material switch in one receiving layer. Volumes and acceptance
              windows are research assumptions until calibrated.
            </p>
            {config.preset === "benchmark" ? (
              <div className="notice">
                Analytical geometry is locked: two 6 mm³ segments, Vtr = 12 mm³,
                cB = v/Vtr. No inter-segment purge. Switch to Pattern study to
                change geometry.
              </div>
            ) : (
              <>
                <div className="field-grid">
                  {number("width", "Region width (mm)", 5, 150)}
                  {number("height", "Region height (mm)", 2, 100)}
                  {number("spacing", "Path spacing (mm)", 0.5, 20, 0.1)}
                  {multi &&
                    number(
                      "transitionVolume",
                      "Transition volume (mm³)",
                      0.1,
                      3000,
                      1,
                    )}
                </div>
                <label className="field">
                  <span>Comparison capacity</span>
                  <select
                    value={draft.capacityMode}
                    onChange={(e) =>
                      setDraft((v) => ({
                        ...v,
                        capacityMode: e.target.value as Config["capacityMode"],
                      }))
                    }
                  >
                    <option value="equal">
                      Equal volume - trimmed reference variants
                    </option>
                    <option value="native">
                      Native geometry - differing capacities
                    </option>
                  </select>
                </label>
                <details>
                  <summary>Advanced model settings</summary>
                  <div className="field-grid">
                    {number("beadWidth", "Bead width (mm)", 0.2, 2, 0.05)}
                    {number("layerHeight", "Layer height (mm)", 0.05, 1, 0.05)}
                    {multi && (
                      <>
                        {number("gamma", "Composition exponent γ", 0.2, 5, 0.1)}
                        {number(
                          "tolerance",
                          "Local window half-width",
                          0.02,
                          0.5,
                          0.01,
                        )}
                        {number("eligibleLow", "Global cB minimum", 0, 1, 0.05)}
                        {number(
                          "eligibleHigh",
                          "Global cB maximum",
                          0,
                          1,
                          0.05,
                        )}
                        <label className="field">
                          <span>Acceptance field</span>
                          <select
                            value={draft.acceptance}
                            onChange={(e) =>
                              setDraft((v) => ({
                                ...v,
                                acceptance: e.target
                                  .value as Config["acceptance"],
                              }))
                            }
                          >
                            <option value="graded">
                              Position-dependent windows
                            </option>
                            <option value="uniform">Uniform [0, 1]</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Switch direction</span>
                          <select
                            value={draft.direction}
                            onChange={(e) =>
                              setDraft((v) => ({
                                ...v,
                                direction: e.target
                                  .value as Config["direction"],
                              }))
                            }
                          >
                            <option>AB</option>
                            <option>BA</option>
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                  <p className="small">
                    IDEX / separate nozzles do not share this transition model.
                    PLA/TPU compatibility and feeding must be established
                    separately.
                  </p>
                </details>
              </>
            )}
            <details>
              <summary>Search and repeatability</summary>
              <div className="field-grid">
                {number("iterations", "Iterations per seed", 10, 2000, 10)}
                {number("replicates", "Seeds", 1, 10)}
                {number("seed", "Starting seed", 0, 4294967295)}
                {number("alpha", "Discard weight α", 0, 1, 0.05)}
              </div>
            </details>
            {validateConfig(draft).length > 0 && (
              <p className="error">{validateConfig(draft).join(" ")}</p>
            )}
            <button
              className="primary"
              disabled={validateConfig(draft).length > 0}
              onClick={() => {
                patch(draft);
                setModal(null);
              }}
            >
              Apply settings
            </button>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
