import { describe, expect, it } from 'vitest';
import { LearningRecordStore, createEmptyRecord } from '../storage/learningRecord';
import { STORAGE_KEY } from '../storage/learningRecord';
import { createMemoryStore } from '../storage/safeStorage';

/** その場かぎりの保存先。中身を覗けるように、置いたキーも返す。 */
function memoryStore(initial?: string) {
  const seed: Record<string, string> = initial === undefined ? {} : { [STORAGE_KEY]: initial };
  const store = createMemoryStore(seed);
  const keys = new Set<string>(Object.keys(seed));
  return {
    getItem: (key: string) => store.getItem(key),
    setItem: (key: string, value: string) => { keys.add(key); store.setItem(key, value); },
    removeItem: (key: string) => { keys.delete(key); store.removeItem(key); },
    keys: () => [...keys],
  };
}

/**
 * 発音と効果音は別のスイッチで、保存は既存キー1つのまま。
 * 効果音の項目を後から足したので、無い過去データも壊れず読めることを押さえる。
 */
describe('発音と効果音の設定', () => {
  it('初期値はどちらも ON', () => {
    const record = createEmptyRecord();
    expect(record.audioEnabled).toBe(true);
    expect(record.sfxEnabled).toBe(true);
  });

  it('片方を変えても、もう片方は変わらない', () => {
    const store = new LearningRecordStore(memoryStore());
    store.update((record) => ({ ...record, audioEnabled: false }));
    expect(store.get().audioEnabled).toBe(false);
    expect(store.get().sfxEnabled).toBe(true);
    store.update((record) => ({ ...record, sfxEnabled: false }));
    expect(store.get().audioEnabled).toBe(false);
    expect(store.get().sfxEnabled).toBe(false);
  });

  it('保存先のキーは既存の1つだけで、二重に作らない', () => {
    const store = memoryStore();
    const records = new LearningRecordStore(store);
    records.update((record) => ({ ...record, audioEnabled: false, sfxEnabled: false }));
    expect(store.keys()).toEqual([STORAGE_KEY]);
  });

  it('効果音の項目が無い過去データは、ON として読む（後方互換）', () => {
    const legacy = JSON.stringify({
      version: 1,
      totalPlays: 3,
      audioEnabled: false,
      masteredPairIds: [1, 2],
    });
    const store = new LearningRecordStore(memoryStore(legacy));
    expect(store.get().audioEnabled).toBe(false);
    expect(store.get().sfxEnabled).toBe(true);
    expect(store.get().totalPlays).toBe(3);
  });

  it('学習記録を消しても、音の設定は端末の設定として残る', () => {
    const store = new LearningRecordStore(memoryStore());
    store.update((record) => ({
      ...record,
      audioEnabled: false,
      sfxEnabled: false,
      totalPlays: 7,
    }));
    store.clear();
    expect(store.get().audioEnabled).toBe(false);
    expect(store.get().sfxEnabled).toBe(false);
    expect(store.get().totalPlays).toBe(0);
  });
});
