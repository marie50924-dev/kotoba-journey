import { describe, expect, it } from 'vitest';
import { buildWaveQuiz, questionCountFor, scoreQuiz, isCorrectAnswer } from '../domain/waveQuiz';
import type { QuizQuestion } from '../domain/waveQuiz';
import { SAMPLE_PAIRS } from '../data/wordPairs';
import type { CardCount } from '../domain/types';

function quiz(wavePairIds: number[], cardCount: CardCount = 6, seed = 2024) {
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
    for (const q of questions) {
      expect(wave).toContain(q.pairId);
      // 選択肢もウェーブ内のペアだけで構成する。
      for (const choice of q.choices) expect(wave).toContain(choice.pairId);
    }
  });

  it('ウェーブ外の単語は選択肢にも現れない', () => {
    const questions = quiz([1, 2, 3], 6);
    const used = new Set(questions.flatMap((q) => q.choices.map((c) => c.pairId)));
    expect([...used].every((id) => [1, 2, 3].includes(id))).toBe(true);
  });

  it('日→英と英→日の両形式が成立する', () => {
    const formats = quiz([1, 2, 3, 4, 5, 6], 12).map((q) => q.format);
    expect(formats).toContain('ja-to-en');
    expect(formats).toContain('en-to-ja');
  });

  it('日→英は日本語を出して英語の選択肢を出す', () => {
    const q = quiz([1, 2, 3], 6).find((x) => x.format === 'ja-to-en')!;
    const pair = SAMPLE_PAIRS.find((p) => p.pairId === q.pairId)!;
    expect(q.prompt).toBe(pair.ja);
    expect(q.choices.map((c) => c.text)).toContain(pair.en);
  });

  it('英→日は英語を出して日本語の選択肢を出す', () => {
    const q = quiz([1, 2, 3], 6).find((x) => x.format === 'en-to-ja')!;
    const pair = SAMPLE_PAIRS.find((p) => p.pairId === q.pairId)!;
    expect(q.prompt).toBe(pair.en);
    expect(q.choices.map((c) => c.text)).toContain(pair.ja);
  });

  it('正解は必ず選択肢に含まれる', () => {
    for (const q of quiz([1, 2, 3, 4, 5, 6], 12)) {
      expect(q.choices.some((c) => c.pairId === q.pairId)).toBe(true);
    }
  });

  it('選択肢は重複しない', () => {
    for (const q of quiz([1, 2, 3, 4, 5, 6], 12)) {
      expect(new Set(q.choices.map((c) => c.pairId)).size).toBe(q.choices.length);
    }
  });

  it('同じ問題を2回出さない', () => {
    const ids = quiz([1, 2, 3, 4, 5, 6], 12).map((q) => q.pairId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('同じ seed なら問題順と選択肢順を再現できる', () => {
    const a = quiz([1, 2, 3, 4, 5, 6], 12, 777);
    const b = quiz([1, 2, 3, 4, 5, 6], 12, 777);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('seed が違えば並びが変わる', () => {
    const a = quiz([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 20, 1).map((q) => q.pairId);
    const b = quiz([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 20, 2).map((q) => q.pairId);
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
  const questions = quiz([1, 2, 3], 6);

  it('正解判定は pairId の一致で行う', () => {
    const q = questions[0];
    expect(isCorrectAnswer(q, q.pairId)).toBe(true);
    expect(isCorrectAnswer(q, q.pairId + 1)).toBe(false);
  });

  it('全問正解を数えられる', () => {
    const answers = new Map(questions.map((q) => [q.id, q.pairId]));
    const outcome = scoreQuiz(questions, answers);
    expect(outcome.correctCount).toBe(questions.length);
    expect(outcome.incorrectPairIds).toEqual([]);
  });

  it('間違えた単語を記録する', () => {
    const answers = new Map(questions.map((q, i) => [q.id, i === 0 ? -1 : q.pairId]));
    const outcome = scoreQuiz(questions, answers);
    expect(outcome.correctCount).toBe(questions.length - 1);
    expect(outcome.incorrectPairIds).toEqual([questions[0].pairId]);
  });

  it('未回答は不正解として扱う', () => {
    const outcome = scoreQuiz(questions, new Map());
    expect(outcome.correctCount).toBe(0);
    expect(outcome.incorrectPairIds).toHaveLength(questions.length);
  });

  it('問題が0件なら0除算にならない', () => {
    const outcome = scoreQuiz([] as QuizQuestion[], new Map());
    expect(outcome).toEqual({ questionCount: 0, correctCount: 0, incorrectPairIds: [] });
  });
});
