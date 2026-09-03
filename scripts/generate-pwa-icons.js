/**
 * Zero-dependency PNG icon generator for Bookarium PWA assets.
 * Generates valid RGBA PNG files using native Node.js zlib and Buffer.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.resolve(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// CRC32 table
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

function generatePng(size, isMaskable = false) {
  const width = size;
  const height = size;

  // Uncompressed scanlines: each row starts with filter byte 0
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const bgR = 14, bgG = 17, bgB = 23; // #0e1117 obsidian
  const goldR = 226, goldG = 177, goldB = 104; // #e2b168 gold
  const whiteR = 255, whiteG = 255, whiteB = 255; // #ffffff

  const cx = width / 2;
  const cy = height / 2;
  const radius = (width / 2) * (isMaskable ? 0.65 : 0.85);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background
      let r = bgR;
      let g = bgG;
      let b = bgB;
      let a = 255;

      // Draw stylized Open-Book icon in center
      // Book dimensions normalized to size
      const scale = size / 512;
      const bx = (x - cx) / scale;
      const by = (y - cy) / scale;

      // Outer circular emblem ring
      if (Math.abs(dist - radius * 0.85) < 3 * scale) {
        r = goldR; g = goldG; b = goldB;
      }

      // Left page curve (-120 to -15, -60 to 70)
      const inLeftPage =
        bx >= -110 && bx <= -15 &&
        by >= -60 + Math.sin((bx + 110) / 95 * Math.PI) * -15 &&
        by <= 70 + Math.sin((bx + 110) / 95 * Math.PI) * -15;

      // Right page curve (15 to 110, -60 to 70)
      const inRightPage =
        bx >= 15 && bx <= 110 &&
        by >= -60 + Math.sin((bx - 15) / 95 * Math.PI) * -15 &&
        by <= 70 + Math.sin((bx - 15) / 95 * Math.PI) * -15;

      // Spine crease in center
      const inSpine = Math.abs(bx) < 6 && by >= -50 && by <= 80;

      if (inLeftPage || inRightPage) {
        r = whiteR; g = whiteG; b = whiteB;
      } else if (inSpine) {
        r = goldR; g = goldG; b = goldB;
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Deflate compress image data
  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const icons = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
];

for (const icon of icons) {
  const buf = generatePng(icon.size, icon.maskable);
  const target = path.join(outDir, icon.name);
  fs.writeFileSync(target, buf);
  console.log(`Generated: ${target} (${icon.size}x${icon.size}, maskable=${icon.maskable})`);
}

