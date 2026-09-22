/**
 * 実ブラウザテスト8本の全体実行器。
 *
 * これまで npm run test:visual は8本を && でつないでいた。
 * && は左が0以外で終わると右を実行しないので、1本目が落ちると
 * 2〜8本目は1度も走らず、他に問題があるかどうかも分からなかった。
 *
 * ここでは8本を子プロセスとして順番に実行し、途中で失敗しても
 * 残りを実行して、最後に全体の合否をまとめて返す。
 *
 * - 逐次実行のみ。並列にはしない。
 *   ブラウザと静的サーバーが同時に立ち上がると、ポート・保存状態・
 *   負荷が競合して、テストの中身とは関係のない落ち方をするため。
 * - 子の stdout / stderr はそのまま流す（stdio: 'inherit'）。
 *   ケース単位の ✓ / ✗ は各スイートが出すので、ここでは触らない。
 * - 集約は [PASS] / [FAIL] で書く。✓ / ✗ を使うと、
 *   ケース単位の記号の数（正常系で ✓ 50件）が変わってしまう。
 *
 * 実行: npm run test:visual
 * 1本だけ動かしたいときは、これまでどおり各ファイルを直接実行できる。
 *   例) node src/tests/visual/newWords.visual.mjs
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * 実行するスイート。並びは package.json の従来の実行順のまま。
 * name は各スイートが自分で出す名前（createSuite に渡している名前）と同じ。
 */
const SUITES = [
  { name: '表示回帰テスト', file: 'pronunciationPanel.visual.mjs' },
  { name: 'Phase 1 表示・操作テスト', file: 'titleAndFlow.visual.mjs' },
  { name: 'Phase 1 統合 キャラクター・会話テスト', file: 'avatarAndChat.visual.mjs' },
  { name: 'Phase 1-C2 直接入力テスト', file: 'directInputQuiz.visual.mjs' },
  { name: 'Phase 1-C3 国紹介テスト（下書き表示）', file: 'countryGuide.visual.mjs' },
  { name: '旧保存データ表示テスト', file: 'legacyRecord.visual.mjs' },
  { name: '追加語テスト', file: 'newWords.visual.mjs' },
  { name: 'コース別語彙セットテスト', file: 'courseVocabulary.visual.mjs' },
];

const scriptPath = (file) => fileURLToPath(new URL(file, import.meta.url));

/** 人が実行を止めたか。止められたら、次のスイートは始めない。 */
let interruptedBy = null;
/** いま動いている子プロセス。中断のとき、これへ signal を送る。 */
let running = null;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    // 2回目以降は、すでに送った signal の転送だけで足りる。
    if (interruptedBy === null) interruptedBy = signal;
    if (running !== null && running.exitCode === null && running.signalCode === null) {
      running.kill(signal);
    }
  });
}

/**
 * 1本を子プロセスとして実行し、終わるまで待つ。
 *
 * shell を使わずに node を直接起動する。&& や ; を挟むと、
 * 失敗した時点で後ろが実行されなくなるため。
 * 環境変数はそのまま渡すので、CHROMIUM_PATH も子へ引き継がれる。
 *
 * 起動そのものに失敗した場合も、投げずに失敗として返して次へ進む。
 */
function runSuite(suite) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, [scriptPath(suite.file)], {
        stdio: 'inherit',
        env: process.env,
      });
    } catch (error) {
      resolve({ ...suite, ok: false, reason: `起動できなかった: ${(error && error.message) || error}` });
      return;
    }

    running = child;
    // 親がすでに中断されていたら、動き出した子もすぐ止める。
    if (interruptedBy !== null) child.kill(interruptedBy);

    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      running = null;
      resolve({ ...suite, ...result });
    };

    child.on('error', (error) => {
      done({ ok: false, reason: `起動できなかった: ${(error && error.message) || error}` });
    });

    child.on('close', (code, signal) => {
      if (signal !== null) {
        done({ ok: false, reason: `signal ${signal} で終了した`, signal });
        return;
      }
      if (code === 0) {
        done({ ok: true });
        return;
      }
      done({ ok: false, reason: `終了コード ${code}`, code });
    });
  });
}

const results = [];
for (const [index, suite] of SUITES.entries()) {
  if (interruptedBy !== null) break;
  console.log(`\n[RUN ${index + 1}/${SUITES.length}] ${suite.name}`);
  const result = await runSuite(suite);
  results.push(result);
  console.log(result.ok ? `[PASS] ${result.name}` : `[FAIL] ${result.name}（${result.reason}）`);
}

const passed = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

console.log('\n実ブラウザテスト全体結果');
for (const result of results) {
  console.log(result.ok ? `PASS  ${result.name}` : `FAIL  ${result.name}（${result.reason}）`);
}

if (interruptedBy !== null) {
  // 中断は「1本の通常失敗」ではない。走っていないスイートを数に入れず、
  // 8本そろったようにも見せない。
  const notRun = SUITES.slice(results.length).map((s) => s.name);
  console.error(`\n${interruptedBy} で中断しました（実行済み ${results.length}/${SUITES.length} 本）`);
  if (notRun.length > 0) console.error(`未実行: ${notRun.join(' / ')}`);
  process.exit(interruptedBy === 'SIGINT' ? 130 : 143);
}

console.log(`成功: ${passed.length}`);
console.log(`失敗: ${failed.length}`);

if (failed.length > 0) process.exit(1);
