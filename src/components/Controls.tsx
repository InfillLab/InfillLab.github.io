import { useEffect, useState } from "react";
import type { Config } from "../model/types";
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="number-field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          aria-label={label}
          type="number"
          value={text}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            if (
              e.target.value !== "" &&
              Number.isFinite(Number(e.target.value))
            )
              onChange(Number(e.target.value));
          }}
          onBlur={() => {
            if (text === "") setText(String(value));
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
    </label>
  );
}
export function Controls({
  config: c,
  update,
  compact = false,
}: {
  config: Config;
  update: (partial: Partial<Config>) => void;
  compact?: boolean;
}) {
  const benchmark = c.preset === "benchmark";
  const n = (
    key: keyof Config,
    label: string,
    min: number,
    max: number,
    step: number,
    unit?: string,
    disabled = benchmark,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={c[key] as number}
      onChange={(v) => update({ [key]: v })}
      min={min}
      max={max}
      step={step}
      unit={unit}
      disabled={disabled}
    />
  );
  return (
    <div className="controls">
      {benchmark && (
        <p className="small-note benchmark-note">
          The manuscript case uses two 60 mm segments. Geometry and composition
          are fixed so its exact solution stays reproducible.
        </p>
      )}
      <details open={!compact}>
        <summary>
          <span className="section-index">01</span> Receiving geometry
        </summary>
        <div className="control-body">
          <label className="select-field">
            Path family
            <select
              value={c.pattern}
              disabled={benchmark}
              onChange={(e) =>
                update({ pattern: e.target.value as Config["pattern"] })
              }
            >
              <option value="parallel">Parallel tracks</option>
              <option value="chevron">Chevron tracks</option>
              <option value="ribs">Alternating ribs</option>
            </select>
          </label>
          <div className="field-grid">
            {n("width", "Width", 5, 150, 1, "mm")}
            {n("height", "Height", 2, 100, 1, "mm")}
            {n("spacing", "Line spacing", 0.5, 20, 0.1, "mm")}
            {n("layers", "Layers", 1, 6, 1)}
            {n("beadWidth", "Bead width", 0.2, 2, 0.05, "mm")}
            {n("layerHeight", "Layer height", 0.05, 1, 0.05, "mm")}
          </div>
          <p className="field-note">
            Rectangular bead model. Track geometry does not certify a mechanical
            interlock.
          </p>
        </div>
      </details>
      <details open={!compact}>
        <summary>
          <span className="section-index">02</span> Material transition
        </summary>
        <div className="control-body">
          <div className="field-grid">
            <label className="text-field">
              Material A
              <input
                value={c.materialA}
                maxLength={40}
                onChange={(e) => update({ materialA: e.target.value })}
              />
            </label>
            <label className="text-field">
              Material B
              <input
                value={c.materialB}
                maxLength={40}
                onChange={(e) => update({ materialB: e.target.value })}
              />
            </label>
          </div>
          <label className="select-field">
            Switch direction
            <select
              disabled={benchmark}
              value={c.direction}
              onChange={(e) =>
                update({ direction: e.target.value as Config["direction"] })
              }
            >
              <option value="AB">A → B</option>
              <option value="BA">B → A</option>
            </select>
          </label>
          <div className="field-grid">
            {n("transitionVolume", "Transition volume", 0.1, 3000, 1, "mm³")}
            {n("gamma", "Curve exponent", 0.2, 5, 0.1, "γ")}
          </div>
          <span className="field-label">Eligible fraction of material B</span>
          <div className="field-grid">
            <NumberField
              label="Lower limit"
              value={+(c.eligibleLow * 100).toFixed(4)}
              onChange={(v) => update({ eligibleLow: v / 100 })}
              min={0}
              max={100}
              unit="%"
              disabled={benchmark}
            />
            <NumberField
              label="Upper limit"
              value={+(c.eligibleHigh * 100).toFixed(4)}
              onChange={(v) => update({ eligibleHigh: v / 100 })}
              min={0}
              max={100}
              unit="%"
              disabled={benchmark}
            />
          </div>
          <p className="field-note">
            An assumed composition curve, not measured PLA/TPU properties.
            Material names are labels only.
          </p>
        </div>
      </details>
      <details open={!compact}>
        <summary>
          <span className="section-index">03</span> Assignment & search
        </summary>
        <div className="control-body">
          <label className="select-field">
            Segment acceptance
            <select
              disabled={benchmark}
              value={c.acceptance}
              onChange={(e) =>
                update({ acceptance: e.target.value as Config["acceptance"] })
              }
            >
              <option value="graded">Graded along y</option>
              <option value="uniform">Uniform across region</option>
            </select>
          </label>
          {c.acceptance === "graded" && (
            <NumberField
              label="Acceptance half-width"
              value={+(c.tolerance * 100).toFixed(4)}
              onChange={(v) => update({ tolerance: v / 100 })}
              min={2}
              max={50}
              unit="% B"
              disabled={benchmark}
            />
          )}
          <label className="weight-field">
            Cost reporting weight <strong>{c.alpha.toFixed(2)}</strong>
            <input
              aria-label="Cost reporting weight"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={c.alpha}
              onChange={(e) => update({ alpha: +e.target.value })}
            />
            <span>
              <small>Travel</small>
              <small>Material</small>
            </span>
          </label>
          <p className="field-note">
            Changes the reported cost J. Coverage remains the first priority;
            equal-volume routes are ranked by travel when α is below 1.
          </p>
          <div className="field-grid">
            {n(
              "iterations",
              "Evaluations per seed",
              10,
              2000,
              10,
              undefined,
              false,
            )}
            {n("replicates", "Replicate seeds", 1, 10, 1, undefined, false)}
            {n("seed", "Initial seed", 0, 4294967295, 1, undefined, false)}
          </div>
          <p className="field-note">
            Complete assignments rank first, then coverage, then weighted cost.
            Search begins from both baselines.
          </p>
        </div>
      </details>
      <details>
        <summary>
          <span className="section-index">04</span> Ideal timing
        </summary>
        <div className="control-body">
          <div className="field-grid">
            {n("depositSpeed", "Deposition speed", 1, 300, 1, "mm/s", false)}
            {n("travelSpeed", "Travel speed", 1, 500, 5, "mm/s", false)}
            {n("purgeRate", "Purge flow", 0.1, 50, 0.1, "mm³/s", false)}
          </div>
          <p className="field-note">
            Constant speeds only. Acceleration, heating, switching delay and
            travel to a purge station are excluded.
          </p>
        </div>
      </details>
    </div>
  );
}
