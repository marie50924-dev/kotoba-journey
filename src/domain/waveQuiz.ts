import type { CardCount, WordPair } from './types';
import { shuffle } from './random';

/**
 * ウェーブ終了後の任意確認テスト。
 *
 * ここでいうテストは開発用の自動テストではなく、プレイヤーが学習内容を
 * 確認するための小テスト。受験は任意で、スキップしても不利にならない。
 *
 * 出題はそのウェーブで出た単語だけを対象にし、選択肢も同じウェーブ内から作る。
 * seed を渡せば問題順・選択肢順を再現できる純粋関数。
 */

export type QuizFormat = 'ja-to-en' | 'en-to-ja';

export interface QuizChoice {
  pairId: number;
  text: string;
}

export interface QuizQuestion {
  id: string;
  format: QuizFormat;
  /** 正解のペア。 */
  pairId: number;
  /** 設問に出す語（format により日本語か英語）。 */
  prompt: string;
  choices: QuizChoice[];
}

/** 枚数ごとの出題数。3〜5問に収める。 */
export const QUESTION_COUNT_BY_CARD_COUNT: Record<CardCount, number> = {
  6: 3,
  12: 4,
  20: 5,
};

/** 選択肢の最大数。ウェーブ内のペア数が少なければそれに合わせる。 */
const MAX_CHOICES = 4;

export function questionCountFor(cardCount: CardCount): number {
  return QUESTION_COUNT_BY_CARD_COUNT[cardCount];
}

export interface BuildQuizOptions {
  /** そのウェーブで出題された pairId。ここにないペアは絶対に出さない。 */
  wavePairIds: readonly number[];
  cardCount: CardCount;
  seed: number;
  /** 語彙データ。wavePairIds の解決に使う。 */
  pairs: readonly WordPair[];
}

/**
 * ウェーブ用の小テストを生成する。
 * 日→英と英→日の両形式を必ず含め、問題数は枚数に応じて 3〜5 問。
 */
export function buildWaveQuiz(options: BuildQuizOptions): QuizQuestion[] {
  const { wavePairIds, cardCount, seed, pairs } = options;

  const pool = wavePairIds
    .map((id) => pairs.find((p) => p.pairId === id))
    .filter((p): p is WordPair => p !== undefined);

  if (pool.length === 0) return [];

  const wanted = Math.min(questionCountFor(cardCount), pool.length);
  const ordered = shuffle(pool, seed).slice(0, wanted);

  return ordered.map((pair, index) => {
    // 日→英と英→日が必ず両方現れるよう、交互に割り当てる。
    const format: QuizFormat = index % 2 === 0 ? 'ja-to-en' : 'en-to-ja';

    const distractors = shuffle(
      pool.filter((p) => p.pairId !== pair.pairId),
      seed + index * 7919,
    ).slice(0, Math.min(MAX_CHOICES, pool.length) - 1);

    const choices = shuffle([pair, ...distractors], seed + index * 104729).map((p) => ({
      pairId: p.pairId,
      text: format === 'ja-to-en' ? p.en : p.ja,
    }));

    return {
      id: `${pair.pairId}-${format}`,
      format,
      pairId: pair.pairId,
      prompt: format === 'ja-to-en' ? pair.ja : pair.en,
      choices,
    };
  });
}

export function isCorrectAnswer(question: QuizQuestion, chosenPairId: number): boolean {
  return question.pairId === chosenPairId;
}

/** 採点結果。通常カルタの集計とは混ぜない。 */
export interface QuizOutcome {
  questionCount: number;
  correctCount: number;
  incorrectPairIds: number[];
}

export function scoreQuiz(
  questions: readonly QuizQuestion[],
  answers: ReadonlyMap<string, number>,
): QuizOutcome {
  let correctCount = 0;
  const incorrectPairIds: number[] = [];

  for (const question of questions) {
    const chosen = answers.get(question.id);
    if (chosen !== undefined && isCorrectAnswer(question, chosen)) {
      correctCount += 1;
    } else {
      incorrectPairIds.push(question.pairId);
    }
  }

  return { questionCount: questions.length, correctCount, incorrectPairIds };
}
