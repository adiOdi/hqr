const alphanumericCharacters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const modeIndicators = {
  numeric: "0001",
  alphanumeric: "0010",
  byte: "0100",
  binary: "0100",
};
const blockInfo = {
  1: {
    L: {
      dataCodewords: 19,
      ecCodewordsPerBlock: 7,
      groups: [{ blocks: 1, dataCodewords: 19 }],
    },
    M: {
      dataCodewords: 16,
      ecCodewordsPerBlock: 10,
      groups: [{ blocks: 1, dataCodewords: 16 }],
    },
    Q: {
      dataCodewords: 13,
      ecCodewordsPerBlock: 13,
      groups: [{ blocks: 1, dataCodewords: 13 }],
    },
    H: {
      dataCodewords: 9,
      ecCodewordsPerBlock: 17,
      groups: [{ blocks: 1, dataCodewords: 9 }],
    },
  },
  2: {
    L: {
      dataCodewords: 34,
      ecCodewordsPerBlock: 10,
      groups: [{ blocks: 1, dataCodewords: 34 }],
    },
    M: {
      dataCodewords: 28,
      ecCodewordsPerBlock: 16,
      groups: [{ blocks: 1, dataCodewords: 28 }],
    },
    Q: {
      dataCodewords: 22,
      ecCodewordsPerBlock: 22,
      groups: [{ blocks: 1, dataCodewords: 22 }],
    },
    H: {
      dataCodewords: 16,
      ecCodewordsPerBlock: 28,
      groups: [{ blocks: 1, dataCodewords: 16 }],
    },
  },
  3: {
    L: {
      dataCodewords: 55,
      ecCodewordsPerBlock: 15,
      groups: [{ blocks: 1, dataCodewords: 55 }],
    },
    M: {
      dataCodewords: 44,
      ecCodewordsPerBlock: 26,
      groups: [{ blocks: 1, dataCodewords: 44 }],
    },
    Q: {
      dataCodewords: 34,
      ecCodewordsPerBlock: 18,
      groups: [{ blocks: 2, dataCodewords: 17 }],
    },
    H: {
      dataCodewords: 26,
      ecCodewordsPerBlock: 22,
      groups: [{ blocks: 2, dataCodewords: 13 }],
    },
  },
  4: {
    L: {
      dataCodewords: 80,
      ecCodewordsPerBlock: 20,
      groups: [{ blocks: 1, dataCodewords: 80 }],
    },
    M: {
      dataCodewords: 64,
      ecCodewordsPerBlock: 18,
      groups: [{ blocks: 2, dataCodewords: 32 }],
    },
    Q: {
      dataCodewords: 48,
      ecCodewordsPerBlock: 26,
      groups: [{ blocks: 2, dataCodewords: 24 }],
    },
    H: {
      dataCodewords: 36,
      ecCodewordsPerBlock: 16,
      groups: [{ blocks: 4, dataCodewords: 9 }],
    },
  },
  5: {
    L: {
      dataCodewords: 108,
      ecCodewordsPerBlock: 26,
      groups: [{ blocks: 1, dataCodewords: 108 }],
    },
    M: {
      dataCodewords: 86,
      ecCodewordsPerBlock: 24,
      groups: [{ blocks: 2, dataCodewords: 43 }],
    },
    Q: {
      dataCodewords: 62,
      ecCodewordsPerBlock: 18,
      groups: [
        { blocks: 2, dataCodewords: 15 },
        { blocks: 2, dataCodewords: 16 },
      ],
    },
    H: {
      dataCodewords: 46,
      ecCodewordsPerBlock: 22,
      groups: [
        { blocks: 2, dataCodewords: 11 },
        { blocks: 2, dataCodewords: 12 },
      ],
    },
  },
  6: {
    L: {
      dataCodewords: 136,
      ecCodewordsPerBlock: 18,
      groups: [{ blocks: 2, dataCodewords: 68 }],
    },
    M: {
      dataCodewords: 108,
      ecCodewordsPerBlock: 16,
      groups: [{ blocks: 4, dataCodewords: 27 }],
    },
    Q: {
      dataCodewords: 76,
      ecCodewordsPerBlock: 24,
      groups: [{ blocks: 4, dataCodewords: 19 }],
    },
    H: {
      dataCodewords: 60,
      ecCodewordsPerBlock: 28,
      groups: [{ blocks: 4, dataCodewords: 15 }],
    },
  },
  7: {
    L: {
      dataCodewords: 156,
      ecCodewordsPerBlock: 20,
      groups: [{ blocks: 2, dataCodewords: 78 }],
    },
    M: {
      dataCodewords: 124,
      ecCodewordsPerBlock: 18,
      groups: [{ blocks: 4, dataCodewords: 31 }],
    },
    Q: {
      dataCodewords: 88,
      ecCodewordsPerBlock: 18,
      groups: [
        { blocks: 2, dataCodewords: 14 },
        { blocks: 4, dataCodewords: 15 },
      ],
    },
    H: {
      dataCodewords: 66,
      ecCodewordsPerBlock: 26,
      groups: [
        { blocks: 4, dataCodewords: 13 },
        { blocks: 1, dataCodewords: 14 },
      ],
    },
  },
  8: {
    L: {
      dataCodewords: 194,
      ecCodewordsPerBlock: 24,
      groups: [{ blocks: 2, dataCodewords: 97 }],
    },
    M: {
      dataCodewords: 154,
      ecCodewordsPerBlock: 22,
      groups: [
        { blocks: 2, dataCodewords: 38 },
        { blocks: 2, dataCodewords: 39 },
      ],
    },
    Q: {
      dataCodewords: 110,
      ecCodewordsPerBlock: 22,
      groups: [
        { blocks: 4, dataCodewords: 18 },
        { blocks: 2, dataCodewords: 19 },
      ],
    },
    H: {
      dataCodewords: 86,
      ecCodewordsPerBlock: 26,
      groups: [
        { blocks: 4, dataCodewords: 14 },
        { blocks: 2, dataCodewords: 15 },
      ],
    },
  },
  9: {
    L: {
      dataCodewords: 232,
      ecCodewordsPerBlock: 30,
      groups: [{ blocks: 2, dataCodewords: 116 }],
    },
    M: {
      dataCodewords: 182,
      ecCodewordsPerBlock: 22,
      groups: [
        { blocks: 3, dataCodewords: 36 },
        { blocks: 2, dataCodewords: 37 },
      ],
    },
    Q: {
      dataCodewords: 132,
      ecCodewordsPerBlock: 20,
      groups: [
        { blocks: 4, dataCodewords: 16 },
        { blocks: 4, dataCodewords: 17 },
      ],
    },
    H: {
      dataCodewords: 100,
      ecCodewordsPerBlock: 24,
      groups: [
        { blocks: 4, dataCodewords: 12 },
        { blocks: 4, dataCodewords: 13 },
      ],
    },
  },
  10: {
    L: {
      dataCodewords: 274,
      ecCodewordsPerBlock: 18,
      groups: [
        { blocks: 2, dataCodewords: 68 },
        { blocks: 2, dataCodewords: 69 },
      ],
    },
    M: {
      dataCodewords: 216,
      ecCodewordsPerBlock: 26,
      groups: [
        { blocks: 4, dataCodewords: 43 },
        { blocks: 1, dataCodewords: 44 },
      ],
    },
    Q: {
      dataCodewords: 154,
      ecCodewordsPerBlock: 24,
      groups: [
        { blocks: 6, dataCodewords: 19 },
        { blocks: 2, dataCodewords: 20 },
      ],
    },
    H: {
      dataCodewords: 122,
      ecCodewordsPerBlock: 28,
      groups: [
        { blocks: 6, dataCodewords: 15 },
        { blocks: 2, dataCodewords: 16 },
      ],
    },
  },
};
const errorCorrectionLevelIndex = { L: 0, M: 1, Q: 2, H: 3 };
const eccCodewordsPerBlock = [
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30,
    28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30,
  ],
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26,
    26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28,
  ],
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28,
    26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30,
  ],
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28,
    26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30,
  ],
];
const errorCorrectionBlockCount = [
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10,
    12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
  ],
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17,
    17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23,
    23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25,
    25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77,
    81,
  ],
];

export function getRawDataModuleCount(version) {
  if (!Number.isInteger(version) || version < 1 || version > 40) {
    throw new Error("QR version must be an integer from 1 to 40.");
  }

  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignmentCount = Math.floor(version / 7) + 2;
    result -= (25 * alignmentCount - 10) * alignmentCount - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

export function getRemainderBitCount(version) {
  return getRawDataModuleCount(version) % 8;
}


export function encodeDataCodewords({
  type,
  value,
  version,
  errorCorrectionLevel,
  useZeroPadding = false,
  paddingBytes = null,
}) {
  const rawBits = [
    ...modeIndicators[type],
    ...getCharacterCountBits(type, value, version),
    ...getPayloadBits(type, value),
  ];
  const info = getBlockInfo(version, errorCorrectionLevel);
  const paddingStartCodeword = getPaddingStartCodeword(
    rawBits.length,
    info.dataCodewords,
  );
  const codewords = finalizeDataCodewords(
    rawBits,
    info.dataCodewords,
    useZeroPadding,
    paddingBytes,
  );

  return {
    codewords,
    blocks: splitIntoBlocks(codewords, info),
    rawBits,
    paddingStartCodeword,
  };
}


export function encodeErrorCorrectionBlocks({
  dataBlocks,
  version,
  errorCorrectionLevel,
}) {
  const info = getBlockInfo(version, errorCorrectionLevel);
  return dataBlocks.map((block) =>
    getReedSolomonRemainder(block, info.ecCodewordsPerBlock),
  );
}

export function getBlockInfo(version, errorCorrectionLevel) {
  if (blockInfo[version]?.[errorCorrectionLevel]) {
    return blockInfo[version][errorCorrectionLevel];
  }

  const levelIndex = errorCorrectionLevelIndex[errorCorrectionLevel];
  if (levelIndex === undefined) {
    throw new Error(`Unknown error-correction level: ${errorCorrectionLevel}`);
  }
  const ecCodewordsPerBlock = eccCodewordsPerBlock[levelIndex][version];
  const blockCount = errorCorrectionBlockCount[levelIndex][version];
  if (!ecCodewordsPerBlock || !blockCount) {
    throw new Error(`QR Version ${version} is not supported.`);
  }

  const rawCodewords = Math.floor(getRawDataModuleCount(version) / 8);
  const shortBlockLength = Math.floor(rawCodewords / blockCount);
  const shortBlockCount = blockCount - (rawCodewords % blockCount);
  const shortDataCodewords = shortBlockLength - ecCodewordsPerBlock;
  const groups = [];
  if (shortBlockCount > 0) {
    groups.push({
      blocks: shortBlockCount,
      dataCodewords: shortDataCodewords,
    });
  }
  if (shortBlockCount < blockCount) {
    groups.push({
      blocks: blockCount - shortBlockCount,
      dataCodewords: shortDataCodewords + 1,
    });
  }

  return {
    dataCodewords: rawCodewords - blockCount * ecCodewordsPerBlock,
    ecCodewordsPerBlock,
    groups,
  };
}

function finalizeDataCodewords(
  rawBits,
  dataCodewordCapacity,
  useZeroPadding,
  paddingBytes,
) {
  const capacityBits = dataCodewordCapacity * 8;
  const bits = [...rawBits];

  if (bits.length > capacityBits) {
    throw new Error(
      "Data does not fit in the selected version and error-correction level.",
    );
  }

  const terminatorLength = Math.min(4, capacityBits - bits.length);
  bits.push(...Array(terminatorLength).fill("0"));

  while (bits.length % 8 !== 0) {
    bits.push("0");
  }

  const codewords = bitsToCodewords(bits);
  const padBytes =
    paddingBytes === null
      ? useZeroPadding
        ? [0x00]
        : [0xec, 0x11]
      : paddingBytes;
  if (
    !Array.isArray(padBytes) ||
    padBytes.length === 0 ||
    padBytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 0xff)
  ) {
    throw new Error("Padding must contain at least one byte from 00 to FF.");
  }
  let padIndex = 0;

  while (codewords.length < dataCodewordCapacity) {
    codewords.push(padBytes[padIndex % padBytes.length]);
    padIndex += 1;
  }

  return codewords;
}

function getPaddingStartCodeword(rawBitLength, dataCodewordCapacity) {
  const capacityBits = dataCodewordCapacity * 8;
  const terminatedLength =
    rawBitLength + Math.max(0, Math.min(4, capacityBits - rawBitLength));
  return Math.ceil(terminatedLength / 8);
}

function splitIntoBlocks(codewords, info) {
  const blocks = [];
  let offset = 0;

  for (const group of info.groups) {
    for (let blockIndex = 0; blockIndex < group.blocks; blockIndex += 1) {
      blocks.push(codewords.slice(offset, offset + group.dataCodewords));
      offset += group.dataCodewords;
    }
  }

  return blocks;
}


function getCharacterCountBits(type, value, version) {
  const count = getCharacterCount(type, value);
  const bitLengthByType = getCharacterCountBitLengths(version);

  return toBits(count, bitLengthByType[type]);
}

function getCharacterCountBitLengths(version) {
  if (version <= 9) {
    return { numeric: 10, alphanumeric: 9, byte: 8, binary: 8 };
  }
  if (version <= 26) {
    return { numeric: 12, alphanumeric: 11, byte: 16, binary: 16 };
  }
  return { numeric: 14, alphanumeric: 13, byte: 16, binary: 16 };
}

function getCharacterCount(type, value) {
  if (type === "binary") {
    return parseBinaryBytes(value).length;
  }

  if (type === "byte") {
    return new TextEncoder().encode(value).length;
  }

  return value.length;
}

function getPayloadBits(type, value) {
  if (type === "numeric") {
    return getNumericBits(value);
  }

  if (type === "alphanumeric") {
    return getAlphanumericBits(value);
  }

  if (type === "binary") {
    return codewordsToBits(parseBinaryBytes(value));
  }

  return codewordsToBits([...new TextEncoder().encode(value)]);
}

function getNumericBits(value) {
  if (!/^\d*$/.test(value)) {
    throw new Error("Numeric data can only contain digits.");
  }

  const bits = [];

  for (let index = 0; index < value.length; index += 3) {
    const chunk = value.slice(index, index + 3);
    const bitLength = chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4;
    bits.push(...toBits(Number(chunk), bitLength));
  }

  return bits;
}

function getAlphanumericBits(value) {
  const normalizedValue = value.toUpperCase();
  const bits = [];

  for (const character of normalizedValue) {
    if (!alphanumericCharacters.includes(character)) {
      throw new Error(`Unsupported alphanumeric character: ${character}`);
    }
  }

  for (let index = 0; index < normalizedValue.length; index += 2) {
    const first = alphanumericCharacters.indexOf(normalizedValue[index]);
    const second = alphanumericCharacters.indexOf(normalizedValue[index + 1]);

    if (Number.isInteger(second) && second >= 0) {
      bits.push(...toBits(first * 45 + second, 11));
    } else {
      bits.push(...toBits(first, 6));
    }
  }

  return bits;
}

function parseBinaryBytes(value) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return [];
  }

  return normalizedValue.split(/\s+/).map((byte) => {
    if (!/^[01]{8}$/.test(byte)) {
      throw new Error("Binary data must use 8-bit groups separated by spaces.");
    }

    return Number.parseInt(byte, 2);
  });
}


function bitsToCodewords(bits) {
  const codewords = [];

  for (let index = 0; index < bits.length; index += 8) {
    codewords.push(
      Number.parseInt(
        bits
          .slice(index, index + 8)
          .join("")
          .padEnd(8, "0"),
        2,
      ),
    );
  }

  return codewords;
}

function codewordsToBits(codewords) {
  return codewords.flatMap((codeword) => toBits(codeword, 8));
}

function toBits(value, bitLength) {
  return value.toString(2).padStart(bitLength, "0").slice(-bitLength).split("");
}

function getReedSolomonRemainder(dataCodewords, errorCorrectionCodewordCount) {
  const generator = getGeneratorPolynomial(errorCorrectionCodewordCount);
  const message = [
    ...dataCodewords,
    ...Array(errorCorrectionCodewordCount).fill(0),
  ];

  for (let index = 0; index < dataCodewords.length; index += 1) {
    const factor = message[index];
    if (factor === 0) {
      continue;
    }

    for (
      let generatorIndex = 0;
      generatorIndex < generator.length;
      generatorIndex += 1
    ) {
      message[index + generatorIndex] ^= gfMultiply(
        generator[generatorIndex],
        factor,
      );
    }
  }

  return message.slice(-errorCorrectionCodewordCount);
}

function getGeneratorPolynomial(degree) {
  let polynomial = [1];

  for (let degreeIndex = 0; degreeIndex < degree; degreeIndex += 1) {
    polynomial = multiplyPolynomials(polynomial, [1, gfPow(2, degreeIndex)]);
  }

  return polynomial;
}

function multiplyPolynomials(first, second) {
  const result = Array(first.length + second.length - 1).fill(0);

  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      result[firstIndex + secondIndex] ^= gfMultiply(
        first[firstIndex],
        second[secondIndex],
      );
    }
  }

  return result;
}

function gfPow(value, exponent) {
  let result = 1;

  for (let index = 0; index < exponent; index += 1) {
    result = gfMultiply(result, value);
  }

  return result;
}

function gfMultiply(first, second) {
  let product = 0;
  let left = first;
  let right = second;

  while (right > 0) {
    if ((right & 1) !== 0) {
      product ^= left;
    }

    left <<= 1;
    if ((left & 0x100) !== 0) {
      left ^= 0x11d;
    }
    right >>= 1;
  }

  return product;
}
