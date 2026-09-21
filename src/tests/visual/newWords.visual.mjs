/**
 * 工程V-2C-4で足した語が、実際に遊べることを確かめる回帰テスト。
 *
 * 語彙が10語から25語になった。カードを作る処理や確認テストは
 * pairId しか見ないので、単体テストでは「新しい語だから壊れる」ことはまず起きない。
 * それでも確かめたいのは、足した語が本当に盤面へ出て、札として取れて、
 * 確認テストで答えられて、結果画面とパスポートに出るところまで通ることそのもの。
 *
 * 盤面の語は seed で決まる。偶然に頼らないよう、ページを開く前に
 * Date.now と Math.random を固定して、seed を狙った値へ寄せる。
 * createSeed() は (Date.now() ^ Math.random()*0xffffffff) >>> 0 なので、
 * Math.random を 0 に固定すれば Date.now だけで seed が決まる。
 *
 * 実行: npm run test:visual:newwords （事前に npm run build が必要）
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../dist', import.meta.url));
const BASE_PATH = '/kotoba-journey/';
const STORAGE_KEY = 'kotoba-journey/learning-record/v1';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
];

/**
 * この時刻を Date.now が返すと、6枚の盤面が pairId 23・24・29 になる。
 * 3語とも工程V-2C-4で足した語で、もとの10語は1つも出ない。
 */
const FIXED_NOW = 1700000000001;
const EXPECTED_PAIR_IDS = [23, 24, 29];
const EXPECTED_WORDS = [
  [23, 'いちご', 'strawberry'],
  [24, 'やま', 'mountain'],
  [29, 'のむ', 'drink'],
];
/** 足した15語ぜんぶ。結果画面やパスポートの照合に使う。 */
const ADDED = new Map([
  [11, ['うさぎ', 'rabbit']],
  [13, ['ぞう', 'elephant']],
  [14, ['うま', 'horse']],
  [15, ['あか', 'red']],
  [16, ['きいろ', 'yellow']],
  [17, ['みどり', 'green']],
  [18, ['しろ', 'white']],
  [19, ['くろ', 'black']],
  [21, ['たまご', 'egg']],
  [23, ['いちご', 'strawberry']],
  [24, ['やま', 'mountain']],
  [26, ['そら', 'sky']],
  [28, ['たべる', 'eat']],
  [29, ['のむ', 'drink']],
  [30, ['ねる', 'sleep']],
]);

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

/** 盤面の seed を固定する。ページのどのスクリプトより先に入れる。 */
async function pinSeed(context) {
  await context.addInitScript((now) => {
    Date.now = () => now;
    Math.random = () => 0;
  }, FIXED_NOW);
}

/** 6枚のカルタ盤面まで進める。 */
async function reachBoard(page, baseUrl) {
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
  await page.getByRole('button', { name: 'この国でことばを集める' }).click();
  await page.waitForSelector('.card');
}

/** 盤面に出ている pairId を取り出す。 */
async function boardPairIds(page) {
  const ids = await page.$$eval('.card', (nodes) =>
    nodes.map((n) => Number(n.getAttribute('data-card-id').split('-')[0])),
  );
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * わざと組を間違える。
 * 同じ語で2回まちがえると復習対象になり、パスポートの復習語に出る。
 * 足した語をパスポートまで追いかけるために使う。
 */
async function makeMistakes(page, [a, b, c]) {
  // 2回そろうまで繰り返す。まちがいの演出が終わる前に押すと選択が流れるので、
  // 待ち時間ではなく画面の「まちがい」の数で確かめる。
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
    // まちがいの演出が終わり、選択が外れるまで待つ。
    // 札は消えずにクラスだけ変わるので、要素の有無ではなく数で見る。
    await page
      .waitForFunction(
        () => document.querySelectorAll('.card.is-selected, .card.is-wrong').length === 0,
        undefined,
        { timeout: 4000 },
      )
      .catch(() => {});
  }
}

/** 画面に出ている「まちがい」の数。 */
async function mistakeCount(page) {
  const text = await page.locator('.karta__stats').textContent();
  const matched = text.match(/まちがい\s*(\d+)/);
  return matched === null ? 0 : Number(matched[1]);
}

/** 盤面の札を全部取る。 */
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
  // ウェーブ終了の会話を閉じる。
  await page.waitForSelector('.chat', { timeout: 6000 });
  await page.locator('.chat__choice').first().click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'とじる' }).first().click();
}

/** 出題文から正答を引く。足した語もここで引けなければならない。 */
function answerFor(prompt, lang) {
  const text = prompt.trim();
  for (const [, [ja, en]] of ADDED) {
    if (text.includes(ja)) return lang === 'en' ? en : ja;
    if (text.includes(en)) return lang === 'en' ? en : ja;
  }
  return '';
}

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  // ---- 1. 足した語だけの盤面を、3サイズで遊べる ----
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport });
    await pinSeed(context);
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    await reachBoard(page, baseUrl);

    // --- 狙った語が本当に出ている（偶然ではない） ---
    const ids = await boardPairIds(page);
    check(
      JSON.stringify(ids) === JSON.stringify(EXPECTED_PAIR_IDS),
      `${label}: 盤面の語が固定seedの想定と違う（${ids.join(',')}）`,
    );
    check(
      ids.every((id) => ADDED.has(id)),
      `${label}: 盤面に、足した語が1つも出ていない（${ids.join(',')}）`,
    );

    // --- 札の文字が語彙データのとおり ---
    for (const [pairId, ja, en] of EXPECTED_WORDS) {
      const jaText = (await page.locator(`[data-card-id="${pairId}-ja"]`).textContent()).trim();
      const enText = (await page.locator(`[data-card-id="${pairId}-en"]`).textContent()).trim();
      check(jaText === ja, `${label}: ${pairId} の日本語札が「${ja}」でない（${jaText}）`);
      check(enText === en, `${label}: ${pairId} の英語札が「${en}」でない（${enText}）`);
    }

    // --- はみ出していない ---
    const scrollX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(scrollX <= 0, `${label}: 横スクロールが出ている（${scrollX}px）`);

    // --- 日本語札と英語札を正しく合わせられる ---
    await clearBoard(page);
    await page.waitForSelector('.screen--quiz-prompt', { timeout: 6000 });

    check(jsErrors.length === 0, `${label}: JavaScriptエラー（${jsErrors.join(' / ')}）`);
    console.log(`✓ ${label} 足した語だけの盤面（${ids.join(',')}）を取り切れた`);
    await context.close();
  }

  // ---- 2. 確認テスト → 結果画面 → パスポートまで、足した語で通る ----
  {
    const label = '393x852 通し';
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    await pinSeed(context);
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    await reachBoard(page, baseUrl);
    // 23 いちご を2回まちがえて、復習対象にする。
    await makeMistakes(page, EXPECTED_PAIR_IDS);
    check(
      (await mistakeCount(page)) === 2,
      `${label}: わざとのまちがいが2回そろっていない（${await mistakeCount(page)}回）`,
    );
    await clearBoard(page);
    await page.waitForSelector('.screen--quiz-prompt', { timeout: 6000 });
    await page.getByRole('button', { name: 'テストを受ける' }).click();
    await page.waitForSelector('.screen--quiz');

    const total = Number(
      (await page.locator('.quiz__progress').textContent()).split('/')[1].trim().split(' ')[0],
    );
    const lang = await page.locator('.quiz__input').getAttribute('lang');

    // 1問目はわざと間違える。ここで出た語が復習対象になり、
    // 結果画面とパスポートで「足した語を解決できるか」を見られる。
    const firstPrompt = await page.locator('.quiz__prompt').textContent();
    const firstAnswer = answerFor(firstPrompt, lang);
    check(
      firstAnswer.length > 0,
      `${label}: 足した語の出題から正答を引けない（${firstPrompt.trim()}）`,
    );
    await page.locator('.quiz__input').fill(lang === 'en' ? 'qqqqqqq' : 'ぬぬぬぬぬ');
    await page.locator('.quiz__submit').click();
    await page.waitForSelector('.quiz__feedback .quiz__verdict', { timeout: 3000 });
    const shownAnswer = (await page.locator('.quiz__answer-text').textContent()).trim();
    check(
      shownAnswer === firstAnswer,
      `${label}: 不正解時に足した語の正答が出ない（表示=${shownAnswer} / 正答=${firstAnswer}）`,
    );
    await page.locator('.quiz__next').click();
    await page.waitForTimeout(120);

    // 残りは正しく答える。足した語でも採点が通ることを見る。
    for (let i = 2; i <= total; i += 1) {
      const prompt = await page.locator('.quiz__prompt').textContent();
      const answer = answerFor(prompt, lang);
      check(answer.length > 0, `${label}: ${i}問目の正答を引けない（${prompt.trim()}）`);
      await page.locator('.quiz__input').fill(answer);
      await page.locator('.quiz__submit').click();
      await page.waitForSelector('.quiz__feedback .quiz__verdict', { timeout: 3000 });
      check(
        (await page.locator('.quiz__feedback.is-correct').count()) === 1,
        `${label}: 足した語の正答が不正解にされた（${answer}）`,
      );
      await page.locator('.quiz__next').click();
      await page.waitForTimeout(120);
    }

    await page.waitForSelector('.screen--quiz-result', { timeout: 6000 });
    const score = (await page.locator('.quiz-result__score .stat-tile__value').textContent()).trim();
    check(score === `${total - 1} / ${total}`, `${label}: 採点が合わない（${score}）`);

    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.waitForSelector('.screen--result', { timeout: 6000 });

    // --- 結果画面に、足した語が日本語と英語で出る ---
    const resultText = await page.evaluate(() => document.body.innerText);
    for (const [pairId, ja, en] of EXPECTED_WORDS) {
      check(resultText.includes(ja), `${label}: 結果画面に ${pairId} の「${ja}」が出ていない`);
      check(resultText.includes(en), `${label}: 結果画面に ${pairId} の「${en}」が出ていない`);
    }
    check(
      (await page.locator('.word-list__ja').count()) > 0,
      `${label}: 結果画面に覚えたことばの一覧が無い`,
    );

    // --- 保存された pairId が、足した語のものになっている ---
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
    check(stored.version === 3, `${label}: 保存が version 3 でない（${stored.version}）`);
    const savedIds = [...stored.masteredPairIds, ...stored.reviewPairIds];
    check(
      savedIds.length > 0 && savedIds.every((id) => ADDED.has(id)),
      `${label}: 保存された pairId に足した語が無い（${savedIds.join(',')}）`,
    );

    // --- パスポートの復習語で、足した語を解決できる ---
    await page.getByRole('button', { name: 'つぎへ' }).click().catch(() => {});
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'マイパスポート' }).click();
    await page.waitForSelector('.screen--passport');

    const reviewIds = stored.reviewPairIds;
    check(reviewIds.length > 0, `${label}: 復習対象が記録されていない`);
    const reviewWords = await page.$$eval('.word-list__item', (nodes) =>
      nodes.map((n) => n.textContent.trim()),
    );
    for (const pairId of reviewIds) {
      const [ja, en] = ADDED.get(pairId) ?? [];
      check(ja !== undefined, `${label}: 復習の pairId ${pairId} が足した語ではない`);
      check(
        reviewWords.some((w) => w.includes(ja) && w.includes(en)),
        `${label}: パスポートの復習語で ${pairId}「${ja} / ${en}」を解決できていない（${reviewWords.join(' / ')}）`,
      );
    }
    // 引けない pairId が「?」で出ていないこと。
    check(
      !reviewWords.some((w) => w.includes('?')),
      `${label}: パスポートの復習語に引けない語がある（${reviewWords.join(' / ')}）`,
    );

    const passportScrollX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(passportScrollX <= 0, `${label}: パスポートで横スクロールが出ている`);
    check(jsErrors.length === 0, `${label}: JavaScriptエラー（${jsErrors.join(' / ')}）`);

    console.log(`✓ ${label} 確認テスト・結果画面・パスポートまで、足した語で通った`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error('\n追加語テスト 失敗');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('\n追加語テスト 成功');
