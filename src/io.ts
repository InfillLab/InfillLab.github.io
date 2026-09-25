import type { Run, Result } from "./model/types";
export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const escape = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;
export function summaryCSV(run: Run) {
  const header = [
    "kind",
    "algorithm",
    "seed",
    "complete",
    "assigned_segments",
    "total_segments",
    "used_mm3",
    "discarded_mm3",
    "travel_mm",
    "deposition_mm",
    "ideal_time_s",
    "score_J",
    "coverage",
    "evaluations",
    "browser_runtime_ms",
    "model_version",
    "config_json",
  ];
  const row = (r: Result, kind: string) =>
    [
      kind,
      r.algorithm,
      r.seed ?? "",
      r.complete ? 1 : 0,
      r.steps.length,
      run.segments.length,
      r.used,
      r.discarded,
      r.travel,
      r.depositionLength,
      r.idealTime,
      r.score,
      r.coverage,
      r.evaluations,
      r.runtimeMs,
      run.modelVersion,
      JSON.stringify(run.config),
    ]
      .map(escape)
      .join(",");
  return [
    header.map(escape).join(","),
    ...run.results.map((r) => row(r, "comparison")),
    ...run.replicates.map((r) => row(r, "replicate")),
  ].join("\r\n");
}
export function exportSVG() {
  const original = document.getElementById("toolpath-figure");
  if (!original) return;
  const copy = original.cloneNode(true) as SVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", "1230");
  copy.setAttribute("height", "690");
  download(
    "infilllab-toolpath.svg",
    new XMLSerializer().serializeToString(copy),
    "image/svg+xml",
  );
}
