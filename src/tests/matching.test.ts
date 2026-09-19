import { describe, expect, it } from 'vitest';
import { PlaySession } from '../domain/matching';
import { buildDeck } from '../domain/deck';
import { SAMPLE_PAIRS } from '../data/wordPairs';
import type { Card } from '../domain/types';

function session(cardCount: 6 | 12 | 20 = 6): PlaySession {
  return new PlaySession(buildDeck(SAMPLE_PAIRS, cardCount, 2024), 0);
}

function idOf(s: PlaySession, pairId: number, lang: 'ja' | 'en'): string {
  const card = s.cards.find((c: Card) => c.pairId === pairId && c.lang === lang);
  if (!card) throw new Error(`card not found: ${pairId}-${lang}`);
  return card.id;
}

/** 全ペアを順番に正解していくヘルパー。 */
function clearAll(s: PlaySession, pairIds: number[]): void {
  for (const pairId of pairIds) {
    s.selectCard(idOf(s, pairId, 'ja'));
    s.selectCard(idOf(s, pairId, 'en'));
    s.resolve();
  }
}

describe('マッチング判定', () => {
  it('1枚目を選ぶと選択状態になる', () => {
    const s = session();
    const outcome = s.selectCard(idOf(s, 1, 'ja'));
    expect(outcome.kind).toBe('selected');
    expect(s.selection).toEqual([idOf(s, 1, 'ja')]);
  });

  it('同じカードをもう一度押すと選択が外れる', () => {
    const s = session();
    const id = idOf(s, 1, 'ja');
    s.selectCard(id);
    expect(s.selectCard(id).kind).toBe('deselected');
    expect(s.selection).toEqual([]);
  });

  it('同じ言語同士は不成立になり、不正解には数えない', () => {
    const s = session();
    s.selectCard(idOf(s, 1, 'ja'));
    const outcome = s.selectCard(idOf(s, 2, 'ja'));
    expect(outcome.kind).toBe('rejected-same-language');
    expect(s.incorrectSelections).toBe(0);
    expect(s.correctSelections).toBe(0);
  });

  it('英語同士も不成立になる', () => {
    const s = session();
    s.selectCard(idOf(s, 1, 'en'));
    expect(s.selectCard(idOf(s, 3, 'en')).kind).toBe('rejected-same-language');
  });

  it('日本語と英語で pairId が一致すれば正解', () => {
    const s = session();
    s.selectCard(idOf(s, 2, 'ja'));
    const outcome = s.selectCard(idOf(s, 2, 'en'));
    expect(outcome).toMatchObject({ kind: 'correct', pairId: 2 });
    expect(s.correctSelections).toBe(1);
    expect(s.isMatched(2)).toBe(true);
  });

  it('英語を先に選んでも正解になる', () => {
    const s = session();
    s.selectCard(idOf(s, 3, 'en'));
    expect(s.selectCard(idOf(s, 3, 'ja')).kind).toBe('correct');
  });

  it('pairId が異なれば不正解', () => {
    const s = session();
    s.selectCard(idOf(s, 1, 'ja'));
    const outcome = s.selectCard(idOf(s, 2, 'en'));
    expect(outcome.kind).toBe('incorrect');
    expect(s.incorrectSelections).toBe(1);
    expect(s.isMatched(1)).toBe(false);
  });

  it('判定後は入力ロックがかかり、連打を受け付けない', () => {
    const s = session();
    s.selectCard(idOf(s, 1, 'ja'));
    s.selectCard(idOf(s, 2, 'en'));
    expect(s.isLocked).toBe(true);
    expect(s.selectCard(idOf(s, 3, 'ja')).kind).toBe('ignored');
    s.resolve();
    expect(s.isLocked).toBe(false);
    expect(s.selectCard(idOf(s, 3, 'ja')).kind).toBe('selected');
  });

  it('取得済みのカードは再度選べない', () => {
    const s = session();
    s.selectCard(idOf(s, 1, 'ja'));
    s.selectCard(idOf(s, 1, 'en'));
    s.resolve();
    expect(s.selectCard(idOf(s, 1, 'ja')).kind).toBe('ignored');
  });

  it('全ペア取得でクリアになる', () => {
    const s = session(6);
    expect(s.isCleared).toBe(false);
    clearAll(s, [1, 2, 3]);
    expect(s.matchedPairCount).toBe(3);
    expect(s.isCleared).toBe(true);
  });

  it('20枚でも全10ペア取得でクリアになる', () => {
    const s = session(20);
    clearAll(s, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(s.isCleared).toBe(true);
    expect(s.correctSelections).toBe(10);
  });

  it('クリア後は入力を受け付けない', () => {
    const s = session(6);
    clearAll(s, [1, 2, 3]);
    expect(s.selectCard(idOf(s, 1, 'ja')).kind).toBe('ignored');
  });
});

describe('記録', () => {
  it('pairIdごとの誤答回数を数える', () => {
    const s = session(6);
    s.selectCard(idOf(s, 1, 'ja'));
    s.selectCard(idOf(s, 2, 'en'));
    s.resolve();
    const stats = s.pairStats();
    expect(stats.find((x) => x.pairId === 1)?.mistakes).toBe(1);
    expect(stats.find((x) => x.pairId === 2)?.mistakes).toBe(1);
    expect(stats.find((x) => x.pairId === 3)?.mistakes).toBe(0);
  });

  it('pairIdごとの回答時間を記録する', () => {
    const s = new PlaySession(buildDeck(SAMPLE_PAIRS, 6, 5), 1000);
    s.selectCard(idOf(s, 1, 'ja'), 1500);
    s.selectCard(idOf(s, 1, 'en'), 3200);
    s.resolve();
    expect(s.pairStats().find((x) => x.pairId === 1)?.answerTimeMs).toBe(2200);
  });

  it('経過時間はクリア時点で止まる', () => {
    const s = new PlaySession(buildDeck(SAMPLE_PAIRS, 6, 5), 0);
    for (const pairId of [1, 2]) {
      s.selectCard(idOf(s, pairId, 'ja'), 100);
      s.selectCard(idOf(s, pairId, 'en'), 200);
      s.resolve();
    }
    s.selectCard(idOf(s, 3, 'ja'), 4000);
    s.selectCard(idOf(s, 3, 'en'), 5000);
    s.resolve();
    expect(s.elapsedMs(90000)).toBe(5000);
  });
});
