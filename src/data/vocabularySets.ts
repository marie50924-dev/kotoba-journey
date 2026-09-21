import type { WordPair } from '../domain/types';
import { SAMPLE_PAIRS } from './wordPairs';

/**
 * 語彙セット。コースが「どの語の中から出題するか」を指す入れ物。
 *
 * いまはセットが1つしかなく、24コースすべてが同じ `common-practice` を参照する。
 * コースごとに違うことばを出す仕組みは、まだ作っていない。
 * ここで用意したのは、あとでセットを増やすときに画面側を触らずに済む経路だけ。
 */
export type VocabularySetId = 'common-practice';

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

/** コースが見つからないときに使うセット。 */
export const DEFAULT_VOCABULARY_SET_ID: VocabularySetId = 'common-practice';

export const VOCABULARY_SETS: readonly VocabularySet[] = [
  {
    id: 'common-practice',
    label: '共通の練習用ことば',
    // 並びは src/data/wordPairs.ts と同じ。
    // 12・20・22・25・27 は資料確認待ちのため、ゲームにも入れていない。
    pairIds: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 13, 14, 15, 16, 17, 18, 19,
      21, 23, 24, 26, 28, 29, 30,
      31, 32, 33, 34, 35, 36, 37, 38,
      39, 40, 41, 42, 43, 44, 45,
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
