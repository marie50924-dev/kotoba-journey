/**
 * Phase 1-C1 の表示・操作回帰テスト。
 *
 * CSS レイアウトと画面遷移は jsdom では測れないため、
 * 実ブラウザ（Chromium）でビルド済みの dist/ を描画して検証する。
 *
 * 実行: npm run test:visual:avatar （事前に npm run build が必要）
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSuite } from './visualCaseReporter.mjs';

const ROOT = fileURLToPath(new URL('../../../dist', import.meta.url));
const BASE_PATH = '/kotoba-journey/';
const STORAGE_KEY = 'kotoba-journey/learning-record/v1';

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

const { check, runCase, finish } = createSuite('Phase 1 統合 キャラクター・会話テスト');

/**
 * 横スクロールと、押せないボタンを測る。
 *
 * 「画面外」は「表示領域の外にあって到達できない」ことを指す。
 * 画面内にスクロール領域がある場合、その中で下にあるボタンはスクロールすれば
 * 押せるので画面外ではない。そこで scrollIntoView したあとに
 * 表示領域へ入るかどうかで判定する。
 */
function overflowMetrics() {
  const buttons = [...document.querySelectorAll('button')].filter((el) => {
    const r = el.getBoundingClientRect();
    return !(r.width === 0 && r.height === 0);
  });

  const offscreen = [];
  for (const el of buttons) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    const reachable =
      r.right > 0.5 &&
      r.bottom > 0.5 &&
      r.left < window.innerWidth - 0.5 &&
      r.top < window.innerHeight - 0.5;
    if (!reachable) offscreen.push(el.textContent.trim().slice(0, 14));
  }

  const small = buttons
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width < 44 || r.height < 44;
    })
    .map((el) => el.textContent.trim().slice(0, 14));

  return {
    // ページ自体の横スクロールは許さない。
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    offscreen,
    small,
  };
}

/**
 * ボタンの文字が1行に収まっているか。
 * テキストノードの行ボックス数で数えるので、折り返しを直接検出できる。
 */
async function buttonLines(page, name) {
  return page.evaluate((label) => {
    const node = [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === label,
    );
    if (!node) return null;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = node.getBoundingClientRect();
    return {
      lines: range.getClientRects().length,
      height: rect.height,
      overflow: node.scrollWidth > node.clientWidth + 1,
    };
  }, name);
}

/** 画面に出てはいけない開発者向けの説明。 */
const FORBIDDEN_NOTES = [
  '正式な立ち絵は後の工程で入ります',
  'あなた自身のことは聞いていません',
  'あらかじめ用意された台本です',
];

async function forbiddenNotesOnScreen(page) {
  return page.evaluate((phrases) => {
    const text = document.body.innerText;
    return phrases.filter((phrase) => text.includes(phrase));
  }, FORBIDDEN_NOTES);
}

async function clearBoard(page) {
  await page.waitForSelector('.card');
  while ((await page.locator('.card:not(.is-matched)').count()) > 0) {
    const id = await page.locator('.card:not(.is-matched)').first().getAttribute('data-card-id');
    const pairId = id.split('-')[0];
    await page.locator(`[data-card-id="${pairId}-ja"]`).click();
    await page.locator(`[data-card-id="${pairId}-en"]`).click();
    await page.waitForSelector('.pronounce', { timeout: 4000 });
    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.waitForTimeout(70);
  }
}

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    await runCase(label, async () => {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        const jsErrors = [];
        page.on('pageerror', (e) => jsErrors.push(e.message));

        const seen = [];
        const record = async (step) => {
          const m = await page.evaluate(overflowMetrics);
          seen.push(step);
          check(!m.hScroll, `${label}/${step}: 横スクロールが発生している`);
          check(m.offscreen.length === 0, `${label}/${step}: 画面外のボタン ${m.offscreen.join(', ')}`);
          check(
            m.small.length === 0,
            `${label}/${step}: タップ領域 44px 未満のボタン ${m.small.join(', ')}`,
          );
        };

        // ---- 1. 表紙 -> 初回キャラクター選択 ----
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await record('表紙');
        await page.getByRole('button', { name: '旅をはじめる' }).click();
        check(
          (await page.locator('.screen--avatar-select').count()) === 1,
          `${label}: 初回にキャラクター選択へ進めない`,
        );
        await record('キャラクター選択');

        // ---- 2. 年代タブとフィルター ----
        const tabCount = await page.getByRole('tab').count();
        check(tabCount === 5, `${label}: 年代タブが5つでない（${tabCount}）`);
        const elementaryCount = await page.locator('.avatar-card').count();
        check(elementaryCount === 16, `${label}: 小学生が16人出ていない（${elementaryCount}）`);

        await page.getByRole('tab', { name: '大人' }).click();
        await page.waitForTimeout(120);
        const adultCount = await page.locator('.avatar-card').count();
        check(adultCount === 16, `${label}: 大人が16人出ていない（${adultCount}）`);

        await page.locator('.avatar-filter__btn[data-filter="m"]').click();
        await page.waitForTimeout(120);
        const maleCount = await page.locator('.avatar-card').count();
        check(maleCount === 8, `${label}: 男性フィルターで8人にならない（${maleCount}）`);
        await page.locator('.avatar-filter__btn[data-filter="f"]').click();
        await page.waitForTimeout(120);
        const femaleCount = await page.locator('.avatar-card').count();
        check(femaleCount === 8, `${label}: 女性フィルターで8人にならない（${femaleCount}）`);
        await record('タブとフィルター');

        // ---- 3. 未選択では確定できない ----
        const confirmBefore = await page.getByRole('button', { name: 'この人を選ぶ' }).isDisabled();
        check(confirmBefore, `${label}: 未選択なのに確定できてしまう`);

        // ---- 4. 選択 -> 確認 -> 確定 ----
        await page.locator('.avatar-card').first().click();
        const chosenId = await page
          .locator('.avatar-card[aria-selected="true"]')
          .getAttribute('data-avatar-id');
        check(chosenId !== null, `${label}: aria-selected で選択が示されていない`);
        check(
          (await page.locator('.avatar-card[aria-selected="true"] .avatar-card__check').count()) === 1,
          `${label}: 選択中のチェック記号が出ていない（色だけに頼らない表示）`,
        );
        const confirmAfter = await page.getByRole('button', { name: 'この人を選ぶ' }).isDisabled();
        check(!confirmAfter, `${label}: 選択したのに確定できない`);

        // 「この人を選ぶ」は1行・44px以上・横あふれなし。
        const selectBtn = await buttonLines(page, 'この人を選ぶ');
        check(selectBtn !== null, `${label}: 「この人を選ぶ」が見つからない`);
        check(selectBtn?.lines === 1, `${label}: 「この人を選ぶ」が${selectBtn?.lines}行になっている`);
        check(selectBtn?.height >= 44, `${label}: 「この人を選ぶ」が44px未満（${selectBtn?.height.toFixed(1)}）`);
        check(!selectBtn?.overflow, `${label}: 「この人を選ぶ」が横にあふれている`);

        const notesOnSelect = await forbiddenNotesOnScreen(page);
        check(
          notesOnSelect.length === 0,
          `${label}: 選択画面に開発者向けの説明が残っている（${notesOnSelect.join(' / ')}）`,
        );

        await page.getByRole('button', { name: 'この人を選ぶ' }).click();
        check(
          (await page.locator('.screen--avatar-confirm').count()) === 1,
          `${label}: 確認画面へ進めない`,
        );
        await record('キャラクター確認');

        // 「この人と旅をはじめる」も1行・44px以上・横あふれなし。
        const startBtn = await buttonLines(page, 'この人と旅をはじめる');
        check(startBtn !== null, `${label}: 「この人と旅をはじめる」が見つからない`);
        check(startBtn?.lines === 1, `${label}: 「この人と旅をはじめる」が${startBtn?.lines}行になっている`);
        check(
          startBtn?.height >= 44,
          `${label}: 「この人と旅をはじめる」が44px未満（${startBtn?.height.toFixed(1)}）`,
        );
        check(!startBtn?.overflow, `${label}: 「この人と旅をはじめる」が横にあふれている`);

        const notesOnConfirm = await forbiddenNotesOnScreen(page);
        check(
          notesOnConfirm.length === 0,
          `${label}: 確認画面に開発者向けの説明が残っている（${notesOnConfirm.join(' / ')}）`,
        );

        await page.getByRole('button', { name: 'この人と旅をはじめる' }).click();

        check(
          (await page.locator('.option-card--category').count()) === 3,
          `${label}: 確定後にコース入口へ進めない`,
        );

        // ---- 5. コース入口の NPC と会話 ----
        check((await page.locator('.npc-bar').count()) === 1, `${label}: コース入口に NPC が出ない`);
        await record('コース入口');

        await page.getByRole('button', { name: 'はなしかける' }).click();
        await page.waitForSelector('.chat');
        const choiceCount = await page.locator('.chat__choice').count();
        check(
          choiceCount >= 2 && choiceCount <= 3,
          `${label}: 会話の選択肢が2〜3個でない（${choiceCount}）`,
        );
        check(
          (await page.locator('.chat__row--npc').count()) >= 1,
          `${label}: NPC の吹き出しが出ていない`,
        );
        check(
          (await page.getByRole('button', { name: 'あとで' }).count()) === 1,
          `${label}: 「あとで」が出ていない`,
        );
        // 自由入力欄を先行実装していないこと。
        check(
          (await page.locator('.chat input, .chat textarea').count()) === 0,
          `${label}: 会話パネルに入力欄がある（今工程では実装しない）`,
        );
        const notesOnChat = await forbiddenNotesOnScreen(page);
        check(
          notesOnChat.length === 0,
          `${label}: 会話画面に開発者向けの説明が残っている（${notesOnChat.join(' / ')}）`,
        );
        await record('会話');

        await page.locator('.chat__choice').first().click();
        await page.waitForTimeout(200);
        check(
          (await page.locator('.chat__row--me').count()) >= 1,
          `${label}: 選んだあとに自分の吹き出しが出ない`,
        );
        await record('会話の分岐');

        await page.getByRole('button', { name: 'とじる' }).first().click();
        await page.waitForTimeout(150);
        check((await page.locator('.chat').count()) === 0, `${label}: 会話を閉じられない`);
        check(
          (await page.locator('.option-card--category').count()) === 3,
          `${label}: 会話を閉じたらコース入口が壊れている`,
        );

        // ---- 6. 既存フロー：20枚カルタを悪化させない ----
        await page.getByRole('button', { name: /学年別/ }).click();
        await page.getByRole('button', { name: '小学生' }).click();
        await page.getByRole('button', { name: /^20枚/ }).click();
        check((await page.locator('.npc-bar').count()) === 1, `${label}: 世界地図に NPC が出ない`);
        await record('世界地図');

        await page.getByRole('button', { name: '出発する' }).click();

        // 統合後は世界地図のあとに旅の移動画面と国紹介が入る。
        await page.waitForSelector('.screen--travel');
        await record('旅の移動');
        await page.getByRole('button', { name: 'スキップ' }).click();
        await page.waitForSelector('.screen--intro');
        await record('国紹介');
        await page.getByRole('button', { name: 'この国でことばを集める' }).click();

        await page.waitForSelector('.card');
        await page.waitForTimeout(250);
        const board = await page.evaluate(() => {
          const cards = [...document.querySelectorAll('.card')];
          const rects = cards.map((c) => c.getBoundingClientRect());
          let overlaps = 0;
          for (let i = 0; i < rects.length; i += 1) {
            for (let j = i + 1; j < rects.length; j += 1) {
              const a = rects[i];
              const b = rects[j];
              if (
                a.left < b.right - 0.5 &&
                b.left < a.right - 0.5 &&
                a.top < b.bottom - 0.5 &&
                b.top < a.bottom - 0.5
              ) {
                overlaps += 1;
              }
            }
          }
          const outside = rects.filter(
            (r) =>
              r.left < -0.5 ||
              r.top < -0.5 ||
              r.right > window.innerWidth + 0.5 ||
              r.bottom > window.innerHeight + 0.5,
          ).length;
          return {
            count: cards.length,
            overlaps,
            outside,
            vScroll: document.documentElement.scrollHeight > window.innerHeight + 1,
          };
        });
        check(board.count === 20, `${label}: 20枚カルタの枚数が違う（${board.count}）`);
        check(board.overlaps === 0, `${label}: カードが重なっている（${board.overlaps}組）`);
        check(board.outside === 0, `${label}: カードが盤面外へ出ている（${board.outside}枚）`);
        check(!board.vScroll, `${label}: カルタ画面に縦スクロールが出ている`);

        // ---- 7. ウェーブ終了の会話 ----
        await clearBoard(page);
        await page.waitForSelector('.chat', { timeout: 6000 });
        check(
          (await page.locator('.chat__row--npc').count()) >= 1,
          `${label}: ウェーブ終了の会話が出ない`,
        );
        await record('ウェーブ終了の会話');
        await page.locator('.chat__choice').first().click();
        await page.waitForTimeout(200);
        await page.getByRole('button', { name: 'とじる' }).first().click();

        // ---- 8. 確認テストの案内（結果画面より前）→ 結果画面 ----
        await page.waitForSelector('.screen--quiz-prompt', { timeout: 6000 });
        await record('確認テストの案内');
        await page.getByRole('button', { name: '今回はスキップ' }).click();

        await page.waitForSelector('.screen--result', { timeout: 6000 });
        check((await page.locator('.npc-bar').count()) === 1, `${label}: 結果画面に NPC が出ない`);
        await record('結果画面');

        // ---- 9. 保存内容と再読み込み ----
        const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
        check(stored.version === 3, `${label}: 保存が version 3 になっていない（${stored.version}）`);
        check(stored.selectedAvatarId === chosenId, `${label}: 選んだキャラクターが保存されていない`);
        check(stored.totalPlays === 1, `${label}: 学習記録が記録されていない`);
        check(
          Array.isArray(stored.metAvatarIds) && stored.metAvatarIds.length >= 1,
          `${label}: 会話した相手が記録されていない`,
        );
        check(
          !stored.metAvatarIds.includes(stored.selectedAvatarId),
          `${label}: 自分のキャラクターが NPC として記録されている`,
        );

        await page.reload({ waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '旅をはじめる' }).click();
        await page.waitForTimeout(200);
        check(
          (await page.locator('.screen--avatar-select').count()) === 0,
          `${label}: 再読み込み後に選択画面が再表示される`,
        );
        check(
          (await page.locator('.option-card--category').count()) === 3,
          `${label}: 再読み込み後にコース入口へ進めない`,
        );
        const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
        check(after.selectedAvatarId === chosenId, `${label}: 再読み込み後に選択が残っていない`);
        check(after.totalPlays === 1, `${label}: 再読み込み後に学習記録が残っていない`);

        // ---- 10. 設定からキャラクターを変更できる ----
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '設定' }).click();
        check(
          (await page.getByRole('button', { name: '旅するキャラクターを変更' }).count()) === 1,
          `${label}: 設定に「旅するキャラクターを変更」が無い`,
        );
        await page.getByRole('button', { name: '旅するキャラクターを変更' }).click();
        await page.waitForSelector('.screen--avatar-select');
        await page.getByRole('tab', { name: '中学生' }).click();
        await page.waitForTimeout(120);
        await page.locator('.avatar-card').nth(2).click();
        const changedId = await page
          .locator('.avatar-card[aria-selected="true"]')
          .getAttribute('data-avatar-id');
        await page.getByRole('button', { name: 'この人を選ぶ' }).click();
        await page.getByRole('button', { name: 'この人と旅をはじめる' }).click();
        const changed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
        check(changed.selectedAvatarId === changedId, `${label}: 設定からの変更が保存されない`);
        check(changed.selectedAvatarId !== chosenId, `${label}: 変更が反映されていない`);
        check(changed.totalPlays === 1, `${label}: 変更で学習記録が失われた`);

        check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);
        return `  ${seen.length}地点で横スクロール0・画面外0・44px充足`;
      } finally {
        await context.close();
      }
    });
  }

  // ---- 11. prefers-reduced-motion でも会話が読める ----
  {
    await runCase('prefers-reduced-motion', async () => {
      const context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '旅をはじめる' }).click();
        await page.locator('.avatar-card').first().click();
        await page.getByRole('button', { name: 'この人を選ぶ' }).click();
        await page.getByRole('button', { name: 'この人と旅をはじめる' }).click();
        await page.getByRole('button', { name: 'はなしかける' }).click();
        await page.waitForSelector('.chat');
        const text = await page.locator('.chat__text').first().textContent();
        check(
          text !== null && text.trim().length > 0,
          'reduced-motion: 会話の本文が読めない（タイピング演出で消えている）',
        );
        check(
          (await page.locator('.chat__choice').count()) >= 2,
          'reduced-motion: 選択肢が出ていない',
        );
        return ' で会話が読める';
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
