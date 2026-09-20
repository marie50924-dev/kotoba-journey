import { describe, expect, it } from 'vitest';
import {
  LearningRecordStore,
  MET_AVATAR_LIMIT,
  RECORD_VERSION,
  STORAGE_KEY,
  applyPlayResult,
  createEmptyRecord,
  lifetimeAccuracy,
  parseRecord,
  rememberMetAvatar,
} from '../storage/learningRecord';
import { createMemoryStore } from '../storage/safeStorage';
import { AVATARS } from '../data/avatars';
import { RECENT_WINDOW } from '../domain/npcCasting';
import type { PlayResult } from '../domain/types';

/** Phase 0（version 1）が実際に書き出していた形。 */
const V1_RECORD = {
  version: 1,
  totalPlays: 7,
  playedDates: ['2026-09-18', '2026-09-19'],
  totalCorrect: 30,
  totalIncorrect: 10,
  masteredPairIds: [1, 2, 5],
  reviewPairIds: [7],
  bestTimeMs: { 6: 18000, 12: 42000, 20: 90000 },
  selectedCourseId: 'eiken-3',
  visitedCountryIds: ['japan'],
  history: [
    {
      date: '2026-09-19',
      courseId: 'eiken-3',
      courseLabel: '3級',
      cardCount: 12,
      accuracy: 75,
      elapsedMs: 42000,
    },
  ],
  audioEnabled: false,
};

function playResult(overrides: Partial<PlayResult> = {}): PlayResult {
  return {
    courseId: 'eiken-3',
    courseLabel: '3級',
    cardCount: 6,
    matchedPairs: 3,
    correctSelections: 3,
    incorrectSelections: 1,
    elapsedMs: 20000,
    accuracy: 75,
    pairStats: [
      { pairId: 1, mistakes: 0, answerTimeMs: 1000 },
      { pairId: 2, mistakes: 1, answerTimeMs: 2000 },
      { pairId: 3, mistakes: 2, answerTimeMs: 3000 },
    ],
    ...overrides,
  };
}

describe('version 1 からの移行', () => {
  it('旧データの学習記録をそのまま保持する', () => {
    const record = parseRecord(JSON.stringify(V1_RECORD));
    expect(record.totalPlays).toBe(7);
    expect(record.totalCorrect).toBe(30);
    expect(record.totalIncorrect).toBe(10);
    expect(record.masteredPairIds).toEqual([1, 2, 5]);
    expect(record.reviewPairIds).toEqual([7]);
    expect(record.bestTimeMs).toEqual({ 6: 18000, 12: 42000, 20: 90000 });
    expect(record.selectedCourseId).toBe('eiken-3');
    expect(record.visitedCountryIds).toEqual(['japan']);
    expect(record.history).toHaveLength(1);
    expect(record.playedDates).toEqual(['2026-09-18', '2026-09-19']);
  });

  it('音声設定も引き継ぐ', () => {
    expect(parseRecord(JSON.stringify(V1_RECORD)).audioEnabled).toBe(false);
  });

  it('移行しても通算正解率が変わらない', () => {
    expect(lifetimeAccuracy(parseRecord(JSON.stringify(V1_RECORD)))).toBe(75);
  });

  it('追加フィールドは安全な初期値で補われる', () => {
    const record = parseRecord(JSON.stringify(V1_RECORD));
    expect(record.version).toBe(RECORD_VERSION);
    expect(record.selectedAvatarId).toBeNull();
    expect(record.metAvatarIds).toEqual([]);
    expect(record.recentNpcAvatarIds).toEqual([]);
  });

  it('旧データを読み込んでも起動でき、保存し直しても値が失われない', () => {
    const storage = createMemoryStore({ [STORAGE_KEY]: JSON.stringify(V1_RECORD) });
    expect(() => new LearningRecordStore(storage)).not.toThrow();

    new LearningRecordStore(storage).update((r) => ({ ...r, selectedAvatarId: 'adult-m-02' }));

    const reloaded = new LearningRecordStore(storage).get();
    expect(reloaded.selectedAvatarId).toBe('adult-m-02');
    expect(reloaded.totalPlays).toBe(7);
    expect(reloaded.totalCorrect).toBe(30);
    expect(reloaded.bestTimeMs).toEqual({ 6: 18000, 12: 42000, 20: 90000 });
    expect(reloaded.audioEnabled).toBe(false);
    expect(reloaded.history).toHaveLength(1);
  });

  it('キャラクターを選んでも、その後のプレイ記録は従来どおり積み上がる', () => {
    let record = parseRecord(JSON.stringify(V1_RECORD));
    record = { ...record, selectedAvatarId: 'university-f-03' };
    record = applyPlayResult(record, playResult(), new Date('2026-09-20T10:00:00'));

    expect(record.selectedAvatarId).toBe('university-f-03');
    expect(record.totalPlays).toBe(8);
    expect(record.totalCorrect).toBe(33);
    expect(record.totalIncorrect).toBe(11);
  });
});

describe('選択したキャラクターの保存', () => {
  it('選択を保存して読み直せる', () => {
    const storage = createMemoryStore();
    new LearningRecordStore(storage).update((r) => ({ ...r, selectedAvatarId: 'middle-m-05' }));
    expect(new LearningRecordStore(storage).get().selectedAvatarId).toBe('middle-m-05');
  });

  it('保存の主キーは名前ではなくID', () => {
    const storage = createMemoryStore();
    new LearningRecordStore(storage).update((r) => ({ ...r, selectedAvatarId: 'elementary-f-01' }));
    const raw = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(raw.selectedAvatarId).toBe('elementary-f-01');
    // 名前は保存しない。
    expect(JSON.stringify(raw)).not.toContain('青山');
  });

  it('名簿に無いIDは null へ復旧する', () => {
    expect(parseRecord(JSON.stringify({ selectedAvatarId: 'ghost-x-99' })).selectedAvatarId).toBeNull();
    expect(parseRecord(JSON.stringify({ selectedAvatarId: 12345 })).selectedAvatarId).toBeNull();
    expect(parseRecord(JSON.stringify({ selectedAvatarId: '青山陽翔' })).selectedAvatarId).toBeNull();
  });

  it('学習記録を消しても、選んだキャラクターと音声設定は残る', () => {
    const storage = createMemoryStore();
    const store = new LearningRecordStore(storage);
    store.update((r) => applyPlayResult(r, playResult(), new Date()));
    store.update((r) => ({ ...r, selectedAvatarId: 'high-m-07', audioEnabled: false }));

    store.clear();
    expect(store.get().totalPlays).toBe(0);
    expect(store.get().selectedAvatarId).toBe('high-m-07');
    expect(store.get().audioEnabled).toBe(false);
  });
});

describe('出会った相手と直近リスト', () => {
  it('会話した相手を記録する', () => {
    const record = rememberMetAvatar(createEmptyRecord(), 'adult-f-01');
    expect(record.metAvatarIds).toEqual(['adult-f-01']);
  });

  it('同じ相手を二重に記録しない', () => {
    let record = rememberMetAvatar(createEmptyRecord(), 'adult-f-01');
    record = rememberMetAvatar(record, 'adult-f-01');
    expect(record.metAvatarIds).toEqual(['adult-f-01']);
  });

  it('名簿に無いIDは記録しない', () => {
    expect(rememberMetAvatar(createEmptyRecord(), 'nope').metAvatarIds).toEqual([]);
  });

  it('出会った相手の保存数は上限を超えない', () => {
    let record = createEmptyRecord();
    for (const a of AVATARS) record = rememberMetAvatar(record, a.id);
    expect(record.metAvatarIds.length).toBeLessThanOrEqual(MET_AVATAR_LIMIT);
    expect(record.metAvatarIds).toHaveLength(80);
  });

  it('読み込み時に不正なIDを取り除き、重複も消す', () => {
    const record = parseRecord(
      JSON.stringify({
        metAvatarIds: ['adult-f-01', 'adult-f-01', 'ghost', 42, null, 'high-m-02'],
        recentNpcAvatarIds: ['high-m-02', 'nope'],
      }),
    );
    expect(record.metAvatarIds).toEqual(['adult-f-01', 'high-m-02']);
    expect(record.recentNpcAvatarIds).toEqual(['high-m-02']);
  });

  it('直近リストは読み込み時も上限に収まる', () => {
    const many = AVATARS.slice(0, 40).map((a) => a.id);
    expect(parseRecord(JSON.stringify({ recentNpcAvatarIds: many })).recentNpcAvatarIds)
      .toHaveLength(RECENT_WINDOW);
  });
});

describe('壊れた保存データからの復旧', () => {
  it('JSONが壊れていても起動できる', () => {
    const storage = createMemoryStore({ [STORAGE_KEY]: '{"selectedAvatarId":' });
    expect(() => new LearningRecordStore(storage)).not.toThrow();
    expect(new LearningRecordStore(storage).get()).toEqual(createEmptyRecord());
  });

  it('配列であるべき値が配列でなくても初期値へ戻る', () => {
    const record = parseRecord(
      JSON.stringify({ ...V1_RECORD, metAvatarIds: 'こわれた', recentNpcAvatarIds: { a: 1 } }),
    );
    expect(record.metAvatarIds).toEqual([]);
    expect(record.recentNpcAvatarIds).toEqual([]);
    // 既存の学習記録は保持されたまま。
    expect(record.totalPlays).toBe(7);
  });
});

describe('キャラクター年代と学習コースの独立', () => {
  it('コースを変えてもキャラクターは変わらない', () => {
    const storage = createMemoryStore();
    const store = new LearningRecordStore(storage);
    store.update((r) => ({ ...r, selectedAvatarId: 'elementary-m-01' }));
    store.update((r) => ({ ...r, selectedCourseId: 'toeic-900' }));
    expect(store.get().selectedAvatarId).toBe('elementary-m-01');

    store.update((r) => ({ ...r, selectedCourseId: 'grade-university' }));
    expect(store.get().selectedAvatarId).toBe('elementary-m-01');
  });

  it('キャラクターを変えてもコースは変わらない', () => {
    const storage = createMemoryStore();
    const store = new LearningRecordStore(storage);
    store.update((r) => ({ ...r, selectedCourseId: 'biz-business' }));
    store.update((r) => ({ ...r, selectedAvatarId: 'elementary-f-08' }));
    expect(store.get().selectedCourseId).toBe('biz-business');
  });

  it('どの年代のキャラクターでも、どのコースとも組み合わせられる', () => {
    const storage = createMemoryStore();
    const store = new LearningRecordStore(storage);
    for (const avatarId of ['elementary-m-01', 'adult-f-08', 'university-m-04']) {
      for (const courseId of ['grade-elementary', 'eiken-1', 'biz-it']) {
        store.update((r) => ({ ...r, selectedAvatarId: avatarId, selectedCourseId: courseId }));
        expect(store.get().selectedAvatarId).toBe(avatarId);
        expect(store.get().selectedCourseId).toBe(courseId);
      }
    }
  });
});
