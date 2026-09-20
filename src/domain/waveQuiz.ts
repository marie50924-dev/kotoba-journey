import type { CardCount, WordPair } from './types';
import { shuffle } from './random';
import { isAnswerCorrect, type AnswerLanguage } from './answerCheck';

/**
 * ウェーブ終了後の任意確認テスト。
 *
 * ここでいうテストは開発用の自動テストではなく、プレイヤーが学習内容を
 * 確認するための小テスト。受験は任意で、スキップしても不利にならない。
 *
 * Phase 1-C2 で、選択肢から選ぶ方式からスマートフォンのキーボードで
 * 直接入力する方式へ変更した。選択肢は作らない。
 *
 * 出題はそのウェーブで出た単語だけを対象にする。
 * seed を渡せば問題順と出題方向を再現できる純粋関数。
 */

export type QuizFormat = 'ja-to-en' | 'en-to-ja';

export interface QuizQuestion {
  id: string;
  format: QuizFormat;
  /** 正解のペア。 */
  pairId: number;
  /** 設問に出す語（format により日本語か英語）。 */
  prompt: string;
  /** 入力してほしい答え。画面には出さない。 */
  answer: string;
  /** 答えを入力する言語。入力欄の設定と案内に使う。 */
  answerLanguage: AnswerLanguage;
}

/** 枚数ごとの出題数。3〜5問に収める。 */
export const QUESTION_COUNT_BY_CARD_COUNT: Record<CardCount, number> = {
  6: 3,
  12: 4,
  20: 5,
};

export function questionCountFor(cardCount: CardCount): number {
  return QUESTION_COUNT_BY_CARD_COUNT[cardCount];
}

/**
 * 1回のテストの出題方向。
 *
 * iOS ではページ側からキーボードの入力言語を切り替えられない。
 * 1回のテストの中で英語とひらがなが混ざると毎問キーボードを切り替えることになり、
 * 320×568 のような狭い画面では特に操作がつらくなる。
 * そのため出題方向はテスト単位で固定し、seed から決める。
 */
export function quizFormatForSeed(seed: number): QuizFormat {
  return Math.abs(Math.trunc(seed)) % 2 === 0 ? 'ja-to-en' : 'en-to-ja';
}

export function answerLanguageFor(format: QuizFormat): AnswerLanguage {
  return format === 'ja-to-en' ? 'en' : 'ja';
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
 * 問題数は枚数に応じて 3〜5 問。出題方向はテスト全体で1つに固定する。
 */
export function buildWaveQuiz(options: BuildQuizOptions): QuizQuestion[] {
  const { wavePairIds, cardCount, seed, pairs } = options;

  const pool = wavePairIds
    .map((id) => pairs.find((p) => p.pairId === id))
    .filter((p): p is WordPair => p !== undefined);

  if (pool.length === 0) return [];

  const wanted = Math.min(questionCountFor(cardCount), pool.length);
  const ordered = shuffle(pool, seed).slice(0, wanted);
  const format = quizFormatForSeed(seed);
  const answerLanguage = answerLanguageFor(format);

  return ordered.map((pair) => ({
    id: `${pair.pairId}-${format}`,
    format,
    pairId: pair.pairId,
    prompt: format === 'ja-to-en' ? pair.ja : pair.en,
    answer: format === 'ja-to-en' ? pair.en : pair.ja,
    answerLanguage,
  }));
}

/** 入力された文字列がその問題の正解か。表記ゆれの扱いは answerCheck 側の規則に従う。 */
export function isCorrectAnswer(question: QuizQuestion, input: string): boolean {
  return isAnswerCorrect(input, question.answer, question.answerLanguage);
}

/** 採点結果。通常カルタの集計とは混ぜない。 */
export interface QuizOutcome {
  questionCount: number;
  correctCount: number;
  incorrectPairIds: number[];
}

/**
 * 採点する。
 * answers は問題IDから「入力された文字列」への対応。
 * 未回答（キーが無い）も不正解として扱うが、通常カルタの誤答数には一切影響しない。
 */
export function scoreQuiz(
  questions: readonly QuizQuestion[],
  answers: ReadonlyMap<string, string>,
): QuizOutcome {
  let correctCount = 0;
  const incorrectPairIds: number[] = [];

  for (const question of questions) {
    const input = answers.get(question.id);
    if (input !== undefined && isCorrectAnswer(question, input)) {
      correctCount += 1;
    } else {
      incorrectPairIds.push(question.pairId);
    }
  }

  return { questionCount: questions.length, correctCount, incorrectPairIds };
}
