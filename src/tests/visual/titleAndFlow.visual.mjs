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
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../dist', import.meta.url));
const BASE_PATH = '/kotoba-journey/';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 393, height: 852 },
  { width: 402, height: 874 },
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

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** 表紙の実測値を集める。 */
function titleMetrics() {
  const pick = (sel) => {
    const node = document.querySelector(sel);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  const buttons = [...document.querySelectorAll('.title__actions button')].map((el) => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), x: r.x, y: r.y, width: r.width, height: r.height };
  });
  return {
    logo: pick('.title__logo'),
    mascot: pick('.title__mascot'),
    background: pick('.title__bg'),
    buttons,
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    vScroll: document.documentElement.scrollHeight > window.innerHeight + 1,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    // 画像が実際に復号できたか（読み込み失敗の検出）。
    logoLoaded: document.querySelector('.title__logo')?.naturalWidth > 0,
    bgLoaded: document.querySelector('.title__bg')?.naturalWidth > 0,
    mascotLoaded: document.querySelector('.title__mascot')?.naturalWidth > 0,
  };
}

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  // ---- 1. 正式表紙が5サイズで成立する ----
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const m = await page.evaluate(titleMetrics);

    check(m.logoLoaded, `${label}: 表紙ロゴが読み込めていない`);
    check(m.bgLoaded, `${label}: 表紙背景が読み込めていない`);
    check(m.mascotLoaded, `${label}: 案内キャラクターが読み込めていない`);

    for (const [name, box] of [['ロゴ', m.logo], ['キャラクター', m.mascot]]) {
      check(box !== null, `${label}: ${name}が存在しない`);
      if (!box) continue;
      check(box.x >= -0.5, `${label}: ${name}が左へはみ出している`);
      check(box.y >= -0.5, `${label}: ${name}が上へはみ出している`);
      check(box.x + box.width <= m.viewport.width + 0.5, `${label}: ${name}が右へはみ出している`);
      check(box.y + box.height <= m.viewport.height + 0.5, `${label}: ${name}が下へはみ出している`);
    }

    check(m.buttons.length === 3, `${label}: 表紙のボタンが3つそろっていない`);
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

    // ロゴ・キャラクター・ボタンが互いに重ならない。
    if (m.logo && m.mascot) {
      check(!rectsOverlap(m.logo, m.mascot), `${label}: ロゴとキャラクターが重なっている`);
    }
    for (const b of m.buttons) {
      if (m.logo) check(!rectsOverlap(m.logo, b), `${label}: ロゴと「${b.text}」が重なっている`);
      if (m.mascot) check(!rectsOverlap(m.mascot, b), `${label}: キャラクターと「${b.text}」が重なっている`);
    }

    check(!m.hScroll, `${label}: 表紙で横スクロールが発生している`);
    check(!m.vScroll, `${label}: 表紙が1画面に収まっていない`);
    check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);

    if (failures.length === 0) {
      console.log(`✓ ${label} 表紙  ロゴ ${m.logo.width.toFixed(0)}px / キャラ ${m.mascot.width.toFixed(0)}px`);
    }
    await context.close();
  }

  // ---- 2. 主人公選択から日本到着・国紹介・カルタまで進める ----
  for (const quizPath of ['take', 'skip']) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    const tag = quizPath === 'take' ? 'テストを受ける経路' : 'スキップ経路';

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '旅をはじめる' }).click();
    await page.getByRole('button', { name: /学年別/ }).click();
    await page.getByRole('button', { name: '小学生' }).click();

    // コース選択のあとに、そのコースの年齢層の2人が出る。
    check(await page.locator('.screen--characters').count() === 1, `${tag}: コース別キャラクターが出ない`);
    const charaSrc = await page.locator('.chara-card__img').first().getAttribute('src');
    check(
      charaSrc.includes('elementary'),
      `${tag}: 小学生コースで小学生の画像が出ていない（${charaSrc}）`,
    );
    const charaLoaded = await page.evaluate(
      () => document.querySelector('.chara-card__img')?.naturalWidth > 0,
    );
    check(charaLoaded, `${tag}: キャラクター画像が読み込めていない`);
    await page.getByRole('button', { name: 'つぎへ' }).click();

    await page.getByRole('button', { name: /^6枚/ }).click();
    await page.getByRole('button', { name: '出発する' }).click();

    check(await page.locator('.screen--travel').count() === 1, `${tag}: 移動演出が出ない`);
    check(await page.getByRole('button', { name: 'スキップ' }).isVisible(), `${tag}: スキップできない`);
    await page.getByRole('button', { name: 'スキップ' }).click();

    check(await page.locator('.screen--intro').count() === 1, `${tag}: 国紹介が出ない`);
    const cardCount = await page.locator('.intro-card').count();
    check(cardCount >= 2 && cardCount <= 3, `${tag}: 国紹介カードが2〜3枚でない（${cardCount}枚）`);
    await page.getByRole('button', { name: 'カルタをはじめる' }).click();

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

    await page.waitForSelector('.screen--result', { timeout: 5000 });
    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.waitForSelector('.screen--quiz-prompt', { timeout: 5000 });

    check(
      await page.getByRole('button', { name: 'テストを受ける' }).isVisible(),
      `${tag}: 「テストを受ける」が表示されない`,
    );
    check(
      await page.getByRole('button', { name: '今回はスキップ' }).isVisible(),
      `${tag}: 「今回はスキップ」が表示されない`,
    );

    if (quizPath === 'take') {
      await page.getByRole('button', { name: 'テストを受ける' }).click();
      await page.waitForSelector('.screen--quiz', { timeout: 5000 });
      let asked = 0;
      while ((await page.locator('.screen--quiz').count()) > 0 && asked < 10) {
        const choice = page.locator('.quiz-choice:not([disabled])').first();
        if ((await choice.count()) === 0) break;
        await choice.click();
        asked += 1;
        await page.waitForTimeout(820);
      }
      await page.waitForSelector('.screen--quiz-result', { timeout: 6000 });
      check(asked >= 3 && asked <= 5, `${tag}: 出題数が3〜5問でない（${asked}問）`);
      check(
        await page.getByRole('button', { name: '次のウェーブへ' }).isVisible(),
        `${tag}: テスト結果から次へ進めない`,
      );
      await page.getByRole('button', { name: '次のウェーブへ' }).click();
    } else {
      await page.getByRole('button', { name: '今回はスキップ' }).click();
    }

    await page.waitForSelector('.screen--map', { timeout: 5000 });
    check(await page.locator('.screen--map').count() === 1, `${tag}: 次へ進めていない`);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kotoba-journey/learning-record/v1')),
    );
    check(stored.selectedCourseId === 'grade-elementary', `${tag}: コース選択が保存されていない`);
    check(stored.characterAgeGroup === null, `${tag}: 年齢層は未設定のままであるべき`);
    check(stored.quizHistory.length === 1, `${tag}: テストの記録が残っていない`);
    check(
      stored.quizHistory[0].status === (quizPath === 'take' ? 'completed' : 'skipped'),
      `${tag}: テストの受験状態が正しく保存されていない`,
    );
    check(stored.totalPlays === 1, `${tag}: 通常カルタの記録が二重加算されている`);
    check(jsErrors.length === 0, `${tag}: JavaScript エラー: ${jsErrors.join(' / ')}`);

    if (failures.length === 0) console.log(`✓ ${tag} 通し操作`);
    await context.close();
  }

  // ---- 3. prefers-reduced-motion でも必須情報が失われない ----
  {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const m = await page.evaluate(titleMetrics);
    check(m.logo !== null && m.logo.width > 0, 'reduced-motion: ロゴが見えない');
    check(m.mascot !== null && m.mascot.width > 0, 'reduced-motion: キャラクターが見えない');
    check(m.buttons.length === 3, 'reduced-motion: 表紙のボタンが欠けている');

    await page.getByRole('button', { name: '旅をはじめる' }).click();
    await page.getByRole('button', { name: /学年別/ }).click();
    await page.getByRole('button', { name: '小学生' }).click();
    await page.getByRole('button', { name: 'つぎへ' }).click();
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

    if (failures.length === 0) console.log('✓ prefers-reduced-motion で必須情報が残る');
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error('\nPhase 1 表示・操作テスト 失敗:');
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log('\nPhase 1 表示・操作テスト 成功');
