import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Plus,
  Settings2,
  X,
  ArrowRight,
  Download,
  RotateCcw,
  Layers,
  ChevronDown,
} from "lucide-react";
import { DEFAULT, BENCHMARK, type Config, type Run } from "./model/types";
import { geometry, validateConfig, parseConfig } from "./model/engine";
import { Controls, NumberField } from "./components/Controls";
import { PrintScene } from "./components/PrintScene";
import Methods from "./components/Methods";
import { download, summaryCSV } from "./io";
import "./studio.css";
const materials = ["PLA", "PETG", "TPU", "ABS", "Nylon", "Custom"];
const swatches = [
  "#be6944",
  "#71824e",
  "#b69b5b",
  "#755775",
  "#4b7773",
  "#424842",
  "#c5bda8",
];
const initial: Config = {
  ...DEFAULT,
  mode: "single",
  materialA: "PLA",
  materialB: "TPU",
  layers: 3,
  acceptance: "uniform",
  eligibleLow: 0,
  eligibleHigh: 1,
  transitionVolume: 150,
};
const fmt = (n: number, d = 1) =>
  n.toLocaleString("en-GB", {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  });
export default function Studio() {
  const [config, setConfig] = useState<Config>(initial),
    [colors, setColors] = useState<[string, string]>(["#be6944", "#71824e"]);
  const [run, setRun] = useState<Run | null>(null),
    [selected, setSelected] = useState(2),
    [busy, setBusy] = useState(false),
    [percent, setPercent] = useState(0),
    [error, setError] = useState("");
  const [modal, setModal] = useState<
      "material0" | "material1" | "settings" | null
    >(null),
    [draft, setDraft] = useState(initial),
    [draftColors, setDraftColors] = useState(colors);
  const [page, setPage] = useState<"studio" | "methods" | "compare">("studio"),
    [position, setPosition] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [flat, setFlat] = useState(false);
  const worker = useRef<Worker | null>(null),
    dialog = useRef<HTMLDialogElement>(null),
    file = useRef<HTMLInputElement>(null);
  const errors = validateConfig(config),
    segments = run?.segments ?? (errors.length ? [] : geometry(config)),
    result = run?.results[selected],
    count = result?.steps.length ?? 0;
  const patch = (p: Partial<Config>) => {
    worker.current?.terminate();
    setBusy(false);
    setConfig((c) => ({ ...c, ...p }));
    setRun(null);
    setPosition(0);
    setPlaying(false);
    setError("");
  };
  const open = (m: typeof modal) => {
    setDraft({ ...config });
    setDraftColors([...colors]);
    setModal(m);
  };
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    if (!playing || !result || page !== "studio" || modal) return;
    let last = performance.now(),
      frame = 0;
    const tick = (now: number) => {
      const delta = Math.min(now - last, 100);
      last = now;
      setPosition((p) => Math.min(count, p + (delta / 1000) * speed * 1.25));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, result, count, speed, page, modal]);
  useEffect(() => {
    if (position >= count && count > 0) setPlaying(false);
  }, [position, count]);
  function launch(c = config) {
    const issues = validateConfig(c);
    if (issues.length) {
      setError(issues.join(" "));
      return;
    }
    worker.current?.terminate();
    setBusy(true);
    setPercent(0);
    setRun(null);
    setPosition(0);
    setPlaying(false);
    setError("");
    const w = new Worker(new URL("./model/worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.type === "progress") setPercent(e.data.fraction);
      if (e.data.type === "result") {
        setRun(e.data.run);
        setSelected(2);
        setBusy(false);
        setPlaying(e.data.run.results[2].steps.length > 0);
        w.terminate();
      }
      if (e.data.type === "error") {
        setError(e.data.message);
        setBusy(false);
        w.terminate();
      }
    };
    w.onerror = () => {
      setError("Calculation could not complete. Please retry.");
      setBusy(false);
      w.terminate();
    };
    w.postMessage(c);
  }
  function save() {
    const issues = validateConfig(draft);
    if (issues.length) return;
    patch(draft);
    setColors(draftColors);
    setModal(null);
  }
  async function importRun(f?: File) {
    if (!f) return;
    try {
      if (f.size > 2000000) throw new Error("Choose a file below 2 MB.");
      const data = JSON.parse(await f.text());
      const c = parseConfig(data);
      patch(c);
      if (
        Array.isArray(data.presentation?.colors) &&
        data.presentation.colors.length === 2 &&
        data.presentation.colors.every(
          (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v),
        )
      )
        setColors(data.presentation.colors);
      setPage("studio");
      launch(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid file.");
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  const materialIndex = modal === "material1" ? 1 : 0;
  function saveFigure() {
    const canvas = document.querySelector<HTMLCanvasElement>(".scene canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = "infilllab-preview.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  }
  return (
    <div className="studio-app">
      <header className="studio-header">
        <a
          className="studio-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("studio");
          }}
        >
          <span className="brand-mark">▱</span>InfillLab
          <span className="brand-caption">PRINT PATH EXPLORER</span>
        </a>
        <nav>
          <button
            className={page === "studio" ? "active" : ""}
            onClick={() => setPage("studio")}
          >
            Workspace
          </button>
          <button
            className={page === "compare" ? "active" : ""}
            onClick={() => setPage("compare")}
          >
            Compare
          </button>
          <button
            className={page === "methods" ? "active" : ""}
            onClick={() => setPage("methods")}
          >
            Methods
          </button>
        </nav>
        <button className="subtle" onClick={() => file.current?.click()}>
          Open experiment
        </button>
        <input
          ref={file}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => importRun(e.target.files?.[0])}
        />
      </header>
      {error && (
        <div className="studio-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {page === "methods" ? (
        <>
          <div className="single-note">
            Single material mode compares paths with unrestricted material
            availability and zero transition waste. Polymer selections identify
            the experiment; they do not load measured mechanical properties.
          </div>
          <Methods />
        </>
      ) : page === "compare" ? (
        <div className="comparison-page">
          <p className="kicker">RESULTS</p>
          <h1>Compare the same print.</h1>
          <p>
            Check completion before comparing travel. Shorter incomplete routes
            are not faster completed prints.
          </p>
          {run ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Tracks</th>
                      <th>Travel</th>
                      <th>
                        {run.config.mode === "single" ? "Deposited" : "Reused"}
                      </th>
                      <th>Transition waste</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.results.map((r, i) => (
                      <tr key={r.algorithm}>
                        <th>
                          <button
                            onClick={() => {
                              setSelected(i);
                              setPosition(0);
                              setPlaying(true);
                              setPage("studio");
                            }}
                          >
                            {r.algorithm} ↗
                          </button>
                        </th>
                        <td>
                          {r.steps.length}/{run.segments.length}
                        </td>
                        <td>{fmt(r.travel)} mm</td>
                        <td>{fmt(r.used)} mm³</td>
                        <td>
                          {run.config.mode === "single"
                            ? "Not applicable"
                            : `${fmt(r.discarded)} mm³`}
                        </td>
                        <td>{r.complete ? "Complete" : "Partial"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="comparison-note">
                Adaptive search: {run.replicates.length} seeds, beginning with{" "}
                {run.config.seed}. The displayed result uses the first seed.
                Modelled values, not printer measurements.
              </p>
              <div className="export-actions">
                <button
                  onClick={() =>
                    download(
                      "infilllab-results.csv",
                      summaryCSV(run),
                      "text/csv",
                    )
                  }
                >
                  Download CSV
                </button>
                <button
                  onClick={() =>
                    download(
                      "infilllab-experiment.json",
                      JSON.stringify(
                        { ...run, presentation: { colors } },
                        null,
                        2,
                      ),
                      "application/json",
                    )
                  }
                >
                  Save experiment JSON
                </button>
              </div>
            </>
          ) : (
            <div className="comparison-empty">
              <Layers size={38} />
              <h2>Your results will appear here.</h2>
              <button
                className="start-button"
                onClick={() => setPage("studio")}
              >
                Set up a print <ArrowRight size={17} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <main className="studio-main">
          <div className="studio-intro">
            <div>
              <p className="kicker">YOUR EXPERIMENT</p>
              <h1>Set it up. Watch it print.</h1>
              <p>
                Choose a material and an infill pattern. Explore the path, layer
                by layer.
              </p>
            </div>
            <span className="research-tag">Geometric simulation</span>
          </div>
          <div className="studio-layout">
            <aside className="setup-card">
              <section>
                <div className="section-title">
                  <span>01</span>
                  <h2>Choose materials</h2>
                </div>
                <button
                  className="material-card"
                  onClick={() => open("material0")}
                >
                  <span
                    className="spool"
                    style={{ "--filament": colors[0] } as React.CSSProperties}
                  />
                  <span>
                    <small>MATERIAL 1</small>
                    <strong>{config.materialA}</strong>
                    <em>Choose material & colour</em>
                  </span>
                  <Settings2 size={17} />
                </button>
                {config.mode === "multi" ? (
                  <button
                    className="material-card"
                    onClick={() => open("material1")}
                  >
                    <span
                      className="spool"
                      style={{ "--filament": colors[1] } as React.CSSProperties}
                    />
                    <span>
                      <small>MATERIAL 2</small>
                      <strong>{config.materialB}</strong>
                      <em>Choose material & colour</em>
                    </span>
                    <Settings2 size={17} />
                  </button>
                ) : (
                  <button
                    className="add-material"
                    onClick={() => {
                      setDraft({ ...config, mode: "multi" });
                      setDraftColors(colors);
                      setModal("material1");
                    }}
                  >
                    <Plus size={17} />
                    Add a second material
                  </button>
                )}
                <p className="setup-hint">
                  {config.mode === "single"
                    ? "One material. Explore infill and travel."
                    : "Two materials. Explore transition reuse."}
                </p>
              </section>
              <section>
                <div className="section-title">
                  <span>02</span>
                  <h2>Build your sample</h2>
                </div>
                <div className="pattern-options">
                  {(["parallel", "chevron", "ribs"] as const).map((p, i) => (
                    <button
                      disabled={config.preset === "benchmark"}
                      key={p}
                      className={config.pattern === p ? "chosen" : ""}
                      onClick={() =>
                        patch({
                          pattern: p,
                          spacing: Math.max(
                            config.spacing,
                            p === "chevron"
                              ? 2 * config.beadWidth
                              : config.beadWidth,
                          ),
                        })
                      }
                    >
                      <svg viewBox="0 0 62 42" aria-hidden="true">
                        {[0, 1, 2, 3].map((j) => (
                          <path
                            key={j}
                            d={
                              i === 1
                                ? `M7 ${9 + j * 8}L31 ${4 + j * 8}L55 ${9 + j * 8}`
                                : i === 2
                                  ? `M${j % 2 ? 24 : 7} ${8 + j * 8}H${j % 2 ? 55 : 38}`
                                  : `M7 ${8 + j * 8}H55`
                            }
                          />
                        ))}
                      </svg>
                      <span>{["Lines", "Chevron", "Ribs"][i]}</span>
                    </button>
                  ))}
                </div>
                <div className="simple-fields">
                  <label>
                    Sample size
                    <select
                      disabled={config.preset === "benchmark"}
                      value={
                        config.width === 40 && config.height === 18
                          ? "small"
                          : config.width === 60 && config.height === 30
                            ? "medium"
                            : "custom"
                      }
                      onChange={(e) => {
                        if (e.target.value === "custom") open("settings");
                        else
                          patch(
                            e.target.value === "small"
                              ? { width: 40, height: 18 }
                              : { width: 60, height: 30 },
                          );
                      }}
                    >
                      <option value="small">Small · 40 × 18 mm</option>
                      <option value="medium">Medium · 60 × 30 mm</option>
                      <option value="custom">Custom dimensions</option>
                    </select>
                  </label>
                  <label>
                    Line spacing
                    <select
                      disabled={config.preset === "benchmark"}
                      value={
                        [1, 2, 4].includes(config.spacing)
                          ? config.spacing
                          : "custom"
                      }
                      onChange={(e) =>
                        e.target.value === "custom"
                          ? open("settings")
                          : patch({ spacing: Number(e.target.value) })
                      }
                    >
                      <option value="4">Open · 4 mm</option>
                      <option value="2">Balanced · 2 mm</option>
                      <option value="1">Dense · 1 mm</option>
                      <option value="custom">Custom spacing</option>
                    </select>
                  </label>
                  <label>
                    Layers
                    <select
                      disabled={config.preset === "benchmark"}
                      value={config.layers}
                      onChange={(e) => patch({ layers: +e.target.value })}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "layer" : "layers"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <button
                className="advanced-button"
                onClick={() => open("settings")}
              >
                <Settings2 size={16} />
                Advanced settings
                <ChevronDown size={15} />
              </button>
              <div className="start-area">
                {errors.length > 0 && (
                  <p role="alert" className="inline-error">
                    {errors.join(" ")}
                  </p>
                )}
                <button
                  className="start-button"
                  disabled={errors.length > 0}
                  onClick={() =>
                    busy
                      ? (worker.current?.terminate(), setBusy(false))
                      : launch()
                  }
                >
                  {busy ? (
                    <>Stop calculation · {Math.round(percent * 100)}%</>
                  ) : (
                    <>
                      <Play size={17} />{" "}
                      {run ? "Run again" : "Start simulation"}
                    </>
                  )}
                </button>
                <p>Ready to try. No printer connection needed.</p>
              </div>
            </aside>
            <div className="visual-column">
              <section className="print-card">
                <div className="print-heading">
                  <div>
                    <span
                      className={`status-dot ${playing ? "pulsing" : ""}`}
                    />
                    <strong>
                      {busy
                        ? "Calculating route"
                        : playing
                          ? "Printing preview"
                          : run
                            ? position >= count
                              ? "Preview complete"
                              : "Preview paused"
                            : "Ready to print"}
                    </strong>
                  </div>
                  <div className="view-switch">
                    <button
                      className={!flat ? "selected" : ""}
                      onClick={() => setFlat(false)}
                    >
                      Perspective
                    </button>
                    <button
                      className={flat ? "selected" : ""}
                      onClick={() => setFlat(true)}
                    >
                      Top
                    </button>
                  </div>
                </div>
                <PrintScene
                  config={run?.config ?? config}
                  segments={segments}
                  result={result}
                  progress={position}
                  colors={colors}
                  flat={flat}
                />
                <div className="scene-materials">
                  <span>
                    <i style={{ background: colors[0] }} />
                    {config.materialA}
                  </span>
                  {config.mode === "multi" && (
                    <>
                      <span
                        className="blend-key"
                        style={{
                          background: `linear-gradient(90deg,${colors[0]},${colors[1]})`,
                        }}
                      />
                      <span>
                        <i style={{ background: colors[1] }} />
                        {config.materialB}
                      </span>
                    </>
                  )}
                  <small>Colour represents material, not strength.</small>
                </div>
                <div className="transport">
                  <button
                    aria-label="Restart preview"
                    disabled={!result}
                    onClick={() => {
                      setPosition(0);
                      setPlaying(false);
                    }}
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    className="transport-play"
                    aria-label={playing ? "Pause preview" : "Play preview"}
                    disabled={!result || count === 0}
                    onClick={() => {
                      if (position >= count) setPosition(0);
                      setPlaying((v) => !v);
                    }}
                  >
                    {playing ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <input
                    aria-label="Print progress"
                    type="range"
                    min="0"
                    max={Math.max(1, count)}
                    step=".01"
                    value={position}
                    disabled={!result}
                    onChange={(e) => {
                      setPosition(+e.target.value);
                      setPlaying(false);
                    }}
                  />
                  <span>
                    {Math.min(Math.floor(position), count)} /{" "}
                    {count || segments.length}
                  </span>
                  <select
                    aria-label="Animation speed"
                    value={speed}
                    onChange={(e) => setSpeed(+e.target.value)}
                  >
                    <option value=".5">0.5×</option>
                    <option value="1">1×</option>
                    <option value="3">3×</option>
                  </select>
                </div>
              </section>
              <section className="results-card">
                <div className="results-heading">
                  <div>
                    <p className="kicker">03 · RESULTS</p>
                    <h2>
                      {result ? "Your calculated print" : "See what changes."}
                    </h2>
                  </div>
                  {result && (
                    <button onClick={() => setPage("compare")}>
                      Compare methods <ArrowRight size={16} />
                    </button>
                  )}
                </div>
                {result ? (
                  <>
                    <div className="result-metrics">
                      <div>
                        <span>
                          {config.mode === "single"
                            ? "Material deposited"
                            : "Transition reused"}
                        </span>
                        <strong>
                          {fmt(result.used)}
                          <small> mm³</small>
                        </strong>
                      </div>
                      <div>
                        <span>Travel without printing</span>
                        <strong>
                          {fmt(result.travel)}
                          <small> mm</small>
                        </strong>
                      </div>
                      <div>
                        <span>
                          {config.mode === "single"
                            ? "Tracks completed"
                            : "Transition waste"}
                        </span>
                        <strong>
                          {config.mode === "single"
                            ? `${result.steps.length}/${segments.length}`
                            : fmt(result.discarded)}
                          <small>{config.mode === "multi" ? " mm³" : ""}</small>
                        </strong>
                      </div>
                    </div>
                    <p
                      className={
                        result.complete ? "result-note" : "result-note partial"
                      }
                    >
                      {result.complete
                        ? "All tracks allocated."
                        : `${result.unassigned.length} tracks could not be allocated within this transition.`}{" "}
                      {config.mode === "multi"
                        ? "Transition behaviour is assumed, not calibrated for this material pair."
                        : "Single-material routing; transition waste is not applicable."}
                    </p>
                    <div className="result-footer">
                      <button onClick={saveFigure}>
                        <Download size={14} />
                        Save image
                      </button>
                      <span>
                        {result.algorithm} · seed {config.seed}
                      </span>
                      <button
                        onClick={() =>
                          download(
                            "infilllab-experiment.json",
                            JSON.stringify(
                              { ...run, presentation: { colors } },
                              null,
                              2,
                            ),
                            "application/json",
                          )
                        }
                      >
                        <Download size={14} />
                        Save experiment
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="empty-results">
                    Start the simulation to calculate material use and travel,
                    then compare different ways to print the same sample.
                  </p>
                )}
              </section>
            </div>
          </div>
          <footer className="studio-footer">
            InfillLab · Research prototype
            <span>
              Geometry and toolpaths. Mechanical strength is not predicted.
            </span>
          </footer>
        </main>
      )}
      <dialog
        aria-label={
          modal === "settings"
            ? "Advanced experiment settings"
            : "Choose material and colour"
        }
        ref={dialog}
        className="settings-dialog"
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
      >
        <div className="dialog-content">
          <header>
            <div>
              <p className="kicker">
                {modal === "settings"
                  ? "EXPERIMENT OPTIONS"
                  : `MATERIAL ${materialIndex + 1}`}
              </p>
              <h2>
                {modal === "settings"
                  ? "Fine-tune your experiment"
                  : "Choose your filament"}
              </h2>
            </div>
            <button aria-label="Close settings" onClick={() => setModal(null)}>
              <X size={21} />
            </button>
          </header>
          {modal === "settings" ? (
            <>
              <p className="dialog-hint">
                Defaults are ready to use. Change only what your experiment
                needs.
              </p>
              <Controls
                compact
                config={draft}
                update={(p) => setDraft((c) => ({ ...c, ...p }))}
              />
              <button
                className="reset-settings"
                onClick={() => setDraft({ ...initial })}
              >
                Reset to starter sample
              </button>
              <details className="verification-option">
                <summary>Reference case</summary>
                <p>
                  Load the fixed two-track example to check the exact solution.
                </p>
                <button
                  onClick={() => {
                    patch({ ...BENCHMARK });
                    setModal(null);
                  }}
                >
                  Load verification case
                </button>
              </details>
            </>
          ) : (
            <>
              <div className="material-choices">
                {materials.map((m) => (
                  <button
                    key={m}
                    className={
                      (materialIndex ? draft.materialB : draft.materialA) === m
                        ? "chosen"
                        : ""
                    }
                    onClick={() =>
                      setDraft((c) => ({
                        ...c,
                        [materialIndex ? "materialB" : "materialA"]: m,
                      }))
                    }
                  >
                    {m}
                    <small>
                      {
                        {
                          PLA: "Rigid thermoplastic",
                          PETG: "Rigid thermoplastic",
                          TPU: "Flexible elastomer",
                          ABS: "Rigid thermoplastic",
                          Nylon: "Polyamide",
                          Custom: "Your own label",
                        }[m]
                      }
                    </small>
                  </button>
                ))}
              </div>
              {!materials
                .slice(0, 5)
                .includes(
                  materialIndex ? draft.materialB : draft.materialA,
                ) && (
                <label className="custom-label">
                  Material label
                  <input
                    defaultValue={
                      (materialIndex ? draft.materialB : draft.materialA) ===
                      "Custom"
                        ? ""
                        : materialIndex
                          ? draft.materialB
                          : draft.materialA
                    }
                    maxLength={40}
                    placeholder="Custom"
                    onChange={(e) =>
                      setDraft((c) => ({
                        ...c,
                        [materialIndex ? "materialB" : "materialA"]:
                          e.target.value || "Custom",
                      }))
                    }
                  />
                </label>
              )}
              <h3>Filament colour</h3>
              <div className="swatches">
                {swatches.map((color) => (
                  <button
                    aria-label={`Choose colour ${color}`}
                    aria-pressed={draftColors[materialIndex] === color}
                    key={color}
                    style={{ background: color }}
                    onClick={() =>
                      setDraftColors((v) =>
                        materialIndex ? [v[0], color] : [color, v[1]],
                      )
                    }
                  />
                ))}
                <label title="Custom colour">
                  <input
                    aria-label="Custom filament colour"
                    type="color"
                    value={draftColors[materialIndex]}
                    onChange={(e) =>
                      setDraftColors((v) =>
                        materialIndex
                          ? [v[0], e.target.value]
                          : [e.target.value, v[1]],
                      )
                    }
                  />
                </label>
              </div>
              <p className="material-disclaimer">
                Material names and colours identify your experiment. They do not
                imply measured adhesion or validated compatibility.
              </p>
              {draft.mode === "multi" && (
                <details className="material-advanced">
                  <summary>Advanced transition settings</summary>
                  <NumberField
                    label="Transition volume"
                    value={draft.transitionVolume}
                    min={0.1}
                    max={3000}
                    unit="mm³"
                    onChange={(v) =>
                      setDraft((c) => ({ ...c, transitionVolume: v }))
                    }
                  />
                  <p>
                    One assumed material switch. Composition and acceptance
                    limits are available in Advanced settings.
                  </p>
                </details>
              )}
              {materialIndex === 1 && config.mode === "multi" && (
                <button
                  className="remove-material"
                  onClick={() => {
                    patch({ mode: "single" });
                    setModal(null);
                  }}
                >
                  Remove second material
                </button>
              )}
            </>
          )}
          {validateConfig(draft).length > 0 && (
            <p className="inline-error" role="alert">
              {validateConfig(draft).join(" ")}
            </p>
          )}
          <footer>
            <button className="cancel-button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="start-button"
              disabled={validateConfig(draft).length > 0}
              onClick={save}
            >
              Apply changes <ArrowRight size={16} />
            </button>
          </footer>
        </div>
      </dialog>
    </div>
  );
}
