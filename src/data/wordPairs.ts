import type { WordPair } from '../domain/types';

/**
 * いまのカルタが使う、共通の練習用語彙（40語）。
 *
 * どのコースを選んでも、24コースすべてがこの同じプールから出題する。
 * コース別の語彙セットはまだ作っていない。
 *
 * pairId は台帳（docs/reports/VOCABULARY_CHECKLIST.md）と保存データを
 * 結ぶ固定の識別子で、詰め直さない。
 * 台帳で確認済みになった語を、台帳と同じ番号のまま足していく。
 * 12・20・22・25・27 が欠けているのは、その番号の語がまだ資料確認待ちだから。
 * 空いた番号へ別の語を入れると、その番号で保存された過去の学習記録が
 * 別の語を指してしまうので、欠番は欠番のまま残す。
 *
 * 8 つき / moon と 10 くるま / car は、Phase 0 から使い続けている語だが
 * 台帳ではまだ資料確認が終わっていない。確認の結果しだいで表記が変わりうる。
 */
export const SAMPLE_PAIRS: readonly WordPair[] = [
  { pairId: 1, ja: 'りんご', en: 'apple' },
  { pairId: 2, ja: 'ねこ', en: 'cat' },
  { pairId: 3, ja: 'あお', en: 'blue' },
  { pairId: 4, ja: 'いぬ', en: 'dog' },
  { pairId: 5, ja: 'はな', en: 'flower' },
  { pairId: 6, ja: 'ほん', en: 'book' },
  { pairId: 7, ja: 'みず', en: 'water' },
  { pairId: 8, ja: 'つき', en: 'moon' },
  { pairId: 9, ja: 'とり', en: 'bird' },
  { pairId: 10, ja: 'くるま', en: 'car' },

  // ここから下は、台帳で確認済みになってから足した語。
  // 12（さかな）は資料確認待ちのため欠番。
  { pairId: 11, ja: 'うさぎ', en: 'rabbit' },
  { pairId: 13, ja: 'ぞう', en: 'elephant' },
  { pairId: 14, ja: 'うま', en: 'horse' },
  { pairId: 15, ja: 'あか', en: 'red' },
  { pairId: 16, ja: 'きいろ', en: 'yellow' },
  { pairId: 17, ja: 'みどり', en: 'green' },
  { pairId: 18, ja: 'しろ', en: 'white' },
  { pairId: 19, ja: 'くろ', en: 'black' },
  // 20（パン）は資料確認待ちのため欠番。
  { pairId: 21, ja: 'たまご', en: 'egg' },
  // 22（ぎゅうにゅう）は資料確認待ちのため欠番。
  { pairId: 23, ja: 'いちご', en: 'strawberry' },
  { pairId: 24, ja: 'やま', en: 'mountain' },
  // 25（うみ）は資料確認待ちのため欠番。
  { pairId: 26, ja: 'そら', en: 'sky' },
  // 27（いえ）は資料確認待ちのため欠番。
  { pairId: 28, ja: 'たべる', en: 'eat' },
  { pairId: 29, ja: 'のむ', en: 'drink' },
  { pairId: 30, ja: 'ねる', en: 'sleep' },

  // 工程V-2D-2で台帳の確認を終え、工程V-2D-3で足した日常の語。
  // 体の部分・身の回りの物・動きを、台帳と同じ番号のまま入れている。
  { pairId: 31, ja: 'かお', en: 'face' },
  { pairId: 32, ja: 'て', en: 'hand' },
  { pairId: 33, ja: 'め', en: 'eye' },
  { pairId: 34, ja: 'みみ', en: 'ear' },
  { pairId: 35, ja: 'くち', en: 'mouth' },
  { pairId: 36, ja: 'かさ', en: 'umbrella' },
  { pairId: 37, ja: 'つくえ', en: 'desk' },
  { pairId: 38, ja: 'いす', en: 'chair' },
  { pairId: 39, ja: 'まど', en: 'window' },
  { pairId: 40, ja: 'ドア', en: 'door' },
  { pairId: 41, ja: 'えんぴつ', en: 'pencil' },
  { pairId: 42, ja: 'あるく', en: 'walk' },
  { pairId: 43, ja: 'およぐ', en: 'swim' },
  { pairId: 44, ja: 'うたう', en: 'sing' },
  { pairId: 45, ja: 'わらう', en: 'laugh' },
];

export function findPair(pairId: number): WordPair | undefined {
  return SAMPLE_PAIRS.find((pair) => pair.pairId === pairId);
}
