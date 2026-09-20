/**
 * 発音確認パネルの表示回帰テスト。
 *
 * ボタン幅や折り返しは CSS レイアウトの結果なので、jsdom では検証できない。
 * 実ブラウザ（Chromium）で実際に描画して、以下を確認する。
 *
 *   1. 「もういちど聞く」がパネル内に収まる
 *   2. 「つぎへ」がパネル内に収まる
 *   3. 両ボタンの外接矩形が重ならない
 *   4. 両ボタンの scrollWidth <= clientWidth
 *   5. パネルに横方向の overflow がない
 *
 * 加えて、文言を省略せず1行で全文表示していること・タップ領域 44x44 以上・
 * 横スクロールなし・背景カードを誤操作できない入力ロックも確認する。
 *
 * 実行: npm run test:visual  （事前に npm run build が必要）
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../dist', import.meta.url));
const BASE_PATH = '/kotoba-journey/';

/** 検証対象の画面サイズ。 */
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
};

/** dist/ を BASE_PATH 配下で配る最小サーバー。外部依存を増やさないため自前で用意する。 */
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

/** 正解を1回出して発音確認パネルを開く。 */
async function openPronunciationPanel(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '旅をはじめる' }).click();
  // Phase 1 で主人公選択が入った。初回のみ表示されるので、出ていれば通過する。
  if ((await page.locator('.screen--characters').count()) > 0) {
    await page.getByRole('button', { name: /女の子の主人公/ }).click();
  }
  await page.getByRole('button', { name: /学年別/ }).click();
  await page.getByRole('button', { name: '小学生' }).click();
  await page.getByRole('button', { name: /^6枚/ }).click();
  await page.getByRole('button', { name: '出発する' }).click();
  // Phase 1 で移動演出と国紹介が入った。演出はスキップして盤面まで進む。
  await page.waitForSelector('.screen--travel');
  await page.getByRole('button', { name: 'スキップ' }).click();
  await page.waitForSelector('.screen--intro');
  await page.getByRole('button', { name: 'カルタをはじめる' }).click();
  await page.waitForSelector('.card');

  const cardId = await page.locator('.card').first().getAttribute('data-card-id');
  const pairId = cardId.split('-')[0];
  await page.locator(`[data-card-id="${pairId}-ja"]`).click();
  await page.locator(`[data-card-id="${pairId}-en"]`).click();
  await page.waitForSelector('.pronounce');
}

/** パネルとボタンの実測値を集める。 */
function collectMetrics() {
  const panel = document.querySelector('.pronounce');
  const actions = document.querySelector('.pronounce__actions');
  const panelRect = panel.getBoundingClientRect();

  const buttons = [...actions.querySelectorAll('button')].map((el) => {
    const rect = el.getBoundingClientRect();
    // 実際に描画された行数を Range の矩形から数え、途中で折り返していないか確かめる。
    const range = document.createRange();
    range.selectNodeContents(el);
    const textRects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    const lines = new Set(textRects.map((r) => Math.round(r.top))).size;
    const textBox = {
      left: Math.min(...textRects.map((r) => r.left)),
      right: Math.max(...textRects.map((r) => r.right)),
      top: Math.min(...textRects.map((r) => r.top)),
      bottom: Math.max(...textRects.map((r) => r.bottom)),
    };
    return {
      text: el.textContent,
      lines,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      textInsideButton:
        textBox.left >= rect.left - 0.5 &&
        textBox.right <= rect.right + 0.5 &&
        textBox.top >= rect.top - 0.5 &&
        textBox.bottom <= rect.bottom + 0.5,
      insidePanel:
        rect.left >= panelRect.left - 0.5 &&
        rect.top >= panelRect.top - 0.5 &&
        rect.right <= panelRect.right + 0.5 &&
        rect.bottom <= panelRect.bottom + 0.5,
    };
  });

  const [a, b] = buttons.map((x) => x.rect);
  const overlayRect = document.querySelector('.overlay').getBoundingClientRect();
  const topPoint = document.elementFromPoint(
    overlayRect.left + overlayRect.width / 2,
    overlayRect.top + 5,
  );

  return {
    buttons,
    panelNoXOverflow: panel.scrollWidth <= panel.clientWidth,
    actionsNoXOverflow: actions.scrollWidth <= actions.clientWidth,
    buttonsOverlap:
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height,
    panelInViewport:
      panelRect.left >= -0.5 &&
      panelRect.top >= -0.5 &&
      panelRect.right <= window.innerWidth + 0.5 &&
      panelRect.bottom <= window.innerHeight + 0.5,
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    // オーバーレイが背景カードへのタップを受け止めている（入力ロック維持）。
    overlayBlocksInput: topPoint !== null && topPoint.closest('.overlay') !== null,
  };
}

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

try {
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', (error) => jsErrors.push(error.message));

    await openPronunciationPanel(page, baseUrl);
    const metrics = await page.evaluate(collectMetrics);

    const replay = metrics.buttons.find((b) => b.text === 'もういちど聞く');
    const next = metrics.buttons.find((b) => b.text === 'つぎへ');

    check(replay !== undefined, `${label}: 「もういちど聞く」ボタンが見つからない`);
    check(next !== undefined, `${label}: 「つぎへ」ボタンが見つからない`);

    for (const button of metrics.buttons) {
      const name = `${label}: 「${button.text}」`;
      check(button.insidePanel, `${name} がパネル外へ出ている`);
      check(button.scrollWidth <= button.clientWidth, `${name} に横方向のはみ出しがある`);
      check(button.scrollHeight <= button.clientHeight, `${name} に縦方向のはみ出しがある`);
      check(button.lines === 1, `${name} が ${button.lines} 行に折り返している（全文1行表示が必要）`);
      check(button.textInsideButton, `${name} の文字がボタン外へ出ている`);
      check(
        button.rect.width >= 44 && button.rect.height >= 44,
        `${name} のタップ領域が 44x44 未満（${button.rect.width}x${button.rect.height}）`,
      );
    }

    check(!metrics.buttonsOverlap, `${label}: 2つのボタンの外接矩形が重なっている`);
    check(metrics.panelNoXOverflow, `${label}: パネルに横方向の overflow がある`);
    check(metrics.actionsNoXOverflow, `${label}: ボタン行に横方向の overflow がある`);
    check(metrics.panelInViewport, `${label}: パネルが画面内に収まっていない`);
    check(!metrics.hScroll, `${label}: 横スクロールが発生している`);
    check(metrics.overlayBlocksInput, `${label}: 背景カードへの入力ロックが効いていない`);
    check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);

    if (failures.length === 0) {
      console.log(
        `✓ ${label}  もういちど聞く=${replay.rect.width.toFixed(1)}px(1行)  つぎへ=${next.rect.width.toFixed(1)}px(1行)`,
      );
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error('\n表示回帰テスト 失敗:');
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(`\n表示回帰テスト 成功（${VIEWPORTS.length}サイズ × 6項目）`);
