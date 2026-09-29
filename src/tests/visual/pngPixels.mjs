/**
 * スクリーンショット（PNG）を画素として読むための道具。
 *
 * 「白い文字が読めるか」「選択の色が青か」は、指定した値ではなく
 * 実際に描かれた画素で確かめたい。Node の zlib だけで復号するので、
 * 新しい依存は増やさない。
 *
 * 対応するのは 8bit の RGB / RGBA、非インターレースの PNG。
 * Playwright の page.screenshot() が返すのはこの形。
 */
import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
  let p = 8;
  let w = 0;
  let h = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
        throw new Error(`未対応のPNGです: depth=${bitDepth} color=${colorType}`);
      }
    } else if (type === 'IDAT') idat.push(Buffer.from(body));
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const ch = colorType === 6 ? 4 : 3;
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4);
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  let q = 0;
  for (let y = 0; y < h; y += 1) {
    const filter = raw[q];
    q += 1;
    raw.copy(line, 0, q, q + stride);
    q += stride;
    // 走査線ごとの差分（フィルタ）を戻す。
    for (let i = 0; i < stride; i += 1) {
      const a = i >= ch ? line[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 0xff;
    }
    for (let x = 0; x < w; x += 1) {
      out[(y * w + x) * 4] = line[x * ch];
      out[(y * w + x) * 4 + 1] = line[x * ch + 1];
      out[(y * w + x) * 4 + 2] = line[x * ch + 2];
      out[(y * w + x) * 4 + 3] = ch === 4 ? line[x * ch + 3] : 255;
    }
    line.copy(prev);
  }
  return { w, h, data: out };
}

export function pixelAt(img, x, y) {
  const px = Math.min(img.w - 1, Math.max(0, Math.round(x)));
  const py = Math.min(img.h - 1, Math.max(0, Math.round(y)));
  const i = (py * img.w + px) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

export function relLum([r, g, b]) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a, b) {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function percentile(values, p) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
}

/**
 * 文字の読みやすさ。
 *
 * 箱の中の画素を明るさで並べ、両端 1% を「文字の芯」と「地の色」とする。
 * 文字は細く、箱に占める割合が小さいので、5% や 10% では芯に届かない。
 * 白い文字でも黒い文字でも同じ手順で測れる（明暗のどちらが文字かを問わない）。
 *
 * box は CSS px、scale は deviceScaleFactor。
 */
export function textContrast(img, box, scale) {
  const x0 = Math.round(box.l * scale);
  const x1 = Math.round(box.r * scale);
  const y0 = Math.round(box.t * scale);
  const y1 = Math.round(box.b * scale);
  const px = [];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) px.push(pixelAt(img, x, y));
  }
  if (px.length === 0) return { ratio: 0, ink: [0, 0, 0], paper: [0, 0, 0] };
  const lums = px.map(relLum);
  const dark = percentile(lums, 0.01);
  const light = percentile(lums, 0.99);
  const pick = (target) =>
    px.reduce((best, p) => (Math.abs(relLum(p) - target) < Math.abs(relLum(best) - target) ? p : best), px[0]);
  const ink = pick(dark);
  const paper = pick(light);
  return { ink, paper, ratio: contrast(ink, paper) };
}
