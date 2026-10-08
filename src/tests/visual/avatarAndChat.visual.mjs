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
import { decodePng, pixelAt, relLum, textContrast } from './pngPixels.mjs';

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

/*
 * 一覧でだけ掛ける、人物ごとの表示倍率。
 * src/data/avatarFraming.ts の AVATAR_DISPLAY_SCALE と同じ値を、配信している
 * ファイル名で引けるようにしたもの（この検査は .ts を読み込めないため）。
 * 表に無い人は 1（＝等倍）。
 */
const DISPLAY_SCALE = {
  // 百瀬陽菜（elementary-f-03）。ChatGPT側のデザイン指定で 1.15 倍。
  'elementary-f-03-replacement-v1-light-v1.webp': 1.15,
};

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

  /*
   * 押せる大きさは、縁の内側（border box）の寸法だけでなく、
   * 「実際に押せる範囲」でも測る。
   *
   * 縁の外へ当たり判定を広げている要素（擬似要素など）があると、寸法だけを
   * 見る測り方では実際より小さく出る。そこで中心から上下左右へ 1px ずつ
   * elementFromPoint で当てていき、そのボタン（またはその子孫）に当たり
   * 続ける範囲を測る。擬似要素に当たった場合は、その持ち主の要素が返る。
   *
   * 会話やダイアログが上に重なっている間は、中心に当てても覆いが返る。
   * そのときは「押せる範囲」を測れないので、寸法で測る（この検査が見るのは
   * 大きさで、覆われているかどうかは別の検査で見ている）。
   */
  const hitSize = (el) => {
    // 直前に別のボタンを表示させた影響で画面外にいることがあるので、入れ直す。
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);
    const hits = (x, y) => {
      if (x < 0 || y < 0 || x > window.innerWidth - 1 || y > window.innerHeight - 1) return false;
      const t = document.elementFromPoint(x, y);
      return t !== null && (t === el || el.contains(t));
    };
    if (!hits(cx, cy)) return { width: r.width, height: r.height, probed: false };
    const reach = (dx, dy) => {
      let n = 0;
      while (n < 80 && hits(cx + dx * (n + 1), cy + dy * (n + 1))) n += 1;
      return n;
    };
    return {
      width: reach(-1, 0) + reach(1, 0) + 1,
      height: reach(0, -1) + reach(0, 1) + 1,
      probed: true,
    };
  };

  const small = buttons
    .map((el) => ({ el, hit: hitSize(el) }))
    .filter(({ hit }) => hit.width < 44 || hit.height < 44)
    .map(({ el, hit }) =>
      `${el.textContent.trim().slice(0, 14)}`
        + `[${hit.probed ? '押せる範囲' : '寸法'} ${hit.width.toFixed(1)}x${hit.height.toFixed(1)}]`,
    );

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

/** 箱の上のほうの、文字が無い帯の平均色。ガラスの「面の色」として使う。 */
function faceColour(img, box, scale, pad = 6) {
  const px = [];
  for (let y = Math.round((box.t + pad) * scale); y < Math.round((box.t + pad + 4) * scale); y += 1) {
    for (let x = Math.round((box.l + pad) * scale); x < Math.round((box.r - pad) * scale); x += 1) {
      px.push(pixelAt(img, x, y));
    }
  }
  if (px.length === 0) return [0, 0, 0];
  return [0, 1, 2].map((i) => Math.round(px.reduce((a, p) => a + p[i], 0) / px.length));
}

const lum8 = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];

/** 一時的に CSS を足して撮る。撮ったら必ず外す。 */
async function shotWithCss(page, css) {
  if (!css) return decodePng(await page.screenshot());
  const tag = await page.addStyleTag({ content: css });
  const buf = await page.screenshot();
  await tag.evaluate((n) => n.remove());
  return decodePng(buf);
}

/*
 * 画像の準備完了待ち（この検査でのみ使う。画像準備待ちを変更した箇所／期限補修版）。
 *
 * 「80人の人物の見え方」は年代タブを押した直後に測っていたため、画像の取得が
 * 終わる前に採寸してしまう余地があった。既存の 300ms はそのまま残し、そのあとで
 * 準備完了を確かめる。class 付与・src・loading・decoding・CSS は一切変えない。
 *
 * 期限は「待機開始から」の capMs を class待ち / img.decode / document.fonts.ready /
 * 描画2フレーム の全段階で共有する。各段階へ残り時間を渡し、残り時間が尽きたら
 * タイマーでタイムアウトを返す。成功した段階のタイマーは必ず解除する。
 * どこかで失敗したら後続の段階へは進まず、止まった段階名・人物ID・src・状態・
 * 経過時間を返して検査を不合格にする。
 */
async function waitAvatarImagesReady(page, expectCards, capMs = 5000) {
  const report = await page.evaluate(
    async ({ expectCards, capMs }) => {
      const t0 = performance.now();
      const left = () => capMs - (performance.now() - t0);
      /** 残り時間つきで待つ。期限が尽きたら { timedOut: true } を返し、タイマーは必ず解除する。 */
      const withDeadline = (promise) => {
        const remaining = left();
        if (remaining <= 0) return Promise.resolve({ timedOut: true });
        let timer = null;
        const guard = new Promise((resolve) => {
          timer = setTimeout(() => resolve({ timedOut: true }), remaining);
        });
        return Promise.race([
          promise.then((value) => ({ timedOut: false, value }), (error) => ({ timedOut: false, error })),
          guard,
        ]).finally(() => { if (timer !== null) clearTimeout(timer); });
      };
      /** 元の顔の img を取る。soft 側の複製は選ばない。 */
      const faceImg = (card) => {
        const face = card.querySelector('.avatar-thumb__face');
        if (!face) return null;
        return (
          [...face.querySelectorAll('.avatar-thumb__img')].find(
            (img) => img.closest('.reference-v23-soft') === null,
          ) || null
        );
      };
      const read = () =>
        [...document.querySelectorAll('.avatar-card')].map((card) => {
          const face = card.querySelector('.avatar-thumb__face');
          const img = faceImg(card);
          return {
            id: img ? (img.getAttribute('src') || '').split('/').pop() : null,
            src: img ? img.getAttribute('src') : null,
            complete: img ? img.complete : false,
            nw: img ? img.naturalWidth : 0,
            nh: img ? img.naturalHeight : 0,
            hasImage: !!face && face.classList.contains('has-image'),
            failed: !!face && face.classList.contains('image-failed'),
          };
        });
      const ready = (s) =>
        s.id !== null && s.complete && s.nw > 0 && s.nh > 0 && s.hasImage && !s.failed;
      const allReady = () => {
        const rows = read();
        return rows.length === expectCards && rows.every(ready);
      };
      const stop = (stage, extra) => {
        const rows = read();
        return {
          ok: false,
          stage,
          cardCount: rows.length,
          classMs,
          decodeMs,
          fontsMs,
          frameMs,
          waitedMs: +(performance.now() - t0).toFixed(1),
          notReady: rows.filter((s) => !ready(s)),
          ...extra,
        };
      };
      let classMs = null;
      let decodeMs = null;
      let fontsMs = null;
      let frameMs = null;

      // 段階1: complete / naturalWidth・Height / has-image / image-failed / カード16枚
      const c0 = performance.now();
      while (!allReady() && left() > 0) {
        await new Promise((resolve) => { setTimeout(resolve, 25); });
      }
      classMs = +(performance.now() - c0).toFixed(1);
      if (!allReady()) return stop('class', { timedOut: true });

      // 段階2: 画像の decode
      const d0 = performance.now();
      const dec = await withDeadline(
        Promise.all(
          [...document.querySelectorAll('.avatar-card')]
            .map(faceImg)
            .filter(Boolean)
            .map((img) => img.decode()),
        ),
      );
      decodeMs = +(performance.now() - d0).toFixed(1);
      if (dec.timedOut) return stop('decode', { timedOut: true });
      if (dec.error !== undefined) {
        return stop('decode', { timedOut: false, decodeError: String((dec.error && dec.error.message) || dec.error) });
      }

      // 段階3: フォント
      const f0 = performance.now();
      const fon = await withDeadline(document.fonts.ready);
      fontsMs = +(performance.now() - f0).toFixed(1);
      if (fon.timedOut) return stop('fonts', { timedOut: true });
      if (fon.error !== undefined) {
        return stop('fonts', { timedOut: false, fontsError: String((fon.error && fon.error.message) || fon.error) });
      }

      // 段階4: 描画2フレーム
      const r0 = performance.now();
      const fr = await withDeadline(
        new Promise((resolve) => {
          requestAnimationFrame(() => { requestAnimationFrame(resolve); });
        }),
      );
      frameMs = +(performance.now() - r0).toFixed(1);
      if (fr.timedOut) return stop('frame', { timedOut: true });

      const rows = read();
      return {
        ok: true,
        stage: 'done',
        cardCount: rows.length,
        classMs,
        decodeMs,
        fontsMs,
        frameMs,
        waitedMs: +(performance.now() - t0).toFixed(1),
        notReady: rows.filter((s) => !ready(s)),
      };
    },
    { expectCards, capMs },
  );
  return report;
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

        // 「この人になって旅をはじめる」も1行・44px以上・横あふれなし。
        const startBtn = await buttonLines(page, 'この人になって旅をはじめる');
        check(startBtn !== null, `${label}: 「この人になって旅をはじめる」が見つからない`);
        check(startBtn?.lines === 1, `${label}: 「この人になって旅をはじめる」が${startBtn?.lines}行になっている`);
        check(
          startBtn?.height >= 44,
          `${label}: 「この人になって旅をはじめる」が44px未満（${startBtn?.height.toFixed(1)}）`,
        );
        check(!startBtn?.overflow, `${label}: 「この人になって旅をはじめる」が横にあふれている`);

        const notesOnConfirm = await forbiddenNotesOnScreen(page);
        check(
          notesOnConfirm.length === 0,
          `${label}: 確認画面に開発者向けの説明が残っている（${notesOnConfirm.join(' / ')}）`,
        );

        await page.getByRole('button', { name: 'この人になって旅をはじめる' }).click();

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
        await page.getByRole('button', { name: 'この人になって旅をはじめる' }).click();
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
   * ---- 12. 選択ボタンのガラス調 ----
   *
   * 「透けているか」は、画面の地色だけを白と黒に差し替えて測る。
   *   透過率 = (白地のときの面の明るさ - 黒地のときの面の明るさ) / 255
   *   1.0 … 背後がそのまま見える   0 … まったく透けない
   * 平らな地色なので、ぼかしの強さに左右されない。この地色は測定のためだけで、
   * 製品の画面には出さない。
   *
   * あわせて「面の色の系統が変わっていないか」「文字が読めるか」も見る。
   */
  for (const vp of [
    { width: 320, height: 568 },
    { width: 393, height: 852 },
  ]) {
    const label = `${vp.width}x${vp.height}`;
    await runCase(`${label} 選択ボタンのガラス調`, async () => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });
      try {
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '旅をはじめる' }).click();
        await page.waitForSelector('.avatar-grid');
        await page.locator('.avatar-card').nth(5).click();
        await page.waitForTimeout(500);

        /*
         * name      … 報告に出す呼び名
         * selector  … 測る要素
         * pass      … 求める透過率の範囲 [下限, 上限]
         * minBlue   … 青系として求める「青−赤」の下限（白系は null）
         *
         * 求める値は、採用済みの指定から1つずつ導いてある。
         *
         * 1) 年代タブ・この人を選ぶ … base.css の共通の青ガラス
         *    background-color: var(--glass-base)（rgb(37,84,236)・不透明）に
         *    不透明なグラデーション2枚を重ねる作りなので、背後は通らない。
         *    透過率は 0 が正しい（実測 0.00）。0.05 までを許す。
         *    以前の 0.6 / 0.12 は、白いガラスだったころの値。
         *
         * 2) 絞り込み … base.css の .btn--soft（淡い青）
         *    --glass-face-soft の不透明度は 0.86 なので、通るのは 0.14。
         *    さらに blur(7px) が模様をならすので、これ以上には上がらない
         *    （実測 0.14）。0.10〜0.25 を求める。
         *    以前の 0.6 / 0.5 は、ずっと薄い面だったころの値。
         *
         * 3) 人物カード … avatar.css の白い半透明の面
         *    rgba(255,255,255,0.24〜0.14) + blur(6px)。よく通る（実測で合格）。
         *    ここは変えていない。
         */
        const TARGETS = [
          { name: '年代タブ 未選択', selector: '.avatar-tab:not([aria-selected="true"])', pass: [0, 0.05], minBlue: 80 },
          { name: '年代タブ 選択中', selector: ".avatar-tab[aria-selected='true']", pass: [0, 0.05], minBlue: 80 },
          { name: '絞り込み 未押下', selector: '.avatar-filter__btn:not([aria-pressed="true"])', pass: [0.10, 0.25], minBlue: 55 },
          { name: '絞り込み 押している', selector: ".avatar-filter__btn[aria-pressed='true']", pass: [0.10, 0.25], minBlue: 55 },
          { name: '人物カード 未選択', selector: '.avatar-card:not([aria-selected="true"])', pass: [0.5, 1], minBlue: null },
          // 選択中のカードも淡い青。濃い青に塗り替えない。
          { name: '人物カード 選択中', selector: ".avatar-card[aria-selected='true']", pass: [0.45, 1], minBlue: 18 },
          { name: 'この人を選ぶ', selector: '.avatar-select__confirm .btn--primary', pass: [0, 0.05], minBlue: 80 },
        ];

        const boxes = await page.evaluate((sels) => {
          const out = {};
          for (const sel of sels) {
            const n = document.querySelector(sel);
            if (n === null) { out[sel] = null; continue; }
            const r = n.getBoundingClientRect();
            out[sel] = { l: r.left, r: r.right, t: r.top, b: r.bottom };
          }
          return out;
        }, TARGETS.map((t) => t.selector));

        const screenBg = (c) => `.screen{background:${c} !important;background-image:none !important;}`;
        /*
         * 面の色を測るときは、そのボタンの中身（顔・名前・チェック印）を一時的に
         * 隠す。隠さないと、狭い画面では顔やチェック印の画素を拾ってしまい、
         * 面の色として読めない。中身を隠しても面の指定は変わらない。
         */
        const bare = `${TARGETS.map((t) => `${t.selector} > *`).join(',')}{visibility:hidden !important;}`
          /*
           * 年代タブと絞り込みの文字は、要素の子ではなく直接の文字なので
           * 「> * を隠す」では消えない。面の色と内側の光を測るときに白い文字を
           * 拾ってしまうので、文字の色だけ透明にする。面の指定は変わらない。
           */
          + ` ${TARGETS.map((t) => t.selector).join(',')}{color:transparent !important;}`;
        const normal = await shotWithCss(page, '');
        const bareShot = await shotWithCss(page, bare);
        const onWhite = await shotWithCss(page, `${screenBg('#ffffff')} ${bare}`);
        const onBlack = await shotWithCss(page, `${screenBg('#000000')} ${bare}`);

        const notes = [];
        for (const t of TARGETS) {
          const box = boxes[t.selector];
          check(box !== null && box !== undefined, `${label}: ${t.name} が見つからない`);
          if (!box) continue;
          const pass = (lum8(faceColour(onWhite, box, 2)) - lum8(faceColour(onBlack, box, 2))) / 255;
          const col = faceColour(bareShot, box, 2);
          check(
            pass >= t.pass[0] && pass <= t.pass[1],
            `${label}: ${t.name} の透過率が採用済みの面と合わない`
              + `（透過率 ${pass.toFixed(2)}・${t.pass[0]}〜${t.pass[1]} を期待）`,
          );
          if (t.minBlue === null) {
            /*
             * 白い面の見分け方。
             *
             * 以前は「3原色がどれも 200 以上」を求めていたが、これは透けた
             * ガラスには合わない。よく透ける白いガラスは背後の空の青を拾って
             * 当然だからで、実際 rgb(195,230,254) で落ちた。
             * いまは「十分に明るいこと」と「青く塗られていないこと」で見る。
             * 青く塗り替えたら（逆検証D）明るさが落ちるので検出できる。
             */
            check(
              lum8(col) >= 195 && Math.min(...col) >= 165,
              `${label}: ${t.name} の面が明るくない rgb(${col.join(',')})・明るさ ${lum8(col).toFixed(0)}`,
            );
            check(
              col[2] - col[0] <= 70,
              `${label}: ${t.name} の面が青く塗られている rgb(${col.join(',')})`,
            );
          } else {
            check(
              col[2] - col[0] >= t.minBlue,
              `${label}: ${t.name} の面が青系でない rgb(${col.join(',')})・青−赤 ${col[2] - col[0]}`,
            );
          }
          const tx = textContrast(normal, box, 2);
          check(
            tx.ratio >= 4.5,
            `${label}: ${t.name} の文字が読みにくい（${tx.ratio.toFixed(2)}:1・4.5:1 以上を期待）`,
          );
          notes.push(`${t.name} ${pass.toFixed(2)}`);
        }

        /*
         * 顔のうしろの丸い地色も透けること。
         *
         * 人物画像は背景のない切り抜きで、顔のうしろの丸い色はこの地色そのもの。
         * ここが不透明だと、カードを透かしても顔のまわりだけ色の板が残る。
         * 人物画像だけを隠して、丸の地色そのものを測る。
         */
        {
          const discBox = await page.evaluate(() => {
            const n = document.querySelector('.avatar-card .avatar-thumb__face');
            const r = n.getBoundingClientRect();
            return { l: r.left, r: r.right, t: r.top, b: r.bottom };
          });
          const hideImg = '.avatar-card .avatar-thumb__img{visibility:hidden !important;}';
          const discWhite = await shotWithCss(page, `${screenBg('#ffffff')} ${hideImg}`);
          const discBlack = await shotWithCss(page, `${screenBg('#000000')} ${hideImg}`);
          const pad = Math.round(Math.min(discBox.r - discBox.l, discBox.b - discBox.t) * 0.3);
          const discPass =
            (lum8(faceColour(discWhite, discBox, 2, pad)) - lum8(faceColour(discBlack, discBox, 2, pad))) / 255;
          check(
            discPass >= 0.4,
            `${label}: 顔のうしろの丸い地色が透けていない（透過率 ${discPass.toFixed(2)}・0.4 以上を期待）`,
          );
          notes.push(`顔のうしろの丸 ${discPass.toFixed(2)}`);
        }

        /*
         * --- 内側の縁から白い光がにじんでいるか（実際に描かれた画素で確認） ---
         *
         * 画面の地色を平らな中間色にして、面の明るさが場所によってどう変わるかを見る。
         * 内側に光があれば、縁のすぐ内（2〜5px）が真ん中より明るくなる。
         * 背景の模様に左右されないよう、地色は平らにして測る。
         */
        {
          const flat = await shotWithCss(page, `${screenBg('#7f7f7f')} ${bare}`);
          const glowTargets = [
            ['人物カード 未選択', '.avatar-card:not([aria-selected="true"])'],
            ['年代タブ 未選択', '.avatar-tab:not([aria-selected="true"])'],
          ];
          for (const [name, sel] of glowTargets) {
            const box = boxes[sel];
            if (!box) continue;
            const mean = (x0, x1, y0, y1) => {
              let sum = 0;
              let n = 0;
              for (let y = Math.round(y0 * 2); y < Math.round(y1 * 2); y += 1) {
                for (let x = Math.round(x0 * 2); x < Math.round(x1 * 2); x += 1) {
                  sum += lum8(pixelAt(flat, x, y));
                  n += 1;
                }
              }
              return n === 0 ? 0 : sum / n;
            };
            const w = box.r - box.l;
            const h = box.b - box.t;
            // 縁のすぐ内（上辺から 2〜5px）と、真ん中の帯
            const edge = mean(box.l + 8, box.r - 8, box.t + 2, box.t + 5);
            const middle = mean(box.l + 8, box.r - 8, box.t + h / 2 - 2, box.t + h / 2 + 2);
            check(
              edge - middle >= 4,
              `${label}: ${name} の内側に光が見えない（縁 ${edge.toFixed(0)} / 中 ${middle.toFixed(0)}・差4以上を期待）`,
            );
            notes.push(`${name}の内側の光 +${(edge - middle).toFixed(0)}`);
            if (w <= 0) break;
          }
        }

        /*
         * --- 人物のなじませ（実際に描かれた画素で確認） ---
         *
         * 1) なじませの形そのもの
         *    絵柄を箱の外へ追い出し、代わりに黒い地色を敷く。白い地の上で撮ると
         *    「黒がどれだけ残っているか」が、そのまま2枚のマスクの掛け算になる。
         *      なじませ = 1 - 明るさ / 255
         *    これで、絵柄の中身に左右されずにマスクの形だけを測れる。
         */
        {
          const maskCss = `
${screenBg('#ffffff')}
.avatar-list,.avatar-card{background:none !important;backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;box-shadow:none !important;border-color:transparent !important;}
.avatar-thumb__name,.avatar-card__check{visibility:hidden !important;}
.avatar-list .avatar-card .avatar-thumb__img{object-fit:none !important;
  object-position:-4000px -4000px !important;background:#000 !important;}`;
          const faceBox = await page.evaluate(() => {
            const n = document.querySelector('.avatar-card:not([aria-selected="true"]) .avatar-thumb__face');
            if (n === null) return null;
            const r = n.getBoundingClientRect();
            return { l: r.left, t: r.top, w: r.width, h: r.height };
          });
          check(faceBox !== null, `${label}: 人物の表示領域が見つからない`);
          if (faceBox) {
            const shot = await shotWithCss(page, maskCss);
            // 箱の中の相対位置（0〜1）での、なじませの強さ。
            const maskAt = (fx, fy) => {
              const x = Math.round((faceBox.l + faceBox.w * fx) * 2);
              const y = Math.round((faceBox.t + faceBox.h * fy) * 2);
              return 1 - lum8(pixelAt(shot, x, y)) / 255;
            };
            const keep = [
              ['顔の中心', 0.5, 0.35],
              ['髪の左端', 0.11, 0.5],
              ['髪の右端', 0.89, 0.5],
              ['頭の上', 0.5, 0.06],
            ];
            for (const [name, fx, fy] of keep) {
              const v = maskAt(fx, fy);
              check(v >= 0.95, `${label}: ${name} が薄くなっている（残り ${v.toFixed(2)}・0.95 以上を期待）`);
            }
            const bottomMid = maskAt(0.5, 0.94);
            const corners = [
              ['下の左角', maskAt(0.08, 0.94)],
              ['下の右角', maskAt(0.92, 0.94)],
            ];
            for (const [name, v] of corners) {
              check(v <= 0.08, `${label}: ${name} が消えていない（残り ${v.toFixed(2)}・0.08 以下を期待）`);
              /*
               * 「下端だけを水平に消す」やり方だと、角と下辺の中央が同じ値になる。
               * 角のほうが先に消えていることを求めて、肩の左右へも移行があると確かめる。
               */
              check(
                bottomMid - v >= 0.1,
                `${label}: ${name} と下辺の中央が同じ（角 ${v.toFixed(2)} / 中央 ${bottomMid.toFixed(2)}）`,
              );
            }
            for (const [name, fx, fy, max] of [
              ['下辺', 0.5, 1.0, 0.08],
              ['左辺', 0.02, 0.8, 0.25],
              ['右辺', 0.98, 0.8, 0.25],
            ]) {
              const v = maskAt(fx, fy);
              check(v <= max, `${label}: ${name} の切り口が残っている（残り ${v.toFixed(2)}・${max} 以下を期待）`);
            }
            /*
             * 段差が無いこと。
             *
             * 見るのは「変化の大きさ」ではなく「変化の変わりかた」（2階差分）。
             * なめらかに落ちている限り、急な坂でもここは小さいままになる。
             * 一段落ちる場所があると、ここだけが跳ね上がる。
             * 外周2画素は撮影の切り口なので外して測る。
             */
            let step = 0;
            const x0 = Math.round(faceBox.l * 2) + 3;
            const x1 = Math.round((faceBox.l + faceBox.w) * 2) - 3;
            const y0 = Math.round((faceBox.t + faceBox.h * 0.6) * 2);
            const y1 = Math.round((faceBox.t + faceBox.h) * 2) - 3;
            for (let y = y0; y < y1; y += 1) {
              for (let x = x0; x < x1; x += 1) {
                const here = lum8(pixelAt(shot, x, y));
                const dx = Math.abs(lum8(pixelAt(shot, x + 1, y)) - here - (here - lum8(pixelAt(shot, x - 1, y))));
                const dy = Math.abs(lum8(pixelAt(shot, x, y + 1)) - here - (here - lum8(pixelAt(shot, x, y - 1))));
                step = Math.max(step, dx, dy);
              }
            }
            check(step <= 24, `${label}: なじませが途中で折れている（${step.toFixed(0)}・24 以下を期待）`);
            notes.push(`なじませ 角 ${corners[0][1].toFixed(2)}/中央 ${bottomMid.toFixed(2)}・折れ ${step.toFixed(0)}`);
          }

          /*
           * 2) なじませの途中で、背後（ガラスと景色）が本当に見えること。
           *    不透明な白い帯で消したように見せていないことの確認でもある。
           *    画面の地を白と黒に変えて、その場所の明るさがどれだけ動くかを測る。
           */
          if (faceBox) {
            /*
             * 名前とチェック印は隠して撮る。
             *
             * ここで測るのは「人物のなじませの途中で背後が見えるか」。
             * 名前は人物と重なる位置にある別の要素で、文字は透けない。
             * 狭い画面ではカードが低く、名前が人物の下のほうへ食い込むため、
             * 測る帯に文字が入って透過率が下がっていた（320x568 で 0.20、
             * 393x852 では入らないので合格、という測り方のぶれ）。
             * 名前そのものの読みやすさは、別のところで測っている。
             */
            const hideName = '.avatar-thumb__name,.avatar-card__check'
              + '{visibility:hidden !important;}';
            const onW = await shotWithCss(page, `${screenBg('#ffffff')} ${hideName}`);
            const onK = await shotWithCss(page, `${screenBg('#000000')} ${hideName}`);
            /*
             * 測る窓は、画素数ではなく箱に対する割合で取る。
             *
             * ±2画素の窓にしていたときは、箱の大きさで窓の相対的な広さが変わり
             * （320x568 では箱の 3.9%、393x852 では 3.1%）、なじませが急に変わる
             * 高さでは同じ場所を測ったことにならなかった。
             * 求める値（0.3）は変えずに、窓を割合で取り直す。
             */
            const seeAt = (fx, fy) => {
              let sw = 0;
              let sk = 0;
              let n = 0;
              const x0 = Math.round((faceBox.l + faceBox.w * (fx - 0.08)) * 2);
              const x1 = Math.round((faceBox.l + faceBox.w * (fx + 0.08)) * 2);
              const y0 = Math.round((faceBox.t + faceBox.h * (fy - 0.03)) * 2);
              const y1 = Math.round((faceBox.t + faceBox.h * (fy + 0.03)) * 2);
              for (let y = y0; y <= y1; y += 1) {
                for (let x = x0; x <= x1; x += 1) {
                  sw += lum8(pixelAt(onW, x, y));
                  sk += lum8(pixelAt(onK, x, y));
                  n += 1;
                }
              }
              return (sw - sk) / n / 255;
            };
            /*
             * 測る場所は「なじませが半分ほど効いている高さ」。
             * 人物をカードいっぱいに広げたぶん、服は前より下まで残るように
             * したので、この高さも下へ移した（求める値 0.3 は変えていない）。
             * 設計上ここのなじませは 0.4 前後で、上の形の測定と対になっている。
             */
            const fade = seeAt(0.5, 0.95);
            check(
              fade >= 0.3,
              `${label}: なじませの途中で背後が見えない（透過率 ${fade.toFixed(2)}・0.3 以上を期待）`,
            );
            const faceSolid = seeAt(0.5, 0.35);
            check(
              faceSolid <= 0.12,
              `${label}: 顔が透けている（透過率 ${faceSolid.toFixed(2)}・0.12 以下を期待）`,
            );
            notes.push(`なじませの途中の透過率 ${fade.toFixed(2)}`);
          }
        }

        // 顔の画像と名前は薄くしない（要素全体の opacity を使っていない）。
        const solid = await page.evaluate(() => {
          const card = document.querySelector('.avatar-card');
          const img = card.querySelector('.avatar-thumb__img');
          const name = card.querySelector('.avatar-thumb__name');
          const o = (n) => (n === null ? null : Number(getComputedStyle(n).opacity));
          return { card: o(card), img: o(img), name: o(name) };
        });
        check(solid.card === 1, `${label}: カード全体が薄くなっている（opacity ${solid.card}）`);
        check(solid.img === 1, `${label}: 顔の画像が薄くなっている（opacity ${solid.img}）`);
        check(solid.name === 1, `${label}: 名前が薄くなっている（opacity ${solid.name}）`);

        // キーボードで選んでいる場所は、選択中の青とも見分けられる。
        let focused = null;
        for (let i = 0; i < 40; i += 1) {
          await page.keyboard.press('Tab');
          focused = await page.evaluate(() => {
            const a = document.activeElement;
            if (!a || !a.classList.contains('avatar-card')) return null;
            const cs = getComputedStyle(a);
            const sel = document.querySelector('.avatar-card[aria-selected="true"]');
            return {
              selected: a.getAttribute('aria-selected') === 'true',
              outline: cs.outlineColor,
              width: parseFloat(cs.outlineWidth),
              offset: parseFloat(cs.outlineStyle === 'none' ? '0' : cs.outlineOffset),
              selectedBorder: sel ? getComputedStyle(sel).borderTopColor : null,
            };
          });
          if (focused && !focused.selected) break;
        }
        check(focused !== null, `${label}: Tab でカードへ移れない`);
        if (focused) {
          check(focused.width >= 3, `${label}: フォーカスの輪が細い（${focused.width}px）`);
          check(focused.offset >= 1, `${label}: フォーカスの輪が要素に密着している`);
          check(
            focused.outline !== focused.selectedBorder,
            `${label}: フォーカスの輪が選択中の縁と同じ色（${focused.outline}）`,
          );
        }

        return ` 透過率 ${notes.join(' / ')}`;
      } finally {
        await context.close();
      }
    });
  }

  /*
   * ---- 13. backdrop-filter が効かない環境でも読める ----
   *
   * 青い面の暗さは backdrop-filter の brightness で作っているので、効かないと
   * 面が淡くなり白文字が読めなくなる。効かない環境向けの指定（@supports not）が
   * 実際に効くかを、その指定を CSS から読み出して当てることで確かめる。
   * 指定の中身をこの検査に書き写すと検査の意味が無くなるので、
   * 出荷する CSS から取り出して使う。
   */
  {
    await runCase('backdrop-filter が効かない環境', async () => {
      const context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 2,
      });
      try {
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '旅をはじめる' }).click();
        await page.waitForSelector('.avatar-grid');
        await page.locator('.avatar-card').nth(5).click();
        await page.waitForTimeout(400);

        // 出荷する CSS の中から、効かない環境向けの指定を取り出す。
        const fallbackCss = await page.evaluate(() => {
          const out = [];
          for (const sheet of document.styleSheets) {
            let rules;
            try {
              rules = sheet.cssRules;
            } catch {
              continue;
            }
            for (const rule of rules) {
              if (
                rule.constructor.name === 'CSSSupportsRule' &&
                rule.conditionText.includes('backdrop-filter')
              ) {
                for (const inner of rule.cssRules) out.push(inner.cssText);
              }
            }
          }
          return out.join('\n');
        });
        check(
          fallbackCss.length > 0,
          'backdrop-filter が効かない環境向けの指定が CSS に無い',
        );

        const TARGETS = [
          ['年代タブ 選択中', ".avatar-tab[aria-selected='true']"],
          ['この人を選ぶ', '.avatar-select__confirm .btn--primary'],
          ['年代タブ 未選択', '.avatar-tab:not([aria-selected="true"])'],
          ['人物カード 未選択', '.avatar-card:not([aria-selected="true"])'],
        ];
        const boxes = await page.evaluate((sels) => {
          const out = {};
          for (const sel of sels) {
            const n = document.querySelector(sel);
            if (n === null) { out[sel] = null; continue; }
            const r = n.getBoundingClientRect();
            out[sel] = { l: r.left, r: r.right, t: r.top, b: r.bottom };
          }
          return out;
        }, TARGETS.map(([, sel]) => sel));

        const off = '*{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}';
        // ぼかしだけを止めたとき（代替指定が無い場合の見え方）
        const bare = await shotWithCss(page, off);
        // 代替指定も一緒に当てたとき（実際の環境での見え方）
        const withFallback = await shotWithCss(page, `${off} ${fallbackCss}`);

        const notes = [];
        for (const [name, sel] of TARGETS) {
          const box = boxes[sel];
          if (!box) continue;
          const a = textContrast(bare, box, 2).ratio;
          const b = textContrast(withFallback, box, 2).ratio;
          check(
            b >= 4.5,
            `393x852: ${name} が、ぼかしの効かない環境で読みにくい（${b.toFixed(2)}:1・4.5:1 以上を期待）`,
          );
          notes.push(`${name} ${a.toFixed(1)}→${b.toFixed(1)}`);
        }
        return ` 代替指定なし→あり ${notes.join(' / ')}`;
      } finally {
        await context.close();
      }
    });
  }

  /*
   * ---- 13-B. 80人ぜんぶの見え方 ----
   *
   * 人物をカードいっぱいに広げたので、1人ずつ確かめる。
   *   ・顔や髪が切れていないか（描いた画像がカードの中に収まっているか）
   *   ・不自然に引き伸ばされていないか（正方形のまま・切り取り無し）
   *   ・頭のてっぺんがそろっているか
   *   ・名前が読めるか
   * 393x852 は16人とも一度に見えるので、年代ごとに1枚撮って測る。
   */
  {
    await runCase('80人の人物の見え方', async () => {
      const context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 2,
      });
      try {
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '旅をはじめる' }).click();
        await page.waitForSelector('.avatar-grid');

        const AGES = ['小学生', '中学生', '高校生', '大学生', '大人'];
        const seen = new Set();
        let worstContrast = Infinity;
        let headSpread = 0;
        const headTops = [];

        const readyLog = [];
        for (const age of AGES) {
          await page.locator('.avatar-tab', { hasText: age }).click();
          await page.waitForTimeout(300);

          // 0) 画像の準備完了を待つ。満たせなければこのケースを不合格にする。
          const ready = await waitAvatarImagesReady(page, 16);
          readyLog.push({ age, ...ready });
          check(
            ready.ok,
            `${age}: 画像の準備が整わないまま測ろうとした`
              + `（止まった段階 ${ready.stage}・待ち合計 ${ready.waitedMs}ms`
              + `・class ${ready.classMs}ms / decode ${ready.decodeMs}ms`
              + ` / fonts ${ready.fontsMs}ms / frame ${ready.frameMs}ms`
              + `・カード ${ready.cardCount}枚`
              + `${ready.timedOut === true ? '・期限切れ' : ''}`
              + `${ready.decodeError === undefined ? '' : `・decode失敗 ${ready.decodeError}`}`
              + `${ready.fontsError === undefined ? '' : `・fonts失敗 ${ready.fontsError}`}`
              + `・未準備 ${ready.notReady.length}件`
              + `${ready.notReady.length === 0 ? '' : ` ${ready.notReady
                  .map((s) => `${s.id || 'src無し'}[complete=${s.complete} nw=${s.nw}x${s.nh}`
                    + ` has-image=${s.hasImage} image-failed=${s.failed}]`)
                  .join(' / ')}`}）`,
          );

          // 1) 寸法は画素を撮らずに読める。切り取り・引き伸ばし・はみ出しをここで見る。
          const geo = await page.evaluate(() => {
            return [...document.querySelectorAll('.avatar-card')].map((card) => {
              const img = card.querySelector('.avatar-thumb__img');
              const cr = card.getBoundingClientRect();
              const ir = img.getBoundingClientRect();
              const cs = getComputedStyle(img);
              /*
               * カードが絵を切り取る境界は、縁の内側（padding box）。
               * 縁の太さは画素密度で丸められるので、計算済みの値から引く。
               */
              const cc = getComputedStyle(card);
              const box = {
                left: cr.left + parseFloat(cc.borderLeftWidth),
                right: cr.right - parseFloat(cc.borderRightWidth),
                top: cr.top + parseFloat(cc.borderTopWidth),
                bottom: cr.bottom - parseFloat(cc.borderBottomWidth),
              };
              /*
               * 「人物が切れていないか」は、画像の箱ではなく人物そのもので見る。
               *
               * 画像は背景のない切り抜きで、左右と上下に透明な余白がある。
               * 表示倍率を掛けている人（AVATAR_DISPLAY_SCALE）は箱がカードより
               * 大きくなり、カードの overflow: hidden で両端が落ちるが、落ちるのが
               * 透明な余白だけなら人物は切れていない。そこで、その場で画像を
               * canvas へ描いて α>127 の画素が占める範囲を測り、それを画面上の
               * 位置へ直してカードの中に収まっているかを見る。
               * 画像は同じ場所から配信しているので canvas は汚染されない。
               */
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              let oL = canvas.width;
              let oR = -1;
              let oT = canvas.height;
              let oB = -1;
              for (let y = 0; y < canvas.height; y += 1) {
                for (let x = 0; x < canvas.width; x += 1) {
                  if (px[(y * canvas.width + x) * 4 + 3] > 127) {
                    if (x < oL) oL = x;
                    if (x > oR) oR = x;
                    if (y < oT) oT = y;
                    if (y > oB) oB = y;
                  }
                }
              }
              // 正方形の画像を正方形の箱へ contain で置くので、箱＝表示範囲。
              const sx = (ir.right - ir.left) / canvas.width;
              const sy = (ir.bottom - ir.top) / canvas.height;
              const person = {
                left: ir.left + oL * sx,
                right: ir.left + (oR + 1) * sx,
                top: ir.top + oT * sy,
                bottom: ir.top + (oB + 1) * sy,
              };
              return {
                id: (img.getAttribute('src') || '').split('/').pop(),
                fit: cs.objectFit,
                square: img.naturalWidth === img.naturalHeight,
                // 縁の内側の幅に対する、画像の表示幅の比（＝掛かっている表示倍率）。
                widthRatio: (ir.right - ir.left) / (box.right - box.left),
                opaque: oR >= 0,
                // 人物の不透明な画素が、切り取り境界の外へどれだけ出ているか（px）。
                outside: {
                  left: box.left - person.left,
                  right: person.right - box.right,
                  top: box.top - person.top,
                  bottom: person.bottom - box.bottom,
                },
              };
            });
          });
          check(geo.length === 16, `${age}: 16人ではなく ${geo.length} 人`);
          for (const g of geo) {
            seen.add(g.id);
            check(g.fit === 'contain', `${g.id}: 切り取る指定になっている（${g.fit}）`);
            check(g.square, `${g.id}: 画像が正方形ではない（引き伸ばしの恐れ）`);
            check(g.opaque, `${g.id}: 不透明な画素が無い（画像が読めていない恐れ）`);
            /*
             * 表示倍率は、採用済みの指定（src/data/avatarFraming.ts の
             * AVATAR_DISPLAY_SCALE）どおりかを1人ずつ見る。表に無い人は等倍。
             * 等倍の人がカード幅より小さく出たら、広がっていないということ。
             */
            const want = DISPLAY_SCALE[g.id] ?? 1;
            check(
              g.widthRatio >= want - 0.03,
              `${g.id}: 人物がカード幅まで広がっていない`
                + `（${(g.widthRatio * 100).toFixed(0)}%・期待 ${(want * 100).toFixed(0)}%）`,
            );
            check(
              g.widthRatio <= want + 0.03,
              `${g.id}: 表示倍率が採用済みの指定より大きい`
                + `（${(g.widthRatio * 100).toFixed(0)}%・期待 ${(want * 100).toFixed(0)}%）`,
            );
            for (const [dir, over] of Object.entries(g.outside)) {
              check(
                over <= 0.6,
                `${g.id}: 人物がカードの${
                  { left: '左', right: '右', top: '上', bottom: '下' }[dir]
                }へ ${over.toFixed(1)}px 出ていて、切れている`,
              );
            }
          }

          /*
           * 2) 頭のてっぺんと名前の読みやすさは、実際に描かれた画素で測る。
           *    ガラスを外して地を白にし、白でない画素が最初に出る行を頭とする。
           */
          const boxes = await page.evaluate(() =>
            [...document.querySelectorAll('.avatar-card')].map((card) => {
              const cr = card.getBoundingClientRect();
              const nr = card.querySelector('.avatar-thumb__name').getBoundingClientRect();
              const img = card.querySelector('.avatar-thumb__img');
              return {
                id: (img.getAttribute('src') || '').split('/').pop(),
                card: { l: cr.left, t: cr.top, r: cr.right, b: cr.bottom },
                name: { l: nr.left, t: nr.top, r: nr.right, b: nr.bottom },
              };
            }),
          );

          const plain = await shotWithCss(
            page,
            `.screen{background:#ffffff !important;background-image:none !important;}
             .avatar-list,.avatar-card{background:none !important;backdrop-filter:none !important;
               -webkit-backdrop-filter:none !important;box-shadow:none !important;
               border-color:transparent !important;}
             .avatar-thumb__name,.avatar-card__check{visibility:hidden !important;}`,
          );
          for (const b2 of boxes) {
            const x0 = Math.round(b2.card.l * 2) + 3;
            const x1 = Math.round(b2.card.r * 2) - 3;
            const y0 = Math.round(b2.card.t * 2) + 2;
            const y1 = Math.round(b2.card.b * 2) - 2;
            let top = null;
            for (let y = y0; y < y1 && top === null; y += 1) {
              for (let x = x0; x < x1; x += 1) {
                const q = pixelAt(plain, x, y);
                if (q[0] < 235 || q[1] < 235 || q[2] < 235) { top = y; break; }
              }
            }
            check(top !== null, `${b2.id}: 人物が描かれていない`);
            if (top !== null) headTops.push(top / 2 - b2.card.t);
          }

          // 名前は通常の表示で測る（人物と重なった状態での読みやすさ）。
          const normalShot = await shotWithCss(page, '');
          for (const b2 of boxes) {
            const tx = textContrast(normalShot, b2.name, 2);
            worstContrast = Math.min(worstContrast, tx.ratio);
            check(
              tx.ratio >= 4.5,
              `${b2.id}: 名前が読みにくい（${tx.ratio.toFixed(2)}:1・4.5:1 以上を期待）`,
            );
          }
        }

        check(seen.size === 80, `80人ではなく ${seen.size} 人しか見ていない`);
        headSpread = Math.max(...headTops) - Math.min(...headTops);
        check(
          headSpread <= 3,
          `頭のてっぺんがそろっていない（ばらつき ${headSpread.toFixed(1)}px・3px 以内を期待）`,
        );
        const waited = readyLog
          .map((r) => `${r.age} 合計${r.waitedMs}（class${r.classMs}/decode${r.decodeMs}`
            + `/fonts${r.fontsMs}/frame${r.frameMs}）ms`)
          .join(' ');
        return `80人・切れ0件・頭のばらつき ${headSpread.toFixed(1)}px・名前の最小コントラスト ${worstContrast.toFixed(2)}`
          + `／画像準備待ち ${waited}`;
      } finally {
        await context.close();
      }
    });
  }

  /*
   * ---- 13-C. カードの切り取りで、見えている絵が落ちていないか ----
   *
   * 一覧のカードは overflow: hidden で角丸の外を切り取る。人物の画像はカードの
   * 幅いっぱいに置いてあり、1人だけ表示倍率（1.15倍）が掛かっているので、
   * 画像の箱はカードの外へ出る。出ているのが透明な余白や、なじませ（mask）で
   * 消えきった部分であれば、人物は切れていない。箱の位置だけを見ても、
   * 画像のアルファ値だけを見ても、そこは分からない。
   *
   * そこで「切り取りあり」と「切り取りなし（overflow: visible）」で撮り比べる。
   * 差が出た画素＝切り取りで消えた画素で、なじませを含んだ実際の描画で測れる。
   *
   * 角丸と画素の端では必ず差が出る（実測：境界から 1px 以内・最大 19/255）。
   * 見るのは「縁の内側より 1px 以上外で消えた画素」で、ここに差が出るのは
   * 絵そのものが落ちたときだけ。実際にこの測り方で、375x667 で陽菜の服のすそが
   * 3.6px ぶん横一文字に切れていること（836点・最大の差 91/255）を見つけた。
   *
   * 測るのは画面の高さが低い2サイズ。カードの高さに余裕がないので、絵の下端が
   * 切り取り線を越えるのはここで起きる（393x852 では絵の下端が切り取り線より
   * 31px 内側にある）。
   */
  {
    await runCase('カードの切り取りで絵が落ちていない', async () => {
      const PLAIN = `.screen{background:#ffffff !important;background-image:none !important;}
         .avatar-list,.avatar-card{background:none !important;backdrop-filter:none !important;
           -webkit-backdrop-filter:none !important;box-shadow:none !important;
           border-color:transparent !important;}
         .avatar-thumb__name,.avatar-card__check{visibility:hidden !important;}`;
      const notes = [];
      for (const [w, h] of [[375, 667], [320, 568]]) {
        const context = await browser.newContext({
          viewport: { width: w, height: h },
          deviceScaleFactor: 2,
        });
        try {
          const page = await context.newPage();
          await page.goto(baseUrl, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: '旅をはじめる' }).click();
          await page.waitForSelector('.avatar-grid');

          let worstOutside = 0;
          let worstCorner = 0;
          for (const age of ['小学生', '中学生', '高校生', '大学生', '大人']) {
            await page.locator('.avatar-tab', { hasText: age }).click();
            await page.waitForTimeout(300);
            const ready = await waitAvatarImagesReady(page, 16);
            check(ready.ok, `${w}x${h}/${age}: 画像の準備が整わないまま測ろうとした`);

            // 切り取りの境界は、縁の内側（padding box）。縁の太さは丸められる。
            const cards = await page.evaluate(() =>
              [...document.querySelectorAll('.avatar-card')].map((card) => {
                const r = card.getBoundingClientRect();
                const cc = getComputedStyle(card);
                const img = card.querySelector('.avatar-thumb__img');
                return {
                  id: (img.getAttribute('src') || '').split('/').pop(),
                  l: r.left + parseFloat(cc.borderLeftWidth),
                  r: r.right - parseFloat(cc.borderRightWidth),
                  t: r.top + parseFloat(cc.borderTopWidth),
                  b: r.bottom - parseFloat(cc.borderBottomWidth),
                };
              }),
            );

            const withClip = await shotWithCss(page, PLAIN);
            const noClip = await shotWithCss(
              page,
              `${PLAIN} .avatar-list .avatar-card{overflow:visible !important;}`,
            );

            let bad = null;
            let badCount = 0;
            for (let y = 0; y < Math.min(withClip.h, noClip.h); y += 1) {
              for (let x = 0; x < Math.min(withClip.w, noClip.w); x += 1) {
                const i = (y * withClip.w + x) * 4;
                const d = Math.max(
                  Math.abs(withClip.data[i] - noClip.data[i]),
                  Math.abs(withClip.data[i + 1] - noClip.data[i + 1]),
                  Math.abs(withClip.data[i + 2] - noClip.data[i + 2]),
                );
                // 8/255 以下は、画素の端の丸めと見分けがつかない。
                if (d <= 8) continue;
                // 画素密度2倍で撮っているので、CSS の座標へ戻す。
                const cx = x / 2;
                const cy = y / 2;
                let near = Infinity;
                let nearId = '';
                for (const c of cards) {
                  const dx = Math.max(c.l - cx, 0, cx - c.r);
                  const dy = Math.max(c.t - cy, 0, cy - c.b);
                  const dist = Math.hypot(dx, dy);
                  if (dist < near) { near = dist; nearId = c.id; }
                }
                if (near <= 1) {
                  worstCorner = Math.max(worstCorner, d);
                  continue;
                }
                worstOutside = Math.max(worstOutside, d);
                badCount += 1;
                // いちばん差が大きかった画素を、場所つきで覚えておく。
                if (bad === null || d > bad.d) {
                  bad = { d, near: +near.toFixed(1), id: nearId };
                }
              }
            }
            check(
              bad === null,
              `${w}x${h}/${age}: 切り取りで人物の絵が落ちている`
                + `${bad === null ? '' : `（${bad.id}・${badCount}点・最大の差 ${bad.d}/255`
                  + `・縁の内側から ${bad.near}px 外）`}`,
            );
          }
          notes.push(`${w}x${h} 外側の最大 ${worstOutside}/255・角丸の最大 ${worstCorner}/255`);
        } finally {
          await context.close();
        }
      }
      return ` ${notes.join(' / ')}（いずれも 1px 以上外で 8/255 超は0点を期待）`;
    });
  }

  /*
   * ---- 14. 選んだ人が一覧から完全に見えなくなっても、下の帯は使える ----
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
   * ---- 15. キーボードだけで選べる ----
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

  // ---- 16. prefers-reduced-motion でも会話が読める ----
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
        await page.getByRole('button', { name: 'この人になって旅をはじめる' }).click();
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
