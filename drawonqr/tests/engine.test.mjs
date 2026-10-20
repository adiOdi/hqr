import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDamage, cloneMatrix, generateBaseline, getAlignmentCenters } from "../js/qr-engine.js";
import { getBlockInfo, getRemainderBitCount } from "../js/data-encoding.js";

function runEngineTests() {
  const failures = [];
  for (let version = 1; version <= 40; version += 1) {
    for (const level of ["L", "M", "Q", "H"]) {
      try {
        const model = generateBaseline({
          version,
          level,
          mask: 1,
          message: "HELLO",
          type: "byte",
        });
        const info = getBlockInfo(version, level);
        const expectedTotal =
          info.dataCodewords +
          model.blocks.reduce((sum, block) => sum + block.eccCount, 0);
        const mappedBits = model.metadata
          .flat()
          .filter((meta) => meta?.kind === "data" || meta?.kind === "ecc");
        if (model.totalCodewords !== expectedTotal) {
          throw new Error("total codeword count");
        }
        if (mappedBits.length !== expectedTotal * 8) {
          throw new Error("module-to-codeword mapping");
        }
        if (
          model.metadata.flat().filter((meta) => meta?.kind === "remainder")
            .length !== getRemainderBitCount(version)
        ) {
          throw new Error("remainder mapping");
        }
        for (let row = 0; row < model.matrix.length; row += 1) {
          for (let column = 0; column < model.matrix.length; column += 1) {
            if (
              model.metadata[row][column]?.kind === "remainder" &&
              model.matrix[row][column] !== (row % 2 === 0)
            ) {
              throw new Error("remainder masking");
            }
          }
        }

        const reconstructedData = model.blocks.map(() => []);
        const reconstructedEcc = model.blocks.map(() => []);
        for (const entry of model.codewordEntries) {
          const target =
            entry.kind === "data" ? reconstructedData : reconstructedEcc;
          target[entry.blockIndex][entry.codewordIndex] = entry.value;
        }
        if (
          JSON.stringify(reconstructedData) !==
            JSON.stringify(model.dataBlocks) ||
          JSON.stringify(reconstructedEcc) !== JSON.stringify(model.eccBlocks)
        ) {
          throw new Error("interleaving/deinterleaving");
        }

        model.blocks.forEach((block, blockIndex) => {
          const dataCount = mappedBits.filter(
            (meta) =>
              meta.blockIndex === blockIndex &&
              meta.kind === "data" &&
              meta.bitIndex === 0,
          ).length;
          const eccCount = mappedBits.filter(
            (meta) =>
              meta.blockIndex === blockIndex &&
              meta.kind === "ecc" &&
              meta.bitIndex === 0,
          ).length;
          if (dataCount !== block.dataCount || eccCount !== block.eccCount) {
            throw new Error("block assignment");
          }
        });

        const first = model.path.find(({ row, column }) =>
          ["data", "ecc"].includes(model.metadata[row][column].kind),
        );
        const meta = model.metadata[first.row][first.column];
        const sameCodeword = model.path.find(({ row, column }) => {
          const candidate = model.metadata[row][column];
          return (
            candidate.kind === meta.kind &&
            candidate.blockIndex === meta.blockIndex &&
            candidate.blockCodewordIndex === meta.blockCodewordIndex &&
            candidate.bitIndex !== meta.bitIndex
          );
        });
        const edited = cloneMatrix(model.matrix);
        edited[first.row][first.column] = !edited[first.row][first.column];
        edited[sameCodeword.row][sameCodeword.column] =
          !edited[sameCodeword.row][sameCodeword.column];
        const damage = analyzeDamage(model, edited);
        if (
          damage.changedCodewords.size !== 1 ||
          damage.blockStats[meta.blockIndex].totalDamaged !== 1 ||
          damage.blockStats[meta.blockIndex].theoreticalLimit !==
            Math.floor(model.blocks[meta.blockIndex].eccCount / 2)
        ) {
          throw new Error("damage counting or correction limit");
        }
      } catch (error) {
        failures.push(`V${version}-${level}: ${error.message}`);
      }
    }
  }

  if (failures.length) {
    throw new Error(`Custom-data engine tests failed: ${failures.join("; ")}`);
  }

  const customPaddingModel = generateBaseline({
    version: 1,
    level: "L",
    mask: 1,
    message: "",
    type: "byte",
    paddingBytes: [0xaa, 0x55],
  });
  const customPaddingData = customPaddingModel.dataBlocks.flat();
  for (let index = 2; index < customPaddingData.length; index += 1) {
    const expected = (index - 2) % 2 === 0 ? 0xaa : 0x55;
    if (customPaddingData[index] !== expected) {
      throw new Error("Custom-data engine test failed: custom padding pattern");
    }
  }

  if (
    JSON.stringify(getAlignmentCenters(32)) !==
    JSON.stringify([6, 34, 60, 86, 112, 138])
  ) {
    throw new Error("Custom-data engine test failed: Version 32 alignment");
  }

  if (
    JSON.stringify(getAlignmentCenters(40)) !==
    JSON.stringify([6, 30, 58, 86, 114, 142, 170])
  ) {
    throw new Error("Custom-data engine test failed: Version 40 alignment");
  }

  return 163;
}

test("copied QR engine passes its 163 existing cases", () => {
  assert.equal(runEngineTests(), 163);
});

