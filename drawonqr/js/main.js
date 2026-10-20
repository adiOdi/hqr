import { analyzeDamage, applyChanges, canDrawOn, generateBaseline } from "./qr-engine.js";
import { fittingLevels, fittingModes, smallestVersion } from "./optimizer.js";
import { DrawingCanvas } from "./canvas.js";
import { download, pngBlob, svgBlob } from "./export.js";

const elements = Object.fromEntries([
  "content", "version", "ecc", "mask", "qr-grid", "qr-canvas", "undo", "redo",
  "status", "blocks", "svg", "png", "share", "highlight-drawn", "highlight-necessary",
  "allow-metadata", "metadata-blocks",
].map((id) => [id, document.getElementById(id)]));
const grid = new DrawingCanvas(elements["qr-grid"], elements["qr-canvas"]);
const MAX_VERSION = 10;
const state = {
  model: null, targets: new Map(), history: [], future: [],
  tool: "pencil", value: true, stroke: null, preview: null,
  revision: 0, ready: false, busy: false, queued: false,
  invalid: false, animating: false, shareFile: null,
};
let worker;
let timer;

function settings() {
  return {
    message: elements.content.value,
    version: Number(elements.version.value),
    level: elements.ecc.value,
    mask: elements.mask.value,
    allowMetadata: elements["allow-metadata"].checked,
  };
}

function view() {
  return {
    model: state.model,
    targets: state.preview ?? state.targets,
    invalid: state.invalid,
    highlightDrawn: elements["highlight-drawn"].checked,
    highlightNecessary: elements["highlight-necessary"].checked,
    allowMetadata: elements["allow-metadata"].checked,
  };
}

function matrix() {
  return applyChanges(state.model.matrix, [...state.targets.values()]);
}

function message(text, type = "") {
  elements.status.textContent = text;
  elements.status.className = type;
}

function updateControls() {
  const exporting = state.ready && !state.busy && !state.queued && !state.stroke && !state.animating;
  elements.svg.disabled = elements.png.disabled = !exporting;
  const shareSupported = state.shareFile && navigator.canShare?.({ files: [state.shareFile] }) && navigator.share;
  elements.share.disabled = !exporting || !shareSupported;
  elements.share.title = shareSupported ? "" : "Image sharing is unavailable in this browser";
  elements.undo.disabled = !state.ready || !state.history.length || state.animating;
  elements.redo.disabled = !state.ready || !state.future.length || state.animating;
}

function showDamage(result) {
  renderDamageRows(elements.blocks, result.damage.blockStats);
  elements["metadata-blocks"].hidden = !elements["allow-metadata"].checked;
  renderDamageRows(elements["metadata-blocks"], result.damage.metadataStats);
}

function renderDamageRows(container, stats) {
  container.replaceChildren();
  for (const block of stats) {
    const damaged = block.damagedBits ?? block.totalDamaged;
    const name = block.name ?? `Block ${block.blockIndex + 1}`;
    const unit = block.damagedBits === undefined ? "codewords" : "bits";
    const row = document.createElement("div");
    row.className = "block";
    row.classList.toggle("is-invalid", damaged > block.theoreticalLimit);
    const label = document.createElement("div");
    label.className = "block-label";
    const title = document.createElement("span");
    title.textContent = name;
    const count = document.createElement("span");
    count.textContent = `${damaged} / ${block.theoreticalLimit}${unit === "bits" ? " bits" : ""}`;
    label.append(title, count);
    const meter = document.createElement("meter");
    meter.min = 0;
    meter.max = Math.max(block.theoreticalLimit + 1, damaged);
    meter.low = 0;
    meter.high = block.theoreticalLimit;
    meter.optimum = 0;
    meter.value = damaged;
    meter.setAttribute("aria-label", `${name}: ${damaged} of ${block.theoreticalLimit} ${unit} damaged`);
    row.append(label, meter);
    container.append(row);
  }
}

function filename(extension) {
  return `drawonqr_v${state.model.version}${state.model.level}_m${state.model.mask}.${extension}`;
}

function resetWorker() {
  worker?.terminate();
  worker = null;
  state.busy = false;
}

async function receive({ data }) {
  if (data.type === "done" || data.type === "error") state.busy = false;
  if (data.revision !== state.revision) {
    if (!state.busy && !state.stroke && state.queued) pump();
    return;
  }
  if (data.type === "error") {
    grid.stop();
    state.ready = false;
    grid.render(view());
    message(data.message, "is-error");
  } else if (data.type === "candidate") {
    state.model = data.result.model;
    showDamage(data.result);
  } else if (data.type === "done") {
    state.model = data.result.model;
    state.invalid = !data.result.readable;
    state.animating = true;
    showDamage(data.result);
    elements.ecc.options[0].textContent = `Auto (${state.model.level})`;
    elements.mask.options[0].textContent = `Auto (${state.model.mask})`;
    await grid.finish(view());
    if (data.revision !== state.revision) return;
    state.animating = false;
    const capacity = data.result.damage.blockStats.reduce((sum, block) => sum + block.theoreticalLimit, 0);
    const metadataExceeded = data.result.damage.metadataStats.some((region) => region.damagedBits > region.theoreticalLimit);
    message(
      metadataExceeded ? "Metadata ECC limit exceeded. QR may be unreadable."
        : state.invalid ? "ECC limit exceeded. QR may be unreadable."
        : `Within ECC limit (${data.result.totalDamaged}/${capacity} blocks destroyed)`,
      state.invalid ? "is-error" : "",
    );
    try {
      const blob = await pngBlob(matrix());
      if (data.revision !== state.revision) return;
      state.shareFile = new File([blob], filename("png"), { type: "image/png" });
    } catch (error) {
      message(error.message, "is-error");
    }
  }
  updateControls();
}

function pump() {
  if (!state.ready || state.busy || state.stroke || !state.queued) return;
  state.queued = false;
  state.busy = true;
  state.invalid = false;
  state.shareFile = null;
  if (!worker) {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = receive;
    worker.onerror = () => {
      resetWorker();
      grid.stop();
      state.ready = false;
      message("Optimization failed.", "is-error");
      updateControls();
    };
  }
  message("Optimizing...", "is-working");
  grid.optimize(view);
  updateControls();
  worker.postMessage({
    revision: state.revision,
    settings: { ...settings(), targets: [...state.targets.values()], previous: state.model },
  });
}

function schedule() {
  state.revision += 1;
  state.queued = true;
  clearTimeout(timer);
  updateControls();
  timer = setTimeout(pump, 80);
}

function rebuild({ fit = false, clear = false } = {}) {
  clearTimeout(timer);
  state.revision += 1;
  resetWorker();
  grid.stop();
  state.ready = false;
  state.queued = false;
  state.animating = false;
  state.stroke = state.preview = null;
  state.shareFile = null;
  try {
    if (fit) elements.version.value = smallestVersion(elements.content.value, elements.ecc.value, MAX_VERSION);
    const config = settings();
    if (!Number.isInteger(config.version) || config.version < 1 || config.version > MAX_VERSION) throw new Error(`Version must be between 1 and ${MAX_VERSION}.`);
    const levels = fittingLevels(config.message, config.version, config.level);
    if (!levels.length) throw new Error("Content does not fit at this version and ECC level.");
    const oldTargets = [...state.targets.values()];
    state.model = generateBaseline({
      ...config,
      level: levels[0],
      type: fittingModes(config.message, config.version, levels[0])[0],
      mask: config.mask === "auto" ? 0 : Number(config.mask),
    });
    const size = state.model.matrix.length;
    state.targets = new Map((clear ? [] : oldTargets).filter(({ row, column }) =>
      row < size && column < size && canDrawOn(state.model, row, column, config.allowMetadata),
    ).map((target) => [target.row * size + target.column, target]));
    state.history = [];
    state.future = [];
    state.invalid = false;
    state.ready = true;
    grid.render(view());
    schedule();
  } catch (error) {
    message(error.message, "is-error");
  }
  updateControls();
}

function paint(targets, row, column) {
  const size = state.model.matrix.length;
  if (row < 0 || column < 0 || row >= size || column >= size || !canDrawOn(state.model, row, column, elements["allow-metadata"].checked)) return;
  const key = row * size + column;
  if (state.tool === "restore") targets.delete(key);
  else targets.set(key, { row, column, value: state.value });
}

function paintLine(from, to) {
  const steps = Math.max(Math.abs(to.row - from.row), Math.abs(to.column - from.column));
  for (let step = 0; step <= steps; step += 1) {
    const fraction = steps ? step / steps : 0;
    paint(state.targets, Math.round(from.row + (to.row - from.row) * fraction), Math.round(from.column + (to.column - from.column) * fraction));
  }
}

function moveStroke(module) {
  if (state.tool === "rectangle") {
    state.preview = new Map(state.stroke.before);
    const start = state.stroke.start;
    for (let row = Math.min(start.row, module.row); row <= Math.max(start.row, module.row); row += 1) {
      for (let column = Math.min(start.column, module.column); column <= Math.max(start.column, module.column); column += 1) {
        paint(state.preview, row, column);
      }
    }
  } else paintLine(state.stroke.last, module);
  state.stroke.last = module;
  grid.render(view());
}

function finishStroke(event) {
  if (!state.stroke || (event && event.pointerId !== state.stroke.pointerId)) return;
  if (state.preview) state.targets = state.preview;
  const before = state.stroke.before;
  state.stroke = state.preview = null;
  const changed = before.size !== state.targets.size || [...before].some(([key, target]) => state.targets.get(key)?.value !== target.value);
  if (changed) {
    state.history.push(before);
    state.future = [];
    schedule();
  } else if (state.busy || state.queued) {
    state.queued = true;
    pump();
  }
  grid.render(view());
  updateControls();
}

elements["qr-grid"].addEventListener("pointerdown", (event) => {
  if (!state.ready || state.stroke || event.button !== 0) return;
  const module = grid.moduleFromPointer(event);
  if (!module || !canDrawOn(state.model, module.row, module.column, elements["allow-metadata"].checked)) return;
  event.preventDefault();
  state.revision += 1;
  state.queued = true;
  state.animating = false;
  grid.stop();
  state.stroke = { before: new Map(state.targets), start: module, last: module, pointerId: event.pointerId };
  elements["qr-grid"].focus({ preventScroll: true });
  elements["qr-grid"].setPointerCapture(event.pointerId);
  moveStroke(module);
  updateControls();
});
elements["qr-grid"].addEventListener("pointermove", (event) => {
  const module = grid.moduleFromPointer(event);
  if (state.stroke && event.pointerId === state.stroke.pointerId && module) moveStroke(module);
});
window.addEventListener("pointerup", finishStroke);
window.addEventListener("pointercancel", finishStroke);
elements["qr-grid"].addEventListener("lostpointercapture", finishStroke);

document.querySelectorAll("[data-tool], [data-color]").forEach((button) => {
  button.addEventListener("click", () => {
    finishStroke();
    const attribute = button.hasAttribute("data-tool") ? "data-tool" : "data-color";
    document.querySelectorAll(`[${attribute}]`).forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    if (attribute === "data-tool") state.tool = button.dataset.tool;
    else state.value = button.dataset.color === "black";
  });
});

function restoreHistory(from, to) {
  if (!state.ready || !from.length || state.animating || state.stroke) return;
  to.push(new Map(state.targets));
  state.targets = from.pop();
  grid.stop();
  grid.render(view());
  schedule();
}
elements.undo.addEventListener("click", () => restoreHistory(state.history, state.future));
elements.redo.addEventListener("click", () => restoreHistory(state.future, state.history));
elements.content.addEventListener("input", () => rebuild({ fit: true, clear: true }));
elements.version.addEventListener("change", () => rebuild());
elements.ecc.addEventListener("change", () => rebuild());
elements.mask.addEventListener("change", () => rebuild());
elements["allow-metadata"].addEventListener("change", () => {
  finishStroke();
  if (!state.model) return;
  if (!elements["allow-metadata"].checked) {
    const protect = (targets) => new Map([...targets].filter(([, { row, column }]) => canDrawOn(state.model, row, column)));
    state.targets = protect(state.targets);
    state.history = state.history.map(protect);
    state.future = state.future.map(protect);
  }
  grid.stop();
  state.animating = false;
  grid.render(view());
  showDamage({ damage: analyzeDamage(state.model, matrix()) });
  if (state.ready) schedule();
});
for (const id of ["highlight-drawn", "highlight-necessary"]) {
  elements[id].addEventListener("change", () => {
    if (!state.model) return;
    if (state.animating) grid.stop();
    grid.render(view());
  });
}
elements.svg.addEventListener("click", () => download(svgBlob(matrix()), filename("svg")));
elements.png.addEventListener("click", async () => download(await pngBlob(matrix()), filename("png")));
elements.share.addEventListener("click", async () => {
  try {
    await navigator.share({ title: "DrawOnQR Code", files: [state.shareFile] });
  } catch (error) {
    if (error.name !== "AbortError") message("Could not share image.", "is-error");
  }
});
document.addEventListener("keydown", (event) => {
  if (event.target.matches("input, textarea, select") || event.altKey) return;
  if (event.ctrlKey || event.metaKey) {
    const key = event.key.toLowerCase();
    if (key === "z" || key === "y") {
      event.preventDefault();
      if (key === "y" || event.shiftKey) elements.redo.click();
      else elements.undo.click();
    } else if (key === "s") {
      event.preventDefault();
      elements.png.click();
    }
  }
});

rebuild({ fit: true });
