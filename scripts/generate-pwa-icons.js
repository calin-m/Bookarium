/**
 * Zero-dependency High-DPI PNG and ICO icon generator for Bookarium PWA & browser tab assets.
 * Generates vector-accurate, 4x4 Sub-Pixel Anti-Aliased (SSAA) PNGs and binary multi-res ICO files
 * using the authentic Bookarium terracotta squircle (#b8731d) and open-book emblem.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.resolve(__dirname, '..', 'public', 'icons');
const publicDir = path.resolve(__dirname, '..', 'public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// CRC32 Table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function calcCrc(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = calcCrc(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

/**
 * Checks if normalized coordinates (nx, ny) in [0, 32] space fall inside the Bookarium Open-Book emblem.
 */
function isInsideBookEmblem(nx, ny) {
  // Center spine divider check
  if (Math.abs(nx - 16) < 0.65 && ny >= 11 && ny <= 24.2) {
    return false;
  }

  // Left Page
  if (nx >= 7 && nx <= 18.8 && ny >= 8 && ny <= 24) {
    // Top right outer arc (from (15, 8) to (19, 12))
    if (nx > 15 && ny < 12) {
      if (Math.hypot(nx - 15, ny - 12) > 4) {
        return false;
      }
    }
    // Bottom curve sweep (concave cutoff from (15.5, 21) to (19, 24))
    if (nx > 15.5 && ny > 21) {
      const ex = (nx - 15.5) / 3.5;
      const ey = (24 - ny) / 3.0;
      if (ex * ex + ey * ey < 1.0) {
        return false;
      }
    } else if (nx <= 15.5 && ny > 21) {
      return false;
    }
    return true;
  }

  // Right Page (Symmetrical across nx = 16)
  const rnx = 32 - nx;
  if (rnx >= 7 && rnx <= 18.8 && ny >= 8 && ny <= 24) {
    if (rnx > 15 && ny < 12) {
      if (Math.hypot(rnx - 15, ny - 12) > 4) {
        return false;
      }
    }
    if (rnx > 15.5 && ny > 21) {
      const ex = (rnx - 15.5) / 3.5;
      const ey = (24 - ny) / 3.0;
      if (ex * ex + ey * ey < 1.0) {
        return false;
      }
    } else if (rnx <= 15.5 && ny > 21) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Checks if (nx, ny) in [0, 32] space falls inside the rounded squircle.
 */
function isInsideSquircle(nx, ny, rx = 7, size = 32) {
  const half = size / 2;
  const dx = Math.abs(nx - half);
  const dy = Math.abs(ny - half);
  if (dx > half || dy > half) return false;

  const cornerX = Math.max(0, dx - (half - rx));
  const cornerY = Math.max(0, dy - (half - rx));
  return cornerX * cornerX + cornerY * cornerY <= rx * rx;
}

/**
 * Generates an ultra-crisp, 4x4 Sub-Pixel Anti-Aliased (SSAA) PNG buffer.
 */
function generatePng(size, { isMaskable = false, isOpaque = false } = {}) {
  const width = size;
  const height = size;
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  // Brand Palette
  const brandR = 184, brandG = 115, brandB = 29; // #b8731d warm terracotta
  const whiteR = 255, whiteG = 255, whiteB = 255; // #ffffff
  const subOffsets = [0.125, 0.375, 0.625, 0.875];
  const numSamples = subOffsets.length * subOffsets.length; // 16 samples per pixel

  for (let py = 0; py < height; py++) {
    const rowOffset = py * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let px = 0; px < width; px++) {
      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;

      for (const ox of subOffsets) {
        for (const oy of subOffsets) {
          const sx = px + ox;
          const sy = py + oy;

          if (isMaskable) {
            // Maskable: Full-bleed #b8731d background, BookOpen scaled inside 80% safe zone
            const safeScale = 0.62;
            const normX = (sx / width - 0.5) / safeScale * 32 + 16;
            const normY = (sy / height - 0.5) / safeScale * 32 + 16;

            if (normX >= 0 && normX <= 32 && normY >= 0 && normY <= 32 && isInsideBookEmblem(normX, normY)) {
              accR += whiteR;
              accG += whiteG;
              accB += whiteB;
            } else {
              accR += brandR;
              accG += brandG;
              accB += brandB;
            }
            accA += 255;
          } else {
            // Standard / Any icon: Centered squircle on transparent canvas
            const padRatio = 0.94; // slight 3% breathing margin for clean roundings
            const normX = (sx / width - 0.5) / padRatio * 32 + 16;
            const normY = (sy / height - 0.5) / padRatio * 32 + 16;

            if (normX >= 0 && normX <= 32 && normY >= 0 && normY <= 32 && isInsideSquircle(normX, normY, 7, 32)) {
              if (isInsideBookEmblem(normX, normY)) {
                accR += whiteR;
                accG += whiteG;
                accB += whiteB;
              } else {
                accR += brandR;
                accG += brandG;
                accB += brandB;
              }
              accA += 255;
            } else {
              // Outside squircle: transparent
              accA += 0;
            }
          }
        }
      }

      const finalA = Math.round(accA / numSamples);
      const finalR = finalA > 0 ? Math.round(accR / numSamples) : 0;
      const finalG = finalA > 0 ? Math.round(accG / numSamples) : 0;
      const finalB = finalA > 0 ? Math.round(accB / numSamples) : 0;

      const idx = rowOffset + 1 + px * 4;
      rawData[idx] = finalR;
      rawData[idx + 1] = finalG;
      rawData[idx + 2] = finalB;
      rawData[idx + 3] = finalA;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function generateIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(entries.length, 4);

  const dirEntries = [];
  let imageOffset = 6 + entries.length * 16;

  for (const entry of entries) {
    const dir = Buffer.alloc(16);
    dir[0] = entry.size >= 256 ? 0 : entry.size;
    dir[1] = entry.size >= 256 ? 0 : entry.size;
    dir[2] = 0;
    dir[3] = 0;
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(entry.png.length, 8);
    dir.writeUInt32LE(imageOffset, 12);
    imageOffset += entry.png.length;
    dirEntries.push(dir);
  }

  return Buffer.concat([header, ...dirEntries, ...entries.map((e) => e.png)]);
}

const icons = [
  { name: 'icon-192.png', size: 192, isMaskable: false, isOpaque: false },
  { name: 'icon-512.png', size: 512, isMaskable: false, isOpaque: false },
  { name: 'icon-maskable-192.png', size: 192, isMaskable: true, isOpaque: true },
  { name: 'icon-maskable-512.png', size: 512, isMaskable: true, isOpaque: true },
  { name: 'apple-touch-icon.png', size: 180, isMaskable: false, isOpaque: false },
];

for (const icon of icons) {
  const buf = generatePng(icon.size, { isMaskable: icon.isMaskable, isOpaque: icon.isOpaque });
  const target = path.join(outDir, icon.name);
  fs.writeFileSync(target, buf);
  console.log(`Generated: ${target} (${icon.size}x${icon.size}, maskable=${icon.isMaskable})`);
}

// Generate multi-resolution binary favicon.ico (16x16, 32x32, 48x48)
const icoSizes = [16, 32, 48];
const icoEntries = icoSizes.map((size) => ({
  size,
  png: generatePng(size, { isMaskable: false, isOpaque: false }),
}));
const icoBuf = generateIco(icoEntries);
const icoTarget = path.join(publicDir, 'favicon.ico');
fs.writeFileSync(icoTarget, icoBuf);
console.log(`Generated: ${icoTarget} (binary multi-res ICO, sizes: ${icoSizes.join(',')})`);
