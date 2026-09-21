/**
 * 工程V-2D-1の表示・操作回帰テスト（コース → 語彙セット → 盤面）。
 *
 * カルタ画面が、選んだコースの語彙セットから語を引くようになった。
 * いまセットは1つだけなので、**どのコースでも同じ共通セットから出題される**。
 * これが正式仕様なので、コースによって語が違うことは確かめない。
 * 確かめるのは、3分類のどのコースからでも最後まで遊べることと、
 * 出題がそのセットの中に収まっていること。
 *
 * 盤面の語は seed で決まる。偶然に頼らないよう、ページを開く前に
 * Date.now と Math.random を固定する。
 *
 * 実行: npm run test:visual:course （事前に npm run build が必要）
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORD_PAIRS, answerFor } from './wordPairsFixture.mjs';

const ROOT = fileURLToPath(new URL('../../../dist', import.meta.url));
const BASE_PATH = '/kotoba-journey/';
const STORAGE_KEY = 'kotoba-journey/learning-record/v1';

const FIXED_NOW = 1700000000001;

/**
 * 共通セットの語。どのコースを選んでもこの中から出る。
 * src/data/wordPairs.ts から読むので、語を足しても直す必要がない。
 */
const COMMON = WORD_PAIRS;
/** まだどのセットにも入れていない語。盤面へ出てはいけない。 */
const RESERVED = [
  [12, 'さかな', 'fish'],
  [20, 'パン', 'bread'],
  [22, 'ぎゅうにゅう', 'milk'],
  [25, 'うみ', 'sea'],
  [27, 'いえ', 'house'],
];

/** 3分類から1コースずつ。カテゴリ名・コース名・そのコースの案内の有無。 */
const COURSES = [
  { category: /学年別/, course: '小学生', notice: false },
  { category: /ステップ別/, course: 'ステップ1', notice: true },
  { category: /社会人/, course: 'IT・仕事', notice: false },
];

const PREPARING = '各ステップのことばは準備中です。現在は共通の練習用ことばで遊べます。';

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

/** 指定したコースでカルタ盤面まで進める。案内文の有無もそのとき見る。 */
async function reachBoard(page, baseUrl, { category, course, notice }, label) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '旅をはじめる' }).click();
  await page.waitForSelector('.screen--avatar-select');
  await page.locator('.avatar-card').first().click();
  await page.getByRole('button', { name: 'この人を選ぶ' }).click();
  await page.waitForSelector('.screen--avatar-confirm');
  await page.getByRole('button', { name: 'この人と旅をはじめる' }).click();

  await page.waitForSelector('.option-card--category');
  await page.getByRole('button', { name: category }).click();
  await page.waitForSelector('.course-group');

  // 準備中の案内は、ステップ別にだけ出る。
  const listText = await page.evaluate(() => document.body.innerText);
  check(
    listText.includes(PREPARING) === notice,
    notice
      ? `${label}: ステップ別に準備中の案内が出ていない`
      : `${label}: この分類に出してはいけない準備中の案内が出ている`,
  );

  await page.getByRole('button', { name: course, exact: true }).first().click();
  await page.getByRole('button', { name: /^6枚/ }).click();
  await page.getByRole('button', { name: '出発する' }).click();
  await page.waitForSelector('.screen--travel');
  await page.getByRole('button', { name: 'スキップ' }).click();
  await page.waitForSelector('.screen--intro');
  await page.getByRole('button', { name: 'この国でことばを集める' }).click();
  await page.waitForSelector('.card');
}

async function boardPairIds(page) {
  const ids = await page.$$eval('.card', (nodes) =>
    nodes.map((n) => Number(n.getAttribute('data-card-id').split('-')[0])),
  );
  return [...new Set(ids)].sort((a, b) => a - b);
}

/** まちがいの数。演出待ちを時間ではなくこの数で判断する。 */
async function mistakeCount(page) {
  const text = await page.locator('.karta__stats').textContent();
  const matched = text.match(/まちがい\s*(\d+)/);
  return matched === null ? 0 : Number(matched[1]);
}

/** わざと2回まちがえて、復習対象を作る。 */
async function makeMistakes(page, [a, b, c]) {
  for (const other of [b, c, b, c, b]) {
    if ((await mistakeCount(page)) >= 2) break;
    const before = await mistakeCount(page);
    await page.locator(`[data-card-id="${a}-ja"]`).click();
    await page.locator(`[data-card-id="${other}-en"]`).click();
    await page
      .waitForFunction((n) => {
        const bar = document.querySelector('.karta__stats');
        if (!bar) return false;
        const matched = bar.textContent.match(/まちがい\s*(\d+)/);
        return matched !== null && Number(matched[1]) > n;
      }, before, { timeout: 4000 })
      .catch(() => {});
    await page
      .waitForFunction(
        () => document.querySelectorAll('.card.is-selected, .card.is-wrong').length === 0,
        undefined,
        { timeout: 4000 },
      )
      .catch(() => {});
  }
}

async function clearBoard(page) {
  while ((await page.locator('.card:not(.is-matched)').count()) > 0) {
    const id = await page.locator('.card:not(.is-matched)').first().getAttribute('data-card-id');
    const pairId = id.split('-')[0];
    await page.locator(`[data-card-id="${pairId}-ja"]`).click();
    await page.locator(`[data-card-id="${pairId}-en"]`).click();
    await page.waitForSelector('.pronounce', { timeout: 4000 });
    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.waitForTimeout(60);
  }
  await page.waitForSelector('.chat', { timeout: 6000 });
  await page.locator('.chat__choice').first().click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'とじる' }).first().click();
}

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  for (const target of COURSES) {
    const label = `${target.course}`;
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    await context.addInitScript((now) => {
      Date.now = () => now;
      Math.random = () => 0;
    }, FIXED_NOW);
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    await reachBoard(page, baseUrl, target, label);

    // --- 出題は共通セットの語に収まっている ---
    const ids = await boardPairIds(page);
    check(ids.length === 3, `${label}: 6枚の盤面が3語になっていない（${ids.join(',')}）`);
    for (const id of ids) {
      check(COMMON.has(id), `${label}: 共通セットに無い pairId ${id} が出ている`);
    }

    // --- 札の文字が語彙データのとおり ---
    for (const id of ids) {
      const [ja, en] = COMMON.get(id) ?? [];
      const jaText = (await page.locator(`[data-card-id="${id}-ja"]`).textContent()).trim();
      const enText = (await page.locator(`[data-card-id="${id}-en"]`).textContent()).trim();
      check(jaText === ja, `${label}: ${id} の日本語札が違う（${jaText}）`);
      check(enText === en, `${label}: ${id} の英語札が違う（${enText}）`);
    }

    // --- 資料確認待ちの語は出ない ---
    const boardText = await page.evaluate(() => document.body.innerText);
    for (const [id, ja, en] of RESERVED) {
      check(!ids.includes(id), `${label}: 未確認の pairId ${id} が盤面に出ている`);
      check(!boardText.includes(ja), `${label}: 未確認の語「${ja}」が出ている`);
      check(!boardText.includes(en), `${label}: 未確認の語「${en}」が出ている`);
    }

    const scrollX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(scrollX <= 0, `${label}: 横スクロールが出ている（${scrollX}px）`);

    // --- 最後まで遊べる ---
    await makeMistakes(page, ids);
    await clearBoard(page);
    await page.waitForSelector('.screen--quiz-prompt', { timeout: 6000 });
    await page.getByRole('button', { name: 'テストを受ける' }).click();
    await page.waitForSelector('.screen--quiz');

    const total = Number(
      (await page.locator('.quiz__progress').textContent()).split('/')[1].trim().split(' ')[0],
    );
    const lang = await page.locator('.quiz__input').getAttribute('lang');
    for (let i = 1; i <= total; i += 1) {
      const prompt = await page.locator('.quiz__prompt').textContent();
      const answer = answerFor(prompt, lang);
      check(answer.length > 0, `${label}: ${i}問目の正答を共通セットから引けない（${prompt.trim()}）`);
      await page.locator('.quiz__input').fill(answer);
      await page.locator('.quiz__submit').click();
      await page.waitForSelector('.quiz__feedback .quiz__verdict', { timeout: 3000 });
      await page.locator('.quiz__next').click();
      await page.waitForTimeout(120);
    }

    await page.waitForSelector('.screen--quiz-result', { timeout: 6000 });
    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.waitForSelector('.screen--result', { timeout: 6000 });

    // --- 結果画面に、盤面の語が出る ---
    const resultText = await page.evaluate(() => document.body.innerText);
    for (const id of ids) {
      const [ja, en] = COMMON.get(id) ?? [];
      check(resultText.includes(ja), `${label}: 結果画面に「${ja}」が出ていない`);
      check(resultText.includes(en), `${label}: 結果画面に「${en}」が出ていない`);
    }

    // --- パスポートまで進める ---
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
    check(stored.version === 3, `${label}: 保存が version 3 でない（${stored.version}）`);
    check(
      stored.selectedCourseId !== null,
      `${label}: 選んだコースが保存されていない`,
    );
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'マイパスポート' }).click();
    await page.waitForSelector('.screen--passport');
    const passportText = await page.evaluate(() => document.body.innerText);
    check(
      passportText.includes('総プレイ回数'),
      `${label}: パスポートが開けていない`,
    );
    const reviewWords = await page.$$eval('.word-list__item', (nodes) =>
      nodes.map((n) => n.textContent.trim()),
    );
    check(
      !reviewWords.some((w) => w.includes('?')),
      `${label}: パスポートの復習語に引けない語がある（${reviewWords.join(' / ')}）`,
    );
    const passportScrollX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(passportScrollX <= 0, `${label}: パスポートで横スクロールが出ている`);
    check(jsErrors.length === 0, `${label}: JavaScriptエラー（${jsErrors.join(' / ')}）`);

    console.log(`✓ ${label} 共通${COMMON.size}語（${ids.join(',')}）で最後まで遊べた`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error('\nコース別語彙セットテスト 失敗');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('\nコース別語彙セットテスト 成功');
