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

/** 枚数選択から、使うペア数を返す。 */
export function pairCountFor(cardCount: CardCount): number {
  return PAIR_COUNT_BY_CARD_COUNT[cardCount];
}

/**
 * 1つの seed から、役割ごとに別の seed を作る。
 *
 * 「どの語を選ぶか」と「カードをどこへ置くか」で同じ seed をそのまま使うと、
 * 同じ並べ替えが2回起きて結果が相関する。役割ごとに定数をずらして切り離す。
 * 盤面レイアウトが seed ^ 0x9e3779b9 を使っているのと同じ考え方。
 */
const SELECT_SALT = 0x85ebca6b;
const ARRANGE_SALT = 0xc2b2ae35;

/** 語彙選出に使う seed。 */
export function selectSeed(seed: number): number {
  return (Math.trunc(seed) ^ SELECT_SALT) >>> 0;
}

/** 盤面のカード順に使う seed。 */
export function arrangeSeed(seed: number): number {
  return (Math.trunc(seed) ^ ARRANGE_SALT) >>> 0;
}

/**
 * 盤面に出す語を seed で選ぶ。
 *
 * 並べ替えてから先頭を取るので、選んだ語に重複は出ない。
 * 元の配列は変更しない（shuffle が複製を返す）。
 * 同じ語彙プール・同じ数・同じ seed なら必ず同じ語になる。
 *
 * 将来コース別の語彙セットを持つときも、渡す配列を差し替えるだけで使える。
 */
export function selectPairs(
  pairs: readonly WordPair[],
  pairCount: number,
  seed: number,
): WordPair[] {
  if (pairs.length < pairCount) {
    throw new Error(
      `ペア数が不足しています: ${pairCount}ペア必要ですが${pairs.length}ペアしかありません`,
    );
  }
  return shuffle(pairs, selectSeed(seed)).slice(0, pairCount);
}

/**
 * 指定枚数ぶんの語を選び、日本語カードと英語カードへ展開する。
 * 1ペアにつき ja と en の2枚を必ず作る。並べ替えはしない純粋関数。
 */
export function buildCards(
  pairs: readonly WordPair[],
  cardCount: CardCount,
  seed: number,
): Card[] {
  const cards: Card[] = [];
  for (const pair of selectPairs(pairs, pairCountFor(cardCount), seed)) {
    cards.push({ id: `${pair.pairId}-ja`, pairId: pair.pairId, lang: 'ja', text: pair.ja });
    cards.push({ id: `${pair.pairId}-en`, pairId: pair.pairId, lang: 'en', text: pair.en });
  }
  return cards;
}

/**
 * 盤面用のデッキを生成する。seed を渡せば同じ並びを再現できる。
 *
 * 語を選ぶ処理（selectPairs）と、盤面へ置く順を決める処理（shuffle）は別で、
 * それぞれ別の seed を使う。日本語カードと英語カードは同じ盤面に混在する。
 */
export function buildDeck(pairs: readonly WordPair[], cardCount: CardCount, seed: number): Card[] {
  return shuffle(buildCards(pairs, cardCount, seed), arrangeSeed(seed));
}
