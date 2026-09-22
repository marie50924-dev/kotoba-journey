import type { WordPair } from '../domain/types';
import { SAMPLE_PAIRS } from './wordPairs';

/**
 * 語彙セット。コースが「どの語の中から出題するか」を指す入れ物。
 *
 * いまは2つある。
 * - `common-practice`: ゲームの70語すべて。23コースがこれを参照する。
 * - `travel-practice`: 旅の場面の30語。海外旅行コースだけが参照する。
 *
 * セットは語の置き場所を決めるだけで、語の確認状態とは別の軸。
 * 旅のセットへ入っていない語が未確認というわけではない。
 */
export type VocabularySetId =
  | 'common-practice'
  | 'travel-practice';

export interface VocabularySet {
  id: VocabularySetId;
  label: string;
  /**
   * このセットで使う語の固定ID。
   * 表示・管理上の順番であり、盤面への選出順ではない。
   * 盤面に出る語と並びは buildDeck が seed から決める。
   */
  pairIds: readonly number[];
}

/**
 * コースが見つからないときに使うセット。
 *
 * 未選択・未知の保存データはここへ落ちる。いちばん語が多い共通セットにしてあるので、
 * どのコースの過去データから来ても遊べなくならない。
 */
export const DEFAULT_VOCABULARY_SET_ID: VocabularySetId = 'common-practice';

export const VOCABULARY_SETS: readonly VocabularySet[] = [
  {
    id: 'common-practice',
    label: '共通の練習用ことば',
    // ゲームに入っている70語すべて。海外旅行を除く23コースがこれを使う。
    // 並びは src/data/wordPairs.ts と同じ。
    // 12・20・22・25・27 は資料確認待ちのため、ゲームにも入れていない。
    pairIds: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 13, 14, 15, 16, 17, 18, 19,
      21, 23, 24, 26, 28, 29, 30,
      31, 32, 33, 34, 35, 36, 37, 38,
      39, 40, 41, 42, 43, 44, 45,
      46, 47, 48, 49, 50, 51, 52, 53,
      54, 55, 56, 57, 58, 59, 60,
      61, 62, 63, 64, 65, 66, 67, 68,
      69, 70, 71, 72, 73, 74, 75,
    ],
  },
  {
    id: 'travel-practice',
    label: '旅のことば',
    // 旅の場面で使う30語。海外旅行コースだけがこのセットを使う。
    //
    // 46〜60 の15語が旅行だけの核。
    // 残り15語は共通セットと共有する基礎語で、旅の場面と結びつくものだけを選んだ。
    // りんご・たまご・いちごはレストランやホテルの朝食、みず・のむ・たべるは食事、
    // ねるはホテル、かさ・いすは持ち物と席、まど・ドアは乗り物と部屋、
    // やま・そらは旅先の景色、あるく・およぐは旅先での行動。
    //
    // 8（つき）と 10（くるま）は台帳でまだ資料確認が終わっていないので入れない。
    // 10 は乗り物だが、意味の範囲が決まるまで専用セットへは広げない。
    // 共通セットでは引き続き使用中なので、ゲームから消えるわけではない。
    //
    // 並びは変えない。同じ seed でも配列が変われば選ばれる語が変わる。
    pairIds: [
      1, 7, 21, 23, 24, 26, 28, 29, 30,
      36, 38, 39, 40, 42, 43,
      46, 47, 48, 49, 50, 51, 52, 53, 54, 55,
      56, 57, 58, 59, 60,
    ],
  },
];

export function findVocabularySet(id: string | null | undefined): VocabularySet | undefined {
  if (!id) return undefined;
  return VOCABULARY_SETS.find((set) => set.id === id);
}

/**
 * セット定義から語を解決する。
 *
 * セット定義そのものを受け取るので、本番データを書き換えずに
 * 「壊れたセット」を渡して振る舞いを確かめられる。
 *
 * 引けない pairId を黙って捨てると、語数が減ったことに気づけないまま
 * 盤面が作られてしまう。見つからない語があればその場で止める。
 */
export function resolveSetPairs(
  set: Pick<VocabularySet, 'id' | 'pairIds'>,
  pairs: readonly WordPair[] = SAMPLE_PAIRS,
): WordPair[] {
  const resolved: WordPair[] = [];
  for (const pairId of set.pairIds) {
    const pair = pairs.find((p) => p.pairId === pairId);
    if (!pair) {
      throw new Error(
        `語彙セット「${set.id}」が、語彙データに無い pairId ${pairId} を指しています`,
      );
    }
    resolved.push(pair);
  }
  return resolved;
}

/**
 * セットIDから語を解決する。セットの並びのまま返す。
 * 未知のIDは既定セットへ落とさず、その場で止める。
 * 黙って別のセットで遊ばせると、どの語で遊んだか分からなくなるため。
 */
export function pairsInSet(id: string | null | undefined): WordPair[] {
  const set = findVocabularySet(id);
  if (!set) {
    throw new Error(`語彙セット「${id}」は定義されていません`);
  }
  return resolveSetPairs(set);
}
