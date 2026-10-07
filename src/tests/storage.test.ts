import { describe, expect, it } from 'vitest';
import {
  LearningRecordStore,
  STORAGE_KEY,
  applyPlayResult,
  bestTimeOverall,
  computeStreak,
  createEmptyRecord,
  isNewBestTime,
  lifetimeAccuracy,
  parseRecord,
  toDateKey,
} from '../storage/learningRecord';
import type { LearningRecord } from '../storage/learningRecord';
import { createMemoryStore } from '../storage/safeStorage';
import type { PlayResult } from '../domain/types';

function result(overrides: Partial<PlayResult> = {}): PlayResult {
  return {
    courseId: 'grade-elementary',
    courseLabel: '小学生',
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

describe('保存と復旧', () => {
  it('保存した記録を読み直せる', () => {
    const storage = createMemoryStore();
    const store = new LearningRecordStore(storage);
    store.update((record) => applyPlayResult(record, result(), new Date('2026-09-19T10:00:00')));

    const reloaded = new LearningRecordStore(storage);
    expect(reloaded.get().totalPlays).toBe(1);
    expect(reloaded.get().masteredPairIds).toEqual([1]);
    expect(reloaded.get().reviewPairIds).toEqual([3]);
  });

  it('保存データが無ければ初期値になる', () => {
    expect(parseRecord(null)).toEqual(createEmptyRecord());
  });

  it('壊れたJSONからでも初期値へ復旧する', () => {
    expect(parseRecord('{"totalPlays":')).toEqual(createEmptyRecord());
    expect(parseRecord('not json at all')).toEqual(createEmptyRecord());
  });

  it('JSONだがオブジェクトでない場合も初期値へ復旧する', () => {
    expect(parseRecord('[1,2,3]')).toEqual(createEmptyRecord());
    expect(parseRecord('"text"')).toEqual(createEmptyRecord());
    expect(parseRecord('null')).toEqual(createEmptyRecord());
  });

  it('型が想定外のフィールドは捨てて初期値で埋める', () => {
    const record = parseRecord(
      JSON.stringify({
        totalPlays: 'たくさん',
        playedDates: [123, '2026-09-18', 'ひどい日付'],
        totalCorrect: -5,
        masteredPairIds: [1, '2', 3.5, 4],
        bestTimeMs: { 6: 1000, 7: 500, 12: 'はやい' },
        history: [{ date: '2026-09-18', cardCount: 99 }],
        audioEnabled: 'yes',
      }),
    );
    expect(record.totalPlays).toBe(0);
    expect(record.playedDates).toEqual(['2026-09-18']);
    expect(record.totalCorrect).toBe(0);
    expect(record.masteredPairIds).toEqual([1, 4]);
    expect(record.bestTimeMs).toEqual({ 6: 1000 });
    expect(record.history).toEqual([]);
    expect(record.audioEnabled).toBe(true);
  });

  it('壊れた保存データがあっても起動時に例外を投げない', () => {
    const storage = createMemoryStore({ [STORAGE_KEY]: '{{{壊れている' });
    expect(() => new LearningRecordStore(storage)).not.toThrow();
    expect(new LearningRecordStore(storage).get().totalPlays).toBe(0);
  });

  it('読み書きで例外を投げるストレージでも起動でき、進行を止めない', () => {
    const hostile = {
      getItem() {
        throw new Error('読み取り不可');
      },
      setItem() {
        throw new Error('書き込み不可');
      },
      removeItem() {
        throw new Error('削除不可');
      },
    };
    const store = new LearningRecordStore(hostile);
    expect(store.get().totalPlays).toBe(0);
    expect(() => store.update((r) => ({ ...r, totalPlays: 1 }))).not.toThrow();
    expect(store.get().totalPlays).toBe(1);
  });

  it('コース選択を保存できる', () => {
    const storage = createMemoryStore();
    new LearningRecordStore(storage).update((record) => ({ ...record, selectedCourseId: 'eiken-3' }));
    expect(new LearningRecordStore(storage).get().selectedCourseId).toBe('eiken-3');
  });

  it('音声設定を保存できる', () => {
    const storage = createMemoryStore();
    new LearningRecordStore(storage).update((record) => ({ ...record, audioEnabled: false }));
    expect(new LearningRecordStore(storage).get().audioEnabled).toBe(false);
  });

  it('記録の消去で学習データが初期化される（音声設定は残る）', () => {
    const storage = createMemoryStore();
    const store = new LearningRecordStore(storage);
    store.update((record) => applyPlayResult(record, result(), new Date('2026-09-19T10:00:00')));
    store.update((record) => ({ ...record, audioEnabled: false, selectedCourseId: 'toeic-600' }));

    store.clear();
    expect(store.get().totalPlays).toBe(0);
    expect(store.get().masteredPairIds).toEqual([]);
    expect(store.get().selectedCourseId).toBeNull();
    expect(store.get().audioEnabled).toBe(false);
    expect(new LearningRecordStore(storage).get().totalPlays).toBe(0);
  });
});

describe('記録の更新', () => {
  it('プレイ結果を通算値へ反映する', () => {
    const record = applyPlayResult(createEmptyRecord(), result(), new Date('2026-09-19T10:00:00'));
    expect(record.totalPlays).toBe(1);
    expect(record.totalCorrect).toBe(3);
    expect(record.totalIncorrect).toBe(1);
    expect(record.playedDates).toEqual(['2026-09-19']);
    expect(record.history[0].courseLabel).toBe('小学生');
  });

  it('習得したペアは復習対象から外れる', () => {
    let record = applyPlayResult(createEmptyRecord(), result(), new Date('2026-09-19T10:00:00'));
    expect(record.reviewPairIds).toContain(3);

    record = applyPlayResult(
      record,
      result({
        pairStats: [{ pairId: 3, mistakes: 0, answerTimeMs: 900 }],
      }),
      new Date('2026-09-20T10:00:00'),
    );
    expect(record.masteredPairIds).toContain(3);
    expect(record.reviewPairIds).not.toContain(3);
  });

  it('ベストタイムは短いときだけ更新される', () => {
    let record = applyPlayResult(createEmptyRecord(), result({ elapsedMs: 30000 }), new Date());
    expect(record.bestTimeMs[6]).toBe(30000);

    expect(isNewBestTime(record, 6, 40000)).toBe(false);
    record = applyPlayResult(record, result({ elapsedMs: 40000 }), new Date());
    expect(record.bestTimeMs[6]).toBe(30000);

    expect(isNewBestTime(record, 6, 21000)).toBe(true);
    record = applyPlayResult(record, result({ elapsedMs: 21000 }), new Date());
    expect(record.bestTimeMs[6]).toBe(21000);
  });

  it('ベストタイムは枚数ごとに分けて持つ', () => {
    let record = applyPlayResult(createEmptyRecord(), result({ elapsedMs: 30000 }), new Date());
    record = applyPlayResult(record, result({ cardCount: 20, elapsedMs: 90000 }), new Date());
    expect(record.bestTimeMs).toEqual({ 6: 30000, 20: 90000 });
    expect(bestTimeOverall(record)).toBe(30000);
  });

  it('履歴は新しい順に最大10件まで保持する', () => {
    let record = createEmptyRecord();
    for (let i = 0; i < 12; i += 1) {
      record = applyPlayResult(record, result({ accuracy: i }), new Date('2026-09-19T10:00:00'));
    }
    expect(record.history).toHaveLength(10);
    expect(record.history[0].accuracy).toBe(11);
  });

  it('通算正解率を計算する', () => {
    const record = applyPlayResult(createEmptyRecord(), result(), new Date());
    expect(lifetimeAccuracy(record)).toBe(75);
    expect(lifetimeAccuracy(createEmptyRecord())).toBe(0);
  });

  it('ベストタイム未記録なら null', () => {
    expect(bestTimeOverall(createEmptyRecord())).toBeNull();
  });
});

/*
 * ことばの区分の決まり方を確かめる検査。
 *
 * 区分は「そのことばが最後に出たプレイの結果」だけで決まる。
 *   誤答0回 → まちがいなし / 誤答1回 → 練習中 / 誤答2回以上 → 復習
 * 同じことばが2つ以上の区分に同時に入ることはなく、
 * 今回出題されなかったことばの記録はそのまま残る。
 */
describe('ことばの区分（まちがいなし・練習中・復習）', () => {
  /** 3つの区分を、読みやすい形で取り出す。 */
  function buckets(record: LearningRecord) {
    return {
      まちがいなし: record.masteredPairIds,
      練習中: record.practicingPairIds,
      復習: record.reviewPairIds,
    };
  }

  it('初めて出た語は、今回の誤答回数どおりに振り分けられる', () => {
    const record = applyPlayResult(
      createEmptyRecord(),
      result({
        pairStats: [
          { pairId: 10, mistakes: 0, answerTimeMs: 900 },
          { pairId: 20, mistakes: 1, answerTimeMs: 1200 },
          { pairId: 30, mistakes: 2, answerTimeMs: 2500 },
        ],
      }),
      new Date('2026-10-08T10:00:00'),
    );
    expect(buckets(record)).toEqual({ まちがいなし: [10], 練習中: [20], 復習: [30] });
  });

  it('まちがいなしだった語を1回間違えると、練習中へ移る', () => {
    const before = { ...createEmptyRecord(), masteredPairIds: [70] };
    const after = applyPlayResult(
      before,
      result({ pairStats: [{ pairId: 70, mistakes: 1, answerTimeMs: 1500 }] }),
      new Date('2026-10-08T10:00:00'),
    );
    expect(buckets(after)).toEqual({ まちがいなし: [], 練習中: [70], 復習: [] });
  });

  it('まちがいなしだった語を2回間違えると、復習へ移る', () => {
    const before = { ...createEmptyRecord(), masteredPairIds: [41, 65] };
    const after = applyPlayResult(
      before,
      result({
        pairStats: [
          { pairId: 41, mistakes: 2, answerTimeMs: 2500 },
          { pairId: 65, mistakes: 1, answerTimeMs: 1100 },
        ],
      }),
      new Date('2026-10-08T10:00:00'),
    );
    // 41 は復習へ、巻き添えで1回まちがえた 65 は練習中へ。どちらもまちがいなしから外れる。
    expect(buckets(after)).toEqual({ まちがいなし: [], 練習中: [65], 復習: [41] });
  });

  it('復習だった語を1回間違えると、練習中へ移る（復習からは外れる）', () => {
    const before = { ...createEmptyRecord(), reviewPairIds: [40] };
    const after = applyPlayResult(
      before,
      result({ pairStats: [{ pairId: 40, mistakes: 1, answerTimeMs: 1300 }] }),
      new Date('2026-10-08T10:00:00'),
    );
    expect(buckets(after)).toEqual({ まちがいなし: [], 練習中: [40], 復習: [] });
  });

  it('復習だった語を誤答0回で取ると、まちがいなしへ移る', () => {
    const before = { ...createEmptyRecord(), reviewPairIds: [40, 68] };
    const after = applyPlayResult(
      before,
      result({ pairStats: [{ pairId: 40, mistakes: 0, answerTimeMs: 900 }] }),
      new Date('2026-10-08T10:00:00'),
    );
    expect(buckets(after)).toEqual({ まちがいなし: [40], 練習中: [], 復習: [68] });
  });

  it('練習中の語は、次の結果しだいで3区分のどこへでも動く', () => {
    const before = { ...createEmptyRecord(), practicingPairIds: [11, 12, 13] };
    const after = applyPlayResult(
      before,
      result({
        pairStats: [
          { pairId: 11, mistakes: 0, answerTimeMs: 800 },
          { pairId: 12, mistakes: 1, answerTimeMs: 1000 },
          { pairId: 13, mistakes: 3, answerTimeMs: 3000 },
        ],
      }),
      new Date('2026-10-08T10:00:00'),
    );
    expect(buckets(after)).toEqual({ まちがいなし: [11], 練習中: [12], 復習: [13] });
  });

  it('同じ区分のまま再プレイしても、重複して増えない', () => {
    let record = { ...createEmptyRecord(), practicingPairIds: [12] };
    for (let i = 0; i < 3; i += 1) {
      record = applyPlayResult(
        record,
        result({ pairStats: [{ pairId: 12, mistakes: 1, answerTimeMs: 1000 }] }),
        new Date('2026-10-08T10:00:00'),
      );
    }
    expect(buckets(record)).toEqual({ まちがいなし: [], 練習中: [12], 復習: [] });
  });

  it('誤答回数は過去と足し合わせない（1回を繰り返しても復習へ入らない）', () => {
    let record = createEmptyRecord();
    for (let i = 0; i < 3; i += 1) {
      record = applyPlayResult(
        record,
        result({ pairStats: [{ pairId: 39, mistakes: 1, answerTimeMs: 1200 }] }),
        new Date('2026-10-08T10:00:00'),
      );
    }
    expect(record.totalPlays).toBe(3);
    expect(buckets(record)).toEqual({ まちがいなし: [], 練習中: [39], 復習: [] });
  });

  it('今回出題されなかった語の区分は、そのまま残る', () => {
    const before = {
      ...createEmptyRecord(),
      masteredPairIds: [1, 2],
      practicingPairIds: [3, 4],
      reviewPairIds: [5, 6],
    };
    const after = applyPlayResult(
      before,
      result({ pairStats: [{ pairId: 2, mistakes: 2, answerTimeMs: 2200 }] }),
      new Date('2026-10-08T10:00:00'),
    );
    // 動くのは今回出た 2 だけ。他の5語はどこへも移らない。
    expect(buckets(after)).toEqual({ まちがいなし: [1], 練習中: [3, 4], 復習: [2, 5, 6] });
  });

  it('同じことばが2つ以上の区分に同時に入らない', () => {
    let record = {
      ...createEmptyRecord(),
      masteredPairIds: [7],
      practicingPairIds: [7],
      reviewPairIds: [7],
    };
    record = applyPlayResult(
      record,
      result({ pairStats: [{ pairId: 7, mistakes: 1, answerTimeMs: 1000 }] }),
      new Date('2026-10-08T10:00:00'),
    );
    const all = [...record.masteredPairIds, ...record.practicingPairIds, ...record.reviewPairIds];
    expect(all).toEqual([7]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('保存して読み直しても、3区分がそのまま戻る', () => {
    const storage = createMemoryStore();
    const store = new LearningRecordStore(storage);
    store.update((record) =>
      applyPlayResult(
        record,
        result({
          pairStats: [
            { pairId: 10, mistakes: 0, answerTimeMs: 900 },
            { pairId: 20, mistakes: 1, answerTimeMs: 1200 },
            { pairId: 30, mistakes: 2, answerTimeMs: 2500 },
          ],
        }),
        new Date('2026-10-08T10:00:00'),
      ),
    );
    const reloaded = new LearningRecordStore(storage).get();
    expect(buckets(reloaded)).toEqual({ まちがいなし: [10], 練習中: [20], 復習: [30] });
  });
});

/*
 * 練習中の項目がまだ無い、古い保存データの読み込み。
 * 過去の練習中のことばは保存されていなかったので、推測で補わない。
 * そのかわり、他の項目を1つも失わないことを確かめる。
 */
describe('練習中の項目が無い古い保存データ', () => {
  const 旧データ = {
    version: 3,
    totalPlays: 12,
    playedDates: ['2026-10-01', '2026-10-05', '2026-10-07'],
    totalCorrect: 90,
    totalIncorrect: 30,
    masteredPairIds: [1, 2, 3],
    reviewPairIds: [9],
    bestTimeMs: { 6: 6000, 20: 42000 },
    selectedCourseId: 'grade-elementary',
    visitedCountryIds: ['japan', 'london'],
    history: [
      { date: '2026-10-07', courseId: 'grade-elementary', courseLabel: '小学生', cardCount: 6, accuracy: 75, elapsedMs: 6000 },
    ],
    audioEnabled: false,
    sfxEnabled: false,
    characterAgeGroup: null,
    quizHistory: [],
    seenTravelIntros: ['japan'],
    skipTravelAnimation: true,
    selectedAvatarId: 'elementary-m-01',
    metAvatarIds: ['elementary-f-06'],
    recentNpcAvatarIds: ['elementary-f-06'],
  };

  it('練習中は空で読み、推測で補わない', () => {
    expect(parseRecord(JSON.stringify(旧データ)).practicingPairIds).toEqual([]);
  });

  it('他の項目は1つも失わない', () => {
    const r = parseRecord(JSON.stringify(旧データ));
    expect(r.totalPlays).toBe(12);
    expect(r.playedDates).toEqual(['2026-10-01', '2026-10-05', '2026-10-07']);
    expect(r.totalCorrect).toBe(90);
    expect(r.totalIncorrect).toBe(30);
    expect(r.masteredPairIds).toEqual([1, 2, 3]);
    expect(r.reviewPairIds).toEqual([9]);
    expect(r.bestTimeMs).toEqual({ 6: 6000, 20: 42000 });
    expect(r.selectedCourseId).toBe('grade-elementary');
    expect(r.visitedCountryIds).toEqual(['japan', 'london']);
    expect(r.history).toHaveLength(1);
    expect(r.history[0].accuracy).toBe(75);
    expect(r.audioEnabled).toBe(false);
    expect(r.sfxEnabled).toBe(false);
    expect(r.seenTravelIntros).toEqual(['japan']);
    expect(r.skipTravelAnimation).toBe(true);
    expect(r.selectedAvatarId).toBe('elementary-m-01');
    expect(r.metAvatarIds).toEqual(['elementary-f-06']);
  });

  it('古い記録のうえに1プレイ重ねても、出題されなかった語は残る', () => {
    const before = parseRecord(JSON.stringify(旧データ));
    const after = applyPlayResult(
      before,
      result({ pairStats: [{ pairId: 3, mistakes: 1, answerTimeMs: 1200 }] }),
      new Date('2026-10-08T10:00:00'),
    );
    // 出題された 3 だけが練習中へ移り、1・2・9 はそのまま。
    expect(after.masteredPairIds).toEqual([1, 2]);
    expect(after.practicingPairIds).toEqual([3]);
    expect(after.reviewPairIds).toEqual([9]);
    expect(after.totalPlays).toBe(13);
  });
});

describe('連続学習日数', () => {
  it('記録がなければ0', () => {
    expect(computeStreak([], '2026-09-19')).toBe(0);
  });

  it('今日を含む連続日数を数える', () => {
    expect(computeStreak(['2026-09-17', '2026-09-18', '2026-09-19'], '2026-09-19')).toBe(3);
  });

  it('昨日まででも継続中として数える', () => {
    expect(computeStreak(['2026-09-17', '2026-09-18'], '2026-09-19')).toBe(2);
  });

  it('2日以上空いていれば0になる', () => {
    expect(computeStreak(['2026-09-10', '2026-09-11'], '2026-09-19')).toBe(0);
  });

  it('途切れた分は数えない', () => {
    expect(computeStreak(['2026-09-10', '2026-09-18', '2026-09-19'], '2026-09-19')).toBe(2);
  });

  it('月をまたいでも連続として数える', () => {
    expect(computeStreak(['2026-08-30', '2026-08-31', '2026-09-01'], '2026-09-01')).toBe(3);
  });

  it('日付キーはローカル日付のYYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 8, 5))).toBe('2026-09-05');
  });
});
