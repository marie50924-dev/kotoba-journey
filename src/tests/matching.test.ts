import { describe, expect, it } from 'vitest';
import { PlaySession } from '../domain/matching';
import { buildDeck } from '../domain/deck';
import { SAMPLE_PAIRS } from '../data/wordPairs';
import type { Card } from '../domain/types';

function session(cardCount: 6 | 12 | 20 = 6): PlaySession {
  return new PlaySession(buildDeck(SAMPLE_PAIRS, cardCount, 2024), 0);
}

/**
 * 盤面に出ている pairId を小さい順に返す。
 *
 * どの語が盤面に出るかは seed で決まるので、1・2・3 と決め打ちしない。
 * マッチング判定の検査は「盤面の1番目・2番目の語」で書く。
 */
function pairsOn(s: PlaySession): number[] {
  return [...new Set(s.cards.map((c: Card) => c.pairId))].sort((a, b) => a - b);
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
    const [a] = pairsOn(s);
    const outcome = s.selectCard(idOf(s, a, 'ja'));
    expect(outcome.kind).toBe('selected');
    expect(s.selection).toEqual([idOf(s, a, 'ja')]);
  });

  it('同じカードをもう一度押すと選択が外れる', () => {
    const s = session();
    const id = idOf(s, pairsOn(s)[0], 'ja');
    s.selectCard(id);
    expect(s.selectCard(id).kind).toBe('deselected');
    expect(s.selection).toEqual([]);
  });

  it('同じ言語同士は不成立になり、不正解には数えない', () => {
    const s = session();
    const [a, b] = pairsOn(s);
    s.selectCard(idOf(s, a, 'ja'));
    const outcome = s.selectCard(idOf(s, b, 'ja'));
    expect(outcome.kind).toBe('rejected-same-language');
    expect(s.incorrectSelections).toBe(0);
    expect(s.correctSelections).toBe(0);
  });

  it('英語同士も不成立になる', () => {
    const s = session();
    const [a, , c] = pairsOn(s);
    s.selectCard(idOf(s, a, 'en'));
    expect(s.selectCard(idOf(s, c, 'en')).kind).toBe('rejected-same-language');
  });

  it('日本語と英語で pairId が一致すれば正解', () => {
    const s = session();
    const [, b] = pairsOn(s);
    s.selectCard(idOf(s, b, 'ja'));
    const outcome = s.selectCard(idOf(s, b, 'en'));
    expect(outcome).toMatchObject({ kind: 'correct', pairId: b });
    expect(s.correctSelections).toBe(1);
    expect(s.isMatched(b)).toBe(true);
  });

  it('英語を先に選んでも正解になる', () => {
    const s = session();
    const [, , c] = pairsOn(s);
    s.selectCard(idOf(s, c, 'en'));
    expect(s.selectCard(idOf(s, c, 'ja')).kind).toBe('correct');
  });

  it('pairId が異なれば不正解', () => {
    const s = session();
    const [a, b] = pairsOn(s);
    s.selectCard(idOf(s, a, 'ja'));
    const outcome = s.selectCard(idOf(s, b, 'en'));
    expect(outcome.kind).toBe('incorrect');
    expect(s.incorrectSelections).toBe(1);
    expect(s.isMatched(a)).toBe(false);
  });

  it('判定後は入力ロックがかかり、連打を受け付けない', () => {
    const s = session();
    const [a, b, c] = pairsOn(s);
    s.selectCard(idOf(s, a, 'ja'));
    s.selectCard(idOf(s, b, 'en'));
    expect(s.isLocked).toBe(true);
    expect(s.selectCard(idOf(s, c, 'ja')).kind).toBe('ignored');
    s.resolve();
    expect(s.isLocked).toBe(false);
    expect(s.selectCard(idOf(s, c, 'ja')).kind).toBe('selected');
  });

  it('取得済みのカードは再度選べない', () => {
    const s = session();
    const [a] = pairsOn(s);
    s.selectCard(idOf(s, a, 'ja'));
    s.selectCard(idOf(s, a, 'en'));
    s.resolve();
    expect(s.selectCard(idOf(s, a, 'ja')).kind).toBe('ignored');
  });

  it('全ペア取得でクリアになる', () => {
    const s = session(6);
    expect(s.isCleared).toBe(false);
    clearAll(s, pairsOn(s));
    expect(s.matchedPairCount).toBe(3);
    expect(s.isCleared).toBe(true);
  });

  it('20枚でも、出た10ペアをすべて取ればクリアになる', () => {
    const s = session(20);
    // 語彙が25語になったので、20枚に並ぶ10語は seed で変わる。
    // どの10語が出ても、全部取ればクリアになることを見る。
    expect(pairsOn(s)).toHaveLength(10);
    clearAll(s, pairsOn(s));
    expect(s.isCleared).toBe(true);
    expect(s.correctSelections).toBe(10);
  });

  it('クリア後は入力を受け付けない', () => {
    const s = session(6);
    const [a] = pairsOn(s);
    clearAll(s, pairsOn(s));
    expect(s.selectCard(idOf(s, a, 'ja')).kind).toBe('ignored');
  });
});

describe('記録', () => {
  it('pairIdごとの誤答回数を数える', () => {
    const s = session(6);
    const [a, b, c] = pairsOn(s);
    s.selectCard(idOf(s, a, 'ja'));
    s.selectCard(idOf(s, b, 'en'));
    s.resolve();
    const stats = s.pairStats();
    expect(stats.find((x) => x.pairId === a)?.mistakes).toBe(1);
    expect(stats.find((x) => x.pairId === b)?.mistakes).toBe(1);
    expect(stats.find((x) => x.pairId === c)?.mistakes).toBe(0);
  });

  it('pairIdごとの回答時間を記録する', () => {
    const s = new PlaySession(buildDeck(SAMPLE_PAIRS, 6, 5), 1000);
    const [a] = pairsOn(s);
    s.selectCard(idOf(s, a, 'ja'), 1500);
    s.selectCard(idOf(s, a, 'en'), 3200);
    s.resolve();
    expect(s.pairStats().find((x) => x.pairId === a)?.answerTimeMs).toBe(2200);
  });

  it('経過時間はクリア時点で止まる', () => {
    const s = new PlaySession(buildDeck(SAMPLE_PAIRS, 6, 5), 0);
    const [a, b, c] = pairsOn(s);
    for (const pairId of [a, b]) {
      s.selectCard(idOf(s, pairId, 'ja'), 100);
      s.selectCard(idOf(s, pairId, 'en'), 200);
      s.resolve();
    }
    s.selectCard(idOf(s, c, 'ja'), 4000);
    s.selectCard(idOf(s, c, 'en'), 5000);
    s.resolve();
    expect(s.elapsedMs(90000)).toBe(5000);
  });
});
