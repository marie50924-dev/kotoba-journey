/**
 * Phase 1-C3 の表示・操作回帰テスト（国紹介）。
 *
 * 日本は事実の本文確認が終わっていないため publicationStatus: 'draft'。
 * ここで確かめるのは、下書きの国で事実を1つも出さないこと
 * （あいさつ「こんにちは / Hello」も学習情報なので出さない）、
 * 国名と国旗だけは行き先の目じるしとして出ること、それでもカルタへ進めること。
 * 'verified' になったときの8カード表示は、単体テスト側で組み立てを固定している。
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
import { createSuite } from './visualCaseReporter.mjs';

const ROOT = fileURLToPath(new URL('../../../dist', import.meta.url));
const BASE_PATH = '/kotoba-journey/';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 393, height: 852 },
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

const { check, runCase, finish } = createSuite('Phase 1-C3 国紹介テスト（下書き表示）');

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
  // ---- 1. 下書き状態の国紹介（3サイズ） ----
  //
  // 日本は publicationStatus: 'draft'。事実の本文確認が終わるまで、
  // 首都・都市・自然・気候・名所・食・歴史・文化の文章は公開導線へ出さない。
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    await runCase(label, async () => {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        const jsErrors = [];
        page.on('pageerror', (e) => jsErrors.push(e.message));

        await reachIntro(page, baseUrl);

        // --- 事実ではない案内は出る ---
        const title = await page.locator('.screen--intro .screen__title').textContent();
        check(
          title.includes('日本') && title.includes('Japan'),
          `${label}: 国名と英語名が出ていない（${title}）`,
        );
        check((await page.locator('.intro__flag').count()) === 1, `${label}: 国旗が出ていない`);

        // --- あいさつは学習情報なので、下書きでは出さない ---
        check(
          (await page.locator('.intro__greeting').count()) === 0,
          `${label}: 下書きなのにあいさつ欄が出ている`,
        );
        check(
          (await page.locator('.intro__greeting-ja').count()) === 0,
          `${label}: 下書きなのに現地のあいさつが出ている`,
        );
        check(
          (await page.locator('.intro__greeting-en').count()) === 0,
          `${label}: 下書きなのに英語のあいさつが出ている`,
        );

        // --- 下書きの案内が読める ---
        const preparing = page.locator('.intro__preparing');
        check((await preparing.count()) === 1, `${label}: 準備中の案内が無い`);
        const preparingText = (await preparing.textContent()).trim();
        check(
          preparingText === 'この国の紹介は準備中です。',
          `${label}: 準備中の案内の文言が違う（${preparingText}）`,
        );
        await preparing.scrollIntoViewIfNeeded();
        const preparingBox = await preparing.boundingBox();
        check(
          preparingBox !== null && preparingBox.height > 0,
          `${label}: 準備中の案内が読めない`,
        );

        // --- 「もっと知る」を出さない ---
        check(
          (await page.locator('.intro__more-toggle').count()) === 0,
          `${label}: 下書きなのに「もっと知る」が出ている`,
        );
        check(
          (await page.locator('.intro__more').count()) === 0,
          `${label}: 下書きなのに詳細パネルがある`,
        );
        check(
          (await page.locator('.intro-card').count()) === 0,
          `${label}: 下書きなのに事実カードが出ている`,
        );
        check(
          (await page.locator('.intro-sources').count()) === 0,
          `${label}: 下書きなのに情報源一覧が出ている`,
        );
        check(
          (await page.locator('.intro__facts').count()) === 0,
          `${label}: 下書きなのに首都と有名なものが出ている`,
        );
        check(
          (await page.locator('.intro__summary').count()) === 0,
          `${label}: 下書きなのに紹介文が出ている`,
        );

        // --- 未確認の事実が画面のどこにも出ていない ---
        const bodyText = await page.evaluate(() => document.body.innerText);
        for (const phrase of [
          'こんにちは',
          'Hello',
          '東京',
          '富士山',
          '森林',
          '梅雨',
          '法隆寺',
          'すし',
          '武士',
          'おじぎ',
        ]) {
          check(
            !bodyText.includes(phrase),
            `${label}: 未確認の事実「${phrase}」が画面に出ている`,
          );
        }

        // --- 技術的な説明を子ども向け画面に出さない ---
        for (const phrase of ['未確認', '確認中', 'draft', '通信']) {
          check(
            !bodyText.includes(phrase),
            `${label}: 開発向けの説明「${phrase}」が画面に出ている`,
          );
        }

        // --- カルタへ進める ---
        const startButton = page.getByRole('button', { name: 'この国でことばを集める' });
        check((await startButton.count()) === 1, `${label}: 開始ボタンが無い`);
        await startButton.scrollIntoViewIfNeeded();
        check(await startButton.isVisible(), `${label}: 開始ボタンが見えない`);

        // --- はみ出しとタップ領域 ---
        const hScroll = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        check(!hScroll, `${label}: 横スクロールが発生している`);
        const offscreen = await page.evaluate(offscreenControls);
        check(offscreen.length === 0, `${label}: 画面外へ出ている操作 ${offscreen.join(', ')}`);
        const small = await page.evaluate(smallControls);
        check(small.length === 0, `${label}: タップ領域 44px 未満 ${small.join(', ')}`);

        await startButton.click();
        await page.waitForSelector('.card', { timeout: 6000 });
        const cards = await page.locator('.card').count();
        check(cards === 6, `${label}: カルタが始まらない（カード${cards}枚）`);

        check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);
        return ' 下書き表示（国名と国旗のみ・あいさつ0件・事実カード0件・カルタ開始OK）';
      } finally {
        await context.close();
      }
    });
  }

  // ---- 2. prefers-reduced-motion でも案内が読める ----
  {
    await runCase('prefers-reduced-motion', async () => {
      const context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        await reachIntro(page, baseUrl);
        const text = await page.locator('.intro__preparing').textContent();
        check(text.trim().length > 0, 'reduced-motion: 準備中の案内が読めない');
        check(
          (await page.locator('.intro__greeting').count()) === 0,
          'reduced-motion: あいさつが出ている',
        );
        check(
          (await page.locator('.intro__more-toggle').count()) === 0,
          'reduced-motion: 「もっと知る」が出ている',
        );
        return ' でも案内が読める';
      } finally {
        await context.close();
      }
    });
  }
} finally {
  await browser.close();
  server.close();
}

finish();
