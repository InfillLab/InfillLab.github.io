import { runStudy } from "./engine";
import type { Config } from "./types";
self.onmessage = (event: MessageEvent<Config>) => {
  try {
    const run = runStudy(event.data, (fraction) =>
      self.postMessage({ type: "progress", fraction }),
    );
    self.postMessage({ type: "result", run });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Calculation failed.",
    });
  }
};
