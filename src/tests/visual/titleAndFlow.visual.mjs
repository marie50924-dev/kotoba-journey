/**
 * Phase 1 の表示・操作回帰テスト。
 *
 * CSS レイアウトと画面遷移の結果は jsdom では測れないため、
 * 実ブラウザ（Chromium）でビルド済みの dist/ を描画して検証する。
 *
 * 実行: npm run test:visual:flow （事前に npm run build が必要）
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createSuite } from './visualCaseReporter.mjs';

const ROOT = fileURLToPath(new URL('../../../dist', import.meta.url));
const BASE_PATH = '/kotoba-journey/';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 393, height: 852 },
  // Safari のアドレスバーが出ていて画面が低いときも確かめる。
  { width: 393, height: 745 },
  { width: 393, height: 700 },
  { width: 430, height: 932 },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
};

function serveDist() {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(req.url.split('?')[0]);
    if (path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length - 1);
    if (path === '/' || path === '') path = '/index.html';
    const file = join(ROOT, normalize(path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const { check, runCase, finish } = createSuite('Phase 1 表示・操作テスト');

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * 表紙の素材と、背景の中で隠してはいけないものの位置。
 *
 * 数値は src/data/titleAssets.ts の実測値と同じ。
 * こちらは .mjs なので TypeScript を読み込めず、同じ値を書いてある。
 * 画面側は background の object-position としてこの比率を出しているので、
 * 食い違っていないことは下の検査で突き合わせる。
 */

/*
 * ボタンの見え方は、DOM の値ではなく「実際に描かれた画素」で確かめる。
 * Playwright のスクリーンショット（PNG）を、依存を増やさずに自前でほどく。
 * 非インターレースの 8bit RGB / RGBA だけを扱う。
 */
function decodePng(buffer) {
  let pos = 8; // シグネチャ
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const body = buffer.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const colorType = body[9];
      const interlace = body[12];
      if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(`扱えない PNG（深さ ${depth} / 種類 ${colorType} / 交互 ${interlace}）`);
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

/** 画面の座標（CSSピクセル）で色を読む。dpr は画像の幅から求める。 */
function pixelAt(img, viewportWidth, x, y) {
  const s = img.width / viewportWidth;
  const px = Math.min(img.width - 1, Math.max(0, Math.round(x * s)));
  const py = Math.min(img.height - 1, Math.max(0, Math.round(y * s)));
  const i = (py * img.width + px) * img.channels;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

/** 矩形の中の画素を集める。step で間引く。 */
function pixelsIn(img, viewportWidth, rect, step = 2) {
  const s = img.width / viewportWidth;
  const out = [];
  const x0 = Math.max(0, Math.round(rect.x * s));
  const x1 = Math.min(img.width, Math.round((rect.x + rect.width) * s));
  const y0 = Math.max(0, Math.round(rect.y * s));
  const y1 = Math.min(img.height, Math.round((rect.y + rect.height) * s));
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * img.width + x) * img.channels;
      out.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
    }
  }
  return out;
}

const relLum = ([r, g, b]) => {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
/** WCAG の明暗比。1〜21。 */
const contrast = (a, b) => {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
/** 小さい順に並べた中の、上から p%（0〜1）の値。 */
const percentile = (v, p) => {
  const a = [...v].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))];
};
const stdev = (v) => {
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
};


/*
 * ボタンの見え方を「実際に描かれた画素」で確かめる。
 *
 * 7枚目の完成見本を同じやり方で測った値を目標にしている。
 *   主ボタンの塗り        rgb(1〜7, 106〜153, 251〜255)  赤がほとんど無い澄んだ青
 *   主ボタンの外の光      縁の近くほど青が強い（白い靄ではない）
 *   副ボタンの透け具合    中のばらつき ÷ 外のばらつき の平均 0.52 と 0.56
 * 見本の値そのものではなく、「見本と同じ性質があるか」を見る。
 * 背景の明るさが画面サイズで変わるため、絶対値ではなく関係で判定する。
 */

/** 見た目の明るさ（0〜255）。 */
const lum8 = ([r, g, b]) => 0.213 * r + 0.715 * g + 0.072 * b;

/*
 * 白い文字の「すぐ外側」の色を集める。
 *
 * ボタンの中でいちばん明るい場所と比べるやり方は、文字の無い所を見てしまう。
 * 実際に読みにくさが出るのは文字の縁なので、文字の画素から数画素だけ
 * 外へ広げた輪の色を見る。影もこの輪に入る。
 */
function aroundInk(img, viewportWidth, rect, inkLum = 150, near = 2, far = 4) {
  const s = img.width / viewportWidth;
  const x0 = Math.max(0, Math.round(rect.x * s));
  const x1 = Math.min(img.width, Math.round((rect.x + rect.width) * s));
  const y0 = Math.max(0, Math.round(rect.y * s));
  const y1 = Math.min(img.height, Math.round((rect.y + rect.height) * s));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return [];
  const at = (x, y) => {
    const i = ((y0 + y) * img.width + (x0 + x)) * img.channels;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (lum8(at(x, y)) > inkLum) ink[y * w + x] = 1;
    }
  }
  // 文字の半端な明るさの画素を拾わないよう、near 画素ぶん離れた所から見る。
  const gn = Math.max(1, Math.round(near * s));
  const gf = Math.max(gn + 1, Math.round(far * s));
  const dist = (x, y, g) => {
    for (let dy = -g; dy <= g; dy += 1) {
      for (let dx = -g; dx <= g; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (ink[ny * w + nx]) return true;
      }
    }
    return false;
  };
  const out = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (ink[y * w + x]) continue;
      if (dist(x, y, gn)) continue;
      if (dist(x, y, gf)) out.push(at(x, y));
    }
  }
  return out;
}

/** 一時的に CSS を足した状態で1枚撮る。撮ったら元へ戻す。 */
async function shotWith(page, css) {
  const tag = await page.addStyleTag({ content: css });
  const png = await page.screenshot();
  await tag.evaluate((node) => node.remove());
  return decodePng(png);
}

async function checkButtonPixels(page, m, label, check) {
  const img = decodePng(await page.screenshot());
  // 副ボタンを消した画面。ボタンの背後に実際に何があるかを、そのまま測れる。
  const behind = await shotWith(page, '.t-sub-btn{visibility:hidden!important}');
  // 幕を外した画面。幕が何をどれだけ暗くしているかを、そのまま測れる。
  const noScrim = await shotWith(page, '.t-scrim{display:none!important}');
  // 3つのボタンを消した画面。ボタンの光が周りへどれだけ及んでいるかを測れる。
  const noButtons = await shotWith(page, '.t-start,.t-sub-btn{visibility:hidden!important}');
  const vw = m.viewport.width;
  const S = m.start;

  // --- 主ボタンの塗り（文字にかからない、上から12%の行） ---
  const fillY = S.y + S.height * 0.12;
  const fills = [0.08, 0.16, 0.84, 0.92].map((f) => pixelAt(img, vw, S.x + S.width * f, fillY));
  for (const [r, g, b] of fills) {
    check(
      b >= 200 && r <= 40 && b - r >= 150,
      `${label}: 主ボタンの塗り rgb(${r},${g},${b}) が澄んだ青でない（見本は rgb(1〜7,106〜153,251〜255)）`,
    );
  }

  // --- 主ボタンの下を暗くしていない ---
  // 見本は下端の中央が rgb(2,106,253) と鮮やかなまま。
  // 修正前のように下端を rgb(6,68,200) 系へ沈めると、青が 215 前後まで落ちる。
  const lum = lum8;
  const bottom = pixelAt(img, vw, S.x + S.width * 0.5, S.y + S.height * 0.93);
  check(
    bottom[2] >= 235 && bottom[0] <= 45,
    `${label}: 主ボタンの下端が沈んでいる（rgb(${bottom}) / 見本は rgb(2,106,253)）`,
  );
  const col = S.x + S.width * 0.08;
  const mid = lum(pixelAt(img, vw, col, S.y + S.height * 0.5));
  const low = lum(pixelAt(img, vw, col, S.y + S.height * 0.9));
  check(low >= mid - 6, `${label}: 主ボタンの下端が途中より暗い（${low.toFixed(0)} < ${mid.toFixed(0)}）`);

  // --- 主ボタンの外へ広がる光が青い ---
  const midY = S.y + S.height / 2;
  const blueness = ([r, , b]) => b - r;
  for (const [side, near, far] of [
    ['左', S.x - 4, S.x - 34],
    ['右', S.x + S.width + 4, S.x + S.width + 34],
  ]) {
    const n = pixelAt(img, vw, near, midY);
    const f = pixelAt(img, vw, far, midY);
    check(
      blueness(n) - blueness(f) >= 25,
      `${label}: 主ボタンの${side}外に青い光が広がっていない（縁の近く rgb(${n}) / 離れた所 rgb(${f})）`,
    );
  }

  /*
   * --- ボタンの光が、周りの石畳の暖色を飛ばしていないこと ---
   *
   * 完成見本（IMG_5246.jpeg）の主ボタンの外側を画素で測ると
   *   縁から 2〜6px は青い光、8〜10px でほぼ消え、14px 先は
   *   rgb(246,206,155)（暖かさ +91）の石畳に戻る。
   * 光を広げすぎると、この暖色が白く飛ぶ。ボタンを消した画面と見比べる。
   */
  {
    const band = (im, y0, h) => pixelsIn(im, vw, { x: S.x, y: y0, width: S.width, height: h }, 2);
    const avg = (v, f) => v.reduce((t, p) => t + f(p), 0) / v.length;
    const warm = (p) => p[0] - p[2];
    const top = Math.max(0, S.y - 22);
    const withBtn = band(img, top, 10);
    const without = band(noButtons, top, 10);
    check(withBtn.length > 20, `${label}: ボタンの外側を測れていない`);
    if (withBtn.length > 20) {
      const loss = avg(without, warm) - avg(withBtn, warm);
      check(
        loss <= 45,
        `${label}: 主ボタンの光が広がりすぎて周りの暖色を飛ばしている` +
          `（ボタンの12〜22px上で 暖かさ ${avg(without, warm).toFixed(0)} → ${avg(withBtn, warm).toFixed(0)}）`,
      );
    }
  }

  /*
   * --- 主ボタンの飛行機と文字が、見本と同じ大きさで描けていること ---
   *
   * 完成見本（IMG_5246.jpeg）の主ボタンの中身（ボタンの左端からの CSSpx）
   *   飛行機 24.4 x 24.4 / 文字 1字の字面 18.3〜21.6 高 / 山形 5.5 x 10.0
   * 小さいまま（以前は 17.5 x 16.5）だと見本の印象にならない。
   */
  if (m.viewport.width >= 375) {
    const s = img.width / vw;
    const x0 = Math.round(S.x * s);
    const y0 = Math.round(S.y * s);
    const w = Math.round(S.width * s);
    const h = Math.round(S.height * s);
    const white = [];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = ((y0 + y) * img.width + (x0 + x)) * img.channels;
        if (Math.min(img.data[i], img.data[i + 1], img.data[i + 2]) > 235) white.push([x, y]);
      }
    }
    check(white.length > 100, `${label}: 主ボタンの白い中身が見つからない`);
    if (white.length > 100) {
      // いちばん左のかたまり＝飛行機。
      const xs = [...new Set(white.map((p) => p[0]))].sort((a, b) => a - b);
      let end = xs[0];
      for (const x of xs) {
        if (x - end > 2 * s) break;
        end = x;
      }
      const plane = white.filter((p) => p[0] <= end);
      const pw = (end - xs[0]) / s;
      const ph =
        (Math.max(...plane.map((p) => p[1])) - Math.min(...plane.map((p) => p[1]))) / s;
      check(
        pw >= 19 && ph >= 19,
        `${label}: 主ボタンの飛行機が小さい（${pw.toFixed(1)}x${ph.toFixed(1)}px / 見本は 24.4x24.4）`,
      );
    }
  }

  /*
   * --- 縁そのものが光って見えること ---
   *
   * 完成見本の主ボタンを縁からの距離ごとに画素で測ると
   *   -2px rgb(3,64,241)（青−赤 +238 / RGBの最小値 3）
   *   -3px rgb(7,60,238)（青−赤 +231 / 最小値 7）
   * で、縁のすぐ外は「白っぽい靄」ではなく、緑の低い澄んだ青。
   * 白を混ぜて広げると、周りの石畳の暖かい色まで薄まる。
   * 左右の縁の ±2px と ±3px、計4点の平均で見る。
   */
  {
    const yc = S.y + S.height / 2;
    const pts = [
      pixelAt(img, vw, S.x - 2, yc),
      pixelAt(img, vw, S.x - 3, yc),
      pixelAt(img, vw, S.x + S.width + 2, yc),
      pixelAt(img, vw, S.x + S.width + 3, yc),
    ];
    const blue = pts.reduce((t, p) => t + (p[2] - p[0]), 0) / pts.length;
    const whiteness = pts.reduce((t, p) => t + Math.min(p[0], p[1], p[2]), 0) / pts.length;
    check(
      blue >= 185,
      `${label}: 縁のすぐ外が青くない（青−赤 ${blue.toFixed(0)} / 見本は +231〜+238）`,
    );
    check(
      whiteness <= 45,
      `${label}: 縁のすぐ外が白い靄になっている（白っぽさ ${whiteness.toFixed(0)} / 見本は 3〜7）`,
    );
  }

  // --- 主ボタンの文字が読める ---
  // 白い文字と塗りの明暗比。文字の縁の1画素ではなく、塗りの分布で見る。
  // 塗りの明るいほう（上から10%）を、文字にとっていちばん不利な塗りとする。
  // 7枚目の完成見本を同じやり方で測ると 2.79。下限はそれより高い 2.9 に置き、
  // 見本より読みにくくならないようにしている。
  const inside = pixelsIn(img, vw, { x: S.x + 6, y: S.y + 6, width: S.width - 12, height: S.height - 12 });
  const fill = inside.filter((p) => lum(p) <= 170);
  check(fill.length > 40, `${label}: 主ボタンの塗りを測れていない（${fill.length}画素）`);
  if (fill.length > 40) {
    const bright = [0, 1, 2].map((c) => percentile(fill.map((p) => p[c]), 0.9));
    const ratio = contrast([255, 255, 255], bright);
    check(
      ratio >= 2.9,
      `${label}: 主ボタンの白文字の明暗比が足りない（${ratio.toFixed(2)} / 明るいほうの塗り rgb(${bright})・見本は 2.79）`,
    );
  }
  // 文字のすぐ外側（影を含む）での明暗比。読みにくさが実際に出る場所。
  {
    const ring = aroundInk(img, vw, S);
    check(ring.length > 40, `${label}: 主ボタンの文字の縁を測れていない`);
    if (ring.length > 40) {
      const near = [0, 1, 2].map((c) => percentile(ring.map((p) => p[c]), 0.9));
      const r = contrast([255, 255, 255], near);
      check(
        r >= 3.5,
        `${label}: 主ボタンの文字の縁での明暗比が足りない（${r.toFixed(2)} / 縁 rgb(${near})）`,
      );
    }
  }

  // --- 副ボタン：背景が透けている ---
  /*
   * 近くの背景と比べるのではなく、「副ボタンを消した画面」の同じ場所と比べる。
   * ボタンの背後に実際にある絵が、どれだけ通ってきているかをそのまま測れる。
   *   透け具合 = ボタン越しの色のばらつき ÷ 背後そのものの色のばらつき
   * 文字と縁は数えない（文字のない上下の帯だけを見る）。
   */
  for (const b of m.subButtons ?? []) {
    const strip = (im, top) =>
      pixelsIn(im, vw, { x: b.x + 10, y: top, width: b.width - 20, height: 7 }, 1);
    const through = [...strip(img, b.y + 4), ...strip(img, b.y + b.height - 11)];
    const raw = [...strip(behind, b.y + 4), ...strip(behind, b.y + b.height - 11)];
    check(
      through.length > 20 && through.length === raw.length,
      `${label}: 「${b.text.trim()}」の画素を測れていない`,
    );
    if (through.length > 20 && through.length === raw.length) {
      /*
       * 透け具合は「明暗の模様がどれだけ通っているか」で測る。
       * 色ごとのばらつきで測ると、色を変えるガラス（青いガラス）が
       * 不当に低く出る。石畳の目地や光の模様が見えるかどうかは
       * 明るさのばらつきで決まるので、そちらを見る。
       */
      const rawLum = stdev(raw.map(lum));
      const seeThrough = rawLum < 1 ? 1 : stdev(through.map(lum)) / rawLum;
      const ratios = [0, 1, 2].map((c) => {
        const sr = stdev(raw.map((p) => p[c]));
        return sr < 1 ? 1 : stdev(through.map((p) => p[c])) / sr;
      });
      check(
        seeThrough >= 0.45,
        `${label}: 「${b.text.trim()}」が塗りつぶされていて背景が透けない` +
          `（透け具合（明暗）${seeThrough.toFixed(2)} / 色ごと R ${ratios[0].toFixed(2)} G ${ratios[1].toFixed(2)} B ${ratios[2].toFixed(2)}）`,
      );
      /*
       * ボタンの面が「青いガラス」に見えること。
       *
       * 背後の石畳は暖色なので、そのまま透かすと茶色が前に出る。
       * 完成見本の副ボタンの面を画素で測ると
       *   マイパスポート rgb(55,70,130)（青−赤 +75）
       *   設定          rgb(53,70,141)（青−赤 +88）
       * で、はっきり青い。茶色や灰色に戻ったら落とす。
       * （ボタンの外の石畳が暖色のままであることは、下の「画面の下端」で見る。）
       */
      const blueness = (v) => v.reduce((t, p) => t + (p[2] - p[0]), 0) / v.length;
      const face = pixelsIn(img, vw, {
        x: b.x + 8,
        y: b.y + 5,
        width: b.width - 16,
        height: b.height - 10,
      }).filter((p) => lum(p) <= 160);
      check(face.length > 40, `${label}: 「${b.text.trim()}」の面を測れていない`);
      if (face.length > 40) {
        check(
          blueness(face) >= 45,
          `${label}: 「${b.text.trim()}」の面が青いガラスに見えない` +
            `（青−赤 ${blueness(face).toFixed(0)} / 見本は +75〜+88）`,
        );
      }
      // 透けていても文字は読める。明るいほう（上から10%）で見る。
      // 見本を同じやり方で測ると 5.28 と 5.58。
      const inkArea = pixelsIn(img, vw, {
        x: b.x + 6,
        y: b.y + 5,
        width: b.width - 12,
        height: b.height - 10,
      }).filter((p) => lum(p) <= 150);
      const bright = [0, 1, 2].map((c) => percentile(inkArea.map((p) => p[c]), 0.9));
      const ratio = contrast([255, 255, 255], bright);
      check(
        ratio >= 3.5,
        `${label}: 「${b.text.trim()}」の白文字の明暗比が足りない（${ratio.toFixed(2)} / 明るいほうの背後 rgb(${bright})）`,
      );
      /*
       * 絵記号が、見本と同じくらいの大きさで描かれていること。
       * 見本は パスポート 16.6x21.6 / 歯車 20.5x20.0 CSSpx。
       * 枠を小さく戻すと 12.5〜14.5 までしか出ない。
       */
      {
        const sc = img.width / vw;
        const ix0 = Math.round((b.x + 6) * sc);
        const ix1 = Math.round((b.x + b.width * 0.45) * sc);
        const iy0 = Math.round((b.y + 4) * sc);
        const iy1 = Math.round((b.y + b.height - 4) * sc);
        const cols = [];
        for (let x = ix0; x < ix1; x += 1) {
          let hit = false;
          for (let y = iy0; y < iy1 && !hit; y += 1) {
            const i = (y * img.width + x) * img.channels;
            if (Math.min(img.data[i], img.data[i + 1], img.data[i + 2]) > 225) hit = true;
          }
          cols.push(hit);
        }
        const first = cols.indexOf(true);
        let last = first;
        for (let k = first; k < cols.length; k += 1) {
          if (cols[k]) last = k;
          else if (k - last > 2 * sc) break;
        }
        let top = iy1;
        let bottom = iy0;
        for (let x = ix0 + first; x <= ix0 + last; x += 1) {
          for (let y = iy0; y < iy1; y += 1) {
            const i = (y * img.width + x) * img.channels;
            if (Math.min(img.data[i], img.data[i + 1], img.data[i + 2]) > 225) {
              if (y < top) top = y;
              if (y > bottom) bottom = y;
            }
          }
        }
        const ih = (bottom - top) / sc;
        check(
          first >= 0 && ih >= 17,
          `${label}: 「${b.text.trim()}」の絵記号が小さい（高さ ${ih.toFixed(1)}px / 見本は 20.0〜21.6）`,
        );
      }

      // 文字のすぐ外側（影を含む）での明暗比。こちらが実際の読みにくさに近い。
      const ring = aroundInk(img, vw, b);
      check(ring.length > 40, `${label}: 「${b.text.trim()}」の文字の縁を測れていない`);
      if (ring.length > 40) {
        const near = [0, 1, 2].map((c) => percentile(ring.map((p) => p[c]), 0.9));
        const r2 = contrast([255, 255, 255], near);
        check(
          r2 >= 4.5,
          `${label}: 「${b.text.trim()}」の文字の縁での明暗比が足りない（${r2.toFixed(2)} / 縁 rgb(${near})）`,
        );
      }
    }
  }

  /*
   * --- 幕が、風景を沈めていないこと ---
   *
   * 幕を外した画面と見比べて、幕がどこをどれだけ暗くしているかを直接測る。
   * 完成見本（IMG_5246.jpeg）を画素で測ると、画面の下のほうは
   *   縦96% 明るさ117 暖かさ(R-B)+78 / 縦99.5% 明るさ124 +60
   * と暖かい光が下端まで残る。以前の実装は 72/-3 と 70/+6 まで沈んでいた。
   */
  {
    const band = (im, y0, y1) =>
      pixelsIn(
        im,
        vw,
        { x: 0, y: m.viewport.height * y0, width: vw, height: m.viewport.height * (y1 - y0) },
        3,
      );
    const mean = (v, f) => v.reduce((t, p) => t + f(p), 0) / v.length;
    // 人物の足元。幕が届いていないこと。
    const feetY = (m.cast.y + m.cast.height) / m.viewport.height;
    const y0 = Math.max(0, feetY - 0.02);
    const y1 = Math.min(1, feetY + 0.01);
    const drop = 1 - mean(band(img, y0, y1), lum) / mean(band(noScrim, y0, y1), lum);
    check(
      drop <= 0.03,
      `${label}: 人物の足元まで幕が暗くしている（明るさが ${(drop * 100).toFixed(1)}% 落ちている）`,
    );
    // 画面のいちばん下。風景の明るさと暖色が残っていること。
    const bottom = band(img, 0.955, 0.999);
    const bl = mean(bottom, lum);
    const bw = mean(bottom, (p) => p[0] - p[2]);
    check(
      bl >= 100,
      `${label}: 画面の下端が暗く沈んでいる（明るさ ${bl.toFixed(0)} / 見本は 117〜124）`,
    );
    check(
      bw >= 20,
      `${label}: 画面の下端から暖色が失われている（暖かさ ${bw.toFixed(0)} / 見本は +60〜+78）`,
    );
    const bottomDrop = 1 - bl / mean(band(noScrim, 0.955, 0.999), lum);
    check(
      bottomDrop <= 0.08,
      `${label}: 幕が画面の下端まで届いている（明るさが ${(bottomDrop * 100).toFixed(1)}% 落ちている）`,
    );
    /*
     * 幕そのものが、石畳の暖色を灰青色へ振っていないこと。
     * 冷たい紺で落とすと、明るさは同じでも色みが失われる。
     * 副ボタンの行（幕がいちばん濃い高さ）で、幕あり・なしを見比べる。
     */
    const warmth = (v) => mean(v, (p) => p[0] - p[2]);
    const rowTop = (m.sub.y + m.sub.height * 0.1) / m.viewport.height;
    const rowBottom = (m.sub.y + m.sub.height * 0.9) / m.viewport.height;
    const scrimWarmLoss =
      warmth(band(noScrim, rowTop, rowBottom)) - warmth(band(img, rowTop, rowBottom));
    check(
      scrimWarmLoss <= 20,
      `${label}: 幕が石畳の暖色を灰青色へ振っている（暖かさが ${scrimWarmLoss.toFixed(0)} 落ちている）`,
    );
  }
}

const BG_NATURAL = { width: 853, height: 1844 };
const BG_POSITION_Y = 0.45;
/** 背景の中の位置（比率）。 */
const LANDMARKS = {
  globe: { left: 0.235, top: 0.178, right: 0.775, bottom: 0.4 },
  fuji: { left: 0.03, top: 0.395, right: 0.43, bottom: 0.48 },
};
/** 富士山の山頂。ここは人物にもロゴにも隠させない。 */
const FUJI_SUMMIT = { x: 0.191, y: 0.401 };

/**
 * 石畳の歩道の範囲（背景に対する比率）。src/data/titleAssets.ts の実測値と同じ。
 * 歩道は遠近法で台形になるので、2つの高さの左右の端を直線でつなぐ。
 */
const WALKWAYS = {
  'background-walkway-candidate.webp': {
    top: 0.555,
    far: { y: 0.7, left: 0.2, right: 0.786 },
    near: { y: 0.85, left: 0.045, right: 0.95 },
  },
  // 歩道が 71.5% から始まり、その上は川と欄干。
  'background-reference-exact.webp': {
    top: 0.715,
    far: { y: 0.78, left: 0.345, right: 0.66 },
    near: { y: 0.92, left: 0.1, right: 0.9 },
  },
};

/** いま出している背景に対応する歩道。背景を替えたら歩道も替わる。 */
function walkwayFor(file) {
  const w = WALKWAYS[file];
  if (!w) throw new Error(`歩道の実測値が無い背景: ${file}`);
  return w;
}

/** 人物素材の接地点（素材に対する比率）。 */
const CAST_CONTACTS = [
  { name: '男性の前の靴', x: 0.235, y: 0.93, edgeMargin: 0 },
  { name: '男性の後ろの靴', x: 0.29, y: 0.927, edgeMargin: 0 },
  { name: 'CAの後ろの靴', x: 0.62, y: 0.945, edgeMargin: 0 },
  { name: 'CAの前の靴', x: 0.685, y: 0.958, edgeMargin: 0 },
  // かばんは浮いている絵。歩道の端から少しはみ出す画面があるが、そこは花壇。
  { name: 'かばんの左脚', x: 0.76, y: 0.893, edgeMargin: 0.05 },
  { name: 'かばんの右脚', x: 0.879, y: 0.904, edgeMargin: 0.05 },
];
const CONTACT_MARGIN = Object.fromEntries(CAST_CONTACTS.map((c) => [c.name, c.edgeMargin]));

/** その高さでの歩道の左右の端。far と near を結んだ直線で求める。 */
function walkwayEdges(walkway, y) {
  const t = (y - walkway.far.y) / (walkway.near.y - walkway.far.y);
  return {
    left: walkway.far.left + (walkway.near.left - walkway.far.left) * t,
    right: walkway.far.right + (walkway.near.right - walkway.far.right) * t,
  };
}
/** 透過素材の、絵柄が入っている範囲（原寸比）。透明な余白を除くために使う。 */
const LOGO_ART = { l: 18 / 1997, r: 1, t: 88 / 788, b: 754 / 788 };
const CAST_ART = { l: 0.0156, r: 0.9951, t: 0.0189, b: 0.9583 };

/*
 * 地球儀がどれだけ見えているかは、ブラウザの中で素材の透明度を読んで測る
 * （titleMetrics の globeVisibleRatio）。
 *
 * 矩形どうしの重なりでは、透過素材の透明な部分まで「隠している」と
 * 数えてしまい、実際の見え方とかけ離れる。
 */

/** 表紙の実測値を集める。 */
function titleMetrics() {
  /**
   * 画像が実際に塗られる範囲。
   *
   * 要素の矩形と塗られる範囲は別物。object-fit: contain では、
   * 箱の縦横比が絵と違うと絵は内側へ寄る（箱いっぱいには塗られない）。
   * 欠けや重なりは、箱ではなく塗られる範囲で測らないと正しく出ない。
   */
  const painted = (node) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    const fit = getComputedStyle(node).objectFit;
    const nw = node.naturalWidth;
    const nh = node.naturalHeight;
    if (!nw || !nh) return null;
    const scale =
      fit === 'contain'
        ? Math.min(r.width / nw, r.height / nh)
        : fit === 'cover'
          ? Math.max(r.width / nw, r.height / nh)
          : fit === 'none'
            ? 1
            : null;
    if (scale === null) return { fit, x: r.x, y: r.y, width: r.width, height: r.height };
    const w = nw * scale;
    const h = nh * scale;
    return { fit, x: r.x + (r.width - w) / 2, y: r.y + (r.height - h) / 2, width: w, height: h };
  };
  const rect = (sel) => {
    const node = document.querySelector(sel);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  const bg = document.querySelector('.t-bg');
  const logo = document.querySelector('.t-logo');
  const cast = document.querySelector('.t-cast');
  const buttons = [...document.querySelectorAll('.screen--title button')].map((el) => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), x: r.x, y: r.y, width: r.width, height: r.height };
  });
  /*
   * 富士山の山頂が、人物やロゴの「絵」に隠されていないかを調べる。
   *
   * 矩形どうしの重なりでは、透明な部分まで「隠している」と数えてしまう。
   * そこで素材を canvas へ描き、その点の透明度を直接読む。
   * 素材は同じ場所から配っているので canvas は汚れない。
   */
  const alphaReader = (node) => {
    if (!node || !node.naturalWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = node.naturalWidth;
    canvas.height = node.naturalHeight;
    const ctx2d = canvas.getContext('2d');
    ctx2d.drawImage(node, 0, 0);
    const data = ctx2d.getImageData(0, 0, canvas.width, canvas.height).data;
    return (point) => {
      const box = node.getBoundingClientRect();
      const u = (point.x - box.x) / box.width;
      const v = (point.y - box.y) / box.height;
      if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
      const x = Math.round(u * (canvas.width - 1));
      const y = Math.round(v * (canvas.height - 1));
      return data[(y * canvas.width + x) * 4 + 3];
    };
  };
  const castAlpha = alphaReader(cast);
  const logoAlpha = alphaReader(logo);
  const summitCoveredBy = (reader, point) => (reader ? reader(point) > 80 : null);
  // 背景の中の比率を画面の座標へ直す（landmarkRect と同じ計算）。
  const bgPoint = (fx, fy) => {
    const box = bg.getBoundingClientRect();
    const scale = Math.max(box.width / bg.naturalWidth, box.height / bg.naturalHeight);
    const w = bg.naturalWidth * scale;
    const h = bg.naturalHeight * scale;
    const posY = Number.parseFloat(getComputedStyle(bg).objectPosition.split(' ')[1]) || 50;
    return { x: box.x + (box.width - w) / 2 + w * fx, y: box.y + (box.height - h) * (posY / 100) + h * fy };
  };
  const summit = bg && bg.naturalWidth ? bgPoint(0.191, 0.401) : null;

  /*
   * 人物の接地点（靴底・かばんの脚）が、背景のどこに来ているか。
   * 画面の座標ではなく「背景の中の比率」で返す。
   * 石畳の歩道の上に来ているかは、呼び出し側で歩道の範囲と突き合わせる。
   */
  const castContacts = (() => {
    if (!bg || !bg.naturalWidth || !cast) return null;
    const box = bg.getBoundingClientRect();
    const scale = Math.max(box.width / bg.naturalWidth, box.height / bg.naturalHeight);
    const w = bg.naturalWidth * scale;
    const h = bg.naturalHeight * scale;
    const posY = Number.parseFloat(getComputedStyle(bg).objectPosition.split(' ')[1]) || 50;
    const x0 = box.x + (box.width - w) / 2;
    const y0 = box.y + (box.height - h) * (posY / 100);
    const cb = cast.getBoundingClientRect();
    const points = [
      { name: '男性の前の靴', x: 0.235, y: 0.93 },
      { name: '男性の後ろの靴', x: 0.29, y: 0.927 },
      { name: 'CAの後ろの靴', x: 0.62, y: 0.945 },
      { name: 'CAの前の靴', x: 0.685, y: 0.958 },
      { name: 'かばんの左脚', x: 0.76, y: 0.893 },
      { name: 'かばんの右脚', x: 0.879, y: 0.904 },
    ];
    return points.map((p) => {
      const sx = cb.x + cb.width * p.x;
      const sy = cb.y + cb.height * p.y;
      return { name: p.name, bx: (sx - x0) / w, by: (sy - y0) / h, sx, sy };
    });
  })();

  /*
   * 地球儀の面のうち、ロゴにも人物にも隠されずに見えている割合。
   *
   * 目標の構図では、大きな地球儀の手前にロゴと人物が重なる。
   * 以前の「重なり0px2」は取り下げられたので、代わりに
   * 「どれだけ見えているか」に下限を置く。
   * 球は丸いので、四角ではなく楕円の内側だけを数える。
   * 隠れているかは、透過素材のその点の透明度で判定する。
   */
  const globeVisibleRatio = (() => {
    if (!bg || !bg.naturalWidth) return null;
    const box = { left: 0.26, top: 0.185, right: 0.775, bottom: 0.395 };
    const tl = bgPoint(box.left, box.top);
    const br = bgPoint(box.right, box.bottom);
    const cx = (tl.x + br.x) / 2;
    const cy = (tl.y + br.y) / 2;
    const rx = (br.x - tl.x) / 2;
    const ry = (br.y - tl.y) / 2;
    let inside = 0;
    let visible = 0;
    const steps = 48;
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; j <= steps; j += 1) {
        const x = tl.x + ((br.x - tl.x) * i) / steps;
        const y = tl.y + ((br.y - tl.y) * j) / steps;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
        inside += 1;
        const point = { x, y };
        const hidden =
          (castAlpha && castAlpha(point) > 80) || (logoAlpha && logoAlpha(point) > 80);
        if (!hidden) visible += 1;
      }
    }
    return inside === 0 ? null : visible / inside;
  })();

  // 画面の中でいちばん下にある要素の下端。
  // documentElement.scrollHeight は html { height: 100% } で頭打ちになるため使わない。
  const bottoms = [...document.querySelectorAll('.screen--title *')].map(
    (el) => el.getBoundingClientRect().bottom,
  );
  return {
    summit,
    summitCoveredByCast: summit ? summitCoveredBy(castAlpha, summit) : null,
    summitCoveredByLogo: summit ? summitCoveredBy(logoAlpha, summit) : null,
    castContacts,
    bgFile: bg ? bg.src.split('/').pop() : '',
    // 接地影が足元に置かれているか。
    ground: rect('.t-ground'),
    globeVisibleRatio,
    bg: rect('.t-bg'),
    // 欠け・重なりの判定は、要素の矩形ではなく塗られる範囲で行う。
    logo: painted(logo),
    cast: painted(cast),
    logoBox: rect('.t-logo'),
    castBox: rect('.t-cast'),
    start: rect('.t-start'),
    sub: rect('.t-sub'),
    subButtons: [...document.querySelectorAll('.t-sub-btn')].map((el) => {
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height, text: el.textContent ?? '' };
    }),
    /*
     * ボタンの中身が幅からあふれていないか。
     * white-space: nowrap を付けてあるので、あふれると文字が切れて
     * 「マイパスポ…」のように見える。折り返しの検査では捕まえられない。
     */
    buttonOverflow: [...document.querySelectorAll('.screen--title button')].map((el) => ({
      text: (el.textContent ?? '').trim(),
      over: el.scrollWidth - el.clientWidth,
    })),
    buttons,
    // 画面が背景へ付けた縦の見せ方。データと食い違っていないかを見る。
    bgObjectPosition: bg ? bg.style.objectPosition : '',
    // 要素の矩形は画面いっぱいでも、object-fit によっては
    // 実際に絵が塗られる範囲が内側へ寄る（左右に余白が出る）。
    // 塗られる範囲そのものを求めて確かめる。
    bgPainted: painted(bg),
    bgNatural: bg ? { width: bg.naturalWidth, height: bg.naturalHeight } : null,
    bgLoaded: bg?.complete === true && bg?.naturalWidth > 0,
    logoLoaded: logo?.complete === true && logo?.naturalWidth > 0,
    castLoaded: cast?.complete === true && cast?.naturalWidth > 0,
    startFontSize: Number.parseFloat(
      getComputedStyle(document.querySelector('.t-start')).fontSize,
    ),
    // ボタンの文字が折り返していないか（1行に収まっているか）。
    buttonLabels: [...document.querySelectorAll('.screen--title .t-label')].map((el) => {
      const r = el.getBoundingClientRect();
      const size = Number.parseFloat(getComputedStyle(el).fontSize);
      return { text: el.textContent.trim(), height: r.height, fontSize: size };
    }),
    subFontSize: Number.parseFloat(
      getComputedStyle(document.querySelector('.t-sub-btn')).fontSize,
    ),
    // 明度調整の幕の指定。どの高さをどれだけ暗くしているかを取り出す。
    scrimGradient: (() => {
      const node = document.querySelector('.t-scrim');
      return node ? getComputedStyle(node).backgroundImage : '';
    })(),
    logoAlt: logo?.getAttribute('alt') ?? '',
    castAriaHidden: cast?.getAttribute('aria-hidden') ?? '',
    // 一枚絵の名残（焼き込まれたロゴ・ボタン）が残っていないこと。
    legacyCover: document.querySelectorAll('.title__cover, .title__cover-box, .title__start').length,
    devNote: document.querySelectorAll('.title__note').length,
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    vScroll: document.body.scrollHeight > window.innerHeight + 1,
    lowestBottom: bottoms.length > 0 ? Math.max(...bottoms) : 0,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
}

/**
 * 明度調整の幕が、ある高さをどれだけ暗くしているかを求める。
 *
 * 幕は linear-gradient(0deg, ...) なので、0 が画面のいちばん下。
 * 画面の座標 y を「下から何割の位置か」に直し、前後の段から補間する。
 * 返すのは 0〜1 の濃さ（0 なら、そこは幕で暗くしていない）。
 *
 * 段の位置は書かなくてもよい（最初は 0、最後は 100%、途中は等間隔）。
 * ブラウザが読み返す文字列では最初の 0 が省かれるので、
 * 位置の省略をきちんと補わないと、先頭の段を取りこぼして
 * 実際より薄い値を返してしまう。
 */
function parseGradientStops(text, viewportHeight) {
  const inside = text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'));
  // かっこの深さを見ながら、いちばん外側のカンマだけで区切る。
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of inside) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') parts.push(current.trim());

  const stops = [];
  for (const part of parts) {
    const color = part.match(/rgba?\(([^)]*)\)/);
    // 先頭の向き（0deg, to top など）には色が無いので飛ばす。
    if (!color) continue;
    const values = color[1].split(',').map((v) => Number.parseFloat(v));
    const rest = part.slice(color.index + color[0].length).trim();
    const position = rest.match(/^(-?[\d.]+)(%|px)?$/);
    let at = null;
    if (position) {
      const value = Number.parseFloat(position[1]);
      at = position[2] === '%' ? value / 100 : value / viewportHeight;
    }
    stops.push({ alpha: values.length > 3 ? values[3] : 1, at });
  }
  if (stops.length === 0) return [];

  // 省かれた位置を補う。最初は 0、最後は 1、途中は前後の段の等間隔。
  if (stops[0].at === null) stops[0].at = 0;
  if (stops[stops.length - 1].at === null) stops[stops.length - 1].at = 1;
  for (let i = 0; i < stops.length; i += 1) {
    if (stops[i].at !== null) continue;
    let next = i;
    while (stops[next].at === null) next += 1;
    const from = stops[i - 1].at;
    const step = (stops[next].at - from) / (next - i + 1);
    for (let k = i; k < next; k += 1) stops[k].at = from + step * (k - i + 1);
  }
  return stops;
}

function scrimAlphaAt(m, y) {
  const stops = parseGradientStops(m.scrimGradient, m.viewport.height);
  if (stops.length === 0) return null;
  const fromBottom = (m.viewport.height - y) / m.viewport.height;
  if (fromBottom <= stops[0].at) return stops[0].alpha;
  for (let i = 1; i < stops.length; i += 1) {
    const a = stops[i - 1];
    const b = stops[i];
    if (fromBottom <= b.at) {
      const t = b.at === a.at ? 0 : (fromBottom - a.at) / (b.at - a.at);
      return a.alpha + (b.alpha - a.alpha) * t;
    }
  }
  return stops[stops.length - 1].alpha;
}

/** 背景の中の比率を、画面の座標へ直す。 */
function landmarkRect(m, box) {
  const boxRect = m.bg;
  const scale = Math.max(boxRect.width / BG_NATURAL.width, boxRect.height / BG_NATURAL.height);
  const renderedW = BG_NATURAL.width * scale;
  const renderedH = BG_NATURAL.height * scale;
  const offsetX = (renderedW - boxRect.width) * 0.5;
  const offsetY = (renderedH - boxRect.height) * BG_POSITION_Y;
  const px = (f) => boxRect.x + f * renderedW - offsetX;
  const py = (f) => boxRect.y + f * renderedH - offsetY;
  return {
    x: px(box.left),
    y: py(box.top),
    width: px(box.right) - px(box.left),
    height: py(box.bottom) - py(box.top),
  };
}

/** 透過素材の、絵柄が入っている矩形。 */
function artRect(box, art) {
  return {
    x: box.x + art.l * box.width,
    y: box.y + art.t * box.height,
    width: (art.r - art.l) * box.width,
    height: (art.b - art.t) * box.height,
  };
}

/** 重なっている面積（px^2）。 */
function overlapArea(a, b) {
  const w = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return w * h;
}

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  // ---- 1. 正式表紙が5サイズで成立する ----
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    await runCase(label, async () => {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        const jsErrors = [];
        page.on('pageerror', (e) => jsErrors.push(e.message));

        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        // 3つの素材の読み込みを待つ。naturalWidth は実体があっても直後は 0 のことがある。
        await page
          .waitForFunction(
            () =>
              ['.t-bg', '.t-logo', '.t-cast'].every((sel) => {
                const img = document.querySelector(sel);
                return img !== null && img.complete && img.naturalWidth > 0;
              }),
            undefined,
            { timeout: 9000 },
          )
          .catch(() => {});
        await page.waitForTimeout(700);
        const m = await page.evaluate(titleMetrics);
        await checkButtonPixels(page, m, label, check);

        check(m.bgLoaded, `${label}: 背景が読み込めていない`);
        check(m.logoLoaded, `${label}: ロゴが読み込めていない`);
        check(m.castLoaded, `${label}: 人物が読み込めていない`);
        check(
          m.bgNatural?.width === BG_NATURAL.width && m.bgNatural?.height === BG_NATURAL.height,
          `${label}: 背景の画素数が受領物と違う（${m.bgNatural?.width}x${m.bgNatural?.height}）`,
        );
        // 一枚絵の名残（焼き込まれたロゴとボタン）が残っていないこと。
        check(m.legacyCover === 0, `${label}: 一枚絵の表紙が残っている`);
        check(m.devNote === 0, `${label}: 開発用の説明文が表紙に出ている`);
        check(m.logoAlt.includes('ことばトラベル'), `${label}: ロゴに代替テキストが無い`);
        check(m.castAriaHidden === 'true', `${label}: 人物の絵が読み上げから外れていない`);

        // 画面が背景へ付けた縦の見せ方が、実測値と一致している。
        check(
          Math.abs(Number.parseFloat(m.bgObjectPosition.split(' ')[1]) / 100 - BG_POSITION_Y) <
            0.0005,
          `${label}: 背景の縦の見せ方が実測値と違う（${m.bgObjectPosition}）`,
        );

        // 背景は画面を覆う。左右の余白は 0。
        // 要素の矩形ではなく、実際に絵が塗られる範囲で確かめる。
        check(m.bgPainted !== null, `${label}: 背景が存在しない`);
        if (m.bgPainted) {
          check(
            m.bgPainted.fit === 'cover',
            `${label}: 背景の敷き方が cover ではない（${m.bgPainted.fit}）`,
          );
          const left = m.bgPainted.x;
          const right = m.viewport.width - (m.bgPainted.x + m.bgPainted.width);
          check(
            left <= 0.5 && right <= 0.5,
            `${label}: 背景の左右に余白がある（左${left.toFixed(1)}px 右${right.toFixed(1)}px）`,
          );
          const top = m.bgPainted.y;
          const bottom = m.viewport.height - (m.bgPainted.y + m.bgPainted.height);
          check(
            top <= 0.5 && bottom <= 0.5,
            `${label}: 背景の上下に余白がある（上${top.toFixed(1)}px 下${bottom.toFixed(1)}px）`,
          );
        }

        // 地球儀と富士山が画面の中にある。
        const globe = landmarkRect(m, LANDMARKS.globe);
        const fuji = landmarkRect(m, LANDMARKS.fuji);
        const logoArt = artRect(m.logo, LOGO_ART);
        const castArt = artRect(m.cast, CAST_ART);
        for (const [name, box] of [['地球儀', globe], ['富士山', fuji]]) {
          check(
            box.x >= -0.5 &&
              box.y >= -0.5 &&
              box.x + box.width <= m.viewport.width + 0.5 &&
              box.y + box.height <= m.viewport.height + 0.5,
            `${label}: ${name}が画面の外にある（${box.x.toFixed(1)},${box.y.toFixed(1)} ${box.width.toFixed(1)}x${box.height.toFixed(1)}）`,
          );
        }
        /*
         * 目標の構図では、大きな地球儀の手前にロゴと人物が重なる。
         * 以前の「重なり0px2」は取り下げられたので、代わりに
         * 「球の面がどれだけ見えているか」に下限を置く。
         */
        const globeVisible = m.globeVisibleRatio;
        check(
          globeVisible !== null && globeVisible >= 0.45,
          `${label}: 地球儀が見えなくなっている（見えているのは ${globeVisible === null ? '不明' : (globeVisible * 100).toFixed(0) + '%'}）`,
        );
        // 富士山の山頂は隠さない。素材の透明度を直接読んで確かめる。
        check(
          m.summitCoveredByCast === false,
          `${label}: 富士山の山頂を人物が隠している`,
        );
        check(
          m.summitCoveredByLogo === false,
          `${label}: 富士山の山頂をロゴが隠している`,
        );

        // ロゴと人物は切れていない（絵柄の矩形が画面の中に収まっている）。
        for (const [name, box] of [['ロゴ', logoArt], ['人物', castArt]]) {
          check(
            box.x >= -0.5 &&
              box.y >= -0.5 &&
              box.x + box.width <= m.viewport.width + 0.5 &&
              box.y + box.height <= m.viewport.height + 0.5,
            `${label}: ${name}が画面からはみ出している（${box.x.toFixed(1)},${box.y.toFixed(1)} ${box.width.toFixed(1)}x${box.height.toFixed(1)}）`,
          );
        }
        // 透過素材は縦横比のまま出す（引き伸ばさない）。
        // 箱ではなく、実際に塗られる範囲の比で見る。
        // ロゴは高さだけを指定し、幅は原寸比に任せている。
        // そのため箱がそのまま絵の範囲になり、object-fit は働かない（fill）。
        check(
          m.logo.fit === 'fill',
          `${label}: ロゴの敷き方が変わっている（${m.logo.fit}）。幅は原寸比に任せる`,
        );
        // 人物も高さだけを指定し、幅は原寸比に任せている（object-fit は働かない）。
        check(
          m.cast.fit === 'fill',
          `${label}: 人物の敷き方が変わっている（${m.cast.fit}）。幅は原寸比に任せる`,
        );
        check(
          Math.abs(m.logo.width / m.logo.height - 1997 / 788) / (1997 / 788) < 0.01,
          `${label}: ロゴの縦横比が原寸と違う（${(m.logo.width / m.logo.height).toFixed(4)}）`,
        );
        check(
          Math.abs(m.cast.width / m.cast.height - 1024 / 1536) / (1024 / 1536) < 0.01,
          `${label}: 人物の縦横比が原寸と違う（${(m.cast.width / m.cast.height).toFixed(4)}）`,
        );

        // ロゴが小さくなりすぎていない。
        // 目標の構図のロゴは画面幅の 74.7%。幅の上限（76vw）で決まるので、
        // どの画面でも 74% 前後になる。
        const logoWidthRatio = logoArt.width / m.viewport.width;
        check(
          logoWidthRatio >= 0.7,
          `${label}: ロゴが小さい（画面幅の ${(logoWidthRatio * 100).toFixed(1)}%）`,
        );

        /*
         * 人物が浮いていないこと。
         *
         * 人物の矩形の下端とボタンの距離ではなく、男性の左右の靴底、
         * CAの左右の靴底、かばんの左右の脚のそれぞれについて、
         * その位置に石畳の歩道があるかを見る。
         */
        check(Array.isArray(m.castContacts), `${label}: 接地点を測れていない`);
        const walkway = walkwayFor(m.bgFile);
        for (const c of m.castContacts ?? []) {
          const edges = walkwayEdges(walkway, c.by);
          const margin = CONTACT_MARGIN[c.name] ?? 0;
          // 水の上に来ていないこと（歩道の消失点より下にあること）。
          check(
            c.by > walkway.top,
            `${label}: ${c.name}が歩道より奥にある（背景の縦 ${(c.by * 100).toFixed(1)}% / 歩道は ${(walkway.top * 100).toFixed(1)}% から）`,
          );
          check(
            c.bx >= edges.left - margin && c.bx <= edges.right + margin,
            `${label}: ${c.name}の下に石畳が無い（背景の ${(c.bx * 100).toFixed(1)}%,${(c.by * 100).toFixed(1)}% / ` +
              `その高さの歩道は ${(edges.left * 100).toFixed(1)}〜${(edges.right * 100).toFixed(1)}%` +
              `${margin > 0 ? `／許す端のはみ出し ${(margin * 100).toFixed(0)}%` : ''}）`,
          );
        }
        // 接地影が足元の高さに置かれている（影だけで解決しない前提の仕上げ）。
        check(m.ground !== null, `${label}: 接地影が無い`);
        if (m.ground && m.castContacts) {
          const soles = m.castContacts.map((c) => c.sy);
          const lowest = Math.max(...soles);
          const highest = Math.min(...soles);
          check(
            m.ground.y <= highest + 1 && m.ground.y + m.ground.height >= lowest - 1,
            `${label}: 接地影が靴底の高さに無い（影 ${m.ground.y.toFixed(1)}〜${(m.ground.y + m.ground.height).toFixed(1)} / 靴底 ${highest.toFixed(1)}〜${lowest.toFixed(1)}）`,
          );
        }

        // ボタンの中身が幅からあふれて、文字が切れていない。
        for (const o of m.buttonOverflow) {
          check(
            o.over <= 0.5,
            `${label}: 「${o.text}」の中身が幅からあふれて切れている（${o.over.toFixed(1)}px）`,
          );
        }

        // ボタンの文字が2行に折り返していない。
        for (const lab of m.buttonLabels) {
          check(
            lab.height <= lab.fontSize * 1.7,
            `${label}: ボタンの文字が折り返している（${lab.text} 高さ${lab.height.toFixed(1)}px / 文字${lab.fontSize}px）`,
          );
        }

        // 人物が小さくなりすぎていない。目標の構図は絵の高さが画面の 47.2%。
        const castHeightRatio = castArt.height / m.viewport.height;
        check(
          castHeightRatio >= 0.4,
          `${label}: 人物が小さい（絵の高さが画面の ${(castHeightRatio * 100).toFixed(1)}%）`,
        );

        /*
         * 幕が風景を沈めていないこと、副ボタンの文字が読めることは、
         * checkButtonPixels が画素で測っている（幕を外した画面との比較）。
         * CSS の文字列から濃さを読む検査は、楕円の幕では測れないためやめた。
         */

        // 人物の靴が主ボタンより上にある。
        check(
          castArt.y + castArt.height <= m.start.y + 0.5,
          `${label}: 人物が開始ボタンに重なっている（靴 ${(castArt.y + castArt.height).toFixed(1)} / ボタン上端 ${m.start.y.toFixed(1)}）`,
        );

        // 主操作が副操作より目立つ。副ボタン1つずつと比べる。
        const subButtons = m.buttons.filter((b) => b.text !== ' 旅をはじめる ' && !b.text.includes('旅をはじめる'));
        check(subButtons.length === 2, `${label}: 副操作が2つそろっていない（${subButtons.length}）`);
        for (const b of subButtons) {
          check(
            m.start.height > b.height,
            `${label}: 開始ボタンが「${b.text}」より高くない（${m.start.height.toFixed(1)} / ${b.height.toFixed(1)}）`,
          );
          check(
            m.start.width >= b.width - 0.5,
            `${label}: 開始ボタンが「${b.text}」より狭い（${m.start.width.toFixed(1)} / ${b.width.toFixed(1)}）`,
          );
        }
        check(
          m.startFontSize > m.subFontSize,
          `${label}: 開始ボタンの文字が副操作より大きくない（${m.startFontSize} / ${m.subFontSize}）`,
        );

        check(m.buttons.length === 3, `${label}: 表紙のボタンが3つそろっていない（${m.buttons.length}）`);
        for (const b of m.buttons) {
          check(
            b.x >= -0.5 && b.y >= -0.5 &&
              b.x + b.width <= m.viewport.width + 0.5 &&
              b.y + b.height <= m.viewport.height + 0.5,
            `${label}: 「${b.text}」が画面外へ出ている`,
          );
          check(
            b.width >= 44 && b.height >= 44,
            `${label}: 「${b.text}」のタップ領域が 44x44 未満（${b.width.toFixed(1)}x${b.height.toFixed(1)}）`,
          );
        }
        // ボタンどうしが重なっていない（重なると意図しないほうが押される）。
        for (let i = 0; i < m.buttons.length; i += 1) {
          for (let j = i + 1; j < m.buttons.length; j += 1) {
            check(
              !rectsOverlap(m.buttons[i], m.buttons[j]),
              `${label}: 「${m.buttons[i].text}」と「${m.buttons[j].text}」が重なっている`,
            );
          }
        }

        // 主操作と副操作がぶつかっていないこと。
        if (m.start && m.sub) {
          const gap = m.sub.y - (m.start.y + m.start.height);
          check(gap >= 0, `${label}: 主操作と副操作が重なっている（すきま ${gap.toFixed(1)}px）`);
        }

        check(!m.hScroll, `${label}: 表紙で横スクロールが発生している`);
        check(!m.vScroll, `${label}: 表紙が1画面に収まっていない`);
        check(
          m.lowestBottom <= m.viewport.height + 0.5,
          `${label}: 表紙の中身が画面の下からはみ出している（${m.lowestBottom.toFixed(1)} > ${m.viewport.height}）`,
        );

        // キーボードだけで旅を始められる。
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => document.activeElement?.className ?? '');
        check(
          focused.includes('t-start'),
          `${label}: Tab の最初で開始ボタンへ移らない（${focused}）`,
        );
        await page.keyboard.press('Enter');
        await page.waitForSelector('.screen--avatar-select', { timeout: 4000 }).catch(() => {});
        check(
          (await page.locator('.screen--avatar-select').count()) === 1,
          `${label}: キーボードの Enter で旅を始められない`,
        );

        check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);

        const globeOut = landmarkRect(m, LANDMARKS.globe);
        return ` 表紙  余白0 / 地球儀 ${globeOut.width.toFixed(0)}x${globeOut.height.toFixed(0)}px / 人物 ${(m.cast.width * (CAST_ART.r - CAST_ART.l)).toFixed(0)}x${(m.cast.height * (CAST_ART.b - CAST_ART.t)).toFixed(0)}px / 主ボタン ${m.start.width.toFixed(0)}x${m.start.height.toFixed(0)}px`;
      } finally {
        await context.close();
      }
    });
  }

  // ---- 1b. 切り欠きとホームバーがある端末でも表紙が成立する ----
  //
  // この環境では実機の安全領域を再現できないので、CSS変数へ値を差し込んで模す。
  // 実機（iPhone 15 Pro / Safari）での確認とは別のものとして扱う。
  for (const safe of [
    { top: 20, bottom: 34, sizes: [{ width: 320, height: 568 }] },
    {
      top: 59,
      bottom: 34,
      sizes: [
        { width: 393, height: 852 },
        { width: 393, height: 745 },
        { width: 430, height: 932 },
      ],
    },
  ]) {
    for (const viewport of safe.sizes) {
      const label = `安全領域 上${safe.top}/下${safe.bottom} ${viewport.width}x${viewport.height}`;
      await runCase(label, async () => {
        const context = await browser.newContext({ viewport });
        try {
          const page = await context.newPage();
          const jsErrors = [];
          page.on('pageerror', (e) => jsErrors.push(e.message));
          await page.goto(baseUrl, { waitUntil: 'networkidle' });
          await page.addStyleTag({
            content: `:root{--safe-top:${safe.top}px;--safe-bottom:${safe.bottom}px;}`,
          });
          await page
            .waitForFunction(
              () =>
                ['.t-bg', '.t-logo', '.t-cast'].every((sel) => {
                  const img = document.querySelector(sel);
                  return img !== null && img.complete && img.naturalWidth > 0;
                }),
              undefined,
              { timeout: 9000 },
            )
            .catch(() => {});
          await page.waitForTimeout(450);
          const m = await page.evaluate(titleMetrics);
          await checkButtonPixels(page, m, label, check);

          // 背景の左右に余白が出ていない。
          check(
            m.bgPainted.x <= 0.5 &&
              m.viewport.width - (m.bgPainted.x + m.bgPainted.width) <= 0.5,
            `${label}: 背景の左右に余白がある`,
          );

          const globe = landmarkRect(m, LANDMARKS.globe);
          const fuji = landmarkRect(m, LANDMARKS.fuji);
          const logoArt = artRect(m.logo, LOGO_ART);
          const castArt = artRect(m.cast, CAST_ART);

          const globeVisible = m.globeVisibleRatio;
          check(
            globeVisible !== null && globeVisible >= 0.45,
            `${label}: 地球儀が見えなくなっている（見えているのは ${globeVisible === null ? '不明' : (globeVisible * 100).toFixed(0) + '%'}）`,
          );
          check(
            m.summitCoveredByCast === false,
            `${label}: 富士山の山頂を人物が隠している`,
          );
          check(
            m.summitCoveredByLogo === false,
            `${label}: 富士山の山頂をロゴが隠している`,
          );

          // ロゴと人物が欠けていない。
          for (const [name, box] of [['ロゴ', logoArt], ['人物', castArt]]) {
            check(
              box.x >= -0.5 &&
                box.y >= -0.5 &&
                box.x + box.width <= m.viewport.width + 0.5 &&
                box.y + box.height <= m.viewport.height + 0.5,
              `${label}: ${name}が画面からはみ出している`,
            );
          }

          /*
           * 切り欠きがあると、ロゴは「安全領域から地球儀まで」の帯に
           * 押し込まれるので、切り欠きが無いときより小さくなる。
           * 幅は画面幅の比で決めているので、切り欠きがあっても変わらない。
           */
          const logoWidthRatio = logoArt.width / m.viewport.width;
          check(
            logoWidthRatio >= 0.7,
            `${label}: ロゴが小さい（画面幅の ${(logoWidthRatio * 100).toFixed(1)}%）`,
          );
          const walkway = walkwayFor(m.bgFile);
          for (const c of m.castContacts ?? []) {
            const edges = walkwayEdges(walkway, c.by);
            const margin = CONTACT_MARGIN[c.name] ?? 0;
            check(
              c.by > walkway.top,
              `${label}: ${c.name}が歩道より奥にある（背景の縦 ${(c.by * 100).toFixed(1)}%）`,
            );
            check(
              c.bx >= edges.left - margin && c.bx <= edges.right + margin,
              `${label}: ${c.name}の下に石畳が無い（背景の ${(c.bx * 100).toFixed(1)}%,${(c.by * 100).toFixed(1)}%）`,
            );
          }
          check(m.ground !== null, `${label}: 接地影が無い`);

          for (const lab of m.buttonLabels) {
            check(
              lab.height <= lab.fontSize * 1.7,
              `${label}: ボタンの文字が折り返している（${lab.text}）`,
            );
          }
          const castHeightRatio = castArt.height / m.viewport.height;
          check(
            castHeightRatio >= 0.4,
            `${label}: 人物が小さい（絵の高さが画面の ${(castHeightRatio * 100).toFixed(1)}%）`,
          );


          // 人物が主ボタンに重なっていない。
          check(
            castArt.y + castArt.height <= m.start.y + 0.5,
            `${label}: 人物が開始ボタンに重なっている（靴 ${(castArt.y + castArt.height).toFixed(1)} / ボタン ${m.start.y.toFixed(1)}）`,
          );

          // 操作は安全領域の内側にあり、44x44 以上で、重なっていない。
          for (const b of m.buttons) {
            check(
              b.x >= -0.5 &&
                b.y >= safe.top - 0.5 &&
                b.x + b.width <= m.viewport.width + 0.5 &&
                b.y + b.height <= m.viewport.height - safe.bottom + 0.5,
              `${label}: 「${b.text}」が安全領域の外にある`,
            );
            check(
              b.width >= 44 && b.height >= 44,
              `${label}: 「${b.text}」のタップ領域が 44x44 未満（${b.width.toFixed(1)}x${b.height.toFixed(1)}）`,
            );
          }
          for (let i = 0; i < m.buttons.length; i += 1) {
            for (let j = i + 1; j < m.buttons.length; j += 1) {
              check(
                !rectsOverlap(m.buttons[i], m.buttons[j]),
                `${label}: 「${m.buttons[i].text}」と「${m.buttons[j].text}」が重なっている`,
              );
            }
          }
          check(!m.hScroll, `${label}: 横スクロールが発生している`);
          check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);
          return ` 余白0 / 地球儀が見える / 山頂が見える / 44px充足 / 安全領域内`;
        } finally {
          await context.close();
        }
      });
    }
  }

  // ---- 2. キャラクター選択から日本到着・国紹介・カルタ・結果まで進める ----
  {
    const tag = '通し操作';
    await runCase(tag, async () => {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
      try {
        const page = await context.newPage();
        const jsErrors = [];
        page.on('pageerror', (e) => jsErrors.push(e.message));

        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '旅をはじめる' }).click();

        // 初回起動なので、80人からのキャラクター選択が挟まる。
        await page.waitForSelector('.screen--avatar-select');
        check(
          await page.locator('.screen--avatar-select').count() === 1,
          `${tag}: 初回にキャラクター選択が出ない`,
        );
        await page.getByRole('tab', { name: '小学生' }).click();
        await page.locator('.avatar-card').first().click();
        const chosenId = await page.locator('.avatar-card[aria-selected="true"]').getAttribute('data-avatar-id');
        await page.getByRole('button', { name: 'この人を選ぶ' }).click();

        await page.waitForSelector('.screen--avatar-confirm');
        await page.getByRole('button', { name: 'この人になって旅をはじめる' }).click();

        await page.waitForSelector('.option-card--category');

        // ステップ別を開き、試験名が画面に出ないことと、準備中の案内が読めることを見る。
        // 語彙はことばトラベルが独自に選ぶので、検定・試験に準拠しているとは見せない。
        await page.getByRole('button', { name: /ステップ別/ }).click();
        await page.waitForSelector('.course-group');
        const stepText = await page.evaluate(() => document.body.innerText);
        for (const word of ['英検', 'TOEIC', '資格', '級', '点']) {
          check(!stepText.includes(word), `${tag}: ステップ別の画面に「${word}」が出ている`);
        }
        check(
          stepText.includes('各ステップのことばは準備中です。現在は共通の練習用ことばで遊べます。'),
          `${tag}: ステップ別の準備中の案内が読めない`,
        );
        check(
          (await page.getByRole('button', { name: 'ステップ1' }).count()) === 2,
          `${tag}: ステップ1が2グループぶん出ていない`,
        );
        await page.getByRole('button', { name: 'もどる' }).click();
        await page.waitForSelector('.option-card--category');

        await page.getByRole('button', { name: /学年別/ }).click();
        // 学年別には、ステップ別の案内を出さない。
        const gradeText = await page.evaluate(() => document.body.innerText);
        check(
          !gradeText.includes('各ステップのことばは準備中です'),
          `${tag}: 学年別にステップ別の案内が出ている`,
        );
        await page.getByRole('button', { name: '小学生' }).click();

        // コース選択のあとは、旧「コース連動キャラクター」画面を挟まず枚数選択へ進む。
        check(
          await page.locator('.screen--characters').count() === 0,
          `${tag}: 廃止した旧キャラクター画面がまだ導線に残っている`,
        );
        await page.getByRole('button', { name: /^6枚/ }).click();
        await page.getByRole('button', { name: '出発する' }).click();

        check(await page.locator('.screen--travel').count() === 1, `${tag}: 移動演出が出ない`);
        check(await page.getByRole('button', { name: 'スキップ' }).isVisible(), `${tag}: スキップできない`);

        // 搭乗券の絵は、行き先の国の正式イラスト。
        const ticketSrc = await page.locator('.travel__ticket .chara-card__img').getAttribute('src');
        check(
          ticketSrc.includes('assets/countries/japan-adopted'),
          `${tag}: 日本へ向かうのに日本の絵が出ていない（${ticketSrc}）`,
        );
        // 読み込みとデコードが終わるのを待ってから測る。
        // 即座に naturalWidth を見ると、実体があっても 0 のことがある。
        const ticketLoaded = await page
          .waitForFunction(
            () => {
              const img = document.querySelector('.travel__ticket .chara-card__img');
              return img !== null && img.complete && img.naturalWidth > 0;
            },
            undefined,
            { timeout: 5000 },
          )
          .then(() => true)
          .catch(() => false);
        check(ticketLoaded, `${tag}: 行き先の正式イラストが読み込めていない`);
        // 旅をするのは利用者が選んだ本人。
        // 表紙のパイロットと CA、年代別の2人組は、本人としても同行者としても出さない。
        const travelImages = await page.evaluate(() =>
          [...document.images].map((i) => i.getAttribute('src') ?? ''),
        );
        check(
          travelImages.every((src) => !src.includes('assets/characters/')),
          `${tag}: 移動画面に年代別の2人組イラストが出ている（${travelImages.join(' ')}）`,
        );
        check(
          travelImages.every((src) => !src.includes('title-adopted-pilot-ca')),
          `${tag}: 移動画面に表紙のパイロットと CA が出ている`,
        );
        check(
          await page.locator('.travel__me .avatar-thumb').count() === 1,
          `${tag}: 移動画面に自分のキャラクターが出ていない`,
        );
        // 本人かどうかは、名前や並び順ではなく画像のIDで照合する。
        const travelMeSrc = await page
          .locator('.travel__me .avatar-thumb__img')
          .getAttribute('src');
        check(
          travelMeSrc.includes(`/avatars/${chosenId}.webp`),
          `${tag}: 移動画面の本人が選んだ人と違う（${travelMeSrc} / 選択 ${chosenId}）`,
        );
        await page.getByRole('button', { name: 'スキップ' }).click();

        check(await page.locator('.screen--intro').count() === 1, `${tag}: 国紹介が出ない`);
        // 到着直後は要点だけを出し、長い説明は「もっと知る」の中に閉じてある。
        check(
          await page.locator('.intro__more:not([hidden])').count() === 0,
          `${tag}: 到着直後から詳細が開いている`,
        );
        // 日本は事実の本文確認が終わっていないため、国紹介は下書き表示。
        // 事実の文章は出さず、準備中の案内だけを出す。
        check(
          await page.locator('.intro__preparing').count() === 1,
          `${tag}: 準備中の案内が出ていない`,
        );
        check(
          await page.locator('.intro__summary').count() === 0,
          `${tag}: 下書きなのに紹介文が出ている`,
        );
        // 到着記念の絵は、その国の正式イラスト。
        const introSrc = await page.locator('.intro__photo .chara-card__img').getAttribute('src');
        check(
          introSrc.includes('assets/countries/japan-adopted'),
          `${tag}: 国紹介に日本の絵が出ていない（${introSrc}）`,
        );
        const introAlt = await page.locator('.intro__photo .chara-card__img').getAttribute('alt');
        check(introAlt.length > 8, `${tag}: 国の絵に代替テキストが無い`);
        for (const word of ['一望', '見わたせ', '見渡せ']) {
          check(!introAlt.includes(word), `${tag}: 国の絵の説明に「${word}」が入っている`);
        }
        const introImages = await page.evaluate(() =>
          [...document.images].map((i) => i.getAttribute('src') ?? ''),
        );
        check(
          introImages.every((src) => !src.includes('assets/characters/')),
          `${tag}: 国紹介に年代別の2人組イラストが出ている`,
        );
        check(
          introImages.every((src) => !src.includes('title-adopted-pilot-ca')),
          `${tag}: 国紹介に表紙のパイロットと CA が出ている`,
        );
        // 国紹介には自分のキャラクターと NPC を置く構造が残っている。
        check(
          await page.locator('.intro__cast-me .avatar-thumb').count() === 1,
          `${tag}: 国紹介に自分のキャラクターの置き場所が無い`,
        );
        const introMeSrc = await page
          .locator('.intro__cast-me .avatar-thumb__img')
          .getAttribute('src');
        check(
          introMeSrc.includes(`/avatars/${chosenId}.webp`),
          `${tag}: 国紹介の本人が選んだ人と違う（${introMeSrc} / 選択 ${chosenId}）`,
        );
        const companions = await page.locator('.intro__cast-npc').count();
        check(companions >= 1, `${tag}: 国紹介に NPC の置き場所が無い`);
        const meOnIntro = await page.locator('.intro__cast-npc [data-avatar-id]').count();
        check(meOnIntro === 0 || chosenId !== null, `${tag}: 同行者の取得に失敗`);
        await page.getByRole('button', { name: 'この国でことばを集める' }).click();

        await page.waitForSelector('.card');
        while ((await page.locator('.card:not(.is-matched)').count()) > 0) {
          const id = await page.locator('.card:not(.is-matched)').first().getAttribute('data-card-id');
          const pid = id.split('-')[0];
          await page.locator(`[data-card-id="${pid}-ja"]`).click();
          await page.locator(`[data-card-id="${pid}-en"]`).click();
          await page.waitForSelector('.pronounce', { timeout: 4000 });
          await page.getByRole('button', { name: 'つぎへ' }).click();
          await page.waitForTimeout(70);
        }

        // ウェーブ終了のチャットを閉じてから結果へ。
        await page.waitForSelector('.chat', { timeout: 5000 });
        await page.locator('.chat__choice').first().click();
        await page.waitForTimeout(200);
        await page.getByRole('button', { name: 'とじる' }).first().click();

        // 確認テストは結果画面より前に入る。結果画面には答えが並ぶため。
        await page.waitForSelector('.screen--quiz-prompt', { timeout: 5000 });
        check(
          await page.locator('.screen--result').count() === 0,
          `${tag}: 確認テストより先に結果画面が出ている`,
        );
        check(
          await page.getByRole('button', { name: 'テストを受ける' }).count() === 1,
          `${tag}: 確認テストへの導線が無い`,
        );
        // ここではスキップ経路を通す。受験経路は directInputQuiz 側で確認する。
        await page.getByRole('button', { name: '今回はスキップ' }).click();

        await page.waitForSelector('.screen--result', { timeout: 5000 });
        await page.getByRole('button', { name: '旅をつづける' }).click();
        await page.waitForSelector('.screen--map', { timeout: 5000 });
        check(await page.locator('.screen--map').count() === 1, `${tag}: 結果から世界地図へ戻れない`);

        const stored = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('kotoba-journey/learning-record/v1')),
        );
        check(stored.version === 3, `${tag}: 保存が version 3 になっていない（${stored.version}）`);
        check(stored.selectedCourseId === 'grade-elementary', `${tag}: コース選択が保存されていない`);
        check(stored.selectedAvatarId === chosenId, `${tag}: 選んだキャラクターが保存されていない`);
        check(stored.characterAgeGroup === null, `${tag}: 旧年齢層設定は未設定のままであるべき`);
        check(stored.quizHistory.length === 1, `${tag}: 確認テストの記録が残っていない`);
        check(
          stored.quizHistory[0].status === 'skipped',
          `${tag}: スキップが skipped として保存されていない`,
        );
        check(
          stored.quizHistory[0].incorrectPairIds.length === 0,
          `${tag}: スキップを不正解として数えている`,
        );
        check(stored.seenTravelIntros.includes('japan'), `${tag}: 到着演出の既読が残っていない`);
        check(stored.totalPlays === 1, `${tag}: 通常カルタの記録が二重加算されている`);
        check(jsErrors.length === 0, `${tag}: JavaScript エラー: ${jsErrors.join(' / ')}`);

        return '（表紙→選択→旅→国紹介→カルタ→確認テスト→結果）';
      } finally {
        await context.close();
      }
    });
  }

  // ---- 3. prefers-reduced-motion でも必須情報が失われない ----
  {
    await runCase('prefers-reduced-motion', async () => {
      const context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);

        const m = await page.evaluate(titleMetrics);
        check(m.bgLoaded, 'reduced-motion: 背景が読み込めていない');
        check(m.logoLoaded, 'reduced-motion: ロゴが読み込めていない');
        check(m.castLoaded, 'reduced-motion: 人物が読み込めていない');
        check(m.start !== null && m.start.width > 0, 'reduced-motion: 開始ボタンが見えない');
        check(m.buttons.length === 3, 'reduced-motion: 表紙のボタンが欠けている');

        await page.getByRole('button', { name: '旅をはじめる' }).click();
        await page.waitForSelector('.screen--avatar-select');
        await page.locator('.avatar-card').first().click();
        await page.getByRole('button', { name: 'この人を選ぶ' }).click();
        await page.waitForSelector('.screen--avatar-confirm');
        await page.getByRole('button', { name: 'この人になって旅をはじめる' }).click();
        await page.getByRole('button', { name: /学年別/ }).click();
        await page.getByRole('button', { name: '小学生' }).click();
        await page.getByRole('button', { name: /^6枚/ }).click();
        await page.getByRole('button', { name: '出発する' }).click();
        await page.waitForSelector('.screen--travel');

        const travel = await page.evaluate(() => {
          const visible = (sel) => {
            const n = document.querySelector(sel);
            if (!n) return false;
            const r = n.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          return {
            from: document.querySelector('.travel__pin--from')?.textContent ?? '',
            to: document.querySelector('.travel__pin--to')?.textContent ?? '',
            vehicle: visible('.travel__vehicle'),
            skip: visible('.travel__bar .btn'),
          };
        });
        check(travel.from.length > 0, 'reduced-motion: 出発地が表示されない');
        check(travel.to.length > 0, 'reduced-motion: 到着地が表示されない');
        check(travel.vehicle, 'reduced-motion: 移動表現が見えない');
        check(travel.skip, 'reduced-motion: スキップボタンが見えない');

        return ' で必須情報が残る';
      } finally {
        await context.close();
      }
    });
  }

  // ---- 4. 長い札の文字が切れない（20枚の最小札） ----
  //
  // 20枚の盤面は札がいちばん小さい。基準の文字サイズのままだと、
  // 74「コンピューター」のような長い語が3行になり、札の下が切れていた。
  // 札は overflow: hidden なので、切れた行は読めないまま消える。
  //
  // いまは、収まらない札だけ文字を小さくする。短い札は基準のまま。
  // seed を固定して、74・3・28・89 が必ず同じ盤面に出るようにしている。
  {
    // Date.now と Math.random を固定すると createSeed() が決まる。
    // 工程V-2O-1で共通セットが105語になり盤面が変わったので、
    // 本番の selectPairs() で予測して取り直した値。
    // この now では 20枚（10語）の盤面が 3,11,28,51,53,54,74,89,94,95 になる。
    const FIXED_NOW = 1700000000781;
    const BOARD_PAIR_IDS = [3, 11, 28, 51, 53, 54, 74, 89, 94, 95];
    /** 文字を小さくしてはいけない短い語。基準の大きさのままであること。 */
    const SHORT_WORDS = [
      [3, 'あお', 'blue'],
      [28, 'たべる', 'eat'],
      [89, 'あける', 'open'],
    ];
    /** 切れていた長い語。全文が残り、11px 以上で読めること。 */
    const LONG_WORD = [74, 'コンピューター', 'computer'];
    const MIN_FONT_PX = 11;

    for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }]) {
      const label = `${viewport.width}x${viewport.height} 20枚の長い札`;
      await runCase(label, async () => {
        const context = await browser.newContext({ viewport });
        await context.addInitScript((now) => {
          Date.now = () => now;
          Math.random = () => 0;
        }, FIXED_NOW);
        try {
          const page = await context.newPage();
          const jsErrors = [];
          page.on('pageerror', (e) => jsErrors.push(e.message));

          await page.goto(baseUrl, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: '旅をはじめる' }).click();
          await page.waitForSelector('.screen--avatar-select');
          await page.locator('.avatar-card').first().click();
          await page.getByRole('button', { name: 'この人を選ぶ' }).click();
          await page.waitForSelector('.screen--avatar-confirm');
          await page.getByRole('button', { name: 'この人になって旅をはじめる' }).click();
          await page.waitForSelector('.option-card--category');
          // 日常英会話は共通の105語を使うので、74 を盤面へ出せる。
          await page.getByRole('button', { name: /社会人/ }).click();
          await page.waitForSelector('.course-group');
          await page.getByRole('button', { name: '日常英会話', exact: true }).click();
          await page.getByRole('button', { name: /^20枚/ }).click();
          await page.getByRole('button', { name: '出発する' }).click();
          await page.waitForSelector('.screen--travel');
          await page.getByRole('button', { name: 'スキップ' }).click();
          await page.waitForSelector('.screen--intro');
          await page.getByRole('button', { name: 'この国でことばを集める' }).click();
          await page.waitForSelector('.card');
          await page.waitForTimeout(300);

          const shot = await page.evaluate(() => {
            const cards = [...document.querySelectorAll('.card')].map((card) => {
              const text = card.querySelector('.card__text');
              const style = getComputedStyle(card);
              const inset =
                (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
              return {
                id: card.getAttribute('data-card-id'),
                text: text.textContent,
                fontSize: parseFloat(style.fontSize),
                // 札は傾けてあるので getBoundingClientRect は使わない。
                // 回転前のレイアウト上の大きさで、内側に収まっているかを見る。
                innerHeight: card.clientHeight - inset,
                innerWidth: text.clientWidth,
                textHeight: text.offsetHeight,
                textWidth: text.scrollWidth,
              };
            });
            return {
              cards,
              hScroll:
                document.documentElement.scrollWidth - document.documentElement.clientWidth,
            };
          });

          const byId = new Map(shot.cards.map((c) => [c.id, c]));
          check(shot.cards.length === 20, `${label}: 札が20枚ない（${shot.cards.length}）`);
          check(
            JSON.stringify(
              [...new Set(shot.cards.map((c) => Number(c.id.split('-')[0])))].sort((a, b) => a - b),
            ) === JSON.stringify(BOARD_PAIR_IDS),
            `${label}: 固定seedの盤面が想定と違う（${shot.cards.map((c) => c.id).join(',')}）`,
          );

          // --- どの札も、文字が枠の内側に収まっている ---
          for (const card of shot.cards) {
            check(
              card.textWidth <= card.innerWidth + 0.5,
              `${label}: ${card.id}「${card.text}」が横へはみ出している（${card.textWidth} > ${card.innerWidth}）`,
            );
            check(
              card.textHeight <= card.innerHeight + 0.5,
              `${label}: ${card.id}「${card.text}」が縦に切れている（${card.textHeight} > ${card.innerHeight}）`,
            );
            check(
              card.fontSize >= MIN_FONT_PX,
              `${label}: ${card.id}「${card.text}」の文字が ${MIN_FONT_PX}px 未満（${card.fontSize}）`,
            );
          }
          check(shot.hScroll <= 0, `${label}: 横スクロールが出ている（${shot.hScroll}px）`);

          // --- 長い語は、省略も欠落もなく全文が残っている ---
          const [longId, longJa, longEn] = LONG_WORD;
          for (const [lang, expected] of [['ja', longJa], ['en', longEn]]) {
            const card = byId.get(`${longId}-${lang}`);
            check(card !== undefined, `${label}: ${longId}-${lang} の札が無い`);
            if (!card) continue;
            // 「…」で省略したり、一部を消したりしていない。
            check(
              card.text === expected,
              `${label}: ${longId}-${lang} の文字が全文でない（${card.text}）`,
            );
            check(
              card.textHeight <= card.innerHeight + 0.5,
              `${label}: ${longId}-${lang}「${expected}」が縦に切れている（${card.textHeight} > ${card.innerHeight}）`,
            );
            check(
              card.fontSize >= MIN_FONT_PX,
              `${label}: ${longId}-${lang} の文字が ${MIN_FONT_PX}px 未満（${card.fontSize}）`,
            );
          }

          // --- 短い語は、基準の大きさのまま。全札を一律に小さくしていない ---
          const base = Math.max(...shot.cards.map((c) => c.fontSize));
          for (const [shortId, ja, en] of SHORT_WORDS) {
            for (const [lang, expected] of [['ja', ja], ['en', en]]) {
              const card = byId.get(`${shortId}-${lang}`);
              check(card !== undefined, `${label}: ${shortId}-${lang} の札が無い`);
              if (!card) continue;
              check(card.text === expected, `${label}: ${shortId}-${lang} の文字が違う（${card.text}）`);
              check(
                card.fontSize === base,
                `${label}: ${shortId}-${lang}「${expected}」が不要に小さくなっている（${card.fontSize} < ${base}）`,
              );
            }
          }

          const long = byId.get(`${longId}-ja`);
          check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);
          return ` 基準${base.toFixed(1)}px / コンピューター${long.fontSize.toFixed(1)}px・${long.textHeight}px（枠内${long.innerHeight}px）`;
        } finally {
          await context.close();
        }
      });
    }
  }
} finally {
  await browser.close();
  server.close();
}

finish();
