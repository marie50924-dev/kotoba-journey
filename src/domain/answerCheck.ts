/**
 * 直接入力テストの正誤判定。
 *
 * DOM に触れない純粋関数だけを置く。
 * 判定の基準をここ1か所に集約し、画面側では一切の例外処理を書かない。
 *
 * 方針：
 * - 入力方法の都合で生じる差（大文字小文字・全角半角・ひらがなカタカナ・前後の空白）は
 *   正解として扱う。スマートフォンのキーボードで打つことを前提にしている。
 * - 語そのものの一部である差（濁点・半濁点・促音・長音）は区別する。
 *   ここを曖昧にすると「おばさん」と「おばあさん」を同じ扱いにしてしまい、学習にならない。
 */

/** 答えの言語。出題形式から決まる。 */
export type AnswerLanguage = 'en' | 'ja';

/** カタカナをひらがなへ寄せる。長音「ー」と「ヴ」以外の小書き文字も含めて変換する。 */
function katakanaToHiragana(text: string): string {
  // U+30A1〜U+30F6 がひらがな U+3041〜U+3096 と1対1で対応する。
  return text.replace(/[ァ-ヶ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

/**
 * 英語の答えを比較用に整える。
 *
 * - NFKC 正規化（全角英字 ａｐｐｌｅ を apple にする）
 * - 前後の空白を落とす
 * - 語中の連続した空白を1つにまとめる
 * - 小文字へそろえる（iPhone の自動大文字化で Apple になっても正解にする）
 */
export function normalizeEnglishAnswer(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * 日本語の答えを比較用に整える。
 *
 * - NFKC 正規化（半角カタカナ ﾘﾝｺﾞ をカタカナ リンゴ にする）
 * - カタカナをひらがなへそろえる（リンゴ を りんご として正解にする）
 * - 空白をすべて落とす（語彙データに空白を含む語は無く、入力上の事故しかないため）
 *
 * 濁点・半濁点・促音・長音はそのまま残すので、
 * 「りんこ」「けき」は「りんご」「けーき」の正解にはならない。
 */
export function normalizeJapaneseAnswer(input: string): string {
  return katakanaToHiragana(input.normalize('NFKC')).replace(/\s+/g, '');
}

export function normalizeAnswer(input: string, language: AnswerLanguage): string {
  return language === 'en' ? normalizeEnglishAnswer(input) : normalizeJapaneseAnswer(input);
}

/**
 * 入力が正解かどうか。
 * 正解側も同じ規則で正規化するので、語彙データの表記ゆれにも影響されない。
 */
export function isAnswerCorrect(
  input: string,
  expected: string,
  language: AnswerLanguage,
): boolean {
  const normalized = normalizeAnswer(input, language);
  if (normalized.length === 0) return false;
  return normalized === normalizeAnswer(expected, language);
}

/** 入力が空（空白だけを含む）かどうか。未入力での送信を止めるのに使う。 */
export function isBlankAnswer(input: string): boolean {
  return input.trim().length === 0;
}

/**
 * 入力された文字種が、答えるべき言語と食い違っていないか。
 *
 * iOS では Web ページ側からキーボードの入力言語を切り替えられないため、
 * 不正解にする代わりに「キーボードを切り替えてね」と案内を出すために使う。
 * 判定はあくまで案内用で、採点には一切影響させない。
 */
export function looksLikeWrongScript(input: string, language: AnswerLanguage): boolean {
  const text = input.normalize('NFKC').trim();
  if (text.length === 0) return false;

  const hasKana = /[ぁ-ゖァ-ヺ]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);

  if (language === 'en') return hasKana;
  return hasLatin && !hasKana;
}
