// Read width/height from PNG, JPEG, WebP, GIF and SVG headers without dependencies.
import fs from 'node:fs';

export function imageSize(file) {
  const b = fs.readFileSync(file);
  // PNG
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  // GIF
  if (b.toString('ascii', 0, 3) === 'GIF') return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  // WebP
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const n = b.readUInt32LE(21); return { width: (n & 0x3fff) + 1, height: ((n >> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  // SVG
  const head = b.toString('utf8', 0, Math.min(b.length, 2000));
  if (head.includes('<svg')) {
    const vb = head.match(/viewBox="[\d.\s-]*?\s([\d.]+)\s+([\d.]+)"/);
    if (vb) return { width: +vb[1], height: +vb[2] };
    const w = head.match(/width="([\d.]+)/), h = head.match(/height="([\d.]+)/);
    if (w && h) return { width: +w[1], height: +h[1] };
  }
  return { width: 1600, height: 1000 };
}
