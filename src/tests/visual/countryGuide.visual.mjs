/**
 * Phase 1-C3 の表示・操作回帰テスト（国紹介）。
 *
 * CSS レイアウトと開閉の結果は jsdom では測れないため、
 * 実ブラウザ（Chromium）でビルド済みの dist/ を描画して検証する。
 *
 * 実行: npm run test:visual:country （事前に npm run build が必要）
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
  { width: 393, height: 852 },
  { width: 430, height: 932 },
];

/** 「もっと知る」に並ぶカード。data-section で照合する。 */
const SECTIONS = ['cities', 'nature', 'climate', 'landmarks', 'foods', 'history', 'culture', 'words'];

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

/** 画面の外へ出ているボタン・リンクを数える。 */
function offscreenControls() {
  return [...document.querySelectorAll('.screen--intro button, .screen--intro a')]
    .filter((node) => {
      const r = node.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      return r.left < -0.5 || r.right > window.innerWidth + 0.5;
    })
    .map((node) => node.textContent.trim());
}

/** タップ領域が 44x44 未満のボタンを数える。 */
function smallControls() {
  return [...document.querySelectorAll('.screen--intro button')]
    .filter((node) => {
      const r = node.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      return r.width < 44 || r.height < 44;
    })
    .map((node) => `${node.textContent.trim()}(${Math.round(node.getBoundingClientRect().height)}px)`);
}

/** 国紹介まで進める。 */
async function reachIntro(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '旅をはじめる' }).click();
  await page.waitForSelector('.screen--avatar-select');
  await page.locator('.avatar-card').first().click();
  await page.getByRole('button', { name: 'この人を選ぶ' }).click();
  await page.waitForSelector('.screen--avatar-confirm');
  await page.getByRole('button', { name: 'この人と旅をはじめる' }).click();

  await page.waitForSelector('.option-card--category');
  await page.getByRole('button', { name: /学年別/ }).click();
  await page.getByRole('button', { name: '小学生' }).click();
  await page.getByRole('button', { name: /^6枚/ }).click();
  await page.getByRole('button', { name: '出発する' }).click();
  await page.waitForSelector('.screen--travel');
  await page.getByRole('button', { name: 'スキップ' }).click();
  await page.waitForSelector('.screen--intro');
}

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  // ---- 1. 3サイズで通常紹介と「もっと知る」 ----
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    await reachIntro(page, baseUrl);

    // --- 最初に見せる分がそろっている ---
    const title = await page.locator('.screen--intro .screen__title').textContent();
    check(title.includes('日本') && title.includes('Japan'), `${label}: 国名と英語名が出ていない（${title}）`);
    check((await page.locator('.intro__flag').count()) === 1, `${label}: 国旗が出ていない`);
    check(
      (await page.locator('.intro__greeting-ja').textContent()) === 'こんにちは',
      `${label}: あいさつが出ていない`,
    );
    const facts = await page.locator('.intro__fact').allTextContents();
    check(facts.some((f) => f.includes('東京')), `${label}: 首都が出ていない`);
    check(facts.some((f) => f.includes('富士山')), `${label}: 有名なものが出ていない`);
    check(
      (await page.locator('.intro__summary').textContent()).length > 10,
      `${label}: 短い紹介文が出ていない`,
    );

    // --- 詳細を開かなくてもゲームを開始できる ---
    check(
      (await page.getByRole('button', { name: 'この国でことばを集める' }).count()) === 1,
      `${label}: 開始ボタンが無い`,
    );
    check(
      await page.getByRole('button', { name: 'この国でことばを集める' }).isVisible(),
      `${label}: 開始ボタンが見えない`,
    );

    // --- 「もっと知る」は最初は閉じている ---
    const toggle = page.locator('.intro__more-toggle');
    check((await toggle.count()) === 1, `${label}: 「もっと知る」が無い`);
    check(
      (await toggle.getAttribute('aria-expanded')) === 'false',
      `${label}: 最初から開いた状態になっている`,
    );
    const panelId = await toggle.getAttribute('aria-controls');
    check(Boolean(panelId), `${label}: aria-controls が設定されていない`);
    check(
      (await page.locator(`#${panelId}`).count()) === 1,
      `${label}: aria-controls の指す要素が無い`,
    );
    check(
      (await page.locator('.intro__more:not([hidden])').count()) === 0,
      `${label}: 閉じているはずの詳細が見えている`,
    );

    // --- キーボードで開ける ---
    await toggle.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    check(
      (await toggle.getAttribute('aria-expanded')) === 'true',
      `${label}: キーボードで開けない`,
    );
    // 開閉してもフォーカスを失わない。
    const focusedAfterOpen = await page.evaluate(() =>
      document.activeElement?.className.includes('intro__more-toggle'),
    );
    check(focusedAfterOpen, `${label}: 開いたあとフォーカスが外れている`);

    // --- 8カテゴリーがそろい、スクロールで到達できる ---
    for (const id of SECTIONS) {
      const card = page.locator(`.intro-card[data-section="${id}"]`);
      check((await card.count()) === 1, `${label}: 「${id}」のカードが無い`);
      await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      check(box !== null && box.height > 0, `${label}: 「${id}」のカードへ到達できない`);
      const heading = await card.locator('.intro-card__heading').textContent();
      check(heading.trim().length > 0, `${label}: 「${id}」の見出しが空`);
    }

    // --- 情報源を開ける ---
    const sourceToggle = page.locator('.intro-sources__toggle');
    await sourceToggle.scrollIntoViewIfNeeded();
    check((await sourceToggle.count()) === 1, `${label}: 情報源の開閉ボタンが無い`);
    check(
      (await sourceToggle.getAttribute('aria-expanded')) === 'false',
      `${label}: 情報源が最初から開いている`,
    );
    await sourceToggle.click();
    await page.waitForTimeout(120);
    check(
      (await sourceToggle.getAttribute('aria-expanded')) === 'true',
      `${label}: 情報源を開けない`,
    );
    const sourceLinks = await page.locator('.intro-sources__link').count();
    check(sourceLinks >= 1, `${label}: 情報源のリンクが無い`);
    const checkedLabels = await page.locator('.intro-sources__checked').allTextContents();
    check(
      checkedLabels.every((t) => /\d{4}-\d{2}-\d{2}/.test(t)),
      `${label}: 確認日が出ていない`,
    );
    check(sourceLinks >= 8, `${label}: 情報源が少なすぎる（${sourceLinks}件）`);

    // 出典が増えても最後まで開いて到達できる。
    const lastSource = page.locator('.intro-sources__item').last();
    await lastSource.scrollIntoViewIfNeeded();
    const lastBox = await lastSource.boundingBox();
    check(
      lastBox !== null && lastBox.height > 0,
      `${label}: 最後の情報源へ到達できない`,
    );
    const lastText = await lastSource.textContent();
    check(lastText.trim().length > 0, `${label}: 最後の情報源が空`);

    // 事実を書いたカードには、必ず出典が添えてある。
    for (const id of SECTIONS.filter((s) => s !== 'words')) {
      const notes = await page
        .locator(`.intro-card[data-section="${id}"] .intro-card__source`)
        .count();
      check(notes >= 1, `${label}: 「${id}」のカードに出典が添えられていない`);
    }
    // ことばのカードは、外部出典ではなくゲーム内データが正本だと示す。
    const wordsNote = await page
      .locator('.intro-card[data-section="words"] .intro-card__source')
      .textContent();
    check(
      wordsNote.includes('語彙データ'),
      `${label}: ことばカードの正本が示されていない（${wordsNote}）`,
    );

    // 服装の目安が天気予報ではないことを断っている。
    const climateText = await page
      .locator('.intro-card[data-section="climate"]')
      .textContent();
    check(
      climateText.includes('天気予報ではありません'),
      `${label}: 服装の目安の断り書きが無い`,
    );

    // --- 開いた状態でも、はみ出しとタップ領域を守れている ---
    const hScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    check(!hScroll, `${label}: 横スクロールが発生している`);
    const offscreen = await page.evaluate(offscreenControls);
    check(offscreen.length === 0, `${label}: 画面外へ出ている操作 ${offscreen.join(', ')}`);
    const small = await page.evaluate(smallControls);
    check(small.length === 0, `${label}: タップ領域 44px 未満 ${small.join(', ')}`);

    // 見出しと本文が切れていないこと（はみ出して隠れていない）。
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('.intro-card__heading, .intro-card__body, .intro__summary')]
        .filter((n) => n.scrollWidth > n.clientWidth + 1)
        .map((n) => n.textContent.trim().slice(0, 20)),
    );
    check(clipped.length === 0, `${label}: 文字が横に切れている ${clipped.join(' / ')}`);

    // --- 閉じても開始ボタンへ到達できる ---
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await page.waitForTimeout(120);
    check(
      (await toggle.getAttribute('aria-expanded')) === 'false',
      `${label}: 閉じられない`,
    );
    check(
      (await page.locator('.intro__more:not([hidden])').count()) === 0,
      `${label}: 閉じたのに詳細が見えている`,
    );
    const startButton = page.getByRole('button', { name: 'この国でことばを集める' });
    await startButton.scrollIntoViewIfNeeded();
    check(await startButton.isVisible(), `${label}: 閉じたあと開始ボタンへ到達できない`);

    // --- 開いて閉じても進行が失われない ---
    await startButton.click();
    await page.waitForSelector('.card', { timeout: 6000 });
    const cards = await page.locator('.card').count();
    check(cards === 6, `${label}: カルタが始まらない（カード${cards}枚）`);

    check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);
    if (failures.length === 0) {
      console.log(`✓ ${label} 国紹介（8カード・情報源${sourceLinks}件・横スクロール0）`);
    }
    await context.close();
  }

  // ---- 2. 詳細を開かずにそのまま開始できる ----
  {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
    const page = await context.newPage();
    await reachIntro(page, baseUrl);
    await page.getByRole('button', { name: 'この国でことばを集める' }).click();
    await page.waitForSelector('.card', { timeout: 6000 });
    check(
      (await page.locator('.card').count()) === 6,
      '詳細を開かずに開始したときにカルタが始まらない',
    );
    if (failures.length === 0) console.log('✓ 「もっと知る」を開かなくてもカルタを開始できる');
    await context.close();
  }

  // ---- 3. prefers-reduced-motion でも全情報が読める ----
  {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await reachIntro(page, baseUrl);
    await page.locator('.intro__more-toggle').click();
    await page.waitForTimeout(150);

    for (const id of SECTIONS) {
      const card = page.locator(`.intro-card[data-section="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      const text = await card.textContent();
      check(
        text.trim().length > 0,
        `reduced-motion: 「${id}」のカードが読めない`,
      );
    }
    check(
      (await page.locator('.intro__summary').textContent()).length > 10,
      'reduced-motion: 紹介文が読めない',
    );
    if (failures.length === 0) console.log('✓ prefers-reduced-motion でも全カードが読める');
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error('\nPhase 1-C3 国紹介テスト 失敗:');
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log('\nPhase 1-C3 国紹介テスト 成功');
