import { describe, expect, it } from 'vitest';
import {
  LearningRecordStore,
  RECORD_VERSION,
  STORAGE_KEY,
  createEmptyRecord,
  detectRecordShape,
  parseRecord,
} from '../storage/learningRecord';
import { createMemoryStore } from '../storage/safeStorage';
import { AVATARS, AVATAR_AGE_GROUPS, avatarsByAgeGroup, fullName } from '../data/avatars';

/**
 * Phase 1 統合の移行テスト。
 *
 * 2本のブランチが別々の内容で version 2 を使ってしまったため、
 * 統合後は version 3 だけを書き込む。
 * ここでは4種類の入力形式を固定 fixture として持ち、
 * どの形から来ても値が失われないことを確かめる。
 */

/** Phase 0（version 1）が実際に書き出していた形。 */
const V1 = {
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

/** title-tour ブランチの version 2。旅・国紹介・確認テストの記録を持つ。 */
const V2_TITLE_TOUR = {
  ...V1,
  version: 2,
  characterAgeGroup: 'junior',
  quizHistory: [
    {
      date: '2026-09-19',
      courseId: 'eiken-3',
      destinationId: 'japan',
      waveId: 'japan-6-1',
      status: 'completed',
      questionCount: 3,
      correctCount: 2,
      incorrectPairIds: [3],
      elapsedMs: 9000,
    },
  ],
  seenTravelIntros: ['japan'],
  skipTravelAnimation: true,
};

/** avatar-chat ブランチの version 2。80人方式の選択と出会いを持つ。 */
const V2_AVATAR_CHAT = {
  ...V1,
  version: 2,
  selectedAvatarId: 'high-m-01',
  metAvatarIds: ['adult-f-01', 'elementary-m-02'],
  recentNpcAvatarIds: ['adult-f-01'],
};

/** 両方のフィールドが混ざった version 2。 */
const V2_MIXED = {
  ...V2_TITLE_TOUR,
  ...V2_AVATAR_CHAT,
  version: 2,
};

/** version 1 から引き継がれるべき Phase 0 の学習記録。 */
function expectPhase0Preserved(record: ReturnType<typeof parseRecord>): void {
  expect(record.totalPlays).toBe(4);
  expect(record.playedDates).toEqual(['2026-09-18', '2026-09-19']);
  expect(record.totalCorrect).toBe(12);
  expect(record.totalIncorrect).toBe(4);
  expect(record.masteredPairIds).toEqual([1, 2]);
  expect(record.reviewPairIds).toEqual([5]);
  expect(record.bestTimeMs).toEqual({ 6: 20000, 20: 90000 });
  expect(record.selectedCourseId).toBe('eiken-3');
  expect(record.visitedCountryIds).toEqual(['japan']);
  expect(record.history).toHaveLength(1);
  expect(record.audioEnabled).toBe(false);
}

describe('保存形式の判別', () => {
  it('4種類の入力形式をフィールドの形から見分ける', () => {
    expect(detectRecordShape(JSON.stringify(V1))).toBe('v1');
    expect(detectRecordShape(JSON.stringify(V2_TITLE_TOUR))).toBe('v2-title-tour');
    expect(detectRecordShape(JSON.stringify(V2_AVATAR_CHAT))).toBe('v2-avatar-chat');
    expect(detectRecordShape(JSON.stringify(V2_MIXED))).toBe('v2-mixed');
  });

  it('version 3 と空と壊れたデータを見分ける', () => {
    expect(detectRecordShape(JSON.stringify(createEmptyRecord()))).toBe('v3');
    expect(detectRecordShape(null)).toBe('empty');
    expect(detectRecordShape('{"version":2,"quizHistory":')).toBe('unknown');
    expect(detectRecordShape('[1,2,3]')).toBe('unknown');
  });

  it('読み込んだ store が元の形式を覚えている', () => {
    const storage = createMemoryStore({ [STORAGE_KEY]: JSON.stringify(V2_MIXED) });
    expect(new LearningRecordStore(storage).sourceShape).toBe('v2-mixed');
  });
});

describe('version 1 → version 3', () => {
  it('Phase 0 の学習記録をすべて引き継ぐ', () => {
    const record = parseRecord(JSON.stringify(V1));
    expectPhase0Preserved(record);
    expect(record.version).toBe(3);
  });

  it('後から足したフィールドは安全な初期値で埋まる', () => {
    const record = parseRecord(JSON.stringify(V1));
    expect(record.characterAgeGroup).toBeNull();
    expect(record.quizHistory).toEqual([]);
    expect(record.seenTravelIntros).toEqual([]);
    expect(record.skipTravelAnimation).toBe(false);
    expect(record.selectedAvatarId).toBeNull();
    expect(record.metAvatarIds).toEqual([]);
    expect(record.recentNpcAvatarIds).toEqual([]);
  });
});

describe('title-tour 版 version 2 → version 3', () => {
  it('旅・国紹介・確認テストの記録を失わない', () => {
    const record = parseRecord(JSON.stringify(V2_TITLE_TOUR));
    expectPhase0Preserved(record);
    expect(record.version).toBe(3);
    expect(record.quizHistory).toHaveLength(1);
    expect(record.quizHistory[0].waveId).toBe('japan-6-1');
    expect(record.quizHistory[0].correctCount).toBe(2);
    expect(record.seenTravelIntros).toEqual(['japan']);
    expect(record.skipTravelAnimation).toBe(true);
    expect(record.characterAgeGroup).toBe('junior');
  });

  it('旧年齢層からキャラクターを推測せず、再選択へ誘導する', () => {
    // 年齢層は16人に該当するため、1人へ一意に対応させられない。
    const record = parseRecord(JSON.stringify(V2_TITLE_TOUR));
    expect(record.selectedAvatarId).toBeNull();
    expect(avatarsByAgeGroup('middle')).toHaveLength(16);
  });
});

describe('avatar-chat 版 version 2 → version 3', () => {
  it('選んだキャラクターと出会いの記録を失わない', () => {
    const record = parseRecord(JSON.stringify(V2_AVATAR_CHAT));
    expectPhase0Preserved(record);
    expect(record.version).toBe(3);
    expect(record.selectedAvatarId).toBe('high-m-01');
    expect(record.metAvatarIds).toEqual(['adult-f-01', 'elementary-m-02']);
    expect(record.recentNpcAvatarIds).toEqual(['adult-f-01']);
  });

  it('旅・確認テスト側のフィールドは初期値で補う', () => {
    const record = parseRecord(JSON.stringify(V2_AVATAR_CHAT));
    expect(record.quizHistory).toEqual([]);
    expect(record.seenTravelIntros).toEqual([]);
    expect(record.skipTravelAnimation).toBe(false);
  });
});

describe('混在 version 2 → version 3', () => {
  it('両ブランチのフィールドを同時に保持する', () => {
    const record = parseRecord(JSON.stringify(V2_MIXED));
    expectPhase0Preserved(record);
    expect(record.version).toBe(3);
    // title-tour 側
    expect(record.quizHistory).toHaveLength(1);
    expect(record.seenTravelIntros).toEqual(['japan']);
    expect(record.skipTravelAnimation).toBe(true);
    expect(record.characterAgeGroup).toBe('junior');
    // avatar-chat 側
    expect(record.selectedAvatarId).toBe('high-m-01');
    expect(record.metAvatarIds).toEqual(['adult-f-01', 'elementary-m-02']);
    expect(record.recentNpcAvatarIds).toEqual(['adult-f-01']);
  });
});

describe('移行後の書き込み', () => {
  it('4種類のどれから読んでも、書き戻しは version 3 になる', () => {
    for (const fixture of [V1, V2_TITLE_TOUR, V2_AVATAR_CHAT, V2_MIXED]) {
      const storage = createMemoryStore({ [STORAGE_KEY]: JSON.stringify(fixture) });
      const store = new LearningRecordStore(storage);
      store.update((r) => ({ ...r, audioEnabled: r.audioEnabled }));
      const written = JSON.parse(storage.getItem(STORAGE_KEY)!);
      expect(written.version).toBe(RECORD_VERSION);
      expect(written.version).toBe(3);
    }
  });

  it('保存キーは変えない（既存プレイヤーの記録を読み続ける）', () => {
    expect(STORAGE_KEY).toBe('kotoba-journey/learning-record/v1');
  });

  it('書き戻しても混在 version 2 の値が消えない', () => {
    const storage = createMemoryStore({ [STORAGE_KEY]: JSON.stringify(V2_MIXED) });
    new LearningRecordStore(storage).update((r) => ({ ...r, selectedCourseId: 'toeic-600' }));

    const reloaded = new LearningRecordStore(storage).get();
    expect(reloaded.totalPlays).toBe(4);
    expect(reloaded.bestTimeMs).toEqual({ 6: 20000, 20: 90000 });
    expect(reloaded.quizHistory).toHaveLength(1);
    expect(reloaded.seenTravelIntros).toEqual(['japan']);
    expect(reloaded.selectedAvatarId).toBe('high-m-01');
    expect(reloaded.metAvatarIds).toEqual(['adult-f-01', 'elementary-m-02']);
    expect(reloaded.selectedCourseId).toBe('toeic-600');
  });
});

describe('壊れた入力でも起動を止めない', () => {
  it('壊れた JSON は初期値へ復旧する', () => {
    const storage = createMemoryStore({ [STORAGE_KEY]: '{"version":2,"quizHistory":' });
    expect(() => new LearningRecordStore(storage)).not.toThrow();
    expect(new LearningRecordStore(storage).get()).toEqual(createEmptyRecord());
  });

  it('名簿に無いIDや型違いでも落ちない', () => {
    const broken = {
      ...V2_MIXED,
      selectedAvatarId: 'ghost-x-99',
      metAvatarIds: ['high-m-01', 42, null, 'high-m-01'],
      recentNpcAvatarIds: 'こわれている',
      characterAgeGroup: 'senior',
      quizHistory: { nope: true },
      skipTravelAnimation: 'yes',
    };
    const record = parseRecord(JSON.stringify(broken));
    expect(record.selectedAvatarId).toBeNull();
    expect(record.metAvatarIds).toEqual(['high-m-01']);
    expect(record.recentNpcAvatarIds).toEqual([]);
    expect(record.characterAgeGroup).toBeNull();
    expect(record.quizHistory).toEqual([]);
    expect(record.skipTravelAnimation).toBe(false);
    // 学習記録そのものは残る。
    expectPhase0Preserved(record);
  });
});

describe('80人名簿が統合後も欠けていない', () => {
  it('80人・5年代×16人', () => {
    expect(AVATARS).toHaveLength(80);
    expect(AVATAR_AGE_GROUPS).toHaveLength(5);
    for (const age of AVATAR_AGE_GROUPS) {
      expect(avatarsByAgeGroup(age)).toHaveLength(16);
    }
  });

  it('IDが一意で、姓名がそろっている', () => {
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(80);
    for (const avatar of AVATARS) {
      expect(avatar.familyName.length).toBeGreaterThan(0);
      expect(avatar.givenName.length).toBeGreaterThan(0);
      expect(fullName(avatar)).toBe(`${avatar.familyName}${avatar.givenName}`);
      // 基準画像は年代×見た目区分の10種類を共有する。
      expect(avatar.imageKey).toBe(`${avatar.ageGroup}-${avatar.presentation}`);
    }
  });
});
