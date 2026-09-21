/**
 * 旧保存データを実際に読み込ませた状態の表示回帰テスト。
 *
 * 工程V-2B以前に保存された学習記録には、当時のコース表示名
 * （「3級」「400点」など、実在する検定名・試験名）が文字列として残っている。
 * 単体テストは「渡す文字列」までしか確かめられないため、
 * ここでは実ブラウザの localStorage へ旧データを入れ、
 * 描画された画面そのものへ旧名称が出ないことを確かめる。
 *
 * あわせて、旧データを入れても記録が消えないこと・アプリが起動すること・
 * 横スクロールや画面外の操作が出ないことも見る。
 *
 * 実行: npm run test:visual:legacy （事前に npm run build が必要）
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

/** 画面へ出してはいけない、当時の検定名・試験名。 */
const FORBIDDEN = ['英検', 'TOEIC', '資格', '級', '点'];

/**
 * 工程V-2B以前（version 1）に保存された形。
 * courseLabel は当時そのまま書き出されていた文字列。
 */
const LEGACY_RECORD = {
  version: 1,
  totalPlays: 7,
  playedDates: ['2026-09-17', '2026-09-18', '2026-09-19'],
  totalCorrect: 40,
  totalIncorrect: 8,
  masteredPairIds: [1, 2],
  reviewPairIds: [3],
  bestTimeMs: { 6: 12000 },
  selectedCourseId: 'eiken-3',
  visitedCountryIds: ['japan'],
  history: [
    { date: '2026-09-19', courseId: 'eiken-3', courseLabel: '3級', cardCount: 6, accuracy: 90, elapsedMs: 12000 },
    { date: '2026-09-19', courseId: 'eiken-pre2', courseLabel: '準2級', cardCount: 12, accuracy: 80, elapsedMs: 30000 },
    { date: '2026-09-18', courseId: 'toeic-400', courseLabel: '400点', cardCount: 6, accuracy: 70, elapsedMs: 20000 },
    { date: '2026-09-18', courseId: 'toeic-900', courseLabel: '900点以上', cardCount: 20, accuracy: 60, elapsedMs: 50000 },
    { date: '2026-09-18', courseId: '', courseLabel: 'TOEIC 600点', cardCount: 6, accuracy: 50, elapsedMs: 18000 },
    { date: '2026-09-17', courseId: 'unknown-course', courseLabel: '英検2級ジュニア', cardCount: 6, accuracy: 40, elapsedMs: 19000 },
    { date: '2026-09-17', courseId: 'grade-elementary', courseLabel: '小学生', cardCount: 6, accuracy: 100, elapsedMs: 9000 },
  ],
  audioEnabled: true,
};

/** 旧データを読み替えたあと、履歴に出るはずの名前。 */
const EXPECTED_HISTORY = [
  'ことばチャレンジ・ステップ3',
  'ことばチャレンジ・ステップ4',
  'しごとチャレンジ・ステップ1',
  'しごとチャレンジ・ステップ6',
  'しごとチャレンジ・ステップ3',
  '以前のコース',
  '小学生',
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

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

/**
 * ケースの成否を、実際の検査結果どおりの記号で出す。
 *
 * 以前は検査に失敗していても ✓ を出していたので、
 * 終了コードだけが失敗という食い違いが起きていた。
 * 開始時点の失敗件数を渡し、増えていなければ ✓、増えていれば ✗ を出す。
 */
function reportCase(before, label, okNote, failNote) {
  const added = failures.slice(before);
  if (added.length === 0) {
    console.log(`✓ ${label}${okNote}`);
    return true;
  }
  console.error(`✗ ${label} ${failNote}`);
  for (const message of added) console.error(`   - ${message}`);
  return false;
}

/** 旧データを入れた状態でパスポートを開く。 */
async function openPassportWithLegacyRecord(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(
    ([key, data]) => localStorage.setItem(key, JSON.stringify(data)),
    [STORAGE_KEY, LEGACY_RECORD],
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'マイパスポート' }).click();
  await page.waitForSelector('.screen--passport');
}

/** 画面の外へ出ている操作を数える。 */
function offscreenControls() {
  return [...document.querySelectorAll('.screen--passport button, .screen--passport a')]
    .filter((node) => {
      const r = node.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      return r.left < -0.5 || r.right > window.innerWidth + 0.5;
    })
    .map((node) => node.textContent.trim());
}

const { server, port } = await serveDist();
const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    const failuresBefore = failures.length;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    await openPassportWithLegacyRecord(page, baseUrl);

    // --- 旧試験名が画面のどこにも出ない（本文・属性の両方） ---
    const bodyText = await page.evaluate(() => document.body.innerText);
    const bodyHtml = await page.evaluate(() => document.body.innerHTML);
    for (const word of FORBIDDEN) {
      check(!bodyText.includes(word), `${label}: パスポートの本文に「${word}」が出ている`);
      check(
        !bodyHtml.includes(word),
        `${label}: パスポートの属性（aria-label・title・alt・data-）に「${word}」が残っている`,
      );
    }
    for (const legacy of ['3級', '準2級', '400点', '900点以上', 'TOEIC 600点', '英検2級ジュニア']) {
      check(!bodyText.includes(legacy), `${label}: 旧コース名「${legacy}」がそのまま出ている`);
    }

    // --- 現在の中立名、または「以前のコース」が出る ---
    const shown = await page.$$eval('.history__course', (nodes) =>
      nodes.map((n) => n.textContent.trim()),
    );
    check(
      JSON.stringify(shown) === JSON.stringify(EXPECTED_HISTORY),
      `${label}: 履歴のコース名が想定と違う（${shown.join(' / ')}）`,
    );
    const selected = await page.locator('.value-line').first().textContent();
    check(
      selected.trim() === 'ことばチャレンジ・ステップ3',
      `${label}: 選択中コースが中立名になっていない（${selected.trim()}）`,
    );

    // --- 記録そのものは消えていない ---
    check(bodyText.includes('7回'), `${label}: 総プレイ回数が失われている`);
    const saved = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    const savedLabels = JSON.parse(saved).history.map((h) => h.courseLabel);
    check(
      savedLabels.includes('3級') && savedLabels.includes('900点以上'),
      `${label}: 保存データの元値が書き換えられている（${savedLabels.join(' / ')}）`,
    );
    check(JSON.parse(saved).history.length === 7, `${label}: 保存データの履歴が減っている`);

    // --- 読めること・はみ出さないこと ---
    const scrollX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(scrollX <= 0, `${label}: 横スクロールが出ている（${scrollX}px）`);
    const offscreen = await page.evaluate(offscreenControls);
    check(offscreen.length === 0, `${label}: 画面外の操作がある（${offscreen.join(', ')}）`);
    check(jsErrors.length === 0, `${label}: JavaScriptエラー（${jsErrors.join(' / ')}）`);

    reportCase(
      failuresBefore,
      label,
      ' 旧保存データでも旧試験名0件・記録は7回のまま',
      '旧保存データ表示テスト',
    );
    await context.close();
  }

  // ---- prefers-reduced-motion でも同じ ----
  {
    const failuresBefore = failures.length;
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    await openPassportWithLegacyRecord(page, baseUrl);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const bodyHtml = await page.evaluate(() => document.body.innerHTML);
    for (const word of FORBIDDEN) {
      check(!bodyText.includes(word), `reduced-motion: 本文に「${word}」が出ている`);
      check(!bodyHtml.includes(word), `reduced-motion: 属性に「${word}」が残っている`);
    }
    const shown = await page.$$eval('.history__course', (nodes) =>
      nodes.map((n) => n.textContent.trim()),
    );
    check(
      JSON.stringify(shown) === JSON.stringify(EXPECTED_HISTORY),
      `reduced-motion: 履歴のコース名が想定と違う（${shown.join(' / ')}）`,
    );
    const history = page.locator('.history__item').first();
    const box = await history.boundingBox();
    check(box !== null && box.height > 0, 'reduced-motion: 履歴が読めない');
    check(jsErrors.length === 0, `reduced-motion: JavaScriptエラー（${jsErrors.join(' / ')}）`);

    reportCase(
      failuresBefore,
      'prefers-reduced-motion',
      ' でも履歴が読め、旧試験名0件',
      '旧保存データ表示テスト',
    );
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error('\n旧保存データ表示テスト 失敗');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('\n旧保存データ表示テスト 成功');
