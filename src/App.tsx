import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Download,
  Upload,
  ChevronRight,
  ArrowUpRight,
  SlidersHorizontal,
  FlaskConical,
  Layers,
  Check,
  CircleHelp,
  X,
  Square,
  FileJson,
  Table2,
  ImageDown,
  Printer,
} from "lucide-react";
import {
  DEFAULT,
  BENCHMARK,
  type Config,
  type Run,
  type Result,
} from "./model/types";
import { bounds, geometry, parseConfig, validateConfig } from "./model/engine";
import { Controls } from "./components/Controls";
import { ToolpathPlot, TransitionPlot } from "./components/Plot";
import Methods from "./components/Methods";
import { download, summaryCSV, exportSVG } from "./io";
const f = (n: number, dp = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-GB", {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      })
    : "-";
function initialConfig(): Config {
  try {
    const raw = localStorage.getItem("infilllab-config");
    return raw ? parseConfig(JSON.parse(raw)) : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}
function Status({ complete }: { complete: boolean }) {
  return (
    <span className={`status ${complete ? "complete" : "partial"}`}>
      {complete ? <Check size={12} /> : <CircleHelp size={12} />}
      {complete ? "Complete allocation" : "Partial allocation"}
    </span>
  );
}
function Compare({
  run,
  selected,
  select,
}: {
  run: Run;
  selected: number;
  select: (i: number) => void;
}) {
  const values = run.replicates.map((r) => r.travel).sort((a, b) => a - b),
    median =
      values.length % 2
        ? values[Math.floor(values.length / 2)]
        : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
  const maxL = Math.max(...run.results.map((r) => r.travel), 1);
  return (
    <div className="comparison">
      <div className="page-intro">
        <span className="eyebrow">CONTROLLED COMPARISON</span>
        <h2>Same geometry. Different schedules.</h2>
        <p>
          All methods share the material history, acceptance windows and layer
          constraints. Partial allocations do not represent equally completed
          parts.
        </p>
      </div>
      <div className="table-scroll">
        <table className="results-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Assigned</th>
              <th>Used / mm³</th>
              <th>Discard / mm³</th>
              <th>Travel / mm</th>
              <th>Cost J</th>
              <th>Allocation</th>
            </tr>
          </thead>
          <tbody>
            {run.results.map((r, i) => (
              <tr
                key={r.algorithm}
                className={selected === i ? "selected-row" : ""}
              >
                <th>
                  <button className="table-method" onClick={() => select(i)}>
                    {r.algorithm}
                    <ArrowUpRight size={13} />
                  </button>
                  {r.seed !== undefined && <small>Seed {r.seed}</small>}
                </th>
                <td>
                  {r.steps.length}/{run.segments.length}
                </td>
                <td>{f(r.used)}</td>
                <td>{f(r.discarded)}</td>
                <td>{f(r.travel)}</td>
                <td>{f(r.score, 4)}</td>
                <td>
                  <Status complete={r.complete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="compare-grid">
        <section>
          <h3>Non-deposition travel</h3>
          <p className="muted">
            Compare completion status before comparing distance.
          </p>
          <div className="bar-chart">
            {run.results.map((r, i) => (
              <div className="bar-row" key={r.algorithm}>
                <span>{r.algorithm}</span>
                <div>
                  <div
                    style={{
                      width: `${(r.travel / maxL) * 100}%`,
                      background: i === 2 ? "#28635e" : "#9caea5",
                    }}
                  />
                </div>
                <strong>
                  {f(r.travel, 1)} <small>mm</small>
                </strong>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3>Adaptive repeatability</h3>
          <p className="muted">
            {run.replicates.length} consecutive seeds, {run.config.iterations}{" "}
            search evaluations each. The displayed route uses the first seed.
          </p>
          <dl className="stats-list">
            <div>
              <dt>Complete allocations</dt>
              <dd>
                {run.replicates.filter((r) => r.complete).length} /{" "}
                {run.replicates.length}
              </dd>
            </div>
            <div>
              <dt>Travel range</dt>
              <dd>
                {f(values[0])} - {f(values.at(-1)!)} mm
              </dd>
            </div>
            <div>
              <dt>Median travel</dt>
              <dd>{f(median)} mm</dd>
            </div>
            <div>
              <dt>Browser compute time</dt>
              <dd>
                {f(
                  run.replicates.reduce((s, r) => s + r.runtimeMs, 0),
                  0,
                )}{" "}
                ms
              </dd>
            </div>
          </dl>
          <p className="field-note">
            Travel statistics include partial routes if present; they are
            descriptive, not a superiority test.
          </p>
        </section>
      </div>
      <section className="convergence">
        <h3>Search history</h3>
        <p className="muted">
          First seed. Coverage ranks ahead of weighted cost, so J can increase
          when a more complete assignment is found.
        </p>
        <div className="table-scroll convergence-table">
          <table>
            <thead>
              <tr>
                <th>Evaluation</th>
                <th>Assigned tracks</th>
                <th>Incumbent J</th>
              </tr>
            </thead>
            <tbody>
              {run.results[2].trace
                .filter(
                  (_, i, all) =>
                    i === 0 ||
                    i === all.length - 1 ||
                    i % Math.max(1, Math.floor(all.length / 8)) === 0,
                )
                .map((t) => (
                  <tr key={t.evaluation}>
                    <td>{t.evaluation}</td>
                    <td>{t.assigned}</td>
                    <td>{f(t.score, 5)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
export default function App() {
  const [config, setConfig] = useState<Config>(initialConfig),
    [run, setRun] = useState<Run | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0);
  const [tab, setTab] = useState<"experiment" | "compare" | "methods">(
      "experiment",
    ),
    [selected, setSelected] = useState(2),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  const [layer, setLayer] = useState(0),
    [stack, setStack] = useState(false),
    [travel, setTravel] = useState(true),
    [labels, setLabels] = useState(false),
    [inspected, setInspected] = useState<number | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [exportOpen, setExportOpen] = useState(false),
    [speed, setSpeed] = useState(450);
  const worker = useRef<Worker | null>(null),
    fileInput = useRef<HTMLInputElement>(null),
    exportRef = useRef<HTMLDivElement>(null);
  const errors = validateConfig(config),
    segments = run?.segments ?? (errors.length ? [] : geometry(config)),
    result = run?.results[selected],
    limit = result?.steps.length ?? 0;
  const bound = errors.length ? null : bounds(config, segments),
    viewed = inspected === null ? null : segments[inspected];
  const update = (partial: Partial<Config>) => {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setRun(null);
    setPlaying(false);
    setStep(0);
    setInspected(null);
    setLayer(0);
    setError("");
    setConfig((c) => ({ ...c, ...partial }));
  };
  function launch(c: Config = config) {
    const issues = validateConfig(c);
    if (issues.length) {
      setError(issues.join(" "));
      return;
    }
    worker.current?.terminate();
    setBusy(true);
    setProgress(0);
    setError("");
    setPlaying(false);
    setExportOpen(false);
    const instance = new Worker(new URL("./model/worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = instance;
    instance.onmessage = (e) => {
      if (e.data.type === "progress") setProgress(e.data.fraction);
      if (e.data.type === "result") {
        const study = e.data.run as Run;
        setRun(study);
        setConfig(study.config);
        setSelected(2);
        setStep(study.results[2].steps.length);
        setBusy(false);
        setLayer(0);
        instance.terminate();
        worker.current = null;
      }
      if (e.data.type === "error") {
        setError(e.data.message);
        setBusy(false);
        instance.terminate();
        worker.current = null;
      }
    };
    instance.onerror = () => {
      setError(
        "The calculation worker could not start. Check the local server or reload the page.",
      );
      setBusy(false);
      instance.terminate();
      worker.current = null;
    };
    instance.postMessage(c);
  }
  useEffect(() => {
    launch(config);
    return () => worker.current?.terminate();
  }, []);
  useEffect(() => {
    if (!errors.length)
      try {
        localStorage.setItem("infilllab-config", JSON.stringify(config));
      } catch {
        /* Local storage is optional. */
      }
  }, [config]);
  useEffect(() => {
    if (!playing) return;
    if (step >= limit) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setStep((s) => s + 1);
      if (result) setLayer(segments[result.steps[step].id].layer);
    }, speed);
    return () => clearTimeout(timer);
  }, [playing, step, limit, speed, result, segments]);
  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportOpen]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  function preset(which: "interface" | "benchmark") {
    const next = { ...(which === "benchmark" ? BENCHMARK : DEFAULT) };
    update(next);
    setStack(false);
    setTab("experiment");
    launch(next);
  }
  function selectResult(i: number) {
    setSelected(i);
    setStep(run?.results[i].steps.length ?? 0);
    setPlaying(false);
    setInspected(null);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Use a JSON file smaller than 2 MB.");
      const imported = parseConfig(JSON.parse(await file.text()));
      update(imported);
      launch(imported);
      setNotice("Configuration imported. Results are being recomputed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import this file.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function doExport(kind: "json" | "csv" | "svg") {
    if (!run) return;
    const date = new Date().toISOString().slice(0, 10);
    if (kind === "json")
      download(
        `infilllab-${date}.json`,
        JSON.stringify(run, null, 2),
        "application/json",
      );
    if (kind === "csv")
      download(
        `infilllab-${date}.csv`,
        summaryCSV(run),
        "text/csv;charset=utf-8",
      );
    if (kind === "svg") exportSVG();
    setExportOpen(false);
  }
  const active = result?.steps[step - 1];
  return (
    <>
      <header className="app-header">
        <div className="brand">
          <div className="brand-symbol" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <path d="M5 6h22v6H5v7h22v7H5" />
            </svg>
          </div>
          <div>
            <h1>InfillLab</h1>
            <span>TRANSITION MATERIAL & TOOLPATHS</span>
          </div>
        </div>
        <div className="header-right">
          <span className="version">
            RESEARCH PROTOTYPE <b>1.0</b>
          </span>
          <button className="quiet-button" onClick={() => setTab("methods")}>
            <CircleHelp size={16} />
            <span>Model notes</span>
          </button>
          <div className="export-wrap" ref={exportRef}>
            <button
              className="outline-button"
              disabled={!run || busy}
              onClick={() => setExportOpen((v) => !v)}
              aria-expanded={exportOpen}
            >
              <Download size={15} />
              Export
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={() => doExport("json")}>
                  <FileJson size={16} />
                  Full experiment .json
                </button>
                <button onClick={() => doExport("csv")}>
                  <Table2 size={16} />
                  Results table .csv
                </button>
                <button
                  disabled={tab !== "experiment"}
                  onClick={() => doExport("svg")}
                >
                  <ImageDown size={16} />
                  Visible toolpath .svg
                </button>
                <button
                  onClick={() => {
                    setExportOpen(false);
                    window.print();
                  }}
                >
                  <Printer size={16} />
                  Print current view
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">COMPUTATIONAL EXPERIMENT</span>
          <h2>From transition volume to deposition path.</h2>
          <p>
            Explore where material can be placed, and how the route changes its
            use.
          </p>
        </div>
        <div className="scope-note">
          <span className="scope-dot" />
          Geometric allocation model<span>No strength prediction</span>
        </div>
      </div>
      <nav className="main-tabs" aria-label="Workspace">
        <div>
          {(["experiment", "compare", "methods"] as const).map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "experiment" ? (
                <FlaskConical size={16} />
              ) : t === "compare" ? (
                <Table2 size={16} />
              ) : (
                <CircleHelp size={16} />
              )}
              {
                {
                  experiment: "Experiment",
                  compare: "Comparison",
                  methods: "Methods & references",
                }[t]
              }
            </button>
          ))}
        </div>
        <span className="local-label">
          All calculations stay in your browser
        </span>
      </nav>
      {error && (
        <div className="message error" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="message" role="status">
          {notice}
          <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {tab === "methods" ? (
        <Methods />
      ) : tab === "compare" ? (
        run ? (
          <Compare
            run={run}
            selected={selected}
            select={(i) => {
              selectResult(i);
              setTab("experiment");
            }}
          />
        ) : (
          <div className="empty-state">
            <Table2 size={30} />
            <h2>Run an experiment to compare schedules.</h2>
            <p>
              Each method will use the same geometry and material constraints.
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setTab("experiment");
                launch();
              }}
              disabled={!!errors.length || busy}
            >
              Run comparison <ChevronRight size={16} />
            </button>
          </div>
        )
      ) : (
        <main className="workspace">
          <aside className="parameter-panel">
            <div className="panel-heading">
              <h3>
                <SlidersHorizontal size={15} />
                Experiment setup
              </h3>
              <button
                className="icon-button"
                title="Reset to interface defaults"
                aria-label="Reset experiment"
                onClick={() => preset("interface")}
              >
                <RotateCcw size={15} />
              </button>
            </div>
            <div className="preset-picker">
              <label htmlFor="preset">Starting point</label>
              <select
                id="preset"
                value={config.preset}
                onChange={(e) => preset(e.target.value as Config["preset"])}
              >
                <option value="interface">Interface allocation study</option>
                <option value="benchmark">Manuscript verification case</option>
              </select>
              <button
                className="text-button"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={13} />
                Import experiment JSON
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => importFile(e.target.files?.[0])}
              />
            </div>
            <Controls config={config} update={update} />
            {errors.length > 0 && (
              <ul className="validation-errors" role="alert">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="run-panel">
              {busy ? (
                <>
                  <button
                    className="primary-button"
                    onClick={() => {
                      worker.current?.terminate();
                      worker.current = null;
                      setBusy(false);
                      setNotice("Calculation stopped.");
                    }}
                  >
                    <Square size={14} />
                    Stop calculation <span>{Math.round(progress * 100)}%</span>
                  </button>
                  <progress
                    value={progress}
                    max="1"
                    aria-label="Search progress"
                  />
                </>
              ) : (
                <button
                  className="primary-button"
                  disabled={!!errors.length}
                  onClick={() => launch()}
                >
                  <Play size={15} />
                  Run comparison <ChevronRight size={16} />
                </button>
              )}
              <span>
                {run
                  ? "Change parameters to start a new experiment."
                  : "Parameters ready. Run to calculate all methods."}
              </span>
            </div>
          </aside>
          <section
            className="simulation-panel"
            aria-label="Simulation workspace"
          >
            <div className="simulation-heading">
              <div>
                <span className="eyebrow">DEPOSITION WORKSPACE</span>
                <h3>
                  {config.preset === "benchmark"
                    ? "Two-segment verification"
                    : "Transition allocation"}
                </h3>
              </div>
              <span className="geometry-meta">
                {segments.length} tracks · {config.layers} layer
                {config.layers === 1 ? "" : "s"}
                {bound && <> · {f(bound.capacity, 1)} mm³ capacity</>}
              </span>
            </div>
            <div className="method-strip" aria-label="Displayed algorithm">
              {[
                "Fixed raster",
                "Nearest feasible",
                "Adaptive search",
                ...(config.preset === "benchmark" ? ["Exact enumeration"] : []),
              ].map((name, i) => (
                <button
                  key={name}
                  disabled={!run || busy}
                  className={selected === i ? "selected" : ""}
                  onClick={() => selectResult(i)}
                >
                  {name}
                  {i === 2 && <span>seed {config.seed}</span>}
                </button>
              ))}
            </div>
            <div className="plot-toolbar">
              <div className="view-switch">
                <button
                  className={!stack ? "selected" : ""}
                  onClick={() => setStack(false)}
                >
                  Layer view
                </button>
                <button
                  className={stack ? "selected" : ""}
                  onClick={() => setStack(true)}
                >
                  <Layers size={13} />
                  Stack
                </button>
              </div>
              <div className="plot-toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={travel}
                    onChange={(e) => setTravel(e.target.checked)}
                  />
                  Travel
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={labels}
                    onChange={(e) => setLabels(e.target.checked)}
                  />
                  IDs
                </label>
                {!stack && (
                  <label>
                    Layer{" "}
                    <select
                      aria-label="Displayed layer"
                      value={layer}
                      onChange={(e) => setLayer(+e.target.value)}
                    >
                      {Array.from({ length: config.layers }, (_, i) => (
                        <option key={i} value={i}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
            <div className="plot-container">
              {errors.length ? (
                <div className="plot-empty">
                  Resolve the parameter errors to preview geometry.
                </div>
              ) : (
                <ToolpathPlot
                  config={config}
                  segments={segments}
                  result={result}
                  visibleSteps={step}
                  layer={layer}
                  stack={stack}
                  travel={travel}
                  labels={labels}
                  inspected={inspected}
                  onInspect={setInspected}
                />
              )}{" "}
              {!run && !busy && !errors.length && (
                <div className="plot-prompt">
                  Geometry preview{" "}
                  <span>Run comparison to allocate material.</span>
                </div>
              )}
              {busy && (
                <div className="compute-banner" role="status">
                  Evaluating feasible routes… {Math.round(progress * 100)}%
                </div>
              )}
            </div>
            <div className="plot-legend">
              <span>
                <i style={{ background: "#2a6797" }} />
                {config.materialA || "A"}
              </span>
              <span className="blend-legend">
                <i />
                Composition transition
              </span>
              <span>
                <i style={{ background: "#c05b2f" }} />
                {config.materialB || "B"}
              </span>
              <span>
                <i style={{ background: "#d8ded9" }} />
                Unassigned / pending
              </span>
            </div>
            <div className="playback">
              <button
                className="icon-button"
                aria-label="Rewind to start"
                disabled={!result}
                onClick={() => {
                  setPlaying(false);
                  setStep(0);
                }}
              >
                <SkipBack size={17} />
              </button>
              <button
                className="play-button"
                aria-label={playing ? "Pause playback" : "Play deposition"}
                disabled={!limit}
                onClick={() => {
                  if (step >= limit) setStep(0);
                  setPlaying((v) => !v);
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <input
                type="range"
                aria-label="Deposited segment count"
                min="0"
                max={limit || 1}
                value={Math.min(step, limit)}
                disabled={!result}
                onChange={(e) => {
                  setPlaying(false);
                  const next = +e.target.value;
                  setStep(next);
                  if (next && result)
                    setLayer(segments[result.steps[next - 1].id].layer);
                }}
              />
              <button
                className="icon-button"
                aria-label="Show all deposited segments"
                disabled={!result}
                onClick={() => {
                  setPlaying(false);
                  setStep(limit);
                }}
              >
                <SkipForward size={17} />
              </button>
              <span className="step-counter">
                {step} / {limit}
              </span>
              <select
                aria-label="Playback speed"
                value={speed}
                onChange={(e) => setSpeed(+e.target.value)}
              >
                <option value={900}>0.5×</option>
                <option value={450}>1×</option>
                <option value={180}>2.5×</option>
              </select>
            </div>
            <div className="step-description" aria-live="polite">
              {active ? (
                <>
                  <span className="mono">
                    SEGMENT {segments[active.id].label}
                  </span>
                  <span>
                    {f(active.start)} → {f(active.end)} mm³
                  </span>
                  <span>
                    B: {f(active.cStart * 100, 1)} → {f(active.cEnd * 100, 1)}%
                  </span>
                  <span>
                    {active.purgeBefore > 1e-8
                      ? `${f(active.purgeBefore)} mm³ purged before deposition`
                      : "No purge before this segment"}
                  </span>
                </>
              ) : (
                <span>
                  {run
                    ? "No segments deposited yet. Start playback or move the slider."
                    : "Each deposited track will show its volume interval and composition."}
                </span>
              )}
            </div>
            <div className="transition-section">
              <div className="subheading">
                <h3>Composition & volume allocation</h3>
                <span>Assumed curve · γ = {f(config.gamma, 1)}</span>
              </div>
              {!errors.length && (
                <TransitionPlot
                  config={config}
                  result={result}
                  visibleSteps={step}
                />
              )}
              <div className="chart-legend">
                <span>
                  <i className="eligible-swatch" />
                  Eligible composition window
                </span>
                <span>
                  <i className="used-swatch" />
                  Assigned volume
                </span>
                <span>
                  <i className="discard-swatch" />
                  External discard
                </span>
              </div>
            </div>
          </section>
          <aside className="results-panel">
            <div className="panel-heading">
              <h3>Allocation summary</h3>
              <span className="eyebrow">
                {result ? "CALCULATED" : "PREVIEW"}
              </span>
            </div>
            {result && <Status complete={result.complete} />}
            <div className="primary-metric">
              <span>Transition utilisation</span>
              <strong>
                {result
                  ? f((result.used / config.transitionVolume) * 100, 1)
                  : "—"}
                <small>%</small>
              </strong>
              <p>
                {result
                  ? `${f(result.used)} of ${f(config.transitionVolume)} mm³ assigned`
                  : "Run the experiment to calculate utilisation."}
              </p>
            </div>
            <div className="utilisation-track">
              <div
                style={{
                  width: `${result ? (result.used / config.transitionVolume) * 100 : 0}%`,
                }}
              />
              {bound && (
                <i
                  style={{
                    left: `${(bound.upperUse / config.transitionVolume) * 100}%`,
                  }}
                />
              )}
            </div>
            <p className="bound-note">
              Analytical upper bound{" "}
              <b>
                {bound
                  ? f((bound.upperUse / config.transitionVolume) * 100, 1)
                  : "—"}
                %
              </b>
            </p>
            <dl className="metric-list">
              <div>
                <dt>External discard</dt>
                <dd>
                  {result ? f(result.discarded) : "—"} <small>mm³</small>
                </dd>
              </div>
              <div>
                <dt>Non-deposition travel</dt>
                <dd>
                  {result ? f(result.travel) : "—"} <small>mm</small>
                </dd>
              </div>
              <div>
                <dt>Assigned tracks</dt>
                <dd>
                  {result ? result.steps.length : "—"}{" "}
                  <small>/ {segments.length}</small>
                </dd>
              </div>
              <div>
                <dt>Receiving volume filled</dt>
                <dd>
                  {result ? f(result.coverage * 100, 1) : "—"} <small>%</small>
                </dd>
              </div>
              <div>
                <dt>Ideal operation time</dt>
                <dd>
                  {result ? f(result.idealTime, 1) : "—"} <small>s</small>
                </dd>
              </div>
              <div>
                <dt>Weighted cost J</dt>
                <dd>{result ? f(result.score, 4) : "—"}</dd>
              </div>
            </dl>
            {result && !result.complete && (
              <div className="allocation-note">
                <h4>{result.unassigned.length} tracks remain unassigned</h4>
                <p>
                  The material history or layer order prevents completion in
                  this single transition. These tracks need a separate
                  operation. A shorter partial route is not a faster completed
                  print.
                </p>
              </div>
            )}
            {result?.complete && (
              <p className="success-note">
                <Check size={14} />
                Every required track fits its composition window and layer
                order.
              </p>
            )}
            <button
              className="compare-link"
              disabled={!run}
              onClick={() => setTab("compare")}
            >
              Compare all methods <ArrowUpRight size={16} />
            </button>
            <section className="inspector">
              <h3>Track inspector</h3>
              {viewed ? (
                <>
                  <div className="inspector-id">
                    Segment {viewed.label}
                    <button
                      className="icon-button"
                      aria-label="Clear inspected track"
                      onClick={() => setInspected(null)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <dl className="stats-list">
                    <div>
                      <dt>Length</dt>
                      <dd>{f(viewed.length)} mm</dd>
                    </div>
                    <div>
                      <dt>Volume</dt>
                      <dd>{f(viewed.volume, 3)} mm³</dd>
                    </div>
                    <div>
                      <dt>Allowed B fraction</dt>
                      <dd>
                        {f(viewed.low * 100, 0)}-{f(viewed.high * 100, 0)}%
                      </dd>
                    </div>
                    <div>
                      <dt>Layer</dt>
                      <dd>{viewed.layer + 1}</dd>
                    </div>
                    <div>
                      <dt>Assignment</dt>
                      <dd>
                        {result
                          ? result.steps.some((s) => s.id === viewed.id)
                            ? "Allocated"
                            : "Unassigned"
                          : "Not calculated"}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p>
                  Click a track in the plot to inspect its geometry and
                  acceptance limits.
                </p>
              )}
            </section>
            <div className="research-note">
              <CircleHelp size={15} />
              <p>
                Colour indicates composition. Structural strength and material
                compatibility are not calculated.
              </p>
            </div>
          </aside>
        </main>
      )}
      <footer className="app-footer">
        <span>
          InfillLab <b>/</b> Transition-aware deposition research
        </span>
        <span>Model v1.0.0 · SI-derived units · Reproducible seeds</span>
      </footer>
    </>
  );
}
