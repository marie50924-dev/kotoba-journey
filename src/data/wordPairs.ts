import type { WordPair } from '../domain/types';

/**
 * グレーボックス工程用の仮データ。
 * 正式なコース別語彙は後工程で差し替える。
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
];

export function findPair(pairId: number): WordPair | undefined {
  return SAMPLE_PAIRS.find((pair) => pair.pairId === pairId);
}
