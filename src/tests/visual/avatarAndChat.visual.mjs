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
import { decodePng, pixelAt, textContrast } from './pngPixels.mjs';

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

/*
 * 主人公選択の一覧で「完全に見える」人数を数える。
 *
 * 完全に見える = カードの箱・顔の円・名前の文字の3つが、
 * 一覧の枠の見えている範囲（表示領域とも重ねた範囲）に全部入っている。
 * 顔だけ見えて名前が切れている人や、カードの下端が切れている人は数えない。
 */
function fullyVisibleAvatars() {
  const grid = document.querySelector('.avatar-grid');
  const g = grid.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const box = {
    left: Math.max(g.left, 0),
    top: Math.max(g.top, 0),
    right: Math.min(g.right, vw),
    bottom: Math.min(g.bottom, vh),
  };
  const inside = (r) =>
    r !== undefined &&
    r !== null &&
    r.width > 0 &&
    r.height > 0 &&
    r.top >= box.top - 0.5 &&
    r.bottom <= box.bottom + 0.5 &&
    r.left >= box.left - 0.5 &&
    r.right <= box.right + 0.5;

  const cards = [...document.querySelectorAll('.avatar-card')];
  const full = cards.filter((c) =>
    inside(c.getBoundingClientRect()) &&
    inside(c.querySelector('.avatar-thumb__face')?.getBoundingClientRect()) &&
    inside(c.querySelector('.avatar-thumb__name')?.getBoundingClientRect()),
  );
  const face = cards[0]?.querySelector('.avatar-thumb__face').getBoundingClientRect();
  return {
    cards: cards.length,
    full: full.length,
    faceSize: face ? Math.min(face.width, face.height) : 0,
    columns: (() => {
      if (cards.length === 0) return 0;
      const t = cards[0].getBoundingClientRect().top;
      return cards.filter((c) => Math.abs(c.getBoundingClientRect().top - t) < 2).length;
    })(),
  };
}

/** 一覧をスクロールしきったとき、何人に到達できるか。 */
function reachableAvatars() {
  const grid = document.querySelector('.avatar-grid');
  const cards = [...document.querySelectorAll('.avatar-card')];
  const reached = new Set();
  const steps = Math.ceil(grid.scrollHeight / Math.max(1, grid.clientHeight)) * 2 + 4;
  for (let i = 0; i <= steps; i += 1) {
    grid.scrollTop = (grid.clientHeight * i) / 2;
    const g = grid.getBoundingClientRect();
    const top = Math.max(g.top, 0);
    const bottom = Math.min(g.bottom, window.innerHeight);
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const name = c.querySelector('.avatar-thumb__name').getBoundingClientRect();
      if (r.top >= top - 0.5 && r.bottom <= bottom + 0.5 && name.bottom <= bottom + 0.5) {
        reached.add(c.dataset.avatarId);
      }
    }
  }
  grid.scrollTop = 0;
  return { reached: reached.size, total: cards.length };
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

        // ---- 10. 設定から「旅するあなた」を変えられる ----
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '設定' }).click();
        check(
          (await page.getByRole('button', { name: '旅するあなたを変える' }).count()) === 1,
          `${label}: 設定に「旅するあなたを変える」が無い`,
        );
        await page.getByRole('button', { name: '旅するあなたを変える' }).click();
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

  /*
   * ---- 11. 主人公選択の再設計 ----
   *
   * 見出し・選択の色・一覧の枠・下の帯を、実際に描かれた画面で測る。
   * 画素を読むので deviceScaleFactor を 2 にして別の context で開く。
   */
  const SELECT_SIZES = [
    // minFull … その画面で「完全に見える」ことを求める最低人数（実測に基づく）
    { width: 320, height: 568, minFull: 12 },
    { width: 393, height: 852, minFull: 16 },
    { width: 430, height: 932, minFull: 16 },
  ];

  for (const vp of SELECT_SIZES) {
    const label = `${vp.width}x${vp.height}`;
    await runCase(`${label} 主人公選択`, async () => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });
      try {
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '旅をはじめる' }).click();
        await page.waitForSelector('.avatar-grid');
        // 顔の画像が出そろってから測る。
        await page.waitForTimeout(500);

        // --- 見出し ---
        const heading = await page.evaluate(() => {
          const title = document.querySelector('.screen__title-text');
          const icon = document.querySelector('.screen__title .t-icon');
          const back = document.querySelector('.btn--back');
          const range = document.createRange();
          range.selectNodeContents(title);
          const t = title.getBoundingClientRect();
          const i = icon ? icon.getBoundingClientRect() : null;
          const b = back ? back.getBoundingClientRect() : null;
          return {
            text: title.textContent,
            lines: range.getClientRects().length,
            hasIcon: icon !== null,
            iconSize: i ? Math.min(i.width, i.height) : 0,
            // 飛行機と「もどる」が重ならないこと。
            gapFromBack: b && i ? i.left - b.right : null,
            overflow: title.scrollWidth > title.clientWidth + 1,
          };
        });
        check(heading.text === '旅するあなたを選ぼう', `${label}: 見出しが「${heading.text}」になっている`);
        check(heading.lines === 1, `${label}: 見出しが${heading.lines}行になっている`);
        check(heading.hasIcon, `${label}: 見出しの飛行機の記号が出ていない`);
        check(heading.iconSize >= 15, `${label}: 見出しの記号が小さい（${heading.iconSize.toFixed(1)}px）`);
        check(!heading.overflow, `${label}: 見出しが横にあふれている`);
        check(
          heading.gapFromBack === null || heading.gapFromBack > 0,
          `${label}: 見出しの記号と「もどる」が重なっている（${heading.gapFromBack?.toFixed(1)}px）`,
        );

        // --- 一覧：完全に見える人数と、全員への到達 ---
        const before = await page.evaluate(fullyVisibleAvatars);
        check(before.cards === 16, `${label}: 一覧が16人になっていない（${before.cards}）`);
        check(
          before.full >= vp.minFull,
          `${label}: 顔・名前・カード下端まで完全に見える人数が ${before.full}人（${vp.minFull}人以上を期待）`,
        );
        check(
          before.faceSize >= 50,
          `${label}: 一覧の顔が小さい（${before.faceSize.toFixed(1)}px・50px以上を期待）`,
        );
        const reach = await page.evaluate(reachableAvatars);
        check(
          reach.reached === 16,
          `${label}: スクロールしても16人に到達できない（${reach.reached}人）`,
        );

        /*
         * --- 一覧の枠のまわりに大きな空白を作らない ---
         *
         * 16人が収まる画面では、枠を使える高さいっぱいに広げ、行を等分して伸ばす。
         * 以前は枠を中身の高さまで縮めていたため、393x852 で上下に 75px、
         * 430x932 で 109px の空白が残り、画面全体が間延びして見えていた。
         */
        const bands = await page.evaluate(() => {
          const r = (sel) => document.querySelector(sel).getBoundingClientRect();
          const filter = r('.avatar-filter');
          const list = r('.avatar-list');
          const note = r('.avatar-select__note');
          return {
            above: list.top - filter.bottom,
            below: note.top - list.bottom,
            listHeight: list.height,
          };
        });
        if (before.full === 16) {
          check(
            bands.above <= 16,
            `${label}: 一覧の枠の上に ${bands.above.toFixed(1)}px の空白がある（16px以下を期待）`,
          );
          check(
            bands.below <= 16,
            `${label}: 一覧の枠の下に ${bands.below.toFixed(1)}px の空白がある（16px以下を期待）`,
          );
        }

        // --- 選択の色は青。チェック印は顔に隠れず前面に出る ---
        await page.locator('.avatar-card').nth(5).click();
        await page.waitForTimeout(200);
        const selected = await page.evaluate(() => {
          const card = document.querySelector('.avatar-card[aria-selected="true"]');
          const check = card.querySelector('.avatar-card__check');
          const cs = getComputedStyle(card);
          const chk = getComputedStyle(check);
          const rgb = (v) => (v.match(/\d+/g) ?? []).slice(0, 3).map(Number);
          const r = check.getBoundingClientRect();
          /*
           * 顔の円に覆われていないか。
           *
           * 中心1点だけでは足りない。顔は円なので、チェック印の中心が
           * 円の外に出ていても、中心からずれた点は円の中に入りうる。
           * 丸の内側の5点すべてでチェック印が返ることを求める。
           */
          const cx = (r.left + r.right) / 2;
          const cy = (r.top + r.bottom) / 2;
          const d = Math.min(r.width, r.height) / 2 - 4.5;
          const probes = [
            [cx, cy],
            [cx - d, cy],
            [cx + d, cy],
            [cx, cy - d],
            [cx, cy + d],
          ];
          const covered = probes.filter(([x, y]) => {
            const hit = document.elementFromPoint(x, y);
            return !(check === hit || check.contains(hit));
          }).length;
          return {
            border: rgb(cs.borderTopColor),
            checkBg: rgb(chk.backgroundColor),
            checkColor: rgb(chk.color),
            checkVisible: chk.visibility === 'visible',
            checkOnTop: covered === 0,
            coveredProbes: covered,
            checkRect: { l: r.left, r: r.right, t: r.top, b: r.bottom },
            checkBox: { w: r.width, h: r.height },
          };
        });
        const blueness = selected.border[2] - selected.border[0];
        check(
          blueness >= 120,
          `${label}: 選択の縁が青くない rgb(${selected.border.join(',')}) 青−赤=${blueness}`,
        );
        check(selected.checkVisible, `${label}: 選択中のチェック印が出ていない`);
        check(
          selected.checkBg[2] - selected.checkBg[0] >= 120,
          `${label}: チェック印の丸が青くない rgb(${selected.checkBg.join(',')})`,
        );
        check(
          selected.checkOnTop,
          `${label}: チェック印が顔の円に隠れている（5点中${selected.coveredProbes}点が覆われている）`,
        );

        // --- 文字の読みやすさ（実際に描かれた画素で測る） ---
        const boxes = await page.evaluate(() => {
          const r = (sel) => {
            const n = document.querySelector(sel);
            if (n === null) return null;
            const b = n.getBoundingClientRect();
            return { l: b.left, r: b.right, t: b.top, b: b.bottom };
          };
          return {
            見出しの白文字: r('.screen__title-text'),
            選択中の年代タブ: r('.avatar-tab[aria-selected="true"]'),
            選んだ人の名前: r('.avatar-card[aria-selected="true"] .avatar-thumb__name'),
            '旅するあなた': r('.avatar-select__chosen-label'),
            姓名: r('.avatar-select__chosen-name'),
          };
        });
        const img = decodePng(await page.screenshot());

        // チェック印の丸が欠けていないか。箱に占める青い画素の割合で見る。
        // 完全な丸なら約 78%。半分が顔に覆われると 40% 台まで落ちる。
        {
          const r = selected.checkRect;
          let blue = 0;
          let total = 0;
          for (let y = Math.round(r.t * 2); y < Math.round(r.b * 2); y += 1) {
            for (let x = Math.round(r.l * 2); x < Math.round(r.r * 2); x += 1) {
              const [pr, , pb] = pixelAt(img, x, y);
              total += 1;
              if (pb - pr >= 90) blue += 1;
            }
          }
          const share = total === 0 ? 0 : blue / total;
          check(
            share >= 0.6,
            `${label}: チェック印の青い丸が欠けている（箱に占める青 ${(share * 100).toFixed(0)}%・60%以上を期待）`,
          );
        }

        const ratios = [];
        for (const [name, box] of Object.entries(boxes)) {
          check(box !== null, `${label}: ${name} が見つからない`);
          if (box === null) continue;
          const m = textContrast(img, box, 2);
          ratios.push(`${name} ${m.ratio.toFixed(1)}`);
          check(
            m.ratio >= 4.5,
            `${label}: ${name} のコントラストが ${m.ratio.toFixed(2)}:1（4.5:1 以上を期待）` +
              ` 文字 rgb(${m.ink.join(',')}) 地 rgb(${m.paper.join(',')})`,
          );
        }

        // --- 下の帯は一覧の外。選んだ人が見えなくなっても使える ---
        const bar = await page.evaluate(() => {
          const grid = document.querySelector('.avatar-grid');
          const list = document.querySelector('.avatar-list');
          const barNode = document.querySelector('.avatar-select__confirm');
          return {
            // スクロールするのは一覧の中だけ。下の帯はその外にある。
            barInsideGrid: grid.contains(barNode) || list.contains(barNode),
            name: document.querySelector('.avatar-select__chosen-name')?.textContent ?? null,
            label: document.querySelector('.avatar-select__chosen-label')?.textContent ?? null,
          };
        });
        check(!bar.barInsideGrid, `${label}: 決定バーがスクロールする一覧の中に入っている`);
        check(bar.label === '旅するあなた', `${label}: 呼び名が「${bar.label}」になっている`);
        check(
          bar.name !== null && bar.name.length >= 2,
          `${label}: 選んだ人の姓名が出ていない（${bar.name}）`,
        );

        const m = await page.evaluate(overflowMetrics);
        check(!m.hScroll, `${label}: 横スクロールが発生している`);
        check(m.small.length === 0, `${label}: タップ領域44px未満 ${m.small.join(', ')}`);

        return (
          ` 完全に見える${before.full}/16人・${before.columns}列・顔${before.faceSize.toFixed(0)}px` +
          `／枠の上下の空白 ${bands.above.toFixed(0)}/${bands.below.toFixed(0)}px` +
          `／到達${reach.reached}人／コントラスト ${ratios.join(' ')}`
        );
      } finally {
        await context.close();
      }
    });
  }

  /*
   * ---- 12. 選んだ人が一覧から完全に見えなくなっても、下の帯は使える ----
   *
   * 320x568 では一覧が1行ぶんしかスクロールしないので、選んだ人を
   * 完全に画面外へ送れない。送れる短い画面で、その状態を作って確かめる。
   */
  {
    await runCase('選んだ人が一覧から消えても決定できる', async () => {
      const context = await browser.newContext({ viewport: { width: 320, height: 480 } });
      try {
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '旅をはじめる' }).click();
        await page.waitForSelector('.avatar-grid');
        await page.locator('.avatar-card').first().click();
        await page.waitForTimeout(150);

        const out = await page.evaluate(() => {
          const grid = document.querySelector('.avatar-grid');
          grid.scrollTop = grid.scrollHeight;
          const g = grid.getBoundingClientRect();
          const top = Math.max(g.top, 0);
          const bottom = Math.min(g.bottom, window.innerHeight);
          const sel = document.querySelector('.avatar-card[aria-selected="true"]');
          const r = sel.getBoundingClientRect();
          const seen = (n) => {
            const b = n.getBoundingClientRect();
            return (
              b.width > 0 &&
              b.height > 0 &&
              b.top >= -0.5 &&
              b.bottom <= window.innerHeight + 0.5 &&
              b.left >= -0.5 &&
              b.right <= window.innerWidth + 0.5
            );
          };
          const btn = [...document.querySelectorAll('button')].find(
            (b) => b.textContent.trim() === 'この人を選ぶ',
          );
          return {
            scrollRange: grid.scrollHeight - grid.clientHeight,
            selectedVisiblePx: Math.max(0, Math.min(r.bottom, bottom) - Math.max(r.top, top)),
            faceSeen: seen(document.querySelector('.avatar-select__chosen .avatar-thumb__face')),
            nameSeen: seen(document.querySelector('.avatar-select__chosen-name')),
            name: document.querySelector('.avatar-select__chosen-name').textContent,
            buttonSeen: seen(btn),
            buttonEnabled: !btn.disabled,
            buttonHeight: btn.getBoundingClientRect().height,
          };
        });
        check(
          out.selectedVisiblePx === 0,
          `選んだ人がまだ ${out.selectedVisiblePx.toFixed(1)}px 見えている（この検査が成り立たない）`,
        );
        check(out.faceSeen, '選んだ人が見えなくなると、下の帯の顔も消える');
        check(out.nameSeen, '選んだ人が見えなくなると、下の帯の姓名も消える');
        check(out.buttonEnabled && out.buttonSeen, '選んだ人が見えなくなると決定ボタンが使えない');
        check(out.buttonHeight >= 44, `決定ボタンが44px未満（${out.buttonHeight.toFixed(1)}）`);

        // 実際に押して、確認画面まで進めること。
        await page.getByRole('button', { name: 'この人を選ぶ' }).click();
        check(
          (await page.locator('.screen--avatar-confirm').count()) === 1,
          '一覧から見えない人を選んだまま確認画面へ進めない',
        );
        return ` 送れる量${out.scrollRange.toFixed(0)}px・選んだ人の見えている高さ0px・姓名「${out.name}」のまま決定できた`;
      } finally {
        await context.close();
      }
    });
  }

  /*
   * ---- 13. キーボードだけで選べる ----
   */
  {
    await runCase('キーボードで選べる', async () => {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
      try {
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '旅をはじめる' }).click();
        await page.waitForSelector('.avatar-grid');
        let hops = 0;
        let onCard = false;
        for (; hops < 40; hops += 1) {
          await page.keyboard.press('Tab');
          onCard = await page.evaluate(
            () => document.activeElement?.classList.contains('avatar-card') ?? false,
          );
          if (onCard) break;
        }
        check(onCard, `Tab を ${hops + 1} 回押しても一覧のカードに移らない`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const after = await page.evaluate(() => ({
          selected: document.querySelectorAll('.avatar-card[aria-selected="true"]').length,
          name: document.querySelector('.avatar-select__chosen-name')?.textContent ?? null,
        }));
        check(after.selected === 1, `Enter で選べない（選択中 ${after.selected} 人）`);
        check(after.name !== null, 'Enter で選んでも下の帯に姓名が出ない');
        return ` Tab ${hops + 1}回でカードへ・Enterで「${after.name}」を選べた`;
      } finally {
        await context.close();
      }
    });
  }

  // ---- 14. prefers-reduced-motion でも会話が読める ----
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
