export function pngBlob(matrix) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = (matrix.length + 8) * 10;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000";
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) context.fillRect((x + 4) * 10, (y + 4) * 10, 10, 10);
  }));
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("Could not export PNG."));
  }, "image/png"));
}

export function svgBlob(matrix) {
  const size = matrix.length + 8;
  const path = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) path.push(`M${x + 4} ${y + 4}h1v1h-1z`);
  }));
  return new Blob([
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 10}" height="${size * 10}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<path fill="#fff" d="M0 0h${size}v${size}H0z"/><path fill="#000" d="${path.join("")}"/></svg>`,
  ], { type: "image/svg+xml" });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
