import { optimizeDrawing } from "./optimizer.js";

self.onmessage = async ({ data: { revision, settings } }) => {
  try {
    const result = await optimizeDrawing(settings, (candidate) => {
      self.postMessage({ revision, type: "candidate", result: candidate });
    });
    self.postMessage({ revision, type: "done", result });
  } catch (error) {
    self.postMessage({ revision, type: "error", message: error.message });
  }
};
