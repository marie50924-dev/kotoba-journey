/**
 * 表示・操作回帰テスト（コース → 語彙セット → 盤面）。
 *
 * カルタ画面は、選んだコースの語彙セットから語を引く。
 * セットは4つある。小学生・中学生が学校のことば30語、海外旅行が旅のことば30語、
 * 接客・観光が接客・観光のことば30語、残り20コースは共通の90語。
 *
 * 確かめるのは、3分類のどのコースからでも最後まで遊べることと、
 * **そのコースへ割り当てたセットの中に出題が収まっていること**。
 * 「ゲーム内90語に含まれる」だけでは、旅の30語は90語の一部なので、
 * 割り当てが壊れても気づけない。コースごとに期待する集合を持たせる。
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
import { createSuite } from './visualCaseReporter.mjs';
import { WORD_PAIRS, answerFor } from './wordPairsFixture.mjs';

const ROOT = fileURLToPath(new URL('../../../dist', import.meta.url));
const BASE_PATH = '/kotoba-journey/';
const STORAGE_KEY = 'kotoba-journey/learning-record/v1';

const FIXED_NOW = 1700000000001;

/**
 * ゲームの90語。src/data/wordPairs.ts から読むので、語を足しても直す必要がない。
 * 共通セットを使うコースは、この中から出題される。
 */
const COMMON = WORD_PAIRS;

/**
 * 旅のことば30語（src/data/vocabularySets.ts の travel-practice と同じ）。
 *
 * ここはあえて手書きにする。本番の定義をそのまま読み込むと、
 * 定義側が壊れたときに期待値も一緒に壊れて、検査が通ってしまう。
 */
const TRAVEL_PAIR_IDS = [
  1, 7, 21, 23, 24, 26, 28, 29, 30,
  36, 38, 39, 40, 42, 43,
  46, 47, 48, 49, 50, 51, 52, 53, 54, 55,
  56, 57, 58, 59, 60,
];
/** 旅行だけの核15語。 */
const TRAVEL_CORE_IDS = TRAVEL_PAIR_IDS.filter((id) => id >= 46);
/** 共通セットと共有する基礎15語。 */
const TRAVEL_SHARED_IDS = TRAVEL_PAIR_IDS.filter((id) => id < 46);

/**
 * 学校のことば30語（src/data/vocabularySets.ts の school-practice と同じ）。
 * 旅のセットと同じ理由で、ここも手書きにする。
 */
const SCHOOL_PAIR_IDS = [
  3, 6, 15, 16, 17, 18, 19,
  28,
  37, 38, 39, 40, 41,
  43, 44,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
  71, 72, 73, 74, 75,
];
/** 学校だけの核15語。 */
const SCHOOL_CORE_IDS = SCHOOL_PAIR_IDS.filter((id) => id >= 61);
/** 共通セットと共有する基礎15語。 */
const SCHOOL_SHARED_IDS = SCHOOL_PAIR_IDS.filter((id) => id < 61);

/**
 * 接客・観光のことば30語（src/data/vocabularySets.ts の hospitality-practice と同じ）。
 * 旅・学校のセットと同じ理由で、ここも手書きにする。
 */
const HOSPITALITY_PAIR_IDS = [
  7,
  28, 29, 30,
  38, 40,
  46, 47, 49, 50, 51, 52, 53, 57, 60,
  76, 77, 78, 79, 80, 81, 82, 83, 84, 85,
  86, 87, 88, 89, 90,
];
/** 接客・観光だけの核15語。 */
const HOSPITALITY_CORE_IDS = HOSPITALITY_PAIR_IDS.filter((id) => id >= 76);
/** 旅のセットと共有する15語。 */
const HOSPITALITY_SHARED_IDS = HOSPITALITY_PAIR_IDS.filter((id) => id < 76);

/**
 * 場面別の3セット（旅・学校・接客観光）へ入れていない語のうち、
 * 意図して外している7件。確認は済んでいて、共通セットでは使用中。
 * 「未確認」「不正」「永久除外」という意味ではなく、
 * いまこの3セットに含めていないという所属上の事実だけを表す。
 *
 * 場面別セットの盤面にこの7件が出たら、セット定義が壊れている。
 * 共通セットの盤面には出てよい。
 */
const PAIR_IDS_NOT_IN_THEME_SET = [
  [8, 'つき', 'moon'],
  [10, 'くるま', 'car'],
  [12, 'さかな', 'fish'],
  [20, 'パン', 'bread'],
  [22, 'ぎゅうにゅう', 'milk'],
  [25, 'うみ', 'sea'],
  [27, 'いえ', 'house'],
];
/** 工程V-2I-2でゲームへ入れた5語。共通セットの盤面には出てよい。 */
const ADDED_IN_V2I2 = [12, 20, 22, 25, 27];

/**
 * 検査するコース。カテゴリ名・コース名・案内の有無・期待する語彙セット。
 *
 * `expected` は、そのコースの盤面に出てよい pairId の集合。
 * 共通セットのコースは `null`（=ゲームの90語ぜんぶ）。
 * `board` を持つコースは、固定seedで必ずその盤面になる（実測して固定した値）。
 * `core` / `shared` は、そのセットの専用語と共有基礎語。両方が盤面に出ることを見る。
 * `historyLabel` を持つコースは、パスポートの履歴表示名も確かめる。
 */
const COURSES = [
  {
    category: /学年別/,
    course: '小学生',
    courseId: 'grade-elementary',
    notice: false,
    setLabel: '学校',
    setId: 'school-practice',
    size: 30,
    expected: SCHOOL_PAIR_IDS,
    board: [16, 71, 74],
    core: SCHOOL_CORE_IDS,
    shared: SCHOOL_SHARED_IDS,
    historyLabel: '小学生',
  },
  {
    category: /ステップ別/,
    course: 'ステップ1',
    courseId: 'eiken-5',
    // 「ステップ1」は eiken-5 と toeic-400 の2つある。どちらの見出しの下かで選び分ける。
    group: 'ことばチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    // 90語になって盤面が変わったので、実測して取り直した値。
    board: [30, 31, 43],
    historyLabel: 'ことばチャレンジ・ステップ1',
  },
  {
    category: /社会人/,
    course: 'IT・仕事',
    courseId: 'biz-it',
    notice: false,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    // ステップ1と同じ共通セット・同じ並びなので、同じ固定seedなら盤面も同じ。
    board: [30, 31, 43],
    historyLabel: 'IT・仕事',
  },
  {
    category: /社会人/,
    course: '海外旅行',
    courseId: 'biz-travel',
    notice: false,
    setLabel: '旅',
    setId: 'travel-practice',
    size: 30,
    expected: TRAVEL_PAIR_IDS,
    board: [23, 56, 59],
    core: TRAVEL_CORE_IDS,
    shared: TRAVEL_SHARED_IDS,
    historyLabel: '海外旅行',
  },
  {
    // 中学生は小学生と同じ学校セット・同じ並びなので、同じ固定seedなら盤面も同じになる。
    category: /学年別/,
    course: '中学生',
    courseId: 'grade-junior',
    notice: false,
    setLabel: '学校',
    setId: 'school-practice',
    size: 30,
    expected: SCHOOL_PAIR_IDS,
    board: [16, 71, 74],
    core: SCHOOL_CORE_IDS,
    shared: SCHOOL_SHARED_IDS,
    historyLabel: '中学生',
  },
  {
    category: /社会人/,
    course: '接客・観光',
    courseId: 'biz-hospitality',
    notice: false,
    setLabel: '接客',
    setId: 'hospitality-practice',
    size: 30,
    expected: HOSPITALITY_PAIR_IDS,
    // 既存の固定seedのまま実測した盤面。核と共有語がどちらも出る。
    board: [30, 86, 89],
    core: HOSPITALITY_CORE_IDS,
    shared: HOSPITALITY_SHARED_IDS,
    historyLabel: '接客・観光',
  },
  // ---- ここから工程V-2L-1で足した18コース ----
  // 共通セットのコースは、同じ固定seed・同じ90語・同じ並びなので、
  // 盤面も上のステップ1・IT・仕事と同じ3語になる。seedは探索し直していない。
  //
  // 「ステップN」は ことばチャレンジ と しごとチャレンジ に1つずつある。
  // 表示名だけでは選び分けられないので、group で見出しを指定して取り違えを防ぐ。
  {
    category: /学年別/,
    course: '高校生',
    courseId: 'grade-high',
    notice: false,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: '高校生',
  },
  {
    category: /学年別/,
    course: '大学生',
    courseId: 'grade-university',
    notice: false,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: '大学生',
  },
  {
    category: /ステップ別/,
    course: 'ステップ2',
    courseId: 'eiken-4',
    group: 'ことばチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'ことばチャレンジ・ステップ2',
  },
  {
    category: /ステップ別/,
    course: 'ステップ3',
    courseId: 'eiken-3',
    group: 'ことばチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'ことばチャレンジ・ステップ3',
  },
  {
    category: /ステップ別/,
    course: 'ステップ4',
    courseId: 'eiken-pre2',
    group: 'ことばチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'ことばチャレンジ・ステップ4',
  },
  {
    category: /ステップ別/,
    course: 'ステップ5',
    courseId: 'eiken-pre2-plus',
    group: 'ことばチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'ことばチャレンジ・ステップ5',
  },
  {
    category: /ステップ別/,
    course: 'ステップ6',
    courseId: 'eiken-2',
    group: 'ことばチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'ことばチャレンジ・ステップ6',
  },
  {
    category: /ステップ別/,
    course: 'ステップ7',
    courseId: 'eiken-pre1',
    group: 'ことばチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'ことばチャレンジ・ステップ7',
  },
  {
    category: /ステップ別/,
    course: 'ステップ8',
    courseId: 'eiken-1',
    group: 'ことばチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'ことばチャレンジ・ステップ8',
  },
  {
    category: /ステップ別/,
    course: 'ステップ1',
    courseId: 'toeic-400',
    group: 'しごとチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'しごとチャレンジ・ステップ1',
  },
  {
    category: /ステップ別/,
    course: 'ステップ2',
    courseId: 'toeic-500',
    group: 'しごとチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'しごとチャレンジ・ステップ2',
  },
  {
    category: /ステップ別/,
    course: 'ステップ3',
    courseId: 'toeic-600',
    group: 'しごとチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'しごとチャレンジ・ステップ3',
  },
  {
    category: /ステップ別/,
    course: 'ステップ4',
    courseId: 'toeic-730',
    group: 'しごとチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'しごとチャレンジ・ステップ4',
  },
  {
    category: /ステップ別/,
    course: 'ステップ5',
    courseId: 'toeic-860',
    group: 'しごとチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'しごとチャレンジ・ステップ5',
  },
  {
    category: /ステップ別/,
    course: 'ステップ6',
    courseId: 'toeic-900',
    group: 'しごとチャレンジ',
    notice: true,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'しごとチャレンジ・ステップ6',
  },
  {
    category: /社会人/,
    course: '日常英会話',
    courseId: 'biz-daily',
    notice: false,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: '日常英会話',
  },
  {
    category: /社会人/,
    course: 'ビジネス',
    courseId: 'biz-business',
    notice: false,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: 'ビジネス',
  },
  {
    category: /社会人/,
    course: '医療・介護',
    courseId: 'biz-care',
    notice: false,
    setLabel: '共通',
    setId: 'common-practice',
    size: 90,
    expected: null,
    board: [30, 31, 43],
    historyLabel: '医療・介護',
  },
];

/**
 * ケース一覧そのものの検査。
 *
 * 本番の COURSES 配列から期待値を作ると、本番が壊れたとき期待値まで同時に壊れて
 * 気づけない。だから24件の courseId と内訳は、ここへ手で書いて固定する。
 *
 * ブラウザを起動する前に走らせる。一覧が欠けたまま全ケース通って「成功」に
 * 見えるのを防ぐため。
 */
const EXPECTED_COURSE_IDS = [
  'grade-elementary', 'grade-junior', 'grade-high', 'grade-university',
  'eiken-5', 'eiken-4', 'eiken-3', 'eiken-pre2', 'eiken-pre2-plus',
  'eiken-2', 'eiken-pre1', 'eiken-1',
  'toeic-400', 'toeic-500', 'toeic-600', 'toeic-730', 'toeic-860', 'toeic-900',
  'biz-daily', 'biz-travel', 'biz-business', 'biz-hospitality', 'biz-care', 'biz-it',
];
/** courseId → 画面に出るコース名。表示名が重なる「ステップN」も、ここで1対1に決める。 */
const EXPECTED_COURSE_LABELS = {
  'grade-elementary': '小学生', 'grade-junior': '中学生',
  'grade-high': '高校生', 'grade-university': '大学生',
  'eiken-5': 'ステップ1', 'eiken-4': 'ステップ2', 'eiken-3': 'ステップ3',
  'eiken-pre2': 'ステップ4', 'eiken-pre2-plus': 'ステップ5', 'eiken-2': 'ステップ6',
  'eiken-pre1': 'ステップ7', 'eiken-1': 'ステップ8',
  'toeic-400': 'ステップ1', 'toeic-500': 'ステップ2', 'toeic-600': 'ステップ3',
  'toeic-730': 'ステップ4', 'toeic-860': 'ステップ5', 'toeic-900': 'ステップ6',
  'biz-daily': '日常英会話', 'biz-travel': '海外旅行', 'biz-business': 'ビジネス',
  'biz-hospitality': '接客・観光', 'biz-care': '医療・介護', 'biz-it': 'IT・仕事',
};
/** セットごとのコース件数。共通20・旅1・学校2・接客1で合計24。 */
const EXPECTED_SET_COUNTS = {
  'common-practice': 20,
  'travel-practice': 1,
  'school-practice': 2,
  'hospitality-practice': 1,
};

function checkCaseList() {
  const label = 'ケース一覧';
  const ids = COURSES.map((c) => c.courseId);

  check(COURSES.length === 24, `${label}: ケース数が24件でない（${COURSES.length}件）`);

  // 同じコースを2回検査して、別のコースを検査し忘れるのを防ぐ。
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
  check(
    duplicated.length === 0,
    `${label}: courseId が重複している（${[...new Set(duplicated)].join(', ')}）`,
  );

  const missing = EXPECTED_COURSE_IDS.filter((id) => !ids.includes(id));
  const unexpected = ids.filter((id) => !EXPECTED_COURSE_IDS.includes(id));
  check(missing.length === 0, `${label}: 検査していない courseId がある（${missing.join(', ')}）`);
  check(
    unexpected.length === 0,
    `${label}: 想定外の courseId がある（${[...new Set(unexpected)].join(', ')}）`,
  );
  check(
    JSON.stringify([...ids].sort()) === JSON.stringify([...EXPECTED_COURSE_IDS].sort()),
    `${label}: courseId の集合が期待の24件と一致しない`,
  );

  // セット別の件数。割り当てが偏っていないか。
  for (const [setId, want] of Object.entries(EXPECTED_SET_COUNTS)) {
    const got = COURSES.filter((c) => c.setId === setId).length;
    check(got === want, `${label}: ${setId} のコース数が ${want} でない（${got}）`);
  }
  const total = Object.values(EXPECTED_SET_COUNTS).reduce((a, b) => a + b, 0);
  check(total === 24, `${label}: セット別件数の合計が24でない（${total}）`);

  // 1件ずつ、期待値がそろっているか。
  for (const target of COURSES) {
    const name = `${label} ${target.courseId}`;
    check(
      target.course === EXPECTED_COURSE_LABELS[target.courseId],
      `${name}: 表示名が期待と違う（期待: ${EXPECTED_COURSE_LABELS[target.courseId]} / 実際: ${target.course}）`,
    );
    check(
      Object.keys(EXPECTED_SET_COUNTS).includes(target.setId),
      `${name}: 期待セットIDが不正（${target.setId}）`,
    );
    check(typeof target.size === 'number', `${name}: 期待語数が無い`);
    check(Array.isArray(target.board) && target.board.length === 3, `${name}: 期待pairIdが無い`);
    check(typeof target.historyLabel === 'string', `${name}: パスポートの期待表示名が無い`);
    // 履歴は、見出しのあるコースだけ「見出し・表示名」の形で並ぶ。
    // 「ステップ1」が2つあっても、履歴で取り違えないようにするため。
    const wantHistory =
      target.group === undefined ? target.course : `${target.group}・${target.course}`;
    check(
      target.historyLabel === wantHistory,
      `${name}: 履歴の期待表示名が「${wantHistory}」でない（${target.historyLabel}）`,
    );
    // 同じ表示名が複数ある「ステップN」は、見出し（group）で選び分ける。
    const shares = COURSES.filter((c) => c.course === target.course);
    check(
      shares.length === 1 || typeof target.group === 'string',
      `${name}: 表示名「${target.course}」が重なっているのに group が無い`,
    );
  }
}

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

const { check, runCase, finish } = createSuite('コース別語彙セットテスト');

// ブラウザを起動する前に、ケース表そのものを確かめる。
// 24コースのうち1つでも表から抜けていたら、実機で遊べても不合格にする。
checkCaseList();

/** 指定したコースでカルタ盤面まで進める。案内文の有無もそのとき見る。 */
async function reachBoard(page, baseUrl, { category, course, notice, group }, label) {
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

  // 「ステップ1」などの表示名は、ことばチャレンジ と しごとチャレンジ に1つずつある。
  // 表示名だけで押すと、どちらが押されたか分からない。
  // group があるコースは、その見出しを持つ .course-group の中だけを探す。
  let scope = page;
  if (group !== undefined) {
    scope = page.locator('.course-group').filter({
      has: page.locator('h2.course-group__title', { hasText: group }),
    });
    const groupCount = await scope.count();
    check(
      groupCount === 1,
      `${label}: 見出し「${group}」の並びが1つに定まらない（${groupCount}個）`,
    );
  }
  const buttonCount = await scope.getByRole('button', { name: course, exact: true }).count();
  check(
    buttonCount === 1,
    `${label}: 「${course}」のボタンが1つに定まらない（${buttonCount}個）`,
  );
  await scope.getByRole('button', { name: course, exact: true }).first().click();
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
    // 表示名だけだと「ステップ1」が2つあって見分けられない。courseId も必ず出す。
    const label = `${target.course} [${target.courseId}]`;
    await runCase(label, async () => {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
      await context.addInitScript((now) => {
        Date.now = () => now;
        Math.random = () => 0;
      }, FIXED_NOW);
      try {
        const page = await context.newPage();
        const jsErrors = [];
        page.on('pageerror', (e) => jsErrors.push(e.message));

        await reachBoard(page, baseUrl, target, label);

        // --- 選択中のコースが、操作したコースになっている ---
        // 画面の見出しではなく保存値で見る。盤面がどのコースの設定で作られたかが分かる。
        const selectedCourseId = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? '{}').selectedCourseId ?? null,
          STORAGE_KEY,
        );
        check(
          selectedCourseId === target.courseId,
          `${label}: 選択中コースが ${target.courseId} でない（${selectedCourseId}）`,
        );

        // --- 出題は、そのコースへ割り当てたセットの中に収まっている ---
        const allowed = target.expected ?? [...COMMON.keys()];
        const ids = await boardPairIds(page);
        check(
          allowed.length === target.size,
          `${label}: ${target.setLabel}セットが${target.size}語でない（${allowed.length}語）`,
        );
        check(ids.length === 3, `${label}: 6枚の盤面が3語になっていない（${ids.join(',')}）`);
        // boardPairIds は重複を落とすので、6枚が3語ぶんでなければここで減る。
        const rawIds = await page.$$eval('.card', (nodes) =>
          nodes.map((n) => n.getAttribute('data-card-id')),
        );
        check(
          rawIds.length === 6 && new Set(rawIds).size === 6,
          `${label}: 6枚の札が重複なく6枚でない（${rawIds.join(',')}）`,
        );
        for (const id of ids) {
          check(COMMON.has(id), `${label}: pairId ${id} が語彙データに無い`);
        }
        for (const id of ids) {
          check(
            allowed.includes(id),
            `${label}: ${target.setLabel}セット（${allowed.length}語）に無い pairId ${id} が出ている（${ids.join(',')}）`,
          );
        }

        if (target.board !== undefined) {
          // 固定seedなので、盤面は毎回この3語になる。
          check(
            JSON.stringify(ids) === JSON.stringify(target.board),
            `${label}: 固定seedの盤面が想定と違う（期待: ${target.board.join(',')} / 実際: ${ids.join(',')}）`,
          );
          if (target.core !== undefined) {
            // そのセットだけの語と、共通セットと共有する基礎語が、どちらも出ている。
            check(
              ids.some((id) => target.core.includes(id)),
              `${label}: ${target.setLabel}専用の語が盤面に無い（${ids.join(',')}）`,
            );
            check(
              ids.some((id) => target.shared.includes(id)),
              `${label}: 共有する基礎語が盤面に無い（${ids.join(',')}）`,
            );
            // 場面別セットへ入れていない7件は、どれもこの盤面に出ない。
            for (const [pairId] of PAIR_IDS_NOT_IN_THEME_SET) {
              check(
                !allowed.includes(pairId),
                `${label}: ${target.setLabel}セットに、入れていない ${pairId} が含まれている`,
              );
            }
            // 76〜90 は、接客・観光のセットの核。旅・学校のセットへは広げていない。
            for (const pairId of HOSPITALITY_CORE_IDS) {
              check(
                allowed.includes(pairId) === (target.courseId === 'biz-hospitality'),
                `${label}: ${target.setLabel}セットの ${pairId} の扱いが違う`,
              );
            }
          } else {
            // 共通セットのコースでは、工程V-2F-2で足した15語も出題されうる。
            for (const pairId of HOSPITALITY_CORE_IDS) {
              check(
                allowed.includes(pairId),
                `${label}: 共通セットに ${pairId} が無い`,
              );
            }
            // 工程V-2I-2で足した5語も、共通セットでは出題されうる。
            for (const pairId of ADDED_IN_V2I2) {
              check(
                allowed.includes(pairId),
                `${label}: 共通セットに、工程V-2I-2で足した ${pairId} が無い`,
              );
            }
            check(allowed.length === 90, `${label}: 共通セットが90語でない（${allowed.length}語）`);
          }
        }

        // --- 札の文字が語彙データのとおり ---
        for (const id of ids) {
          const [ja, en] = COMMON.get(id) ?? [];
          const jaText = (await page.locator(`[data-card-id="${id}-ja"]`).textContent()).trim();
          const enText = (await page.locator(`[data-card-id="${id}-en"]`).textContent()).trim();
          check(jaText === ja, `${label}: ${id} の日本語札が違う（${jaText}）`);
          check(enText === en, `${label}: ${id} の英語札が違う（${enText}）`);
        }

        // --- 場面別セットには、外している7件が混ざらない ---
        // 共通セットのコースでは7件とも出てよいので、そちらでは見ない。
        if (target.expected !== null) {
          const boardText = await page.evaluate(() => document.body.innerText);
          for (const [id, ja, en] of PAIR_IDS_NOT_IN_THEME_SET) {
            check(
              !ids.includes(id),
              `${label}: ${target.setLabel}セットに入れていない pairId ${id} が盤面に出ている`,
            );
            check(!boardText.includes(ja), `${label}: 入れていない語「${ja}」が出ている`);
            check(!boardText.includes(en), `${label}: 入れていない語「${en}」が出ている`);
          }
          // 除外表は7件から減らさない。1件でも抜けると、そのpairIdの混入に気づけなくなる。
          check(
            PAIR_IDS_NOT_IN_THEME_SET.length === 7,
            `${label}: 場面別セットの除外表が7件でない（${PAIR_IDS_NOT_IN_THEME_SET.length}件）`,
          );
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
        if (target.historyLabel !== undefined) {
          const shownCourses = await page.$$eval('.history__course', (nodes) =>
            nodes.map((n) => n.textContent.trim()),
          );
          check(
            shownCourses[0] === target.historyLabel,
            `${label}: 履歴の表示名が「${target.historyLabel}」でない（${shownCourses.join(' / ')}）`,
          );
        }
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

        return ` ${target.setLabel}${allowed.length}語（${ids.join(",")}）で最後まで遊べた`;
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
