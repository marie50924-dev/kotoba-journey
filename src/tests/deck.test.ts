import { describe, expect, it } from 'vitest';
import { buildCards, buildDeck, pairCountFor, isCardCount } from '../domain/deck';
import { shuffle, createRng } from '../domain/random';
import { SAMPLE_PAIRS } from '../data/wordPairs';
import type { CardCount } from '../domain/types';

const COUNTS: CardCount[] = [6, 12, 20];

describe('デッキ生成', () => {
  it('3/6/10ペアに対応する枚数を返す', () => {
    expect(pairCountFor(6)).toBe(3);
    expect(pairCountFor(12)).toBe(6);
    expect(pairCountFor(20)).toBe(10);
  });

  it.each(COUNTS)('%i枚のデッキは指定枚数ちょうどになる', (count) => {
    expect(buildDeck(SAMPLE_PAIRS, count, 1)).toHaveLength(count);
  });

  it.each(COUNTS)('%i枚のデッキは日本語と英語が同数になる', (count) => {
    const deck = buildDeck(SAMPLE_PAIRS, count, 42);
    const ja = deck.filter((card) => card.lang === 'ja');
    const en = deck.filter((card) => card.lang === 'en');
    expect(ja).toHaveLength(count / 2);
    expect(en).toHaveLength(count / 2);
  });

  it.each(COUNTS)('%i枚のデッキは pairId が日英で1対1に対応する', (count) => {
    const deck = buildDeck(SAMPLE_PAIRS, count, 7);
    const jaIds = deck.filter((c) => c.lang === 'ja').map((c) => c.pairId).sort((a, b) => a - b);
    const enIds = deck.filter((c) => c.lang === 'en').map((c) => c.pairId).sort((a, b) => a - b);
    expect(jaIds).toEqual(enIds);
    expect(new Set(jaIds).size).toBe(pairCountFor(count));
  });

  it('先頭のペアから順に使う', () => {
    const cards = buildCards(SAMPLE_PAIRS, 6);
    expect(cards.map((c) => c.pairId)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(cards.map((c) => c.text)).toEqual(['りんご', 'apple', 'ねこ', 'cat', 'あお', 'blue']);
  });

  it('カードIDは盤面内で一意になる', () => {
    const deck = buildDeck(SAMPLE_PAIRS, 20, 3);
    expect(new Set(deck.map((c) => c.id)).size).toBe(20);
  });

  it('ペアが足りない場合はエラーになる', () => {
    expect(() => buildDeck(SAMPLE_PAIRS.slice(0, 2), 20, 1)).toThrow();
  });

  it('isCardCount は 6/12/20 のみを受け付ける', () => {
    expect(isCardCount(6)).toBe(true);
    expect(isCardCount(20)).toBe(true);
    expect(isCardCount(7)).toBe(false);
    expect(isCardCount('12')).toBe(false);
  });
});

describe('seed付きシャッフル', () => {
  it('同じseedなら必ず同じ並びになる', () => {
    const a = buildDeck(SAMPLE_PAIRS, 20, 12345);
    const b = buildDeck(SAMPLE_PAIRS, 20, 12345);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('seedが違えば並びが変わる', () => {
    const a = buildDeck(SAMPLE_PAIRS, 20, 1).map((c) => c.id);
    const b = buildDeck(SAMPLE_PAIRS, 20, 2).map((c) => c.id);
    expect(a).not.toEqual(b);
  });

  it('シャッフルは元の配列を壊さず、要素を欠落させない', () => {
    const source = [1, 2, 3, 4, 5];
    const result = shuffle(source, 99);
    expect(source).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort((x, y) => x - y)).toEqual(source);
  });

  it('乱数は 0 以上 1 未満に収まる', () => {
    const rng = createRng(2024);
    for (let i = 0; i < 500; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
