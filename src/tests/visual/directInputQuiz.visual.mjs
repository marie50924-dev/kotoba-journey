/**
 * Phase 1-C2 の表示・操作回帰テスト（直接入力テスト）。
 *
 * CSS レイアウトと画面遷移の結果は jsdom では測れないため、
 * 実ブラウザ（Chromium）でビルド済みの dist/ を描画して検証する。
 *
 * ソフトウェアキーボードは自動化できないため、
 * 「キーボードが出ている状態」をビューポートの高さを縮めて再現する。
 * iPhone SE 相当（320×568）でキーボードが出ると、使える高さは 300px 前後になる。
 *
 * 実行: npm run test:visual:quiz （事前に npm run build が必要）
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

/** キーボードが出ている状態の実効高さ。320×568 での実測相当。 */
const KEYBOARD_VIEWPORTS = [
  { width: 320, height: 300 },
  { width: 393, height: 420 },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
};

/** 語彙データ。出題文から正解を引くために持つ。 */
const PAIRS = [
  ['りんご', 'apple'],
  ['ねこ', 'cat'],
  ['あお', 'blue'],
  ['いぬ', 'dog'],
  ['はな', 'flower'],
  ['ほん', 'book'],
  ['みず', 'water'],
  ['つき', 'moon'],
  ['とり', 'bird'],
  ['くるま', 'car'],
];

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

/** 要素が今の表示領域に収まっているか。 */
function visibleBox(selector) {
  const node = document.querySelector(selector);
  if (!node) return null;
  const r = node.getBoundingClientRect();
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    inView: r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5,
    viewportHeight: window.innerHeight,
  };
}

function correctAnswerFor(prompt, lang, pairs) {
  const row = pairs.find((p) => p[0] === prompt || p[1] === prompt);
  if (!row) return '';
  return lang === 'en' ? row[1] : row[0];
}

/** 表紙から確認テストの1問目までを一気に進める。 */
async function reachQuiz(page, baseUrl) {
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
  await page.getByRole('button', { name: 'カルタをはじめる' }).click();

  await page.waitForSelector('.card');
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

  await page.waitForSelector('.screen--quiz-prompt', { timeout: 6000 });
}

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  // ---- 1. 3サイズで通し操作できる ----
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    await reachQuiz(page, baseUrl);

    // 確認テストは結果画面より前に入る（結果画面には答えが並ぶため）。
    check(
      (await page.locator('.screen--result').count()) === 0,
      `${label}: 確認テストの前に結果画面が出ている（答えが見えてしまう）`,
    );
    check(
      (await page.locator('.quiz-prompt__mode').count()) === 1,
      `${label}: どちらの言語で入力するかの案内が無い`,
    );

    await page.getByRole('button', { name: 'テストを受ける' }).click();
    await page.waitForSelector('.screen--quiz');

    // 未入力では送信できない。
    check(
      await page.locator('.quiz__submit').isDisabled(),
      `${label}: 未入力なのに「こたえる」が押せる`,
    );

    // 出題方向はテスト全体で固定（キーボードの切り替えを発生させない）。
    const firstLang = await page.locator('.quiz__input').getAttribute('lang');
    const total = Number(
      (await page.locator('.quiz__progress').textContent()).split('/')[1].trim().split(' ')[0],
    );
    check(total >= 3 && total <= 5, `${label}: 出題数が3〜5問でない（${total}問）`);

    // 答えが画面のどこにも出ていない。
    const promptText = await page.locator('.quiz__prompt').textContent();
    const answer = correctAnswerFor(promptText, firstLang, PAIRS);
    check(answer.length > 0, `${label}: 出題語を語彙データから引けない（${promptText}）`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    check(
      !bodyText.includes(answer),
      `${label}: 回答前に答え「${answer}」が画面に出ている`,
    );

    // キーボード取り違えの案内は出るが、採点には影響しない。
    await page.locator('.quiz__input').fill(firstLang === 'en' ? 'りんご' : 'ringo');
    await page.waitForTimeout(120);
    check(
      (await page.locator('.quiz__hint.is-shown').count()) === 1,
      `${label}: 文字種が違うのに案内が出ない`,
    );

    // 大文字・前後空白つきでも正解になる。
    const typed = firstLang === 'en' ? `  ${answer.toUpperCase()}  ` : `  ${answer}  `;
    await page.locator('.quiz__input').fill(typed);
    await page.locator('.quiz__submit').click();
    await page.waitForSelector('.quiz__feedback .quiz__verdict', { timeout: 3000 });
    check(
      (await page.locator('.quiz__feedback.is-correct').count()) === 1,
      `${label}: 大文字・空白つきの正答が不正解にされた（${JSON.stringify(typed)}）`,
    );
    check(
      (await page.locator('.quiz__submit:not([hidden])').count()) === 0,
      `${label}: 回答後も「こたえる」が残っている`,
    );

    // 連打しても問題が飛ばない。
    const before = await page.locator('.quiz__progress').textContent();
    await page.locator('.quiz__next').click();
    await page.locator('.quiz__next').click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
    const after = await page.locator('.quiz__progress').textContent();
    check(before !== after, `${label}: 「つぎへ」で問題が進んでいない`);
    const shown = Number(after.split('/')[0].trim());
    check(shown === 2, `${label}: 連打で問題が飛んだ（${after}）`);

    // 残りを答え切る。
    for (let i = 2; i <= total; i += 1) {
      const p = await page.locator('.quiz__prompt').textContent();
      const l = await page.locator('.quiz__input').getAttribute('lang');
      check(l === firstLang, `${label}: テストの途中で入力言語が変わった（${firstLang} → ${l}）`);
      await page.locator('.quiz__input').fill(correctAnswerFor(p, l, PAIRS));
      await page.locator('.quiz__submit').click();
      await page.waitForSelector('.quiz__feedback .quiz__verdict', { timeout: 3000 });
      await page.locator('.quiz__next').click();
      await page.waitForTimeout(120);
    }

    await page.waitForSelector('.screen--quiz-result', { timeout: 6000 });
    const score = await page.locator('.quiz-result__score .stat-tile__value').textContent();
    check(score.trim() === `${total} / ${total}`, `${label}: 全問正解にならない（${score}）`);

    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.waitForSelector('.screen--result', { timeout: 6000 });

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kotoba-journey/learning-record/v1')),
    );
    check(stored.version === 3, `${label}: 保存が version 3 でない（${stored.version}）`);
    check(stored.quizHistory.length === 1, `${label}: テストの記録が残っていない`);
    check(
      stored.quizHistory[0].status === 'completed',
      `${label}: 受験状態が completed になっていない`,
    );
    check(
      stored.quizHistory[0].correctCount === total,
      `${label}: 正解数が保存されていない（${stored.quizHistory[0].correctCount}）`,
    );
    check(stored.totalPlays === 1, `${label}: 通常カルタの記録が二重加算されている`);

    const hScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    check(!hScroll, `${label}: 横スクロールが発生している`);
    check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);

    if (failures.length === 0) console.log(`✓ ${label} 通し操作（${total}問・全問正解）`);
    await context.close();
  }

  // ---- 2. キーボードが出ても入力欄と「こたえる」が隠れない ----
  for (const viewport of KEYBOARD_VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}(キーボード表示)`;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: 568 },
    });
    const page = await context.newPage();
    await reachQuiz(page, baseUrl);
    await page.getByRole('button', { name: 'テストを受ける' }).click();
    await page.waitForSelector('.screen--quiz');

    // キーボードが出た状態を、使える高さを縮めて再現する。
    await page.setViewportSize(viewport);
    await page.locator('.quiz__input').click();
    await page.waitForTimeout(250);

    const input = await page.evaluate(visibleBox, '.quiz__input');
    const submit = await page.evaluate(visibleBox, '.quiz__submit');
    const promptBox = await page.evaluate(visibleBox, '.quiz__prompt');

    check(input !== null, `${label}: 入力欄が無い`);
    check(input?.inView, `${label}: 入力欄がキーボードの裏に隠れている`);
    check(input?.height >= 44, `${label}: 入力欄が44px未満（${input?.height?.toFixed(1)}）`);
    check(submit !== null, `${label}: 「こたえる」が無い`);
    check(submit?.inView, `${label}: 「こたえる」がキーボードの裏に隠れている`);
    check(submit?.height >= 44, `${label}: 「こたえる」が44px未満（${submit?.height?.toFixed(1)}）`);
    check(promptBox?.inView, `${label}: 出題がキーボードの裏に隠れている`);

    const hScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    check(!hScroll, `${label}: 横スクロールが発生している`);

    if (failures.length === 0) {
      console.log(
        `✓ ${label} 出題・入力欄・こたえる がすべて可視（入力欄 ${input.height.toFixed(0)}px / ボタン ${submit.height.toFixed(0)}px）`,
      );
    }
    await context.close();
  }

  // ---- 3. スキップしても進行が止まらない ----
  {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
    const page = await context.newPage();
    await reachQuiz(page, baseUrl);
    await page.getByRole('button', { name: '今回はスキップ' }).click();
    await page.waitForSelector('.screen--result', { timeout: 6000 });

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kotoba-journey/learning-record/v1')),
    );
    check(stored.quizHistory.length === 1, 'スキップ: 記録が残っていない');
    check(stored.quizHistory[0].status === 'skipped', 'スキップ: status が skipped でない');
    check(stored.quizHistory[0].incorrectPairIds.length === 0, 'スキップ: 不正解として数えている');
    check(stored.totalPlays === 1, 'スキップ: 通常カルタの記録が失われた');

    if (failures.length === 0) console.log('✓ スキップしても記録と進行が保たれる');
    await context.close();
  }

  // ---- 4. 会話の置換記号が画面に残らない ----
  //
  // 一人称が年代・表示分類どおりかは単体テスト（avatars / dialogues）で固定している。
  // ここで確かめるのは、その置換が実際の画面で行われていること。
  // {npcI} のような記号がそのまま出ていたら、置換に失敗している。
  {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    const page = await context.newPage();
    const pronouns = new Set();
    let linesSeen = 0;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: '旅をはじめる' }).click();

      if ((await page.locator('.screen--avatar-select').count()) > 0) {
        await page.locator('.avatar-card').first().click();
        await page.getByRole('button', { name: 'この人を選ぶ' }).click();
        await page.getByRole('button', { name: 'この人と旅をはじめる' }).click();
      }
      await page.waitForSelector('.option-card--category');
      await page.getByRole('button', { name: 'はなしかける' }).click();
      await page.waitForSelector('.chat');
      await page.waitForTimeout(120);

      for (const text of await page.locator('.chat__text').allTextContents()) {
        linesSeen += 1;
        check(
          !/\{[a-zA-Z]+\}/.test(text),
          `会話: 置換されていない記号が画面に出ている（${text}）`,
        );
        const match = text.match(/^(ぼく|わたし)は/);
        if (match) pronouns.add(match[1]);
      }

      // 選択肢を選んだあとの返信にも記号が残らないこと。
      await page.locator('.chat__choice').first().click();
      await page.waitForTimeout(150);
      for (const text of await page.locator('.chat__text').allTextContents()) {
        check(
          !/\{[a-zA-Z]+\}/.test(text),
          `会話: 返信に置換されていない記号が残っている（${text}）`,
        );
      }
    }

    check(linesSeen > 0, '会話: 台詞が1行も表示されなかった');
    // 乱暴に聞こえる一人称は使わない。
    for (const p of pronouns) {
      check(!/おれ|オレ|俺/.test(p), `会話: 想定外の一人称が出た（${p}）`);
    }

    if (failures.length === 0) {
      console.log(
        `✓ 会話の置換記号が残らない（${linesSeen}行・観測した一人称: ${[...pronouns].join(' / ') || 'なし'}）`,
      );
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error('\nPhase 1-C2 直接入力テスト 失敗:');
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log('\nPhase 1-C2 直接入力テスト 成功');
