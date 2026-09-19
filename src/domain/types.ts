/** 学習データとゲーム進行で共有する型定義。 */

export type Language = 'ja' | 'en';

/** 1組の日英ペア。pairId が日本語カードと英語カードを結び付ける。 */
export interface WordPair {
  pairId: number;
  ja: string;
  en: string;
}

/** 盤面に並ぶ1枚のカード。 */
export interface Card {
  /** 盤面内で一意なID。`${pairId}-${lang}` 形式。 */
  id: string;
  pairId: number;
  lang: Language;
  text: string;
}

/** 枚数選択の3段階。 */
export type CardCount = 6 | 12 | 20;

export interface CardCountOption {
  cardCount: CardCount;
  pairCount: number;
  labelJa: string;
}

/** 2枚目を選んだ時の判定結果。 */
export type SelectionOutcome =
  /** 1枚目の選択、または選択解除。判定は発生しない。 */
  | { kind: 'selected'; cardId: string }
  | { kind: 'deselected'; cardId: string }
  /** 同じ言語同士。不成立として選択を解除する（不正解には数えない）。 */
  | { kind: 'rejected-same-language'; cardIds: [string, string] }
  /** 日本語と英語で pairId が一致。 */
  | { kind: 'correct'; pairId: number; cardIds: [string, string] }
  /** 日本語と英語だが pairId が異なる。 */
  | { kind: 'incorrect'; cardIds: [string, string] }
  /** 入力ロック中、または取得済みカードへの操作。 */
  | { kind: 'ignored' };

/** 1プレイ分の集計。 */
export interface PairStat {
  pairId: number;
  /** その pairId が絡んだ不正解の回数。 */
  mistakes: number;
  /** 盤面開始から、そのペアを取得するまでの時間(ms)。 */
  answerTimeMs: number;
}

/** 仮の習得判定。誤答0回=習得 / 1回=練習中 / 2回以上=復習。 */
export type MasteryLevel = 'mastered' | 'practicing' | 'review';

export interface PlayResult {
  courseId: string;
  courseLabel: string;
  cardCount: CardCount;
  matchedPairs: number;
  correctSelections: number;
  incorrectSelections: number;
  elapsedMs: number;
  accuracy: number;
  pairStats: PairStat[];
}
