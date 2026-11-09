/**
 * High-DPI Vector and Raster PWA & Browser Tab Asset Generator for Bookarium.
 * Renders the custom Book-`"B"` brand monogram emblem across 16x16 through 1024x1024
 * with sharp SVG rasterization and binary multi-resolution ICO packing.
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

function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Exact Euclidean distance from point (px, py) to line segment (ax, ay) -> (bx, by).
 */
function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lenSq = vx * vx + vy * vy;
  const t = lenSq > 0 ? clamp((wx * vx + wy * vy) / lenSq, 0, 1) : 0;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

/**
 * Exact Euclidean distance from point (px, py) to a 90-degree circular arc centered at (cx, cy)
 * with radius `r` in quadrant signs (qx, qy) in {-1, +1}.
 */
function distToQuarterArc(px, py, cx, cy, r, qx, qy) {
  const dx = (px - cx) * qx;
  const dy = (py - cy) * qy;
  if (dx >= 0 && dy >= 0) {
    return Math.abs(Math.hypot(dx, dy) - r);
  }
  return Math.min(Math.hypot(dx - r, dy), Math.hypot(dx, dy - r));
}

/**
 * Computes exact signed distance from normalized (nx, ny) in [0, 32] space to the Lucide `BookOpen`
 * vector wireframe (`24x24` viewBox scaled into `[0, 32]`), returning stroke coverage in [0, 1].
 */
function getBookOpenStrokeCoverage(nx, ny, normPixelSize) {
  // Map [0, 32] space into Lucide [0, 24] coordinate space with 0.78 scale (18.72 / 32 footprint)
  const scaleTo32 = 0.78;
  const lx = (nx - 16) / scaleTo32 + 12;
  const ly = (ny - 16) / scaleTo32 + 12;

  if (lx < -1 || lx > 25 || ly < -1 || ly > 25) {
    return 0;
  }

  // Fold across horizontal symmetry axis lx = 12
  const sx = 12 - Math.abs(lx - 12);

  // 1. Center spine vertical segment: (12, 7) -> (12, 21)
  let d = distToSegment(sx, ly, 12, 7, 12, 21);

  // 2. Top page horizontal edge: (3, 3) -> (8, 3)
  d = Math.min(d, distToSegment(sx, ly, 3, 3, 8, 3));

  // 3. Top-left outer rounded corner: center (3, 4), r = 1, quadrant (-1, -1)
  d = Math.min(d, distToQuarterArc(sx, ly, 3, 4, 1, -1, -1));

  // 4. Outer page vertical edge: (2, 4) -> (2, 17)
  d = Math.min(d, distToSegment(sx, ly, 2, 4, 2, 17));

  // 5. Bottom-left outer rounded corner: center (3, 17), r = 1, quadrant (-1, +1)
  d = Math.min(d, distToQuarterArc(sx, ly, 3, 17, 1, -1, 1));

  // 6. Bottom page horizontal edge: (3, 18) -> (9, 18)
  d = Math.min(d, distToSegment(sx, ly, 3, 18, 9, 18));

  // 7. Top-inner page curve toward spine: center (8, 7), r = 4, quadrant (+1, -1)
  d = Math.min(d, distToQuarterArc(sx, ly, 8, 7, 4, 1, -1));

  // 8. Bottom-inner page curve toward spine: center (9, 21), r = 3, quadrant (+1, -1)
  d = Math.min(d, distToQuarterArc(sx, ly, 9, 21, 3, 1, -1));

  // Convert Lucide distance back to [0, 32] space and apply half-stroke width
  const halfStrokeInLucide = 1.08; // 2.16px stroke width in 24x24 space
  const signedDist32 = (d - halfStrokeInLucide) * scaleTo32;
  const aaRadius = Math.max(normPixelSize * 0.65, 0.02);

  return 1 - smoothstep(-aaRadius, aaRadius, signedDist32);
}

/**
 * Signed distance to the rounded squircle centered at (16, 16) with half-size 16 and corner radius rx.
 * Returns coverage in [0, 1].
 */
function getSquircleCoverage(nx, ny, normPixelSize, rx = 7, size = 32) {
  const half = size / 2;
  const qx = Math.abs(nx - half) - (half - rx);
  const qy = Math.abs(ny - half) - (half - rx);
  const outsideDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const insideDist = Math.min(Math.max(qx, qy), 0);
  const signedDist = outsideDist + insideDist - rx;
  const aaRadius = Math.max(normPixelSize * 0.65, 0.02);
  return 1 - smoothstep(-aaRadius, aaRadius, signedDist);
}

/**
 * Generates an analytical SDF-antialiased PNG buffer at the requested resolution.
 */
function generatePng(size, { isMaskable = false, isOpaque = false } = {}) {
  const width = size;
  const height = size;
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  // Brand Palette: #c05621 editorial orange (matching --primary in globals.css)
  const brandR = 192;
  const brandG = 86;
  const brandB = 33;
  const whiteR = 255;
  const whiteG = 255;
  const whiteB = 255;

  const scaleFactor = isMaskable ? 0.66 : isOpaque ? 1.0 : 0.94;
  const normPixelSize = 32 / (size * scaleFactor);

  for (let py = 0; py < height; py++) {
    const rowOffset = py * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    const normY = ((py + 0.5) / height - 0.5) / scaleFactor * 32 + 16;

    for (let px = 0; px < width; px++) {
      const normX = ((px + 0.5) / width - 0.5) / scaleFactor * 32 + 16;

      const squircleCov =
        isMaskable || isOpaque ? 1.0 : getSquircleCoverage(normX, normY, normPixelSize, 7, 32);

      let finalR = 0;
      let finalG = 0;
      let finalB = 0;
      let finalA = 0;

      if (squircleCov > 0) {
        const strokeCov = getBookOpenStrokeCoverage(normX, normY, normPixelSize);
        finalR = Math.round(brandR + (whiteR - brandR) * strokeCov);
        finalG = Math.round(brandG + (whiteG - brandG) * strokeCov);
        finalB = Math.round(brandB + (whiteB - brandB) * strokeCov);
        finalA = Math.round(squircleCov * 255);
      }

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

async function generateAllAssets() {
  const svgTarget = path.join(publicDir, 'icon.svg');
  if (!fs.existsSync(svgTarget)) {
    console.error(`Error: Source vector ${svgTarget} not found.`);
    process.exit(1);
  }

  const svgBuf = fs.readFileSync(svgTarget);
  console.log(`Using source vector: ${svgTarget}`);

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    sharp = null;
  }

  // 2. Generate High-DPI PNG icon suite (192, 512, 1024, maskable, and 512x512 apple-touch-icon)
  const icons = [
    { name: 'icon-192.png', size: 192, isMaskable: false, isOpaque: false },
    { name: 'icon-512.png', size: 512, isMaskable: false, isOpaque: false },
    { name: 'icon-1024.png', size: 1024, isMaskable: false, isOpaque: false },
    { name: 'icon-maskable-192.png', size: 192, isMaskable: true, isOpaque: true },
    { name: 'icon-maskable-512.png', size: 512, isMaskable: true, isOpaque: true },
    { name: 'apple-touch-icon.png', size: 512, isMaskable: false, isOpaque: true },
  ];

  if (sharp) {
    for (const icon of icons) {
      let buf;
      if (icon.isMaskable || icon.isOpaque) {
        const scaleFactor = icon.isMaskable ? 0.72 : 0.82;
        const emblemSize = Math.round(icon.size * scaleFactor);
        const emblemBuf = await sharp(svgBuf).resize(emblemSize, emblemSize).png().toBuffer();
        buf = await sharp({
          create: {
            width: icon.size,
            height: icon.size,
            channels: 4,
            background: { r: 252, g: 251, b: 249, alpha: 1 },
          },
        })
          .composite([{ input: emblemBuf, gravity: 'center' }])
          .png()
          .toBuffer();
      } else {
        buf = await sharp(svgBuf).resize(icon.size, icon.size).png().toBuffer();
      }

      const target = path.join(outDir, icon.name);
      fs.writeFileSync(target, buf);
      console.log(`Generated via sharp: ${target} (${icon.size}x${icon.size}, maskable=${icon.isMaskable})`);
    }

    // 3. Generate multi-resolution binary favicon.ico (16x16, 32x32, 48x48)
    const icoSizes = [16, 32, 48];
    const icoEntries = [];
    for (const size of icoSizes) {
      const pngBuf = await sharp(svgBuf).resize(size, size).png().toBuffer();
      icoEntries.push({ size, png: pngBuf });
    }
    const icoBuf = generateIco(icoEntries);
    const icoTarget = path.join(publicDir, 'favicon.ico');
    fs.writeFileSync(icoTarget, icoBuf);
    console.log(`Generated via sharp: ${icoTarget} (binary multi-res ICO: ${icoSizes.join(',')})`);
  } else {
    for (const icon of icons) {
      const buf = generatePng(icon.size, { isMaskable: icon.isMaskable, isOpaque: icon.isOpaque });
      const target = path.join(outDir, icon.name);
      fs.writeFileSync(target, buf);
      console.log(`Generated: ${target} (${icon.size}x${icon.size})`);
    }

    const icoSizes = [16, 32, 48];
    const icoEntries = icoSizes.map((size) => ({
      size,
      png: generatePng(size, { isMaskable: false, isOpaque: false }),
    }));
    const icoBuf = generateIco(icoEntries);
    const icoTarget = path.join(publicDir, 'favicon.ico');
    fs.writeFileSync(icoTarget, icoBuf);
    console.log(`Generated: ${icoTarget} (binary multi-res ICO)`);
  }
}

generateAllAssets().catch((err) => {
  console.error('Failed generating PWA icons:', err);
  process.exit(1);
});
