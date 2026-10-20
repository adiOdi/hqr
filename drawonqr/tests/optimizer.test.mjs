import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDamage, applyChanges, generateBaseline } from "../js/qr-engine.js";
import { fittingModes, optimizeDrawing, smallestVersion } from "../js/optimizer.js";

function padding(model) {
  return model.dataBlocks.flat().slice(model.paddingStartCodeword);
}

function standardPadding(model) {
  return padding(model).map((_, index) => index % 2 === 0 ? 0xec : 0x11);
}

test("standard EC 11 padding is used without a drawing", async () => {
  for (const [message, version] of [["hi", 1], ["67", 2], ["HELLO", 5]]) {
    const result = await optimizeDrawing({ message, version });
    assert.ok(padding(result.model).length > 0);
    assert.deepEqual(padding(result.model), standardPadding(result.model));
  }
});

test("padding stays standard when alternatives cannot reduce damage, even after a previous optimization", async () => {
  for (let mask = 0; mask < 8; mask += 1) {
    const settings = { message: "hi", version: 1, level: "H", mask };
    const base = generateBaseline(settings);
    const previous = generateBaseline({ ...settings, paddingBytes: [0] });
    const position = base.path.find(({ row, column }) => {
      const meta = base.metadata[row][column];
      return meta.kind === "data" && meta.globalDataCodewordIndex < base.paddingStartCodeword;
    });
    const targets = [{ ...position, value: !base.matrix[position.row][position.column] }];
    const result = await optimizeDrawing({ ...settings, targets, previous });
    assert.equal(result.totalDamaged, 1);
    assert.deepEqual(padding(result.model), standardPadding(result.model));
  }
});

test("beneficial padding changes preserve all unconstrained standard pad bytes", async () => {
  const settings = { message: "hi", version: 5, level: "H", mask: 0 };
  const base = generateBaseline(settings);
  const target = base.path.find(({ row, column }) => {
    const meta = base.metadata[row][column];
    return meta.kind === "data" && meta.globalDataCodewordIndex === base.paddingStartCodeword;
  });
  const meta = base.metadata[target.row][target.column];
  const expected = standardPadding(base);
  expected[0] ^= 1 << (7 - meta.bitIndex);
  const result = await optimizeDrawing({ ...settings, targets: [{ ...target, value: !base.matrix[target.row][target.column] }] });
  assert.equal(result.totalDamaged, 0);
  assert.deepEqual(padding(result.model), expected);
});

test("content chooses the smallest fitting version for allowed ECC levels", () => {
  const content = "noel-friedrich.de";
  assert.equal(smallestVersion(content), 1);
  assert.equal(smallestVersion(content, "H"), 3);
});

test("auto-fit reports content that exceeds the available version range", () => {
  const content = "x".repeat(300);
  assert.ok(smallestVersion(content) > 10);
  assert.throws(() => smallestVersion(content, "auto", 10), /Versions 1-10/);
});

test("only modes that preserve the exact content are eligible", () => {
  assert.deepEqual(fittingModes("123", 1, "H"), ["numeric", "alphanumeric", "byte"]);
  assert.deepEqual(fittingModes("ABC-123", 1, "H"), ["alphanumeric", "byte"]);
  for (const message of ["abc", "ABC\n", "123\n", "123\t", "caf\u00e9", ""]) {
    assert.deepEqual(fittingModes(message, 1, "H"), ["byte"]);
  }
});

test("numeric and alphanumeric modes allow smaller versions", async () => {
  for (const [message, type] of [["12345678901234567", "numeric"], ["ABCDEFGHIJ", "alphanumeric"]]) {
    assert.equal(smallestVersion(message, "H"), 1);
    const result = await optimizeDrawing({ message, version: 1, level: "H", mask: 0 });
    assert.equal(result.model.type, type);
    assert.equal(result.model.version, 1);
    assert.ok(result.readable);
    const baseline = generateBaseline({ message, version: 1, level: "H", mask: 0, type });
    assert.deepEqual(result.edited, baseline.matrix);
  }
});

test("mode search can keep byte encoding when it best matches the drawing", async () => {
  const message = "1234567";
  const base = generateBaseline({ message, version: 1, level: "H", mask: 0, type: "byte" });
  const targets = [];
  base.matrix.forEach((line, row) => line.forEach((value, column) => {
    if (!base.functionMap[row][column]) targets.push({ row, column, value });
  }));
  const result = await optimizeDrawing({ message, version: 1, level: "H", mask: 0, targets });
  assert.equal(result.model.type, "byte");
  assert.equal(result.totalDamaged, 0);
  assert.deepEqual(result.edited, base.matrix);
});

test("padding reevaluation retains the chosen numeric or alphanumeric mode", async () => {
  for (const [message, type] of [["1234567890123", "numeric"], ["ABCDEFGH", "alphanumeric"]]) {
    const base = generateBaseline({ message, version: 1, level: "H", mask: 0, type });
    const targets = [];
    base.metadata.forEach((line, row) => line.forEach((meta, column) => {
      if (meta.kind === "data" && meta.globalDataCodewordIndex === base.paddingStartCodeword) {
        targets.push({ row, column, value: !base.matrix[row][column] });
      }
    }));
    assert.equal(targets.length, 8);
    const result = await optimizeDrawing({ message, version: 1, level: "H", mask: 0, targets });
    assert.equal(result.model.type, type);
    assert.equal(result.totalDamaged, 0);
    assert.deepEqual(result.model.dataBlocks.flat().slice(0, base.paddingStartCodeword), base.dataBlocks.flat().slice(0, base.paddingStartCodeword));
    for (const { row, column, value } of targets) assert.equal(result.edited[row][column], value);
  }
});

test("padding absorbs a painted byte while preserving encoded content", async () => {
  const base = generateBaseline({ message: "hi", version: 1, level: "H", mask: 0 });
  const position = base.metadata.flat().find((meta) => meta.kind === "data" && meta.globalDataCodewordIndex >= base.paddingStartCodeword);
  const targets = [];
  base.metadata.forEach((line, row) => line.forEach((meta, column) => {
    if (meta.kind === "data" && meta.globalDataCodewordIndex === position.globalDataCodewordIndex) {
      targets.push({ row, column, value: !base.matrix[row][column] });
    }
  }));
  const before = analyzeDamage(base, applyChanges(base.matrix, targets));
  assert.equal(before.blockStats[0].totalDamaged, 1);
  const result = await optimizeDrawing({ message: "hi", version: 1, level: "H", mask: "0", targets });
  assert.equal(result.totalDamaged, 0);
  assert.ok(result.readable);
  assert.equal(result.model.version, 1);
  assert.equal(result.model.mask, 0);
  assert.equal(result.model.level, "H");
  assert.deepEqual(result.model.dataBlocks.flat().slice(0, base.paddingStartCodeword), base.dataBlocks.flat().slice(0, base.paddingStartCodeword));
  for (const { row, column, value } of targets) assert.equal(result.edited[row][column], value);
});

test("all function patterns remain protected even if supplied as targets", async () => {
  const base = generateBaseline({ message: "hi", version: 7, level: "H", mask: 0 });
  const targets = [];
  base.functionMap.forEach((line, row) => line.forEach((kind, column) => {
    if (kind) targets.push({ row, column, value: !base.matrix[row][column] });
  }));
  const result = await optimizeDrawing({ message: "hi", version: 7, level: "H", mask: "0", targets });
  assert.deepEqual(result.edited, base.matrix);
  assert.equal(result.totalDamaged, 0);
});

test("auto settings can choose the only fitting ECC level without enlarging", async () => {
  const result = await optimizeDrawing({ message: "noel-friedrich.de", version: 1 });
  assert.equal(result.model.version, 1);
  assert.equal(result.model.level, "L");
  assert.ok(result.readable);
});

test("painting every editable module exceeds ECC and preserves drawing", async () => {
  const base = generateBaseline({ message: "67", version: 1, level: "H", mask: 0 });
  const targets = [];
  base.matrix.forEach((line, row) => line.forEach((_, column) => {
    if (!base.functionMap[row][column]) targets.push({ row, column, value: false });
  }));
  const result = await optimizeDrawing({ message: "67", version: 1, targets });
  assert.equal(result.readable, false);
  assert.ok(result.damage.blockStats.some((block) => block.totalDamaged > block.theoreticalLimit));
  for (const { row, column } of targets) assert.equal(result.edited[row][column], false);
});

test("no-spare-padding case still returns an evaluated QR", async () => {
  const result = await optimizeDrawing({ message: "abcdefg", version: 1, level: "H", mask: 1, targets: [{ row: 12, column: 12, value: true }] });
  assert.equal(result.model.paddingStartCodeword, result.model.dataBlocks.flat().length);
  assert.equal(result.edited[12][12], true);
});

test("invalid settings and content that does not fit fail explicitly", async () => {
  await assert.rejects(optimizeDrawing({ message: "67", version: 0 }), /Version/);
  await assert.rejects(optimizeDrawing({ message: "67", version: 1, level: "bad" }), /ECC/);
  await assert.rejects(optimizeDrawing({ message: "67", version: 1, mask: 8 }), /mask/);
  await assert.rejects(optimizeDrawing({ message: "noel-friedrich.de", version: 1, level: "H" }), /does not fit/);
});
