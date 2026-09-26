/**
 * 足した語が実際に遊べることを確かめる回帰テスト。
 *
 * 語彙は 10語 → 25語 → 40語 → 55語 → 70語 → 85語 → 90語（工程V-2I-2）
 * → 105語（工程V-2O-1）と増えてきた。
 * カードを作る処理や確認テストは pairId しか見ないので、
 * 単体テストでは「新しい語だから壊れる」ことはまず起きない。
 * それでも確かめたいのは、足した語が本当に盤面へ出て、札として取れて、
 * 確認テストで答えられて、結果画面とパスポートに出るところまで通ることそのもの。
 *
 * 足したまとまりごとに盤面を1つずつ作る。古いまとまりの確認は消さない。
 *
 * このテストは「日常英会話」コースで遊ぶ。特定のコースを確かめたいのではなく、
 * **足した語を盤面へ出せるコースが要る**ため。
 * 日常英会話は common-practice（105語）を使うので、どのまとまりの語も出せる。
 * 工程V-2O-1で足した15語は医療・介護の専用セットにも入るので、
 * そのまとまりだけは医療・介護コース（care-practice 30語）で確かめる。
 * 30語のプールなら、15語だけの盤面を固定seedで作れる。
 * コースごとの語彙セットの割り当ては courseVocabulary.visual.mjs が見る。
 * 役割分担を混ぜないよう、ここではコースが変わっていないことだけ確かめる。
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
import { createSuite } from './visualCaseReporter.mjs';
import { WORD_PAIRS, answerFor } from './wordPairsFixture.mjs';

const ROOT = fileURLToPath(new URL('../../../dist', import.meta.url));
const BASE_PATH = '/kotoba-journey/';
const STORAGE_KEY = 'kotoba-journey/learning-record/v1';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
];

/**
 * 足したまとまりごとの盤面。
 * `now` を Date.now が返すと、その盤面がちょうど `expected` の語になる。
 * 語の中身は src/data/wordPairs.ts から引くので、ここには番号だけ置く。
 */
/**
 * 工程V-2O-1で足した15語を確かめるコース。
 *
 * 15語は医療・介護の専用セット（care-practice 30語）の核なので、
 * 30語のプールなら固定seedで「15語だけの盤面」を作れる。
 * 共通セット（105語）では15語だけの盤面になる seed が現実的に見つからない。
 */
const CARE_COURSE = {
  categoryLabel: /社会人/,
  label: '医療・介護',
  courseId: 'biz-care',
  setId: 'care-practice',
  poolSize: 105,
};

/** 語彙データそのものの語数。pairId 99 は欠番なので、最大pairIdとは別の数。 */
const WORD_DATA_SIZE = 105;

/**
 * 工程V-2O-1でゲームへ入れた医療・介護の15語（care-practice の核）。
 * **pairId 99 は入らない**（台帳で見送りにした「あし / foot」の番号）。
 */
const CARE_CORE_IDS = [91, 92, 93, 94, 95, 96, 97, 98, 100, 101, 102, 103, 104, 105, 106];

const BATCHES = [
  {
    label: '11〜30',
    stage: '工程V-2C-4',
    now: 1700000000194,
    cardLabel: /^6枚/,
    expected: [16, 18, 23],
    from: [11, 13, 14, 15, 16, 17, 18, 19, 21, 23, 24, 26, 28, 29, 30],
    groups: null,
  },
  {
    label: '31〜45',
    stage: '工程V-2D-3',
    now: 1700000172957,
    cardLabel: /^12枚/,
    expected: [33, 36, 38, 40, 41, 43],
    from: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45],
    // 体の部分・身の回りの物が、どちらも盤面に出ていること。
    groups: {
      体の部分: [31, 32, 33, 34, 35],
      身の回りの物: [36, 37, 38, 39, 40, 41],
    },
  },
  {
    label: '46〜60',
    stage: '工程V-2D-5',
    now: 1700000484811,
    cardLabel: /^12枚/,
    expected: [48, 49, 50, 55, 56, 60],
    from: [46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60],
    // 乗り物・場所・持ち物が、どれも盤面に出ていること。
    groups: {
      乗り物: [46, 47, 48, 49],
      場所: [50, 54, 55, 60],
      持ち物: [51, 52, 53, 56, 57, 58, 59],
    },
  },
  {
    label: '61〜75',
    stage: '工程V-2D-7',
    now: 1700003394602,
    cardLabel: /^12枚/,
    expected: [61, 62, 66, 68, 69, 70],
    from: [61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75],
    // 場所・人・道具・本が、どれも盤面に出ていること。
    groups: {
      場所: [61, 64, 71],
      人: [62, 63],
      道具: [65, 66, 67, 68, 69, 73, 74],
      本: [70, 72, 75],
    },
    // ひらがなとカタカナが混ざった「けしゴム」が、そのまま出ること。
    mixedSpelling: 66,
  },
  {
    label: '76〜90',
    stage: '工程V-2F-2',
    now: 1700001494324,
    cardLabel: /^12枚/,
    expected: [79, 82, 83, 84, 88, 89],
    from: [76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
    // 飲食の物・宿泊や建物の物・接客の動作が、どれも盤面に出ていること。
    groups: {
      飲食の物: [76, 77, 78, 79, 80, 81],
      宿泊建物の物: [82, 83, 84, 85, 86],
      接客の動作: [87, 88, 89, 90],
    },
    // カタカナの語とひらがなの語が、どちらも出ていること。
    spellingGroups: {
      カタカナ: [76, 77, 78, 79, 80, 82, 83, 85, 86],
      ひらがな: [81, 84, 87, 88, 89, 90],
    },
  },
  {
    // 工程V-2I-2でゲームへ入れた5語。
    // ほかのまとまりと違い、5語がひとつづきの番号ではないので
    // 「この範囲の語だけで盤面が埋まる」seed は存在しない。
    // 代わりに、20枚（10語）の盤面へ5語がすべて出る seed を固定して、
    // 5語が実際に遊べることを1回で確かめる。
    label: 'V-2I-2の5語',
    stage: '工程V-2I-2',
    now: 1700000038342,
    cardLabel: /^20枚/,
    expected: [11, 12, 20, 22, 25, 27, 67, 74, 77, 97],
    // 5語はどれも共通セットの語なので、from は共通セットの全語。
    // pairId 99 は欠番なので、1〜106 から抜く。
    from: Array.from({ length: 106 }, (_, i) => i + 1).filter((id) => id !== 99),
    groups: null,
    // この盤面に必ず出ていてほしい5語。expected と別に持たせて、
    // expected をうっかり書き換えても5語の検査が残るようにする。
    mustInclude: [12, 20, 22, 25, 27],
  },
  {
    // 工程V-2O-1でゲームへ入れた15語の前半。医療・介護コース（30語）で遊ぶ。
    // 20枚（10語）の盤面が、15語のうち10語だけで埋まる seed を固定してある。
    // 長い表記（91 びょういん / hospital、94 medicine、95 くるまいす / wheelchair）を
    // この盤面へ必ず出す。
    label: 'V-2O-1の15語(1)',
    stage: '工程V-2O-1',
    course: CARE_COURSE,
    now: 1700000095244,
    cardLabel: /^20枚/,
    expected: [91, 92, 94, 95, 96, 97, 98, 100, 103, 105],
    from: CARE_CORE_IDS,
    groups: {
      場所と人: [91, 92, 93],
      物: [94, 95, 96, 97],
      体の部分: [98, 100, 101, 106],
      動作: [102, 103, 104, 105],
    },
    spellingGroups: {
      カタカナ: [97],
      ひらがな: [91, 92, 93, 94, 95, 96, 98, 100, 101, 102, 103, 104, 105, 106],
    },
    // 重点確認の長い表記。
    mustInclude: [91, 94, 95],
  },
  {
    // 工程V-2O-1の15語のうち、(1) の盤面に出なかった 93・101・102・104・106 を出す。
    // (1) と合わせて15語すべてが、どちらかの盤面で確かめられる。
    label: 'V-2O-1の15語(2)',
    stage: '工程V-2O-1',
    course: CARE_COURSE,
    now: 1700000005142,
    cardLabel: /^20枚/,
    expected: [91, 92, 93, 96, 97, 101, 102, 104, 105, 106],
    from: CARE_CORE_IDS,
    groups: {
      場所と人: [91, 92, 93],
      体の部分: [98, 100, 101, 106],
      動作: [102, 103, 104, 105],
    },
    mustInclude: [93, 101, 102, 104, 106],
  },
];

/** 工程V-2O-1でゲームへ入れた15語。pairId 99 は含まない。 */
const ADDED_IN_V2O1 = [91, 92, 93, 94, 95, 96, 97, 98, 100, 101, 102, 103, 104, 105, 106];

/**
 * 工程V-2I-2でゲームへ入れた5語。
 * それまでは「盤面に出てはいけない語」だったが、いまは共通セットの語なので
 * 共通プールの盤面に出てよい。5語をまとめて確かめるまとまりを下に足してある。
 */
const ADDED_IN_V2I2 = [12, 20, 22, 25, 27];

/**
 * 追加語の回帰確認に使うコース。
 *
 * 足した語をどのまとまりも盤面へ出したいので、共通の90語を使うコースを選ぶ。
 * 名前が「日常英会話」だから選んだのではなく、語彙セットが common-practice
 * （90語）だから選んでいる。ここが別のセットへ変わると、
 * 旅行語や学校語のまとまりが盤面へ出せなくなり、この回帰確認が成立しない。
 */
const REGRESSION_COURSE = {
  /** コース入口の分類ボタン。 */
  categoryLabel: /社会人/,
  /** 画面に出るコース名。 */
  label: '日常英会話',
  /** 保存データに入る内部ID。 */
  courseId: 'biz-daily',
  /** このコースが使うはずの語彙セット。 */
  setId: 'common-practice',
  /** そのセットの語数。 */
  poolSize: 105,
};

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

const { check, runCase, finish } = createSuite('追加語テスト');

/** 盤面の seed を固定する。ページのどのスクリプトより先に入れる。 */
async function pinSeed(context, now) {
  await context.addInitScript((value) => {
    Date.now = () => value;
    Math.random = () => 0;
  }, now);
}

/** カルタ盤面まで進める。 */
async function reachBoard(page, baseUrl, cardLabel, course = REGRESSION_COURSE) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '旅をはじめる' }).click();
  await page.waitForSelector('.screen--avatar-select');
  await page.locator('.avatar-card').first().click();
  await page.getByRole('button', { name: 'この人を選ぶ' }).click();
  await page.waitForSelector('.screen--avatar-confirm');
  await page.getByRole('button', { name: 'この人と旅をはじめる' }).click();

  await page.waitForSelector('.option-card--category');
  await page.getByRole('button', { name: course.categoryLabel }).click();
  await page.getByRole('button', { name: course.label, exact: true }).first().click();
  await page.getByRole('button', { name: cardLabel }).click();
  await page.getByRole('button', { name: '出発する' }).click();
  await page.waitForSelector('.screen--travel');
  await page.getByRole('button', { name: 'スキップ' }).click();
  await page.waitForSelector('.screen--intro');
  await page.getByRole('button', { name: 'この国でことばを集める' }).click();
  await page.waitForSelector('.card');
}

/**
 * 狙ったコースで遊べているかを、保存された選択状態から確かめる。
 *
 * 盤面だけを見ても、語彙プールが同じなら別のコースでも同じ盤面になる。
 * それではコース経路が入れ替わったことに気づけないので、保存値で見る。
 * 保存形式は変えず、いま入っている値を読むだけ。
 */
async function checkCourse(page, label, course = REGRESSION_COURSE) {
  const courseId = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}').selectedCourseId ?? null,
    STORAGE_KEY,
  );
  check(
    courseId === course.courseId,
    `${label}: 選択中コースが想定と違う` +
      `（期待: ${course.courseId} / 実際: ${courseId}）`,
  );
  // 語彙データが読み落とされていないこと。
  check(
    WORD_PAIRS.size === WORD_DATA_SIZE,
    `${label}: 語彙データが${WORD_DATA_SIZE}語でない（${WORD_PAIRS.size}語）`,
  );
  // 見送りにした 99 は、ゲームデータに入っていない。
  check(!WORD_PAIRS.has(99), `${label}: 見送りの pairId 99 が語彙データにある`);
  return courseId;
}

/** 盤面に出ている pairId を取り出す。 */
async function boardPairIds(page) {
  const ids = await page.$$eval('.card', (nodes) =>
    nodes.map((n) => Number(n.getAttribute('data-card-id').split('-')[0])),
  );
  return [...new Set(ids)].sort((a, b) => a - b);
}

/** 画面に出ている「まちがい」の数。 */
async function mistakeCount(page) {
  const text = await page.locator('.karta__stats').textContent();
  const matched = text.match(/まちがい\s*(\d+)/);
  return matched === null ? 0 : Number(matched[1]);
}

/**
 * わざと組を間違える。
 * 同じ語で2回まちがえると復習対象になり、パスポートの復習語に出る。
 * 足した語をパスポートまで追いかけるために使う。
 * まちがいの演出が終わる前に押すと選択が流れるので、
 * 待ち時間ではなく画面の「まちがい」の数で確かめる。
 */
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

/** 盤面の中身を確かめる。 */
async function checkBoard(page, batch, label) {
  const ids = await boardPairIds(page);
  check(
    JSON.stringify(ids) === JSON.stringify(batch.expected),
    `${label}: 盤面の語が固定seedの想定と違う` +
      `（期待: ${batch.expected.join(',')} / 実際: ${ids.join(',')}）`,
  );
  check(
    ids.every((id) => batch.from.includes(id)),
    `${label}: 盤面に、このまとまり以外の語が出ている（${ids.join(',')}）`,
  );
  // 出ていてほしい語を持つまとまりだけ、その5語が全部そろっているかを見る。
  for (const required of batch.mustInclude ?? []) {
    check(
      ids.includes(required),
      `${label}: 足した ${required} が盤面に出ていない（${ids.join(',')}）`,
    );
  }
  // 盤面の語は、すべて実在する語を指していること。
  for (const id of ids) {
    check(WORD_PAIRS.has(id), `${label}: 盤面の ${id} が語彙データに無い`);
  }

  // 体の部分・身の回りの物・動き が、それぞれ盤面に出ている。
  for (const [group, members] of Object.entries(batch.groups ?? {})) {
    check(
      ids.some((id) => members.includes(id)),
      `${label}: ${group}の語が盤面に出ていない（${ids.join(',')}）`,
    );
  }

  // カタカナの語とひらがなの語が、どちらも盤面に出ている。
  for (const [name, members] of Object.entries(batch.spellingGroups ?? {})) {
    check(
      ids.some((id) => members.includes(id)),
      `${label}: ${name}の語が盤面に出ていない（${ids.join(',')}）`,
    );
  }

  // ひらがなとカタカナが混ざった語を、そのまま出しているか。
  if (batch.mixedSpelling !== undefined) {
    const [ja] = WORD_PAIRS.get(batch.mixedSpelling) ?? [];
    check(ids.includes(batch.mixedSpelling), `${label}: 混在表記の ${batch.mixedSpelling} が盤面に無い`);
    const shown = (
      await page.locator(`[data-card-id="${batch.mixedSpelling}-ja"]`).textContent()
    ).trim();
    check(shown === ja, `${label}: 混在表記が「${ja}」で出ていない（${shown}）`);
    check(/^[ぁ-ん]+[ァ-ヶー]+$/.test(shown), `${label}: 混在表記がくずれている（${shown}）`);
  }

  // 札の文字が語彙データのとおり。
  for (const id of ids) {
    const [ja, en] = WORD_PAIRS.get(id) ?? [];
    const jaText = (await page.locator(`[data-card-id="${id}-ja"]`).textContent()).trim();
    const enText = (await page.locator(`[data-card-id="${id}-en"]`).textContent()).trim();
    check(jaText === ja, `${label}: ${id} の日本語札が「${ja}」でない（${jaText}）`);
    check(enText === en, `${label}: ${id} の英語札が「${en}」でない（${enText}）`);
  }

  // 札の見え方。全文が残り、枠からはみ出さず、文字が小さくなりすぎないこと。
  // 工程V-2M-4で入れた文字調整が効いていることも、ここで見る。
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('.card')].map((card) => {
      const text = card.querySelector('.card__text');
      const style = getComputedStyle(card);
      const inset =
        (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      return {
        id: card.getAttribute('data-card-id'),
        text: text.textContent,
        fontSize: parseFloat(style.fontSize),
        // 札は傾けてあるので getBoundingClientRect は使わない。
        innerHeight: card.clientHeight - inset,
        innerWidth: text.clientWidth,
        textHeight: text.offsetHeight,
        textWidth: text.scrollWidth,
      };
    }));
  for (const card of shown) {
    const [pairId, lang] = card.id.split('-');
    const [ja, en] = WORD_PAIRS.get(Number(pairId)) ?? [];
    const expectedText = lang === 'ja' ? ja : en;
    // 省略や欠落がないこと。
    check(
      card.text === expectedText,
      `${label}: ${card.id} の札が全文でない（期待: ${expectedText} / 実際: ${card.text}）`,
    );
    check(
      card.textWidth <= card.innerWidth + 0.5,
      `${label}: ${card.id}「${card.text}」が横へはみ出している（${card.textWidth} > ${card.innerWidth}）`,
    );
    check(
      card.textHeight <= card.innerHeight + 0.5,
      `${label}: ${card.id}「${card.text}」が縦に切れている（${card.textHeight} > ${card.innerHeight}）`,
    );
    check(
      card.fontSize >= 11,
      `${label}: ${card.id}「${card.text}」の文字が 11px 未満（${card.fontSize}）`,
    );
  }
  return ids;
}

/**
 * 工程V-2O-1で足した15語が、どのまとまりで確かめられるかを先に固定する。
 * 15語のうち1語でも、どの盤面にも出ないまま通ってしまわないようにする。
 */
function checkAddedWordsCovered() {
  const covered = new Set(
    BATCHES.filter((b) => b.stage === '工程V-2O-1').flatMap((b) => b.expected),
  );
  const missing = ADDED_IN_V2O1.filter((id) => !covered.has(id));
  check(
    missing.length === 0,
    `工程V-2O-1の15語のうち、どの盤面にも出ない語がある（${missing.join(',')}）`,
  );
  check(
    ADDED_IN_V2O1.length === 15,
    `工程V-2O-1で足した語が15語でない（${ADDED_IN_V2O1.length}語）`,
  );
  // 見送りの 99 は、どのまとまりの期待盤面にも入らない。
  for (const batch of BATCHES) {
    check(
      !batch.expected.includes(99),
      `${batch.label}: 期待盤面に見送りの 99 が入っている`,
    );
  }
}

// ブラウザを起動する前に、まとまりの表そのものを確かめる。
checkAddedWordsCovered();

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  for (const batch of BATCHES) {
    // ---- 1. そのまとまりの語だけの盤面を、3サイズで遊べる ----
    for (const viewport of VIEWPORTS) {
      const label = `${batch.label} ${viewport.width}x${viewport.height}`;
      await runCase(label, async () => {
        const context = await browser.newContext({ viewport });
        try {
          await pinSeed(context, batch.now);
          const page = await context.newPage();
          const jsErrors = [];
          page.on('pageerror', (e) => jsErrors.push(e.message));

          const course = batch.course ?? REGRESSION_COURSE;
          await reachBoard(page, baseUrl, batch.cardLabel, course);
          await checkCourse(page, label, course);
          const ids = await checkBoard(page, batch, label);

          const scrollX = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          check(scrollX <= 0, `${label}: 横スクロールが出ている（${scrollX}px）`);

          // 日本語札と英語札を正しく合わせられる。
          await clearBoard(page);
          await page.waitForSelector('.screen--quiz-prompt', { timeout: 8000 });

          check(jsErrors.length === 0, `${label}: JavaScriptエラー（${jsErrors.join(' / ')}）`);
          return ` ${batch.stage}の${ids.length}語（${ids.join(',')}）を取り切れた`;
        } finally {
          await context.close();
        }
      }, `${batch.stage}の追加語テスト`);
    }

    // ---- 2. 確認テスト → 結果画面 → パスポートまで通る ----
    {
      const label = `${batch.label} 通し`;
      await runCase(label, async () => {
        const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
        try {
          await pinSeed(context, batch.now);
          const page = await context.newPage();
          const jsErrors = [];
          page.on('pageerror', (e) => jsErrors.push(e.message));

          const course = batch.course ?? REGRESSION_COURSE;
          await reachBoard(page, baseUrl, batch.cardLabel, course);
          await checkCourse(page, label, course);
          const ids = await boardPairIds(page);
          // 先頭の語を2回まちがえて、復習対象にする。
          await makeMistakes(page, ids);
          check(
            (await mistakeCount(page)) === 2,
            `${label}: わざとのまちがいが2回そろっていない（${await mistakeCount(page)}回）`,
          );
          await clearBoard(page);
          await page.waitForSelector('.screen--quiz-prompt', { timeout: 8000 });
          await page.getByRole('button', { name: 'テストを受ける' }).click();
          await page.waitForSelector('.screen--quiz');

          const total = Number(
            (await page.locator('.quiz__progress').textContent()).split('/')[1].trim().split(' ')[0],
          );
          const lang = await page.locator('.quiz__input').getAttribute('lang');

          // 1問目はわざと間違える。不正解のときに正しい正答が出るかを見る。
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

          await page.waitForSelector('.screen--quiz-result', { timeout: 8000 });
          const score = (
            await page.locator('.quiz-result__score .stat-tile__value').textContent()
          ).trim();
          check(score === `${total - 1} / ${total}`, `${label}: 採点が合わない（${score}）`);

          await page.getByRole('button', { name: 'つぎへ' }).click();
          await page.waitForSelector('.screen--result', { timeout: 8000 });

          // --- 結果画面に、盤面の語が日本語と英語で出る ---
          const resultText = await page.evaluate(() => document.body.innerText);
          for (const id of ids) {
            const [ja, en] = WORD_PAIRS.get(id) ?? [];
            check(resultText.includes(ja), `${label}: 結果画面に ${id} の「${ja}」が出ていない`);
            check(resultText.includes(en), `${label}: 結果画面に ${id} の「${en}」が出ていない`);
          }
          check(
            (await page.locator('.word-list__ja').count()) > 0,
            `${label}: 結果画面に覚えたことばの一覧が無い`,
          );

          // --- 保存された pairId が、盤面の語の正しい番号になっている ---
          const stored = await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)),
            STORAGE_KEY,
          );
          check(stored.version === 3, `${label}: 保存が version 3 でない（${stored.version}）`);
          const savedIds = [...stored.masteredPairIds, ...stored.reviewPairIds];
          check(
            savedIds.length > 0 && savedIds.every((id) => ids.includes(id)),
            `${label}: 保存された pairId が盤面の語と合わない` +
              `（盤面: ${ids.join(',')} / 保存: ${savedIds.join(',')}）`,
          );

          // --- 遊んだ記録も、狙ったコースで残っている ---
          const latest = stored.history[0];
          check(
            latest !== undefined && latest.courseId === course.courseId,
            `${label}: 履歴のコースIDが想定と違う` +
              `（期待: ${course.courseId} / 実際: ${latest && latest.courseId}）`,
          );

          // --- パスポートの復習語で、足した語を解決できる ---
          await page.goto(baseUrl, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'マイパスポート' }).click();
          await page.waitForSelector('.screen--passport');

          // 履歴の画面表示は、内部IDではなくいまのコース名になる。
          const shownCourses = await page.$$eval('.history__course', (nodes) =>
            nodes.map((n) => n.textContent.trim()),
          );
          check(
            shownCourses[0] === course.label,
            `${label}: 履歴の表示名が「${course.label}」でない（${shownCourses.join(' / ')}）`,
          );

          const reviewIds = stored.reviewPairIds;
          check(reviewIds.length > 0, `${label}: 復習対象が記録されていない`);
          const reviewWords = await page.$$eval('.word-list__item', (nodes) =>
            nodes.map((n) => n.textContent.trim()),
          );
          for (const pairId of reviewIds) {
            const [ja, en] = WORD_PAIRS.get(pairId) ?? [];
            check(ja !== undefined, `${label}: 復習の pairId ${pairId} を語彙データから引けない`);
            check(
              reviewWords.some((w) => w.includes(ja) && w.includes(en)),
              `${label}: パスポートの復習語で ${pairId}「${ja} / ${en}」を解決できていない（${reviewWords.join(' / ')}）`,
            );
          }
          check(
            !reviewWords.some((w) => w.includes('?')),
            `${label}: パスポートの復習語に引けない語がある（${reviewWords.join(' / ')}）`,
          );

          const passportScrollX = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          check(passportScrollX <= 0, `${label}: パスポートで横スクロールが出ている`);
          check(jsErrors.length === 0, `${label}: JavaScriptエラー（${jsErrors.join(' / ')}）`);

          return ' 確認テスト・結果画面・パスポートまで通った';
        } finally {
          await context.close();
        }
      }, `${batch.stage}の通しテスト`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

finish();
