#!/usr/bin/env node
/**
 * Generates a 22x22 pause-symbol PNG (two vertical bars) for the macOS menu bar.
 * Pure Node.js — no external dependencies.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 16, H = 16;

// CRC32 lookup table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// RGBA pixels — all transparent by default
const pixels = new Uint8Array(W * H * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = a;
}

// Draw pause symbol: two 3×10 black bars, vertically centred in 16×16
//   Left bar:  x 2–4,  Right bar: x 11–13,  y 3–12
for (let y = 3; y < 13; y++) {
  for (let x = 2; x < 5; x++) setPixel(x, y, 0, 0, 0);
  for (let x = 11; x < 14; x++) setPixel(x, y, 0, 0, 0);
}

// Build raw PNG scanlines (filter byte 0x00 before each row)
const rawRows = [];
for (let y = 0; y < H; y++) {
  rawRows.push(0); // filter: None
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    rawRows.push(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]);
  }
}

const compressed = zlib.deflateSync(Buffer.from(rawRows));

const ihdr = Buffer.allocUnsafe(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // RGBA
ihdr[10] = 0; // compression method
ihdr[11] = 0; // filter method
ihdr[12] = 0; // interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG signature
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', compressed),
  pngChunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'tray-icon.png'), png);
console.log('✓ tray-icon.png created');
