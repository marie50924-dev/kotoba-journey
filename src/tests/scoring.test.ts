import { describe, expect, it } from 'vitest';
import { calculateAccuracy, formatDuration, groupByMastery, masteryFor } from '../domain/scoring';

describe('正解率', () => {
  it('correct / (correct + incorrect) * 100 で計算する', () => {
    expect(calculateAccuracy(10, 0)).toBe(100);
    expect(calculateAccuracy(3, 1)).toBe(75);
    expect(calculateAccuracy(1, 1)).toBe(50);
  });

  it('割り切れない場合は小数第1位へ丸める', () => {
    expect(calculateAccuracy(2, 1)).toBe(66.7);
  });

  it('分母が0でも0除算にならず0を返す', () => {
    expect(calculateAccuracy(0, 0)).toBe(0);
    expect(Number.isFinite(calculateAccuracy(0, 0))).toBe(true);
  });

  it('全問不正解なら0になる', () => {
    expect(calculateAccuracy(0, 5)).toBe(0);
  });
});

describe('習得状態の判定', () => {
  it('誤答0回は習得', () => {
    expect(masteryFor(0)).toBe('mastered');
  });

  it('誤答1回は練習中', () => {
    expect(masteryFor(1)).toBe('practicing');
  });

  it('誤答2回以上は復習', () => {
    expect(masteryFor(2)).toBe('review');
    expect(masteryFor(9)).toBe('review');
  });

  it('pairStats を習得状態ごとにまとめる', () => {
    const grouped = groupByMastery([
      { pairId: 1, mistakes: 0, answerTimeMs: 100 },
      { pairId: 2, mistakes: 1, answerTimeMs: 200 },
      { pairId: 3, mistakes: 3, answerTimeMs: 300 },
      { pairId: 4, mistakes: 0, answerTimeMs: 400 },
    ]);
    expect(grouped.mastered).toEqual([1, 4]);
    expect(grouped.practicing).toEqual([2]);
    expect(grouped.review).toEqual([3]);
  });
});

describe('時間表示', () => {
  it('m:ss 形式にする', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9000)).toBe('0:09');
    expect(formatDuration(65000)).toBe('1:05');
    expect(formatDuration(600000)).toBe('10:00');
  });

  it('不正な値でも壊れない', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(-100)).toBe('0:00');
  });
});
