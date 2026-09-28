import { runStudy } from "./engine";
import { PATTERNS } from "./patterns";
import type { Config } from "./types";
self.onmessage = (
  event: MessageEvent<{ config: Config; matrix?: boolean }>,
) => {
  try {
    const { config, matrix } = event.data;
    if (matrix) {
      const runs = PATTERNS.map((p, i) =>
        runStudy({ ...config, preset: "interface", pattern: p.id }, (f) =>
          self.postMessage({ type: "progress", fraction: (i + f) / 10 }),
        ),
      );
      self.postMessage({ type: "matrix", runs });
    } else {
      const run = runStudy(config, (f) =>
        self.postMessage({ type: "progress", fraction: f }),
      );
      self.postMessage({ type: "result", run });
    }
  } catch (e) {
    self.postMessage({
      type: "error",
      message: e instanceof Error ? e.message : "Calculation failed",
    });
  }
};
