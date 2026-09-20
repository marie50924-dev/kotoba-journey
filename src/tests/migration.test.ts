import { describe, expect, it } from 'vitest';
import {
  LearningRecordStore,
  QUIZ_HISTORY_LIMIT,
  RECORD_VERSION,
  STORAGE_KEY,
  appendQuizRecord,
  applyPlayResult,
  createEmptyRecord,
  lifetimeAccuracy,
  parseRecord,
  quizAccuracy,
} from '../storage/learningRecord';
import type { WaveQuizRecord } from '../storage/learningRecord';
import { createMemoryStore } from '../storage/safeStorage';
import type { PlayResult } from '../domain/types';

/** Phase 0（version 1）が実際に書き出していた形。 */
const V1_RECORD = {
  version: 1,
  totalPlays: 4,
  playedDates: ['2026-09-18', '2026-09-19'],
  totalCorrect: 12,
  totalIncorrect: 4,
  masteredPairIds: [1, 2],
  reviewPairIds: [5],
  bestTimeMs: { 6: 20000, 20: 90000 },
  selectedCourseId: 'eiken-3',
  visitedCountryIds: ['japan'],
  history: [
    {
      date: '2026-09-19',
      courseId: 'eiken-3',
      courseLabel: '3級',
      cardCount: 6,
      accuracy: 75,
      elapsedMs: 20000,
    },
  ],
  audioEnabled: false,
};

function quizEntry(overrides: Partial<WaveQuizRecord> = {}): WaveQuizRecord {
  return {
    date: '2026-09-20',
    courseId: 'eiken-3',
    destinationId: 'japan',
    waveId: 'japan-6-1',
    status: 'completed',
    questionCount: 3,
    correctCount: 2,
    incorrectPairIds: [3],
    elapsedMs: 9000,
    ...overrides,
  };
}

function playResult(overrides: Partial<PlayResult> = {}): PlayResult {
  return {
    courseId: 'eiken-3',
    courseLabel: '3級',
    cardCount: 6,
    matchedPairs: 3,
    correctSelections: 3,
    incorrectSelections: 1,
    elapsedMs: 18000,
    accuracy: 75,
    pairStats: [
      { pairId: 1, mistakes: 0, answerTimeMs: 1000 },
      { pairId: 2, mistakes: 1, answerTimeMs: 2000 },
      { pairId: 3, mistakes: 0, answerTimeMs: 3000 },
    ],
    ...overrides,
  };
}

describe('version 1 からの移行', () => {
  it('v1 の保存データをそのまま読み込める', () => {
    const record = parseRecord(JSON.stringify(V1_RECORD));
    expect(record.totalPlays).toBe(4);
    expect(record.totalCorrect).toBe(12);
    expect(record.totalIncorrect).toBe(4);
    expect(record.masteredPairIds).toEqual([1, 2]);
    expect(record.reviewPairIds).toEqual([5]);
    expect(record.bestTimeMs).toEqual({ 6: 20000, 20: 90000 });
    expect(record.selectedCourseId).toBe('eiken-3');
    expect(record.visitedCountryIds).toEqual(['japan']);
    expect(record.history).toHaveLength(1);
    expect(record.audioEnabled).toBe(false);
  });

  it('移行後も既存の正解率が変わらない', () => {
    const record = parseRecord(JSON.stringify(V1_RECORD));
    expect(lifetimeAccuracy(record)).toBe(75);
  });

  it('v2 で追加したフィールドは安全な初期値で補われる', () => {
    const record = parseRecord(JSON.stringify(V1_RECORD));
    expect(record.version).toBe(RECORD_VERSION);
    expect(record.characterId).toBeNull();
    expect(record.quizHistory).toEqual([]);
    expect(record.seenTravelIntros).toEqual([]);
    expect(record.skipTravelAnimation).toBe(false);
  });

  it('主人公が未選択でも v1 のデータを読み込めて起動できる', () => {
    const storage = createMemoryStore({ [STORAGE_KEY]: JSON.stringify(V1_RECORD) });
    expect(() => new LearningRecordStore(storage)).not.toThrow();
    const store = new LearningRecordStore(storage);
    expect(store.get().characterId).toBeNull();
    expect(store.get().totalPlays).toBe(4);
  });

  it('移行した記録を保存し直しても v1 の値が失われない', () => {
    const storage = createMemoryStore({ [STORAGE_KEY]: JSON.stringify(V1_RECORD) });
    new LearningRecordStore(storage).update((r) => ({ ...r, characterId: 'girl' }));

    const reloaded = new LearningRecordStore(storage).get();
    expect(reloaded.characterId).toBe('girl');
    expect(reloaded.totalPlays).toBe(4);
    expect(reloaded.bestTimeMs).toEqual({ 6: 20000, 20: 90000 });
    expect(reloaded.audioEnabled).toBe(false);
  });
});

describe('主人公の保存', () => {
  it('選んだ主人公を保存・復旧できる', () => {
    const storage = createMemoryStore();
    new LearningRecordStore(storage).update((r) => ({ ...r, characterId: 'boy' }));
    expect(new LearningRecordStore(storage).get().characterId).toBe('boy');
  });

  it('「あとで選ぶ」は null として保存される', () => {
    const storage = createMemoryStore();
    const store = new LearningRecordStore(storage);
    store.update((r) => ({ ...r, characterId: 'girl' }));
    store.update((r) => ({ ...r, characterId: null }));
    expect(new LearningRecordStore(storage).get().characterId).toBeNull();
  });

  it('未知の主人公IDは null へ落とす', () => {
    expect(parseRecord(JSON.stringify({ characterId: 'dragon' })).characterId).toBeNull();
    expect(parseRecord(JSON.stringify({ characterId: 42 })).characterId).toBeNull();
  });
});

describe('確認テストの記録', () => {
  it('受験結果を保存できる', () => {
    const record = appendQuizRecord(createEmptyRecord(), quizEntry());
    expect(record.quizHistory).toHaveLength(1);
    expect(record.quizHistory[0].correctCount).toBe(2);
  });

  it('スキップも記録するが不正解として数えない', () => {
    const record = appendQuizRecord(
      createEmptyRecord(),
      quizEntry({ status: 'skipped', questionCount: 0, correctCount: 0, incorrectPairIds: [] }),
    );
    expect(record.quizHistory[0].status).toBe('skipped');
    expect(record.quizHistory[0].incorrectPairIds).toEqual([]);
    // スキップは通算正答率の分母にも入らない。
    expect(quizAccuracy(record)).toBe(0);
  });

  it('スキップは受験ぶんの正答率に影響しない', () => {
    let record = appendQuizRecord(createEmptyRecord(), quizEntry({ questionCount: 4, correctCount: 4, incorrectPairIds: [] }));
    const before = quizAccuracy(record);
    record = appendQuizRecord(record, quizEntry({ status: 'skipped', questionCount: 0, correctCount: 0, incorrectPairIds: [] }));
    expect(quizAccuracy(record)).toBe(before);
    expect(before).toBe(100);
  });

  it('テスト結果は通常カルタの正解率とベストタイムを変えない', () => {
    let record = applyPlayResult(createEmptyRecord(), playResult(), new Date('2026-09-20T10:00:00'));
    const accuracyBefore = lifetimeAccuracy(record);
    const bestBefore = { ...record.bestTimeMs };
    const playsBefore = record.totalPlays;
    const masteredBefore = [...record.masteredPairIds];

    record = appendQuizRecord(record, quizEntry({ correctCount: 0, incorrectPairIds: [1, 2, 3] }));

    expect(lifetimeAccuracy(record)).toBe(accuracyBefore);
    expect(record.bestTimeMs).toEqual(bestBefore);
    expect(record.totalPlays).toBe(playsBefore);
    expect(record.masteredPairIds).toEqual(masteredBefore);
    expect(record.totalIncorrect).toBe(1);
  });

  it('履歴は上限まで、新しい順に保持する', () => {
    let record = createEmptyRecord();
    for (let i = 0; i < QUIZ_HISTORY_LIMIT + 8; i += 1) {
      record = appendQuizRecord(record, quizEntry({ waveId: `wave-${i}` }));
    }
    expect(record.quizHistory).toHaveLength(QUIZ_HISTORY_LIMIT);
    expect(record.quizHistory[0].waveId).toBe(`wave-${QUIZ_HISTORY_LIMIT + 7}`);
  });

  it('読み込み時も履歴の上限を超えない', () => {
    const huge = Array.from({ length: 200 }, (_, i) => quizEntry({ waveId: `w${i}` }));
    expect(parseRecord(JSON.stringify({ quizHistory: huge })).quizHistory)
      .toHaveLength(QUIZ_HISTORY_LIMIT);
  });
});

describe('壊れた追加データからの復旧', () => {
  it('quizHistory が配列でなくても起動できる', () => {
    const record = parseRecord(JSON.stringify({ ...V1_RECORD, quizHistory: 'こわれている' }));
    expect(record.quizHistory).toEqual([]);
    expect(record.totalPlays).toBe(4);
  });

  it('形式の違う履歴要素は捨てる', () => {
    const record = parseRecord(
      JSON.stringify({
        quizHistory: [
          quizEntry(),
          { date: '2026-09-20', status: 'unknown' },
          { status: 'completed' },
          null,
          'テキスト',
        ],
      }),
    );
    expect(record.quizHistory).toHaveLength(1);
  });

  it('seenTravelIntros や skipTravelAnimation が壊れていても既定値へ戻る', () => {
    const record = parseRecord(
      JSON.stringify({ seenTravelIntros: { japan: true }, skipTravelAnimation: 'yes' }),
    );
    expect(record.seenTravelIntros).toEqual([]);
    expect(record.skipTravelAnimation).toBe(false);
  });

  it('壊れた v2 データが入っていても起動を止めない', () => {
    const storage = createMemoryStore({ [STORAGE_KEY]: '{"version":2,"quizHistory":' });
    expect(() => new LearningRecordStore(storage)).not.toThrow();
    expect(new LearningRecordStore(storage).get()).toEqual(createEmptyRecord());
  });
});
