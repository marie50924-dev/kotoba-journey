import type { Card, PairStat, SelectionOutcome } from './types';

/**
 * カルタ1プレイぶんの状態とルール。DOM には一切触れない。
 * 画面側は selectCard() の戻り値を見て演出を出し、
 * 演出が終わったタイミングで resolve() を呼ぶ。
 */
export class PlaySession {
  readonly cards: readonly Card[];

  private readonly matched = new Set<number>();
  private readonly mistakesByPair = new Map<number, number>();
  private readonly answerTimeByPair = new Map<number, number>();

  private selectedIds: string[] = [];
  private locked = false;
  private startedAtMs: number;
  private finishedAtMs: number | null = null;

  private correct = 0;
  private incorrect = 0;

  constructor(cards: readonly Card[], nowMs = 0) {
    this.cards = cards.slice();
    this.startedAtMs = nowMs;
  }

  /** 開始時刻を打ち直す（画面表示が整ってから計測を始めたい場合に使う）。 */
  start(nowMs: number): void {
    this.startedAtMs = nowMs;
  }

  get selection(): readonly string[] {
    return this.selectedIds;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  get correctSelections(): number {
    return this.correct;
  }

  get incorrectSelections(): number {
    return this.incorrect;
  }

  get matchedPairCount(): number {
    return this.matched.size;
  }

  get totalPairCount(): number {
    return this.cards.length / 2;
  }

  get isCleared(): boolean {
    return this.matched.size === this.totalPairCount;
  }

  isMatched(pairId: number): boolean {
    return this.matched.has(pairId);
  }

  isSelected(cardId: string): boolean {
    return this.selectedIds.includes(cardId);
  }

  elapsedMs(nowMs: number): number {
    const end = this.finishedAtMs ?? nowMs;
    // performance.now() は小数を返すので、記録用に整数へ丸める。
    return Math.round(Math.max(0, end - this.startedAtMs));
  }

  /**
   * カードを1枚選ぶ。
   * 1枚目 -> selected / 同じカードをもう一度 -> deselected /
   * 2枚目 -> rejected-same-language | correct | incorrect。
   * 判定が出た場合は入力ロックがかかるので、演出後に resolve() を呼ぶこと。
   */
  selectCard(cardId: string, nowMs = 0): SelectionOutcome {
    if (this.locked || this.isCleared) return { kind: 'ignored' };

    const card = this.cards.find((c) => c.id === cardId);
    if (!card) return { kind: 'ignored' };
    if (this.matched.has(card.pairId)) return { kind: 'ignored' };

    if (this.selectedIds.includes(cardId)) {
      this.selectedIds = this.selectedIds.filter((id) => id !== cardId);
      return { kind: 'deselected', cardId };
    }

    if (this.selectedIds.length === 0) {
      this.selectedIds = [cardId];
      return { kind: 'selected', cardId };
    }

    const firstId = this.selectedIds[0];
    const first = this.cards.find((c) => c.id === firstId)!;
    const ids: [string, string] = [firstId, cardId];

    // 同じ言語同士は不成立。誤答としては数えず、選択だけ解除する。
    if (first.lang === card.lang) {
      this.locked = true;
      return { kind: 'rejected-same-language', cardIds: ids };
    }

    this.selectedIds = ids;
    this.locked = true;

    if (first.pairId === card.pairId) {
      this.correct += 1;
      this.matched.add(card.pairId);
      this.answerTimeByPair.set(card.pairId, Math.round(Math.max(0, nowMs - this.startedAtMs)));
      if (this.isCleared) this.finishedAtMs = nowMs;
      return { kind: 'correct', pairId: card.pairId, cardIds: ids };
    }

    this.incorrect += 1;
    this.bumpMistake(first.pairId);
    this.bumpMistake(card.pairId);
    return { kind: 'incorrect', cardIds: ids };
  }

  /** 演出が終わったので選択状態を解除し、入力ロックを外す。 */
  resolve(): void {
    this.selectedIds = [];
    this.locked = false;
  }

  /** pairId ごとの誤答回数と回答時間。 */
  pairStats(): PairStat[] {
    const pairIds = Array.from(new Set(this.cards.map((c) => c.pairId)));
    return pairIds.map((pairId) => ({
      pairId,
      mistakes: this.mistakesByPair.get(pairId) ?? 0,
      answerTimeMs: this.answerTimeByPair.get(pairId) ?? 0,
    }));
  }

  private bumpMistake(pairId: number): void {
    this.mistakesByPair.set(pairId, (this.mistakesByPair.get(pairId) ?? 0) + 1);
  }
}
