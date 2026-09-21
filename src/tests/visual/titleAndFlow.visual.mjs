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

/** 表紙の実測値を集める。 */
function titleMetrics() {
  const pick = (sel) => {
    const node = document.querySelector(sel);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  const buttons = [...document.querySelectorAll('.title__actions button')].map((el) => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), x: r.x, y: r.y, width: r.width, height: r.height };
  });
  return {
    logo: pick('.title__logo'),
    mascot: pick('.title__mascot'),
    background: pick('.title__bg'),
    buttons,
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    vScroll: document.documentElement.scrollHeight > window.innerHeight + 1,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    // 画像が実際に復号できたか（読み込み失敗の検出）。
    logoLoaded: document.querySelector('.title__logo')?.naturalWidth > 0,
    bgLoaded: document.querySelector('.title__bg')?.naturalWidth > 0,
    mascotLoaded: document.querySelector('.title__mascot')?.naturalWidth > 0,
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
        await page.waitForTimeout(700);
        const m = await page.evaluate(titleMetrics);

        check(m.logoLoaded, `${label}: 表紙ロゴが読み込めていない`);
        check(m.bgLoaded, `${label}: 表紙背景が読み込めていない`);
        check(m.mascotLoaded, `${label}: 案内キャラクターが読み込めていない`);

        for (const [name, box] of [['ロゴ', m.logo], ['キャラクター', m.mascot]]) {
          check(box !== null, `${label}: ${name}が存在しない`);
          if (!box) continue;
          check(box.x >= -0.5, `${label}: ${name}が左へはみ出している`);
          check(box.y >= -0.5, `${label}: ${name}が上へはみ出している`);
          check(box.x + box.width <= m.viewport.width + 0.5, `${label}: ${name}が右へはみ出している`);
          check(box.y + box.height <= m.viewport.height + 0.5, `${label}: ${name}が下へはみ出している`);
        }

        check(m.buttons.length === 3, `${label}: 表紙のボタンが3つそろっていない`);
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

        // ロゴ・キャラクター・ボタンが互いに重ならない。
        if (m.logo && m.mascot) {
          check(!rectsOverlap(m.logo, m.mascot), `${label}: ロゴとキャラクターが重なっている`);
        }
        for (const b of m.buttons) {
          if (m.logo) check(!rectsOverlap(m.logo, b), `${label}: ロゴと「${b.text}」が重なっている`);
          if (m.mascot) check(!rectsOverlap(m.mascot, b), `${label}: キャラクターと「${b.text}」が重なっている`);
        }

        check(!m.hScroll, `${label}: 表紙で横スクロールが発生している`);
        check(!m.vScroll, `${label}: 表紙が1画面に収まっていない`);
        check(jsErrors.length === 0, `${label}: JavaScript エラー: ${jsErrors.join(' / ')}`);

        return ` 表紙  ロゴ ${m.logo.width.toFixed(0)}px / キャラ ${m.mascot.width.toFixed(0)}px`;
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

        // 旅の正式イラストは、選んだキャラクターの年代に合わせて出す。
        const charaSrc = await page.locator('.chara-card__img').first().getAttribute('src');
        check(
          charaSrc.includes('elementary'),
          `${tag}: 小学生を選んだのに小学生の旅イラストが出ていない（${charaSrc}）`,
        );
        // 読み込みとデコードが終わるのを待ってから測る。
        // 即座に naturalWidth を見ると、実体があっても 0 のことがある。
        const charaLoaded = await page
          .waitForFunction(
            () => {
              const img = document.querySelector('.chara-card__img');
              return img !== null && img.complete && img.naturalWidth > 0;
            },
            undefined,
            { timeout: 5000 },
          )
          .then(() => true)
          .catch(() => false);
        check(charaLoaded, `${tag}: 旅の正式イラストが読み込めていない`);
        check(
          await page.locator('.travel__me .avatar-thumb').count() === 1,
          `${tag}: 移動画面に自分のキャラクターが出ていない`,
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
        // 国紹介には自分のキャラクターと NPC を置く構造が残っている。
        check(
          await page.locator('.intro__cast-me .avatar-thumb').count() === 1,
          `${tag}: 国紹介に自分のキャラクターの置き場所が無い`,
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
        check(m.logo !== null && m.logo.width > 0, 'reduced-motion: ロゴが見えない');
        check(m.mascot !== null && m.mascot.width > 0, 'reduced-motion: キャラクターが見えない');
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
} finally {
  await browser.close();
  server.close();
}

finish();
