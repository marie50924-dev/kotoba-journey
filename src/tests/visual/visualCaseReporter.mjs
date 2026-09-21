/**
 * 実ブラウザテストの、ケース単位の成否表示をまとめた部品。
 *
 * これらのテストはテスト用フレームワークを使わず、検査の失敗を配列へためて
 * 最後にまとめて報告し、1件でも失敗があれば終了コード1で終わる。
 * その「途中経過の記号」を、ケースごとの実際の結果に合わせるための
 * 共通処理だけをここに置く。
 *
 * ブラウザ操作・期待値・失敗文言は共通化せず、各テストのファイルに残す。
 * どの画面をどう確かめるかは、テストごとにまったく違うため。
 */

/**
 * 1つの実ブラウザテスト（スイート）ぶんの記録係を作る。
 *
 * @param {string} suiteName 失敗一覧や ✗ の行に出すスイート名。
 */
export function createSuite(suiteName) {
  const failures = [];

  /** 検査1つぶん。失敗してもその場では止めず、配列へためる。 */
  const check = (condition, message) => {
    if (!condition) failures.push(message);
  };

  /**
   * 1ケースぶんの検査をまとめて走らせ、記号を実際の成否に合わせる。
   *
   * ケースの前後で失敗の件数を比べ、増えていなければ ✓、
   * 増えていれば ✗ と、そのケースで増えた失敗の詳細だけを出す。
   * 前のケースの失敗を後続ケースの成否へ混ぜない。
   *
   * 例外もそのケースの失敗として数えるので、途中で落ちても ✓ にはならず、
   * 独立した後続のケースはそのまま続けられる。
   * ブラウザの context などは、body の中の finally で閉じること。
   *
   * body が返した文字列は、失敗が0件のときだけラベルの後ろに付ける。
   * 観測した実測値は、期待値と一致を確かめたあとにだけ成功表示へ出す。
   *
   * @param {string} label このケースの名前。✓ と ✗ で同じものを使う。
   * @param {() => Promise<string | undefined>} body このケースの検査本体。
   * @param {string} [failNote] ✗ の行でラベルの後ろに出す言葉。
   * @returns {Promise<boolean>} このケースが成功したか。
   */
  async function runCase(label, body, failNote = suiteName) {
    const before = failures.length;
    let note = '';
    try {
      note = (await body()) ?? '';
    } catch (error) {
      failures.push(
        `${label}: 検査の途中で例外が出た（${(error && error.message) || error}）`,
      );
    }
    const added = failures.slice(before);
    if (added.length === 0) {
      console.log(`✓ ${label}${note}`);
      return true;
    }
    console.error(`✗ ${label} ${failNote}`);
    for (const message of added) console.error(`   - ${message}`);
    return false;
  }

  /**
   * 最後にまとめて報告し、終了コードを決める。
   * 失敗が1件でもあれば終了コード1、無ければ0。
   */
  function finish(successNote = '') {
    if (failures.length > 0) {
      console.error(`\n${suiteName} 失敗`);
      for (const message of failures) console.error(` - ${message}`);
      process.exit(1);
    }
    console.log(`\n${suiteName} 成功${successNote}`);
  }

  return { failures, check, runCase, finish };
}
