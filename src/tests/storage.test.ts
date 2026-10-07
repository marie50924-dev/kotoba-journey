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
 * 「練習中」（誤答1回）の扱いを、現在の仕様のまま書き留めておく検査。
 * 仕様を変えるための検査ではなく、いまの保存内容を固定して
 * あとから意図せず変わったら気づけるようにするためのもの。
 *
 * 現在の applyPlayResult は習得（誤答0回）と復習（誤答2回以上）だけを書き込み、
 * 練習中は習得にも復習にも入れない。保存形式に誤答回数の項目も無い。
 */
describe('練習中（誤答1回）の保存内容', () => {
  it('初めて出た語を1回間違えると、習得にも復習にも入らない', () => {
    const record = applyPlayResult(
      createEmptyRecord(),
      result({ pairStats: [{ pairId: 39, mistakes: 1, answerTimeMs: 1200 }] }),
      new Date('2026-10-07T10:00:00'),
    );
    expect(record.masteredPairIds).not.toContain(39);
    expect(record.reviewPairIds).not.toContain(39);
    // 保存データ全体を見ても、その pairId はどこにも残らない。
    expect(JSON.stringify(record)).not.toContain('39');
  });

  it('習得済みの語を1回間違えても、習得のまま残り復習へ移らない', () => {
    const before = { ...createEmptyRecord(), masteredPairIds: [70] };
    const after = applyPlayResult(
      before,
      result({ pairStats: [{ pairId: 70, mistakes: 1, answerTimeMs: 1500 }] }),
      new Date('2026-10-07T10:00:00'),
    );
    expect(after.masteredPairIds).toEqual([70]);
    expect(after.reviewPairIds).toEqual([]);
  });

  it('習得済みの語を2回間違えると、習得から外れて復習へ移る', () => {
    const before = { ...createEmptyRecord(), masteredPairIds: [41, 65] };
    const after = applyPlayResult(
      before,
      result({
        pairStats: [
          { pairId: 41, mistakes: 2, answerTimeMs: 2500 },
          { pairId: 65, mistakes: 1, answerTimeMs: 1100 },
        ],
      }),
      new Date('2026-10-07T10:00:00'),
    );
    expect(after.masteredPairIds).toEqual([65]);
    expect(after.reviewPairIds).toEqual([41]);
  });

  it('復習対象の語を誤答0回で取ると習得へ移る（今回の結果で上書きされる）', () => {
    const before = { ...createEmptyRecord(), reviewPairIds: [40, 68] };
    const after = applyPlayResult(
      before,
      result({ pairStats: [{ pairId: 40, mistakes: 0, answerTimeMs: 900 }] }),
      new Date('2026-10-07T10:00:00'),
    );
    expect(after.masteredPairIds).toEqual([40]);
    expect(after.reviewPairIds).toEqual([68]);
  });

  it('誤答回数は過去と足し合わされない（1回の誤答を2回繰り返しても復習へ入らない）', () => {
    let record = createEmptyRecord();
    for (let i = 0; i < 3; i += 1) {
      record = applyPlayResult(
        record,
        result({ pairStats: [{ pairId: 39, mistakes: 1, answerTimeMs: 1200 }] }),
        new Date('2026-10-07T10:00:00'),
      );
    }
    expect(record.totalPlays).toBe(3);
    expect(record.masteredPairIds).toEqual([]);
    expect(record.reviewPairIds).toEqual([]);
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
