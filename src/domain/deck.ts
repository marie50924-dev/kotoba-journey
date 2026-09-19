import type { Card, CardCount, WordPair } from './types';
import { shuffle } from './random';

/** 枚数選択に対応するペア数。 */
export const PAIR_COUNT_BY_CARD_COUNT: Record<CardCount, number> = {
  6: 3,
  12: 6,
  20: 10,
};

export const CARD_COUNTS: CardCount[] = [6, 12, 20];

export function isCardCount(value: unknown): value is CardCount {
  return value === 6 || value === 12 || value === 20;
}

/** 枚数選択から、先頭から使うペア数を返す。 */
export function pairCountFor(cardCount: CardCount): number {
  return PAIR_COUNT_BY_CARD_COUNT[cardCount];
}

/**
 * 指定枚数ぶんのペアを先頭から取り出し、日本語カードと英語カードへ展開する。
 * シャッフル前の並び（日本語→英語の順）を返す純粋関数。
 */
export function buildCards(pairs: readonly WordPair[], cardCount: CardCount): Card[] {
  const pairCount = pairCountFor(cardCount);
  if (pairs.length < pairCount) {
    throw new Error(
      `ペア数が不足しています: ${cardCount}枚には${pairCount}ペア必要ですが${pairs.length}ペアしかありません`,
    );
  }
  const cards: Card[] = [];
  for (const pair of pairs.slice(0, pairCount)) {
    cards.push({ id: `${pair.pairId}-ja`, pairId: pair.pairId, lang: 'ja', text: pair.ja });
    cards.push({ id: `${pair.pairId}-en`, pairId: pair.pairId, lang: 'en', text: pair.en });
  }
  return cards;
}

/**
 * 盤面用のデッキを生成する。seed を渡せば同じ並びを再現できる。
 * 日本語カードと英語カードは同じ盤面に混在する。
 */
export function buildDeck(pairs: readonly WordPair[], cardCount: CardCount, seed: number): Card[] {
  return shuffle(buildCards(pairs, cardCount), seed);
}
