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
import { createSuite } from './visualCaseReporter.mjs';

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

const { check, runCase, finish } = createSuite('Phase 1 表示・操作テスト');

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * 絵に描かれた「旅をはじめる」ボタンの位置。
 *
 * 原寸 852x1846 の画素を測った値で、src/data/titleAssets.ts の
 * TITLE_COVER_BUTTON と同じ数字。こちらは .mjs なので TypeScript を読み込めず、
 * 同じ値を書いてある。ずれていないことは下の検査で確かめる
 * （画面側は inline style としてこの比率を出しているので、突き合わせられる）。
 */
const COVER_NATURAL = { width: 852, height: 1846 };
const COVER_BUTTON_PX = { left: 165, top: 1549, right: 679, bottom: 1678 };

/** 表紙の実測値を集める。 */
function titleMetrics() {
  const pick = (sel) => {
    const node = document.querySelector(sel);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  // 表紙の操作ボタンは、絵の上に重ねる「旅をはじめる」と、下の操作列の2種類。
  const buttons = [...document.querySelectorAll('.screen--title button')].map((el) => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const cover = document.querySelector('.title__cover');
  const start = document.querySelector('.title__start');
  // 画面が絵から付けた位置指定。データと食い違っていないかを見るために読む。
  const startStyle = start
    ? {
        left: start.style.left,
        top: start.style.top,
        width: start.style.width,
        height: start.style.height,
      }
    : null;
  // 画面の中でいちばん下にある要素の下端。
  // documentElement.scrollHeight は html { height: 100% } で頭打ちになるため使わない。
  const bottoms = [...document.querySelectorAll('.screen--title *')].map(
    (el) => el.getBoundingClientRect().bottom,
  );
  return {
    box: pick('.title__cover-box'),
    cover: pick('.title__cover'),
    start: pick('.title__start'),
    startStyle,
    startLabel: start?.textContent.trim() ?? '',
    // 絵の中のロゴと人物を DOM で二重に重ねていないこと。
    legacyLayers: document.querySelectorAll('.title__logo, .title__mascot, .title__bg').length,
    coverAlt: cover?.getAttribute('alt') ?? '',
    buttons,
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    vScroll: document.body.scrollHeight > window.innerHeight + 1,
    lowestBottom: bottoms.length > 0 ? Math.max(...bottoms) : 0,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    // 画像が実際に復号できたか（読み込み失敗の検出）。
    coverLoaded: cover?.complete === true && cover?.naturalWidth > 0,
    coverNatural: cover ? { width: cover.naturalWidth, height: cover.naturalHeight } : null,
  };
}

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  // ---- 1. 正式表紙が5サイズで成立する ----
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    await runCase(label, async () => {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        const jsErrors = [];
        page.on('pageerror', (e) => jsErrors.push(e.message));

        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        // 遅延読み込みを待つ。naturalWidth は実体があっても直後は 0 のことがある。
        await page
          .waitForFunction(
            () => {
              const img = document.querySelector('.title__cover');
              return img !== null && img.complete && img.naturalWidth > 0;
            },
            undefined,
            { timeout: 8000 },
          )
          .catch(() => {});
        await page.waitForTimeout(700);
        const m = await page.evaluate(titleMetrics);

        check(m.coverLoaded, `${label}: 表紙の一枚絵が読み込めていない`);
        check(
          m.coverNatural?.width === COVER_NATURAL.width &&
            m.coverNatural?.height === COVER_NATURAL.height,
          `${label}: 表紙の画素数が受領物と違う（${m.coverNatural?.width}x${m.coverNatural?.height}）`,
        );
        // 絵の中にロゴと人物があるので、DOM で二重に重ねてはいけない。
        check(m.legacyLayers === 0, `${label}: ロゴ／キャラクターの画像を絵の上へ重ねている`);
        check(m.coverAlt.includes('ことばトラベル'), `${label}: 表紙の絵に代替テキストが無い`);

        // 絵が切れていない＝絵の矩形が画面の中に完全に収まっている。
        check(m.box !== null, `${label}: 表紙の絵が存在しない`);
        if (m.box) {
          check(m.box.x >= -0.5, `${label}: 絵が左へはみ出している（${m.box.x.toFixed(1)}）`);
          check(m.box.y >= -0.5, `${label}: 絵が上へはみ出している（${m.box.y.toFixed(1)}）`);
          check(
            m.box.x + m.box.width <= m.viewport.width + 0.5,
            `${label}: 絵が右へはみ出している（${(m.box.x + m.box.width).toFixed(1)} > ${m.viewport.width}）`,
          );
          check(
            m.box.y + m.box.height <= m.viewport.height + 0.5,
            `${label}: 絵が下へはみ出している（${(m.box.y + m.box.height).toFixed(1)} > ${m.viewport.height}）`,
          );
          // 縦横比が原寸と一致する＝引き伸ばしも切り抜きも起きていない。
          const wanted = COVER_NATURAL.width / COVER_NATURAL.height;
          const shown = m.box.width / m.box.height;
          check(
            Math.abs(shown - wanted) / wanted < 0.01,
            `${label}: 絵の縦横比が原寸と違う（${shown.toFixed(4)} / 原寸 ${wanted.toFixed(4)}）`,
          );
        }

        // 画面が付けた位置指定が、実測した比率と一致している。
        check(m.startStyle !== null, `${label}: 開始ボタンが存在しない`);
        if (m.startStyle) {
          const pct = (v) => Number.parseFloat(v) / 100;
          const wantLeft = COVER_BUTTON_PX.left / COVER_NATURAL.width;
          const wantWidth = (COVER_BUTTON_PX.right - COVER_BUTTON_PX.left) / COVER_NATURAL.width;
          const wantCenterY =
            (COVER_BUTTON_PX.top + COVER_BUTTON_PX.bottom) / 2 / COVER_NATURAL.height;
          check(
            Math.abs(pct(m.startStyle.left) - wantLeft) < 0.0005,
            `${label}: 開始ボタンの左位置が実測値と違う（${m.startStyle.left}）`,
          );
          check(
            Math.abs(pct(m.startStyle.width) - wantWidth) < 0.0005,
            `${label}: 開始ボタンの幅が実測値と違う（${m.startStyle.width}）`,
          );
          check(
            Math.abs(pct(m.startStyle.top) - wantCenterY) < 0.0005,
            `${label}: 開始ボタンの中心が実測値と違う（${m.startStyle.top}）`,
          );
        }

        // 実際に描かれた位置が、絵の中のボタンと重なっている。
        if (m.box && m.start) {
          const drawn = {
            x: m.box.x + (COVER_BUTTON_PX.left / COVER_NATURAL.width) * m.box.width,
            y: m.box.y + (COVER_BUTTON_PX.top / COVER_NATURAL.height) * m.box.height,
            width: ((COVER_BUTTON_PX.right - COVER_BUTTON_PX.left) / COVER_NATURAL.width) * m.box.width,
            height:
              ((COVER_BUTTON_PX.bottom - COVER_BUTTON_PX.top) / COVER_NATURAL.height) * m.box.height,
          };
          check(
            Math.abs(m.start.x - drawn.x) <= 1 && Math.abs(m.start.width - drawn.width) <= 1,
            `${label}: 押せる範囲が絵のボタンと横にずれている（実 ${m.start.x.toFixed(1)}+${m.start.width.toFixed(1)} / 絵 ${drawn.x.toFixed(1)}+${drawn.width.toFixed(1)}）`,
          );
          // 縦は 44px を下回らないよう上下へ広げるので、中心が合っていればよい。
          const drawnCenter = drawn.y + drawn.height / 2;
          const startCenter = m.start.y + m.start.height / 2;
          check(
            Math.abs(startCenter - drawnCenter) <= 1,
            `${label}: 押せる範囲が絵のボタンと縦にずれている（実 ${startCenter.toFixed(1)} / 絵 ${drawnCenter.toFixed(1)}）`,
          );
          check(
            m.start.height + 0.5 >= drawn.height,
            `${label}: 押せる範囲が絵のボタンより小さい`,
          );
        }

        check(m.buttons.length === 3, `${label}: 表紙のボタンが3つそろっていない（${m.buttons.length}）`);
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
        // ボタンどうしが重なっていない（重なると意図しないほうが押される）。
        for (let i = 0; i < m.buttons.length; i += 1) {
          for (let j = i + 1; j < m.buttons.length; j += 1) {
            check(
              !rectsOverlap(m.buttons[i], m.buttons[j]),
              `${label}: 「${m.buttons[i].text}」と「${m.buttons[j].text}」が重なっている`,
            );
          }
        }

        check(!m.hScroll, `${label}: 表紙で横スクロールが発生している`);
        check(!m.vScroll, `${label}: 表紙が1画面に収まっていない`);
        check(
          m.lowestBottom <= m.viewport.height + 0.5,
          `${label}: 表紙の中身が画面の下からはみ出している（${m.lowestBottom.toFixed(1)} > ${m.viewport.height}）`,
        );

        // キーボードだけで旅を始められる。
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => document.activeElement?.className ?? '');
        check(
          focused.includes('title__start'),
          `${label}: Tab の最初で開始ボタンへ移らない（${focused}）`,
        );
        await page.keyboard.press('Enter');
        await page.waitForSelector('.screen--avatar-select', { timeout: 4000 }).catch(() => {});
        check(
          (await page.locator('.screen--avatar-select').count()) === 1,
          `${label}: キーボードの Enter で旅を始められない`,
        );

        check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);

        return ` 表紙  絵 ${m.box.width.toFixed(0)}x${m.box.height.toFixed(0)}px / 開始ボタン ${m.start.width.toFixed(0)}x${m.start.height.toFixed(0)}px`;
      } finally {
        await context.close();
      }
    });
  }

  // ---- 2. キャラクター選択から日本到着・国紹介・カルタ・結果まで進める ----
  {
    const tag = '通し操作';
    await runCase(tag, async () => {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
      try {
        const page = await context.newPage();
        const jsErrors = [];
        page.on('pageerror', (e) => jsErrors.push(e.message));

        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '旅をはじめる' }).click();

        // 初回起動なので、80人からのキャラクター選択が挟まる。
        await page.waitForSelector('.screen--avatar-select');
        check(
          await page.locator('.screen--avatar-select').count() === 1,
          `${tag}: 初回にキャラクター選択が出ない`,
        );
        await page.getByRole('tab', { name: '小学生' }).click();
        await page.locator('.avatar-card').first().click();
        const chosenId = await page.locator('.avatar-card[aria-selected="true"]').getAttribute('data-avatar-id');
        await page.getByRole('button', { name: 'この人を選ぶ' }).click();

        await page.waitForSelector('.screen--avatar-confirm');
        await page.getByRole('button', { name: 'この人と旅をはじめる' }).click();

        await page.waitForSelector('.option-card--category');

        // ステップ別を開き、試験名が画面に出ないことと、準備中の案内が読めることを見る。
        // 語彙はことばトラベルが独自に選ぶので、検定・試験に準拠しているとは見せない。
        await page.getByRole('button', { name: /ステップ別/ }).click();
        await page.waitForSelector('.course-group');
        const stepText = await page.evaluate(() => document.body.innerText);
        for (const word of ['英検', 'TOEIC', '資格', '級', '点']) {
          check(!stepText.includes(word), `${tag}: ステップ別の画面に「${word}」が出ている`);
        }
        check(
          stepText.includes('各ステップのことばは準備中です。現在は共通の練習用ことばで遊べます。'),
          `${tag}: ステップ別の準備中の案内が読めない`,
        );
        check(
          (await page.getByRole('button', { name: 'ステップ1' }).count()) === 2,
          `${tag}: ステップ1が2グループぶん出ていない`,
        );
        await page.getByRole('button', { name: 'もどる' }).click();
        await page.waitForSelector('.option-card--category');

        await page.getByRole('button', { name: /学年別/ }).click();
        // 学年別には、ステップ別の案内を出さない。
        const gradeText = await page.evaluate(() => document.body.innerText);
        check(
          !gradeText.includes('各ステップのことばは準備中です'),
          `${tag}: 学年別にステップ別の案内が出ている`,
        );
        await page.getByRole('button', { name: '小学生' }).click();

        // コース選択のあとは、旧「コース連動キャラクター」画面を挟まず枚数選択へ進む。
        check(
          await page.locator('.screen--characters').count() === 0,
          `${tag}: 廃止した旧キャラクター画面がまだ導線に残っている`,
        );
        await page.getByRole('button', { name: /^6枚/ }).click();
        await page.getByRole('button', { name: '出発する' }).click();

        check(await page.locator('.screen--travel').count() === 1, `${tag}: 移動演出が出ない`);
        check(await page.getByRole('button', { name: 'スキップ' }).isVisible(), `${tag}: スキップできない`);

        // 搭乗券の絵は、行き先の国の正式イラスト。
        const ticketSrc = await page.locator('.travel__ticket .chara-card__img').getAttribute('src');
        check(
          ticketSrc.includes('assets/countries/japan-adopted'),
          `${tag}: 日本へ向かうのに日本の絵が出ていない（${ticketSrc}）`,
        );
        // 読み込みとデコードが終わるのを待ってから測る。
        // 即座に naturalWidth を見ると、実体があっても 0 のことがある。
        const ticketLoaded = await page
          .waitForFunction(
            () => {
              const img = document.querySelector('.travel__ticket .chara-card__img');
              return img !== null && img.complete && img.naturalWidth > 0;
            },
            undefined,
            { timeout: 5000 },
          )
          .then(() => true)
          .catch(() => false);
        check(ticketLoaded, `${tag}: 行き先の正式イラストが読み込めていない`);
        // 旅をするのは利用者が選んだ本人。
        // 表紙のパイロットと CA、年代別の2人組は、本人としても同行者としても出さない。
        const travelImages = await page.evaluate(() =>
          [...document.images].map((i) => i.getAttribute('src') ?? ''),
        );
        check(
          travelImages.every((src) => !src.includes('assets/characters/')),
          `${tag}: 移動画面に年代別の2人組イラストが出ている（${travelImages.join(' ')}）`,
        );
        check(
          travelImages.every((src) => !src.includes('title-adopted-pilot-ca')),
          `${tag}: 移動画面に表紙のパイロットと CA が出ている`,
        );
        check(
          await page.locator('.travel__me .avatar-thumb').count() === 1,
          `${tag}: 移動画面に自分のキャラクターが出ていない`,
        );
        // 本人かどうかは、名前や並び順ではなく画像のIDで照合する。
        const travelMeSrc = await page
          .locator('.travel__me .avatar-thumb__img')
          .getAttribute('src');
        check(
          travelMeSrc.includes(`/avatars/${chosenId}.webp`),
          `${tag}: 移動画面の本人が選んだ人と違う（${travelMeSrc} / 選択 ${chosenId}）`,
        );
        await page.getByRole('button', { name: 'スキップ' }).click();

        check(await page.locator('.screen--intro').count() === 1, `${tag}: 国紹介が出ない`);
        // 到着直後は要点だけを出し、長い説明は「もっと知る」の中に閉じてある。
        check(
          await page.locator('.intro__more:not([hidden])').count() === 0,
          `${tag}: 到着直後から詳細が開いている`,
        );
        // 日本は事実の本文確認が終わっていないため、国紹介は下書き表示。
        // 事実の文章は出さず、準備中の案内だけを出す。
        check(
          await page.locator('.intro__preparing').count() === 1,
          `${tag}: 準備中の案内が出ていない`,
        );
        check(
          await page.locator('.intro__summary').count() === 0,
          `${tag}: 下書きなのに紹介文が出ている`,
        );
        // 到着記念の絵は、その国の正式イラスト。
        const introSrc = await page.locator('.intro__photo .chara-card__img').getAttribute('src');
        check(
          introSrc.includes('assets/countries/japan-adopted'),
          `${tag}: 国紹介に日本の絵が出ていない（${introSrc}）`,
        );
        const introAlt = await page.locator('.intro__photo .chara-card__img').getAttribute('alt');
        check(introAlt.length > 8, `${tag}: 国の絵に代替テキストが無い`);
        for (const word of ['一望', '見わたせ', '見渡せ']) {
          check(!introAlt.includes(word), `${tag}: 国の絵の説明に「${word}」が入っている`);
        }
        const introImages = await page.evaluate(() =>
          [...document.images].map((i) => i.getAttribute('src') ?? ''),
        );
        check(
          introImages.every((src) => !src.includes('assets/characters/')),
          `${tag}: 国紹介に年代別の2人組イラストが出ている`,
        );
        check(
          introImages.every((src) => !src.includes('title-adopted-pilot-ca')),
          `${tag}: 国紹介に表紙のパイロットと CA が出ている`,
        );
        // 国紹介には自分のキャラクターと NPC を置く構造が残っている。
        check(
          await page.locator('.intro__cast-me .avatar-thumb').count() === 1,
          `${tag}: 国紹介に自分のキャラクターの置き場所が無い`,
        );
        const introMeSrc = await page
          .locator('.intro__cast-me .avatar-thumb__img')
          .getAttribute('src');
        check(
          introMeSrc.includes(`/avatars/${chosenId}.webp`),
          `${tag}: 国紹介の本人が選んだ人と違う（${introMeSrc} / 選択 ${chosenId}）`,
        );
        const companions = await page.locator('.intro__cast-npc').count();
        check(companions >= 1, `${tag}: 国紹介に NPC の置き場所が無い`);
        const meOnIntro = await page.locator('.intro__cast-npc [data-avatar-id]').count();
        check(meOnIntro === 0 || chosenId !== null, `${tag}: 同行者の取得に失敗`);
        await page.getByRole('button', { name: 'この国でことばを集める' }).click();

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

        // ウェーブ終了のチャットを閉じてから結果へ。
        await page.waitForSelector('.chat', { timeout: 5000 });
        await page.locator('.chat__choice').first().click();
        await page.waitForTimeout(200);
        await page.getByRole('button', { name: 'とじる' }).first().click();

        // 確認テストは結果画面より前に入る。結果画面には答えが並ぶため。
        await page.waitForSelector('.screen--quiz-prompt', { timeout: 5000 });
        check(
          await page.locator('.screen--result').count() === 0,
          `${tag}: 確認テストより先に結果画面が出ている`,
        );
        check(
          await page.getByRole('button', { name: 'テストを受ける' }).count() === 1,
          `${tag}: 確認テストへの導線が無い`,
        );
        // ここではスキップ経路を通す。受験経路は directInputQuiz 側で確認する。
        await page.getByRole('button', { name: '今回はスキップ' }).click();

        await page.waitForSelector('.screen--result', { timeout: 5000 });
        await page.getByRole('button', { name: '旅をつづける' }).click();
        await page.waitForSelector('.screen--map', { timeout: 5000 });
        check(await page.locator('.screen--map').count() === 1, `${tag}: 結果から世界地図へ戻れない`);

        const stored = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('kotoba-journey/learning-record/v1')),
        );
        check(stored.version === 3, `${tag}: 保存が version 3 になっていない（${stored.version}）`);
        check(stored.selectedCourseId === 'grade-elementary', `${tag}: コース選択が保存されていない`);
        check(stored.selectedAvatarId === chosenId, `${tag}: 選んだキャラクターが保存されていない`);
        check(stored.characterAgeGroup === null, `${tag}: 旧年齢層設定は未設定のままであるべき`);
        check(stored.quizHistory.length === 1, `${tag}: 確認テストの記録が残っていない`);
        check(
          stored.quizHistory[0].status === 'skipped',
          `${tag}: スキップが skipped として保存されていない`,
        );
        check(
          stored.quizHistory[0].incorrectPairIds.length === 0,
          `${tag}: スキップを不正解として数えている`,
        );
        check(stored.seenTravelIntros.includes('japan'), `${tag}: 到着演出の既読が残っていない`);
        check(stored.totalPlays === 1, `${tag}: 通常カルタの記録が二重加算されている`);
        check(jsErrors.length === 0, `${tag}: JavaScript エラー: ${jsErrors.join(' / ')}`);

        return '（表紙→選択→旅→国紹介→カルタ→確認テスト→結果）';
      } finally {
        await context.close();
      }
    });
  }

  // ---- 3. prefers-reduced-motion でも必須情報が失われない ----
  {
    await runCase('prefers-reduced-motion', async () => {
      const context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);

        const m = await page.evaluate(titleMetrics);
        check(m.box !== null && m.box.width > 0, 'reduced-motion: 表紙の絵が見えない');
        check(m.coverLoaded, 'reduced-motion: 表紙の絵が読み込めていない');
        check(m.start !== null && m.start.width > 0, 'reduced-motion: 開始ボタンが見えない');
        check(m.buttons.length === 3, 'reduced-motion: 表紙のボタンが欠けている');

        await page.getByRole('button', { name: '旅をはじめる' }).click();
        await page.waitForSelector('.screen--avatar-select');
        await page.locator('.avatar-card').first().click();
        await page.getByRole('button', { name: 'この人を選ぶ' }).click();
        await page.waitForSelector('.screen--avatar-confirm');
        await page.getByRole('button', { name: 'この人と旅をはじめる' }).click();
        await page.getByRole('button', { name: /学年別/ }).click();
        await page.getByRole('button', { name: '小学生' }).click();
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

        return ' で必須情報が残る';
      } finally {
        await context.close();
      }
    });
  }

  // ---- 4. 長い札の文字が切れない（20枚の最小札） ----
  //
  // 20枚の盤面は札がいちばん小さい。基準の文字サイズのままだと、
  // 74「コンピューター」のような長い語が3行になり、札の下が切れていた。
  // 札は overflow: hidden なので、切れた行は読めないまま消える。
  //
  // いまは、収まらない札だけ文字を小さくする。短い札は基準のまま。
  // seed を固定して、74・3・28・89 が必ず同じ盤面に出るようにしている。
  {
    // Date.now と Math.random を固定すると createSeed() が決まる。
    // 工程V-2O-1で共通セットが105語になり盤面が変わったので、
    // 本番の selectPairs() で予測して取り直した値。
    // この now では 20枚（10語）の盤面が 3,11,28,51,53,54,74,89,94,95 になる。
    const FIXED_NOW = 1700000000781;
    const BOARD_PAIR_IDS = [3, 11, 28, 51, 53, 54, 74, 89, 94, 95];
    /** 文字を小さくしてはいけない短い語。基準の大きさのままであること。 */
    const SHORT_WORDS = [
      [3, 'あお', 'blue'],
      [28, 'たべる', 'eat'],
      [89, 'あける', 'open'],
    ];
    /** 切れていた長い語。全文が残り、11px 以上で読めること。 */
    const LONG_WORD = [74, 'コンピューター', 'computer'];
    const MIN_FONT_PX = 11;

    for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }]) {
      const label = `${viewport.width}x${viewport.height} 20枚の長い札`;
      await runCase(label, async () => {
        const context = await browser.newContext({ viewport });
        await context.addInitScript((now) => {
          Date.now = () => now;
          Math.random = () => 0;
        }, FIXED_NOW);
        try {
          const page = await context.newPage();
          const jsErrors = [];
          page.on('pageerror', (e) => jsErrors.push(e.message));

          await page.goto(baseUrl, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: '旅をはじめる' }).click();
          await page.waitForSelector('.screen--avatar-select');
          await page.locator('.avatar-card').first().click();
          await page.getByRole('button', { name: 'この人を選ぶ' }).click();
          await page.waitForSelector('.screen--avatar-confirm');
          await page.getByRole('button', { name: 'この人と旅をはじめる' }).click();
          await page.waitForSelector('.option-card--category');
          // 日常英会話は共通の105語を使うので、74 を盤面へ出せる。
          await page.getByRole('button', { name: /社会人/ }).click();
          await page.waitForSelector('.course-group');
          await page.getByRole('button', { name: '日常英会話', exact: true }).click();
          await page.getByRole('button', { name: /^20枚/ }).click();
          await page.getByRole('button', { name: '出発する' }).click();
          await page.waitForSelector('.screen--travel');
          await page.getByRole('button', { name: 'スキップ' }).click();
          await page.waitForSelector('.screen--intro');
          await page.getByRole('button', { name: 'この国でことばを集める' }).click();
          await page.waitForSelector('.card');
          await page.waitForTimeout(300);

          const shot = await page.evaluate(() => {
            const cards = [...document.querySelectorAll('.card')].map((card) => {
              const text = card.querySelector('.card__text');
              const style = getComputedStyle(card);
              const inset =
                (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
              return {
                id: card.getAttribute('data-card-id'),
                text: text.textContent,
                fontSize: parseFloat(style.fontSize),
                // 札は傾けてあるので getBoundingClientRect は使わない。
                // 回転前のレイアウト上の大きさで、内側に収まっているかを見る。
                innerHeight: card.clientHeight - inset,
                innerWidth: text.clientWidth,
                textHeight: text.offsetHeight,
                textWidth: text.scrollWidth,
              };
            });
            return {
              cards,
              hScroll:
                document.documentElement.scrollWidth - document.documentElement.clientWidth,
            };
          });

          const byId = new Map(shot.cards.map((c) => [c.id, c]));
          check(shot.cards.length === 20, `${label}: 札が20枚ない（${shot.cards.length}）`);
          check(
            JSON.stringify(
              [...new Set(shot.cards.map((c) => Number(c.id.split('-')[0])))].sort((a, b) => a - b),
            ) === JSON.stringify(BOARD_PAIR_IDS),
            `${label}: 固定seedの盤面が想定と違う（${shot.cards.map((c) => c.id).join(',')}）`,
          );

          // --- どの札も、文字が枠の内側に収まっている ---
          for (const card of shot.cards) {
            check(
              card.textWidth <= card.innerWidth + 0.5,
              `${label}: ${card.id}「${card.text}」が横へはみ出している（${card.textWidth} > ${card.innerWidth}）`,
            );
            check(
              card.textHeight <= card.innerHeight + 0.5,
              `${label}: ${card.id}「${card.text}」が縦に切れている（${card.textHeight} > ${card.innerHeight}）`,
            );
            check(
              card.fontSize >= MIN_FONT_PX,
              `${label}: ${card.id}「${card.text}」の文字が ${MIN_FONT_PX}px 未満（${card.fontSize}）`,
            );
          }
          check(shot.hScroll <= 0, `${label}: 横スクロールが出ている（${shot.hScroll}px）`);

          // --- 長い語は、省略も欠落もなく全文が残っている ---
          const [longId, longJa, longEn] = LONG_WORD;
          for (const [lang, expected] of [['ja', longJa], ['en', longEn]]) {
            const card = byId.get(`${longId}-${lang}`);
            check(card !== undefined, `${label}: ${longId}-${lang} の札が無い`);
            if (!card) continue;
            // 「…」で省略したり、一部を消したりしていない。
            check(
              card.text === expected,
              `${label}: ${longId}-${lang} の文字が全文でない（${card.text}）`,
            );
            check(
              card.textHeight <= card.innerHeight + 0.5,
              `${label}: ${longId}-${lang}「${expected}」が縦に切れている（${card.textHeight} > ${card.innerHeight}）`,
            );
            check(
              card.fontSize >= MIN_FONT_PX,
              `${label}: ${longId}-${lang} の文字が ${MIN_FONT_PX}px 未満（${card.fontSize}）`,
            );
          }

          // --- 短い語は、基準の大きさのまま。全札を一律に小さくしていない ---
          const base = Math.max(...shot.cards.map((c) => c.fontSize));
          for (const [shortId, ja, en] of SHORT_WORDS) {
            for (const [lang, expected] of [['ja', ja], ['en', en]]) {
              const card = byId.get(`${shortId}-${lang}`);
              check(card !== undefined, `${label}: ${shortId}-${lang} の札が無い`);
              if (!card) continue;
              check(card.text === expected, `${label}: ${shortId}-${lang} の文字が違う（${card.text}）`);
              check(
                card.fontSize === base,
                `${label}: ${shortId}-${lang}「${expected}」が不要に小さくなっている（${card.fontSize} < ${base}）`,
              );
            }
          }

          const long = byId.get(`${longId}-ja`);
          check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);
          return ` 基準${base.toFixed(1)}px / コンピューター${long.fontSize.toFixed(1)}px・${long.textHeight}px（枠内${long.innerHeight}px）`;
        } finally {
          await context.close();
        }
      });
    }
  }
} finally {
  await browser.close();
  server.close();
}

finish();
