import { analyzeDamage, applyChanges, canDrawOn, generateBaseline } from "./qr-engine.js";
import { fittingLevels, fittingModes, smallestVersion } from "./optimizer.js";
import { DrawingCanvas } from "./canvas.js";
import { download, pngBlob, svgBlob } from "./export.js";

const elements = Object.fromEntries([
  "content", "version", "ecc", "mask", "qr-grid", "qr-canvas", "undo", "redo",
  "status", "blocks", "svg", "png", "share", "highlight-areas", "grid-legend",
  "allow-metadata", "metadata-blocks", "allow-alignment",
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
    allowAlignment: elements["allow-alignment"].checked,
  };
}

function view() {
  return {
    model: state.model,
    targets: state.preview ?? state.targets,
    invalid: state.invalid,
    highlightAreas: elements["highlight-areas"].checked,
    allowMetadata: elements["allow-metadata"].checked,
  };
}

function matrix() {
  return applyChanges(state.model.matrix, [...state.targets.values()]);
}

function canPaint(row, column) {
  return canDrawOn(state.model, row, column,
    elements["allow-metadata"].checked, elements["allow-alignment"].checked);
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
        : state.invalid ? "ECC limit exceeded. QR may be unreadable. increase version."
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
      row < size && column < size && canPaint(row, column),
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
  if (row < 0 || column < 0 || row >= size || column >= size || !canPaint(row, column)) return;
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
  if (!module || !canPaint(module.row, module.column)) return;
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
function setLogo(){
  const version3 = '[[300,{"row":10,"column":10,"value":true}],[330,{"row":11,"column":11,"value":true}],[360,{"row":12,"column":12,"value":true}],[390,{"row":13,"column":13,"value":true}],[420,{"row":14,"column":14,"value":true}],[561,{"row":19,"column":10,"value":true}],[533,{"row":18,"column":11,"value":true}],[505,{"row":17,"column":12,"value":true}],[477,{"row":16,"column":13,"value":true}],[449,{"row":15,"column":14,"value":true}],[301,{"row":10,"column":11,"value":true}],[302,{"row":10,"column":12,"value":true}],[331,{"row":11,"column":12,"value":true}],[332,{"row":11,"column":13,"value":true}],[361,{"row":12,"column":13,"value":true}],[391,{"row":13,"column":14,"value":true}],[362,{"row":12,"column":14,"value":true}],[392,{"row":13,"column":15,"value":true}],[421,{"row":14,"column":15,"value":true}],[450,{"row":15,"column":15,"value":true}],[479,{"row":16,"column":15,"value":true}],[478,{"row":16,"column":14,"value":true}],[507,{"row":17,"column":14,"value":true}],[506,{"row":17,"column":13,"value":true}],[535,{"row":18,"column":13,"value":true}],[534,{"row":18,"column":12,"value":true}],[563,{"row":19,"column":12,"value":true}],[562,{"row":19,"column":11,"value":true}],[591,{"row":20,"column":11,"value":true}],[272,{"row":9,"column":11,"value":true}],[273,{"row":9,"column":12,"value":true}],[274,{"row":9,"column":13,"value":true}],[303,{"row":10,"column":13,"value":true}],[333,{"row":11,"column":14,"value":true}],[363,{"row":12,"column":15,"value":true}],[393,{"row":13,"column":16,"value":true}],[422,{"row":14,"column":16,"value":true}],[451,{"row":15,"column":16,"value":true}],[244,{"row":8,"column":12,"value":true}],[304,{"row":10,"column":14,"value":true}],[334,{"row":11,"column":15,"value":true}],[364,{"row":12,"column":16,"value":true}],[394,{"row":13,"column":17,"value":true}],[423,{"row":14,"column":17,"value":true}],[621,{"row":21,"column":12,"value":true}],[592,{"row":20,"column":12,"value":true}],[564,{"row":19,"column":13,"value":true}],[565,{"row":19,"column":14,"value":true}],[536,{"row":18,"column":14,"value":true}],[537,{"row":18,"column":15,"value":true}],[508,{"row":17,"column":15,"value":true}],[480,{"row":16,"column":16,"value":true}],[452,{"row":15,"column":17,"value":true}],[509,{"row":17,"column":16,"value":true}],[593,{"row":20,"column":13,"value":true}],[481,{"row":16,"column":17,"value":true}],[424,{"row":14,"column":18,"value":true}],[453,{"row":15,"column":18,"value":true}],[215,{"row":7,"column":12,"value":false}],[216,{"row":7,"column":13,"value":false}],[245,{"row":8,"column":13,"value":false}],[246,{"row":8,"column":14,"value":false}],[275,{"row":9,"column":14,"value":false}],[276,{"row":9,"column":15,"value":false}],[305,{"row":10,"column":15,"value":false}],[306,{"row":10,"column":16,"value":false}],[335,{"row":11,"column":16,"value":false}],[336,{"row":11,"column":17,"value":false}],[365,{"row":12,"column":17,"value":false}],[366,{"row":12,"column":18,"value":false}],[395,{"row":13,"column":18,"value":false}],[396,{"row":13,"column":19,"value":false}],[425,{"row":14,"column":19,"value":false}],[454,{"row":15,"column":19,"value":false}],[483,{"row":16,"column":19,"value":false}],[482,{"row":16,"column":18,"value":false}],[511,{"row":17,"column":18,"value":false}],[510,{"row":17,"column":17,"value":false}],[539,{"row":18,"column":17,"value":false}],[538,{"row":18,"column":16,"value":false}],[567,{"row":19,"column":16,"value":false}],[566,{"row":19,"column":15,"value":false}],[595,{"row":20,"column":15,"value":false}],[594,{"row":20,"column":14,"value":false}],[623,{"row":21,"column":14,"value":false}],[622,{"row":21,"column":13,"value":false}],[651,{"row":22,"column":13,"value":false}],[650,{"row":22,"column":12,"value":false}],[649,{"row":22,"column":11,"value":false}],[620,{"row":21,"column":11,"value":false}],[619,{"row":21,"column":10,"value":false}],[590,{"row":20,"column":10,"value":false}],[589,{"row":20,"column":9,"value":false}],[560,{"row":19,"column":9,"value":false}],[531,{"row":18,"column":9,"value":false}],[532,{"row":18,"column":10,"value":false}],[503,{"row":17,"column":10,"value":false}],[504,{"row":17,"column":11,"value":false}],[475,{"row":16,"column":11,"value":false}],[476,{"row":16,"column":12,"value":false}],[447,{"row":15,"column":12,"value":false}],[448,{"row":15,"column":13,"value":false}],[419,{"row":14,"column":13,"value":false}],[418,{"row":14,"column":12,"value":false}],[389,{"row":13,"column":12,"value":false}],[388,{"row":13,"column":11,"value":false}],[359,{"row":12,"column":11,"value":false}],[358,{"row":12,"column":10,"value":false}],[329,{"row":11,"column":10,"value":false}],[328,{"row":11,"column":9,"value":false}],[299,{"row":10,"column":9,"value":false}],[270,{"row":9,"column":9,"value":false}],[271,{"row":9,"column":10,"value":false}],[242,{"row":8,"column":10,"value":false}],[243,{"row":8,"column":11,"value":false}],[214,{"row":7,"column":11,"value":false}]]';
  const version4 = '[[340,{"row":10,"column":10,"value":false}],[374,{"row":11,"column":11,"value":true}],[408,{"row":12,"column":12,"value":true}],[442,{"row":13,"column":13,"value":true}],[476,{"row":14,"column":14,"value":true}],[510,{"row":15,"column":15,"value":true}],[801,{"row":24,"column":9,"value":false}],[769,{"row":23,"column":10,"value":false}],[737,{"row":22,"column":11,"value":false}],[705,{"row":21,"column":12,"value":false}],[673,{"row":20,"column":13,"value":false}],[641,{"row":19,"column":14,"value":false}],[609,{"row":18,"column":15,"value":false}],[577,{"row":17,"column":16,"value":true}],[544,{"row":16,"column":16,"value":true}],[339,{"row":10,"column":9,"value":false}],[373,{"row":11,"column":10,"value":true}],[407,{"row":12,"column":11,"value":true}],[441,{"row":13,"column":12,"value":true}],[475,{"row":14,"column":13,"value":true}],[509,{"row":15,"column":14,"value":true}],[543,{"row":16,"column":15,"value":true}],[610,{"row":18,"column":16,"value":true}],[642,{"row":19,"column":15,"value":true}],[674,{"row":20,"column":14,"value":true}],[706,{"row":21,"column":13,"value":true}],[738,{"row":22,"column":12,"value":true}],[770,{"row":23,"column":11,"value":true}],[802,{"row":24,"column":10,"value":true}],[608,{"row":18,"column":14,"value":false}],[640,{"row":19,"column":13,"value":false}],[672,{"row":20,"column":12,"value":false}],[704,{"row":21,"column":11,"value":false}],[736,{"row":22,"column":10,"value":false}],[768,{"row":23,"column":9,"value":false}],[372,{"row":11,"column":9,"value":false}],[405,{"row":12,"column":9,"value":false}],[406,{"row":12,"column":10,"value":false}],[439,{"row":13,"column":10,"value":false}],[440,{"row":13,"column":11,"value":false}],[473,{"row":14,"column":11,"value":false}],[474,{"row":14,"column":12,"value":false}],[507,{"row":15,"column":12,"value":false}],[508,{"row":15,"column":13,"value":false}],[541,{"row":16,"column":13,"value":false}],[542,{"row":16,"column":14,"value":false}],[575,{"row":17,"column":14,"value":false}],[576,{"row":17,"column":15,"value":false}],[803,{"row":24,"column":11,"value":true}],[771,{"row":23,"column":12,"value":true}],[739,{"row":22,"column":13,"value":true}],[707,{"row":21,"column":14,"value":true}],[708,{"row":21,"column":15,"value":true}],[675,{"row":20,"column":15,"value":true}],[676,{"row":20,"column":16,"value":true}],[643,{"row":19,"column":16,"value":true}],[644,{"row":19,"column":17,"value":true}],[611,{"row":18,"column":17,"value":true}],[578,{"row":17,"column":17,"value":true}],[579,{"row":17,"column":18,"value":true}],[612,{"row":18,"column":18,"value":true}],[645,{"row":19,"column":18,"value":true}],[677,{"row":20,"column":17,"value":true}],[709,{"row":21,"column":16,"value":true}],[741,{"row":22,"column":15,"value":true}],[740,{"row":22,"column":14,"value":true}],[678,{"row":20,"column":18,"value":true}],[710,{"row":21,"column":17,"value":true}],[742,{"row":22,"column":16,"value":true}],[774,{"row":23,"column":15,"value":true}],[773,{"row":23,"column":14,"value":true}],[806,{"row":24,"column":14,"value":true}],[805,{"row":24,"column":13,"value":true}],[838,{"row":25,"column":13,"value":true}],[871,{"row":26,"column":13,"value":true}],[870,{"row":26,"column":12,"value":true}],[869,{"row":26,"column":11,"value":false}],[836,{"row":25,"column":11,"value":true}],[837,{"row":25,"column":12,"value":true}],[772,{"row":23,"column":13,"value":true}],[804,{"row":24,"column":12,"value":true}],[341,{"row":10,"column":11,"value":true}],[375,{"row":11,"column":12,"value":true}],[376,{"row":11,"column":13,"value":true}],[409,{"row":12,"column":13,"value":true}],[410,{"row":12,"column":14,"value":true}],[443,{"row":13,"column":14,"value":true}],[444,{"row":13,"column":15,"value":true}],[477,{"row":14,"column":15,"value":true}],[478,{"row":14,"column":16,"value":true}],[511,{"row":15,"column":16,"value":true}],[545,{"row":16,"column":17,"value":true}],[546,{"row":16,"column":18,"value":true}],[513,{"row":15,"column":18,"value":true}],[512,{"row":15,"column":17,"value":true}],[479,{"row":14,"column":17,"value":true}],[445,{"row":13,"column":16,"value":true}],[342,{"row":10,"column":12,"value":true}],[343,{"row":10,"column":13,"value":true}],[377,{"row":11,"column":14,"value":true}],[411,{"row":12,"column":15,"value":true}],[446,{"row":13,"column":17,"value":true}],[480,{"row":14,"column":18,"value":true}],[514,{"row":15,"column":19,"value":true}],[412,{"row":12,"column":16,"value":true}],[378,{"row":11,"column":15,"value":true}],[344,{"row":10,"column":14,"value":true}],[310,{"row":9,"column":13,"value":true}],[309,{"row":9,"column":12,"value":true}],[308,{"row":9,"column":11,"value":false}],[276,{"row":8,"column":12,"value":false}],[277,{"row":8,"column":13,"value":true}],[547,{"row":16,"column":19,"value":true}],[580,{"row":17,"column":19,"value":true}],[613,{"row":18,"column":19,"value":true}],[581,{"row":17,"column":20,"value":true}],[614,{"row":18,"column":20,"value":true}],[548,{"row":16,"column":20,"value":true}],[582,{"row":17,"column":21,"value":true}],[615,{"row":18,"column":21,"value":true}],[647,{"row":19,"column":20,"value":true}],[646,{"row":19,"column":19,"value":true}],[679,{"row":20,"column":19,"value":true}],[711,{"row":21,"column":18,"value":true}],[743,{"row":22,"column":17,"value":true}],[775,{"row":23,"column":16,"value":true}],[807,{"row":24,"column":15,"value":true}],[840,{"row":25,"column":15,"value":true}],[839,{"row":25,"column":14,"value":true}],[872,{"row":26,"column":14,"value":true}],[808,{"row":24,"column":16,"value":true}],[776,{"row":23,"column":17,"value":true}],[744,{"row":22,"column":18,"value":true}],[712,{"row":21,"column":19,"value":true}],[680,{"row":20,"column":20,"value":true}],[648,{"row":19,"column":21,"value":true}],[311,{"row":9,"column":14,"value":true}],[345,{"row":10,"column":15,"value":true}],[379,{"row":11,"column":16,"value":true}],[413,{"row":12,"column":17,"value":true}],[447,{"row":13,"column":18,"value":true}],[481,{"row":14,"column":19,"value":true}],[515,{"row":15,"column":20,"value":true}],[549,{"row":16,"column":21,"value":true}],[583,{"row":17,"column":22,"value":true}],[616,{"row":18,"column":22,"value":true}],[904,{"row":27,"column":13,"value":true}],[903,{"row":27,"column":12,"value":false}],[275,{"row":8,"column":11,"value":false}],[307,{"row":9,"column":10,"value":false}],[243,{"row":7,"column":12,"value":false}],[244,{"row":7,"column":13,"value":false}],[245,{"row":7,"column":14,"value":false}],[278,{"row":8,"column":14,"value":false}],[279,{"row":8,"column":15,"value":false}],[312,{"row":9,"column":15,"value":false}],[313,{"row":9,"column":16,"value":false}],[346,{"row":10,"column":16,"value":false}],[347,{"row":10,"column":17,"value":false}],[380,{"row":11,"column":17,"value":false}],[381,{"row":11,"column":18,"value":false}],[414,{"row":12,"column":18,"value":false}],[415,{"row":12,"column":19,"value":false}],[448,{"row":13,"column":19,"value":false}],[449,{"row":13,"column":20,"value":false}],[482,{"row":14,"column":20,"value":false}],[483,{"row":14,"column":21,"value":false}],[516,{"row":15,"column":21,"value":false}],[517,{"row":15,"column":22,"value":false}],[550,{"row":16,"column":22,"value":false}],[551,{"row":16,"column":23,"value":false}],[584,{"row":17,"column":23,"value":false}],[617,{"row":18,"column":23,"value":false}],[650,{"row":19,"column":23,"value":false}],[649,{"row":19,"column":22,"value":false}],[682,{"row":20,"column":22,"value":false}],[681,{"row":20,"column":21,"value":false}],[714,{"row":21,"column":21,"value":false}],[713,{"row":21,"column":20,"value":false}],[746,{"row":22,"column":20,"value":false}],[745,{"row":22,"column":19,"value":false}],[778,{"row":23,"column":19,"value":false}],[777,{"row":23,"column":18,"value":false}],[810,{"row":24,"column":18,"value":false}],[809,{"row":24,"column":17,"value":false}],[842,{"row":25,"column":17,"value":false}],[841,{"row":25,"column":16,"value":false}],[874,{"row":26,"column":16,"value":false}],[873,{"row":26,"column":15,"value":false}],[906,{"row":27,"column":15,"value":false}],[905,{"row":27,"column":14,"value":false}],[834,{"row":25,"column":9,"value":false}],[835,{"row":25,"column":10,"value":false}],[868,{"row":26,"column":10,"value":false}],[902,{"row":27,"column":11,"value":false}],[936,{"row":28,"column":12,"value":false}],[937,{"row":28,"column":13,"value":false}],[938,{"row":28,"column":14,"value":false}]]'
  if (state.model.version===3)
    state.targets = new  Map(JSON.parse(version3));
  if (state.model.version===4)
    state.targets = new  Map(JSON.parse(version4));
  schedule();
  grid.render(view());
  updateControls();
}
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
elements.content.addEventListener("input", () => {rebuild({ fit: true, clear: true });setLogo();});
elements.version.addEventListener("change", () => {rebuild();setLogo();});
elements.ecc.addEventListener("change", () => rebuild());
elements.mask.addEventListener("change", () => rebuild());
for (const id of ["allow-metadata", "allow-alignment"]) {
  elements[id].addEventListener("change", () => {
    finishStroke();
    if (!state.model) return;
    const protect = (targets) => new Map([...targets].filter(([, { row, column }]) => canPaint(row, column)));
    state.targets = protect(state.targets);
    state.history = state.history.map(protect);
    state.future = state.future.map(protect);
    grid.stop();
    state.animating = false;
    grid.render(view());
    showDamage({ damage: analyzeDamage(state.model, matrix()) });
    if (state.ready) schedule();
  });
}
elements["highlight-areas"].addEventListener("change", () => {
  elements["grid-legend"].hidden = !elements["highlight-areas"].checked;
  if (!state.model) return;
  if (state.animating) grid.stop();
  grid.render(view());
});
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
    if (event.key.toLowerCase()==="c"){
    event.preventDefault();
    console.log(JSON.stringify(Array.from(state.targets.entries())));
  }
  if (event.key.toLowerCase()==="r"){
    event.preventDefault();
    setLogo()
  }
});
rebuild({ fit: true });
setLogo()