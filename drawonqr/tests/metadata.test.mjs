import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDamage, applyChanges, canDrawOn, generateBaseline, getMetadataRegions, isMetadataModule } from "../js/qr-engine.js";
import { optimizeDrawing } from "../js/optimizer.js";

const settings = { message: "hi", version: 1, level: "H", mask: 0 };

function flip(region, count, model) {
  return region.positions.slice(0, count).map(([row, column]) => ({
    row, column, value: !model.matrix[row][column],
  }));
}

test("only format and version metadata become editable", () => {
  const model = generateBaseline({ ...settings, version: 7 });
  model.functionMap.forEach((line, row) => line.forEach((kind, column) => {
    assert.equal(canDrawOn(model, row, column), !kind);
    assert.equal(canDrawOn(model, row, column, true), !kind || isMetadataModule(kind));
  }));
  assert.equal(canDrawOn(model, -1, 0, true), false);
  assert.equal(canDrawOn(model, 0, 1000, true), false);
});

test("each metadata copy has its own three-bit budget", async () => {
  const model = generateBaseline(settings);
  const regions = getMetadataRegions(1);
  assert.deepEqual(regions.map((region) => region.positions.length), [15, 15]);
  for (const [first, second, readable] of [[3, 3, true], [4, 0, false], [4, 2, false], [0, 4, false]]) {
    const targets = [...flip(regions[0], first, model), ...flip(regions[1], second, model)];
    const result = await optimizeDrawing({ ...settings, targets, allowMetadata: true });
    assert.equal(result.readable, readable);
    assert.equal(result.totalDamaged, 0);
    assert.equal(result.metadataDamaged, first + second);
    assert.deepEqual(result.damage.metadataStats.map((region) => region.damagedBits), [first, second]);
    assert.deepEqual(result.damage.metadataStats.map((region) => region.theoreticalLimit), [3, 3]);
    for (const { row, column, value } of targets) assert.equal(result.edited[row][column], value);
  }
});

test("metadata is immutable unless explicitly enabled", async () => {
  const model = generateBaseline(settings);
  const targets = flip(getMetadataRegions(1)[0], 4, model);
  const result = await optimizeDrawing({ ...settings, targets });
  assert.deepEqual(result.edited, model.matrix);
  assert.equal(result.metadataDamaged, 0);
  assert.ok(result.readable);
});

test("version information is measured independently starting at version seven", async () => {
  assert.equal(getMetadataRegions(6).length, 2);
  const model = generateBaseline({ ...settings, version: 7 });
  const regions = getMetadataRegions(7);
  assert.deepEqual(regions.map((region) => region.positions.length), [15, 15, 18, 18]);
  const targets = [...flip(regions[2], 4, model), ...flip(regions[3], 2, model)];
  const damage = analyzeDamage(model, applyChanges(model.matrix, targets));
  assert.deepEqual(damage.metadataStats.map((region) => region.damagedBits), [0, 0, 4, 2]);
  const result = await optimizeDrawing({ ...settings, version: 7, targets, allowMetadata: true });
  assert.equal(result.readable, false);
  assert.equal(result.totalDamaged, 0);
});

test("Auto ECC and mask can match painted format metadata", async () => {
  const desired = generateBaseline({ ...settings, level: "Q", mask: 5 });
  const targets = getMetadataRegions(1).flatMap(({ positions }) => positions.map(([row, column]) => ({
    row, column, value: desired.matrix[row][column],
  })));
  const result = await optimizeDrawing({ message: "hi", version: 1, targets, allowMetadata: true });
  assert.equal(result.model.level, "Q");
  assert.equal(result.model.mask, 5);
  assert.equal(result.metadataDamaged, 0);
  assert.equal(result.totalDamaged, 0);
  assert.ok(result.readable);
});
