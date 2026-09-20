import { describe, expect, it } from 'vitest';
import {
  answerLanguageFor,
  buildWaveQuiz,
  isCorrectAnswer,
  questionCountFor,
  quizFormatForSeed,
  scoreQuiz,
} from '../domain/waveQuiz';
import type { QuizQuestion } from '../domain/waveQuiz';
import { SAMPLE_PAIRS } from '../data/wordPairs';
import type { CardCount } from '../domain/types';

/** 出題方向が固定なので、seed で「日→英」「英→日」を選び分けてテストする。 */
const SEED_JA_TO_EN = 2024; // 偶数 → ja-to-en
const SEED_EN_TO_JA = 2025; // 奇数 → en-to-ja

function quiz(wavePairIds: number[], cardCount: CardCount = 6, seed = SEED_JA_TO_EN) {
  return buildWaveQuiz({ wavePairIds, cardCount, seed, pairs: SAMPLE_PAIRS });
}

describe('確認テストの出題', () => {
  it('枚数に応じて3〜5問になる', () => {
    expect(questionCountFor(6)).toBe(3);
    expect(questionCountFor(12)).toBe(4);
    expect(questionCountFor(20)).toBe(5);
    expect(quiz([1, 2, 3], 6)).toHaveLength(3);
    expect(quiz([1, 2, 3, 4, 5, 6], 12)).toHaveLength(4);
    expect(quiz([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 20)).toHaveLength(5);
  });

  it('そのウェーブの pairId だけから問題を作る', () => {
    const wave = [2, 4, 6];
    const questions = quiz(wave, 6);
    expect(questions).toHaveLength(3);
    for (const q of questions) expect(wave).toContain(q.pairId);
  });

  it('ウェーブ外の単語は答えにも現れない', () => {
    const wave = [1, 2, 3];
    const allowed = SAMPLE_PAIRS.filter((p) => wave.includes(p.pairId));
    for (const q of quiz(wave, 6)) {
      expect(allowed.some((p) => p.ja === q.answer || p.en === q.answer)).toBe(true);
    }
  });

  it('選択肢は作らない（直接入力方式）', () => {
    for (const q of quiz([1, 2, 3], 6)) {
      expect('choices' in q).toBe(false);
      expect(typeof q.answer).toBe('string');
      expect(q.answer.length).toBeGreaterThan(0);
    }
  });

  it('1回のテストの出題方向は全問で同じ（キーボードを切り替えさせない）', () => {
    for (const seed of [SEED_JA_TO_EN, SEED_EN_TO_JA, 7, 88, 123456]) {
      const formats = new Set(
        quiz([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 20, seed).map((q) => q.format),
      );
      expect(formats.size).toBe(1);
    }
  });

  it('出題方向は seed から決まり、両方向が起こりうる', () => {
    expect(quizFormatForSeed(SEED_JA_TO_EN)).toBe('ja-to-en');
    expect(quizFormatForSeed(SEED_EN_TO_JA)).toBe('en-to-ja');
    expect(quizFormatForSeed(-3)).toBe('en-to-ja');
    expect(quizFormatForSeed(0)).toBe('ja-to-en');
  });

  it('日→英は日本語を出して英語を入力させる', () => {
    for (const q of quiz([1, 2, 3], 6, SEED_JA_TO_EN)) {
      const pair = SAMPLE_PAIRS.find((p) => p.pairId === q.pairId)!;
      expect(q.format).toBe('ja-to-en');
      expect(q.prompt).toBe(pair.ja);
      expect(q.answer).toBe(pair.en);
      expect(q.answerLanguage).toBe('en');
    }
  });

  it('英→日は英語を出してひらがなを入力させる', () => {
    for (const q of quiz([1, 2, 3], 6, SEED_EN_TO_JA)) {
      const pair = SAMPLE_PAIRS.find((p) => p.pairId === q.pairId)!;
      expect(q.format).toBe('en-to-ja');
      expect(q.prompt).toBe(pair.en);
      expect(q.answer).toBe(pair.ja);
      expect(q.answerLanguage).toBe('ja');
    }
  });

  it('答える言語は出題方向から決まる', () => {
    expect(answerLanguageFor('ja-to-en')).toBe('en');
    expect(answerLanguageFor('en-to-ja')).toBe('ja');
  });

  it('出題文に答えを含めない', () => {
    for (const q of quiz([1, 2, 3, 4, 5, 6], 12)) {
      expect(q.prompt).not.toContain(q.answer);
    }
  });

  it('同じ問題を2回出さない', () => {
    const ids = quiz([1, 2, 3, 4, 5, 6], 12).map((q) => q.pairId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('同じ seed なら問題順を再現できる', () => {
    const a = quiz([1, 2, 3, 4, 5, 6], 12, 778);
    const b = quiz([1, 2, 3, 4, 5, 6], 12, 778);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('seed が違えば並びが変わる', () => {
    const a = quiz([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 20, 1).map((q) => q.pairId);
    const b = quiz([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 20, 3).map((q) => q.pairId);
    expect(a).not.toEqual(b);
  });

  it('ウェーブのペア数が出題数より少なければその数に合わせる', () => {
    expect(quiz([1, 2], 20)).toHaveLength(2);
  });

  it('ウェーブが空なら問題を作らない', () => {
    expect(quiz([], 6)).toEqual([]);
  });

  it('語彙データに無い pairId は無視する', () => {
    const questions = quiz([1, 2, 999], 6);
    expect(questions.every((q) => q.pairId !== 999)).toBe(true);
  });
});

describe('確認テストの採点', () => {
  const questions = quiz([1, 2, 3], 6, SEED_JA_TO_EN);

  it('入力した文字列で正誤を判定する', () => {
    const q = questions[0];
    expect(isCorrectAnswer(q, q.answer)).toBe(true);
    expect(isCorrectAnswer(q, `${q.answer}x`)).toBe(false);
  });

  it('大文字小文字と前後の空白は正解のまま', () => {
    const q = questions[0];
    expect(isCorrectAnswer(q, `  ${q.answer.toUpperCase()}  `)).toBe(true);
  });

  it('ひらがな入力でもカタカナを正解にする', () => {
    const q = quiz([1, 2, 3], 6, SEED_EN_TO_JA)[0];
    const katakana = q.answer.replace(/[ぁ-ゖ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60),
    );
    expect(isCorrectAnswer(q, katakana)).toBe(true);
  });

  it('全問正解を数えられる', () => {
    const answers = new Map(questions.map((q) => [q.id, q.answer]));
    const outcome = scoreQuiz(questions, answers);
    expect(outcome.correctCount).toBe(questions.length);
    expect(outcome.incorrectPairIds).toEqual([]);
  });

  it('間違えた単語を記録する', () => {
    const answers = new Map(questions.map((q, i) => [q.id, i === 0 ? 'zzzz' : q.answer]));
    const outcome = scoreQuiz(questions, answers);
    expect(outcome.correctCount).toBe(questions.length - 1);
    expect(outcome.incorrectPairIds).toEqual([questions[0].pairId]);
  });

  it('未回答は不正解として扱う', () => {
    const outcome = scoreQuiz(questions, new Map());
    expect(outcome.correctCount).toBe(0);
    expect(outcome.incorrectPairIds).toHaveLength(questions.length);
  });

  it('空文字の回答は不正解として扱う', () => {
    const answers = new Map(questions.map((q) => [q.id, '   ']));
    const outcome = scoreQuiz(questions, answers);
    expect(outcome.correctCount).toBe(0);
    expect(outcome.incorrectPairIds).toHaveLength(questions.length);
  });

  it('問題が0件なら0除算にならない', () => {
    const outcome = scoreQuiz([] as QuizQuestion[], new Map());
    expect(outcome).toEqual({ questionCount: 0, correctCount: 0, incorrectPairIds: [] });
  });
});
