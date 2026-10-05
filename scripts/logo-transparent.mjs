/** Converts logo/GoodNews_Logo.png (opaque, white background) into a transparent PNG
 * at public/logo.png. Only white pixels CONNECTED TO THE IMAGE BORDER become transparent
 * (flood fill), so white areas inside the artwork are preserved. Anti-aliased edge pixels
 * are un-blended from white so the logo sits cleanly on dark backgrounds.
 * Usage: node scripts/logo-transparent.mjs [inPath] [outPath]
 */
import fs from "node:fs";
import zlib from "node:zlib";

const IN = process.argv[2] ?? "logo/GoodNews_Logo.png";
const OUT = process.argv[3] ?? "public/logo.png";

const b = fs.readFileSync(IN);
if (b.slice(1, 4).toString() !== "PNG") throw new Error("not a PNG");
const W = b.readUInt32BE(16), H = b.readUInt32BE(20);
const colorType = b[25];
if (colorType !== 3 && colorType !== 6) throw new Error("unsupported color type " + colorType);

// ---- gather chunks ----
let plte = null, trns = null;
const idat = [];
for (let p = 8; p < b.length - 8; ) {
  const len = b.readUInt32BE(p), type = b.slice(p + 4, p + 8).toString();
  if (type === "PLTE") plte = b.slice(p + 8, p + 8 + len);
  if (type === "tRNS") trns = b.slice(p + 8, p + 8 + len);
  if (type === "IDAT") idat.push(b.slice(p + 8, p + 8 + len));
  p += 12 + len;
}

// ---- decode to RGBA ----
const raw = zlib.inflateSync(Buffer.concat(idat));
const strideBytes = colorType === 6 ? 4 * W : 1 * W;
const stride = strideBytes + 1;
const rgba = Buffer.alloc(W * H * 4, 255);
const prev = Buffer.alloc(strideBytes);
const cur = Buffer.alloc(strideBytes);
for (let y = 0; y < H; y++) {
  const ft = raw[y * stride];
  const line = raw.slice(y * stride + 1, (y + 1) * stride);
  for (let x = 0; x < strideBytes; x++) {
    const a = x >= 1 ? cur[x - 1] : 0;
    const bb = prev[x];
    const c = x >= 1 ? prev[x - 1] : 0;
    let v = line[x];
    if (ft === 1) v += a;
    else if (ft === 2) v += bb;
    else if (ft === 3) v += (a + bb) >> 1;
    else if (ft === 4) {
      const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
      v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c;
    }
    cur[x] = v & 255;
  }
  for (let x = 0; x < W; x++) {
    if (colorType === 6) {
      for (let k = 0; k < 4; k++) rgba[(y * W + x) * 4 + k] = cur[4 * x + k];
    } else {
      const idx = cur[x];
      rgba[(y * W + x) * 4] = plte[idx * 3];
      rgba[(y * W + x) * 4 + 1] = plte[idx * 3 + 1];
      rgba[(y * W + x) * 4 + 2] = plte[idx * 3 + 2];
      rgba[(y * W + x) * 4 + 3] = trns && trns.length > idx ? trns[idx] : 255;
    }
  }
  prev.set(cur);
}

const isWhiteish = (x, y) => {
  const i = (y * W + x) * 4;
  return rgba[i] >= 245 && rgba[i + 1] >= 245 && rgba[i + 2] >= 245;
};

// ---- flood fill from borders through whiteish pixels ----
const visit = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
while (stack.length) {
  const p = stack.pop();
  if (visit[p]) continue;
  visit[p] = 1;
  const x = p % W, y = (p / W) | 0;
  if (!isWhiteish(x, y)) continue;
  rgba[p * 4 + 3] = 0; // transparent
  if (x > 0) stack.push(p - 1);
  if (x < W - 1) stack.push(p + 1);
  if (y > 0) stack.push(p - W);
  if (y < H - 1) stack.push(p + W);
}

// ---- un-blend anti-aliased edge pixels from white ----
// pixel = C = F*a + W*(1-a)  =>  a = 1 - min(R,G,B)/255 (for low-saturation light pixels
// adjacent to the transparent area); F recovered by dividing the white part out.
const lum = (i) => 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
let softened = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const p = y * W + x, i = p * 4;
    if (rgba[i + 3] === 0) continue;
    const nearTransparent =
      (x > 0 && rgba[(p - 1) * 4 + 3] === 0) || (x < W - 1 && rgba[(p + 1) * 4 + 3] === 0) ||
      (y > 0 && rgba[(p - W) * 4 + 3] === 0) || (y < H - 1 && rgba[(p + W) * 4 + 3] === 0);
    if (!nearTransparent) continue;
    const l = lum(i), mx = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]), mn = Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (l < 235 || mx - mn > 30) continue; // only light, low-saturation halo pixels
    const a = 1 - mn / 255;
    if (a <= 0.02) { rgba[i + 3] = 0; softened++; continue; }
    for (let k = 0; k < 3; k++) rgba[i + k] = Math.round((rgba[i + k] - 255 * (1 - a)) / a);
    rgba[i + 3] = Math.round(a * 255);
    softened++;
  }
}

// ---- encode RGBA PNG ----
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.slice(4, 8 + data.length)), 8 + data.length);
  return out;
};

const rawOut = Buffer.alloc(H * (1 + 4 * W));
for (let y = 0; y < H; y++) {
  rawOut[y * (1 + 4 * W)] = 0; // filter none
  rgba.copy(rawOut, y * (1 + 4 * W) + 1, y * 4 * W, (y + 1) * 4 * W);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(rawOut, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.writeFileSync(OUT, png);

// ---- stats ----
let transparent = 0;
for (let p = 0; p < W * H; p++) if (rgba[p * 4 + 3] === 0) transparent++;
console.log(`in : ${IN} (${(b.length / 1024).toFixed(1)} KB)`);
console.log(`out: ${OUT} (${(png.length / 1024).toFixed(1)} KB, ${W}x${H} RGBA)`);
console.log(`transparent: ${transparent}/${W * H} (${(100 * transparent / (W * H)).toFixed(1)}%), softened edge px: ${softened}`);
