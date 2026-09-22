import { describe, expect, it } from 'vitest';
import kartaSource from '../screens/kartaScreen.ts?raw';
import {
  DEFAULT_VOCABULARY_SET_ID,
  VOCABULARY_SETS,
  findVocabularySet,
  pairsInSet,
  resolveSetPairs,
} from '../data/vocabularySets';
import { COURSES, findCourse, pairsForCourse } from '../data/courses';
import { SAMPLE_PAIRS, findPair } from '../data/wordPairs';
import { buildDeck, pairCountFor } from '../domain/deck';
import { buildWaveQuiz } from '../domain/waveQuiz';
import {
  LearningRecordStore,
  RECORD_VERSION,
  STORAGE_KEY,
  parseRecord,
} from '../storage/learningRecord';
import { createMemoryStore } from '../storage/safeStorage';
import { COUNTRY_INTROS, allClaims, canPublish, showsDetails } from '../data/countryIntros';
import type { CardCount } from '../domain/types';

/**
 * 「コース → 語彙セット → 語」の経路の検査。
 *
 * いまセットは4つある。小学生・中学生が学校のことば30語、
 * 海外旅行が旅のことば30語、接客・観光が接客・観光のことば30語、
 * 残り20コースが共通の85語を使う。
 * セットは場面で分けたもので、学年別の難易度でも仕事で必要な力でもない。
 * ここで固定したいのは、経路が通っていること、どのコースがどのセットを使うか、
 * そして共通セットで遊ぶコースの出題が以前と変わっていないこと。
 */

/** 共通セットが持つ85語。src/data/wordPairs.ts と同じ並び。 */
const COMMON_PAIR_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 13, 14, 15, 16, 17, 18, 19,
  21, 23, 24, 26, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38,
  39, 40, 41, 42, 43, 44, 45,
  46, 47, 48, 49, 50, 51, 52, 53,
  54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68,
  69, 70, 71, 72, 73, 74, 75,
  76, 77, 78, 79, 80, 81, 82, 83,
  84, 85, 86, 87, 88, 89, 90,
];
/** 工程V-2F-2で共通セットへ足した接客・飲食・宿泊の15語。 */
const HOSPITALITY_PAIR_IDS = [76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];
/** 工程V-2D-7で共通セットへ足した15語。学校セットの核でもある。 */
const SCHOOL_PAIR_IDS = [61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75];
/** 学校のことば30語。並びも定義どおりに固定する。 */
const SCHOOL_SET_PAIR_IDS = [
  3, 6, 15, 16, 17, 18, 19,
  28,
  37, 38, 39, 40, 41,
  43, 44,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
  71, 72, 73, 74, 75,
];
/** 学校だけの核15語（= SCHOOL_PAIR_IDS）と、共通セットと共有する基礎15語。 */
const SCHOOL_SHARED_IDS = [3, 6, 15, 16, 17, 18, 19, 28, 37, 38, 39, 40, 41, 43, 44];
/** 学校セットを使うコース。 */
const SCHOOL_COURSE_IDS = ['grade-elementary', 'grade-junior'];
/** 接客・観光のことば30語。並びも定義どおりに固定する。 */
const HOSPITALITY_SET_PAIR_IDS = [
  7,
  28, 29, 30,
  38, 40,
  46, 47, 49, 50, 51, 52, 53, 57, 60,
  76, 77, 78, 79, 80, 81, 82, 83, 84, 85,
  86, 87, 88, 89, 90,
];
/** 接客・観光だけの核15語（= 工程V-2F-2で足した語）。 */
const HOSPITALITY_CORE_IDS = [76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];
/** 旅のセットと共有する15語。 */
const HOSPITALITY_SHARED_IDS = [7, 28, 29, 30, 38, 40, 46, 47, 49, 50, 51, 52, 53, 57, 60];
/** 資料確認待ちで、まだどのセットにも入れていない語。 */
const RESERVED_PAIR_IDS = [12, 20, 22, 25, 27];
/** 旅のことば30語。並びも定義どおりに固定する。 */
const TRAVEL_PAIR_IDS = [
  1, 7, 21, 23, 24, 26, 28, 29, 30,
  36, 38, 39, 40, 42, 43,
  46, 47, 48, 49, 50, 51, 52, 53, 54, 55,
  56, 57, 58, 59, 60,
];
/** 旅行だけの核15語。ほかのセットには入っていない。 */
const TRAVEL_CORE_IDS = [46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60];
/** 共通セットと共有する基礎15語。 */
const TRAVEL_SHARED_IDS = [1, 7, 21, 23, 24, 26, 28, 29, 30, 36, 38, 39, 40, 42, 43];
/** 台帳でまだ資料確認が終わっていない、使用中の2語。旅のセットへは入れない。 */
const UNVERIFIED_IN_USE = [8, 10];
/** 共通セットを使うコース。小学生・中学生・海外旅行だけが別。 */
const COMMON_COURSE_IDS = COURSES.map((c) => c.id).filter(
  (id) => id !== 'biz-travel' && id !== 'biz-hospitality' && !SCHOOL_COURSE_IDS.includes(id),
);
const COUNTS: CardCount[] = [6, 12, 20];
/**
 * セットが違えば盤面も食い違う seed。
 * 偶然そろう値を避けるため、実測して固定してある（枚数ごとに確認済み）。
 * 共通×旅・共通×学校・旅×学校のどの組でも食い違う。
 */
const DIFFERENT_BOARD_SEEDS = [1, 2, 3];

describe('語彙セットの定義', () => {
  it('セットIDは重複しない', () => {
    expect(new Set(VOCABULARY_SETS.map((s) => s.id)).size).toBe(VOCABULARY_SETS.length);
  });

  it('いまは common・travel・school・hospitality の4件がある', () => {
    expect(VOCABULARY_SETS).toHaveLength(4);
    expect(VOCABULARY_SETS.map((s) => s.id)).toEqual([
      'common-practice', 'travel-practice', 'school-practice', 'hospitality-practice',
    ]);
    expect(findVocabularySet('common-practice')!.label).toBe('共通の練習用ことば');
    expect(findVocabularySet('travel-practice')!.label).toBe('旅のことば');
    expect(findVocabularySet('school-practice')!.label).toBe('学校のことば');
    expect(findVocabularySet('hospitality-practice')!.label).toBe('接客・観光のことば');
  });

  it('既定セットは common-practice のまま', () => {
    // 未選択・未知のコースはここへ落ちる。語がいちばん多いセットにしておく。
    expect(DEFAULT_VOCABULARY_SET_ID).toBe('common-practice');
    expect(findVocabularySet(DEFAULT_VOCABULARY_SET_ID)!.pairIds).toHaveLength(85);
  });

  it('共通セットの pairIds は、1〜90から予約欠番5件を除いた85件と一致する', () => {
    const set = findVocabularySet('common-practice')!;
    expect(set.pairIds).toEqual(COMMON_PAIR_IDS);
    expect(set.pairIds).toHaveLength(85);
    // 1〜90 から予約欠番を除いた集合と一致する。
    const expected = Array.from({ length: 90 }, (_, i) => i + 1)
      .filter((id) => !RESERVED_PAIR_IDS.includes(id));
    expect([...set.pairIds]).toEqual(expected);
    // 工程V-2F-2で足した15語は末尾に、昇順で入っている。
    expect(set.pairIds.slice(-15)).toEqual(HOSPITALITY_PAIR_IDS);
    // 学校の核15語の位置も変わっていない。
    expect(set.pairIds.slice(-30, -15)).toEqual(SCHOOL_PAIR_IDS);
  });

  it('セット内の pairId に重複がない', () => {
    for (const set of VOCABULARY_SETS) {
      expect(new Set(set.pairIds).size, `${set.id}`).toBe(set.pairIds.length);
    }
  });

  it('セット内の pairId は、すべて実在する語を指す', () => {
    const known = new Set(SAMPLE_PAIRS.map((p) => p.pairId));
    for (const set of VOCABULARY_SETS) {
      for (const pairId of set.pairIds) {
        expect(known.has(pairId), `${set.id} の ${pairId}`).toBe(true);
      }
    }
  });

  it('資料確認待ちの欠番を、どのセットも含まない', () => {
    for (const set of VOCABULARY_SETS) {
      for (const pairId of RESERVED_PAIR_IDS) {
        expect(set.pairIds, `${set.id} が欠番 ${pairId} を含んでいる`).not.toContain(pairId);
      }
    }
  });

  it('旅のセットの pairIds は、指定の30件と並びまで一致する', () => {
    const set = findVocabularySet('travel-practice')!;
    expect(set.pairIds).toEqual(TRAVEL_PAIR_IDS);
    expect(set.pairIds).toHaveLength(30);
    // 核15語と共有15語で、ちょうど30語になる。
    expect([...TRAVEL_CORE_IDS, ...TRAVEL_SHARED_IDS].sort((a, b) => a - b))
      .toEqual([...TRAVEL_PAIR_IDS].sort((a, b) => a - b));
  });

  it('旅のセットは、旅行だけの15語と共有基礎15語をすべて含む', () => {
    const ids = new Set(findVocabularySet('travel-practice')!.pairIds);
    for (const pairId of TRAVEL_CORE_IDS) {
      expect(ids.has(pairId), `旅行専用の ${pairId} が入っていない`).toBe(true);
    }
    for (const pairId of TRAVEL_SHARED_IDS) {
      expect(ids.has(pairId), `共有基礎の ${pairId} が入っていない`).toBe(true);
    }
    // 核15語は共通セット側にもあるが、学校の語（61〜75）は旅のセットに入れない。
    for (const pairId of SCHOOL_PAIR_IDS) {
      expect(ids.has(pairId), `学校の ${pairId} が旅のセットに入っている`).toBe(false);
    }
  });

  it('テーマ別のセットへ、工程V-2F-2で足した15語を広げていない', () => {
    // 接客・観光の専用セットはまだ作っていない。76〜90 は共通セットだけに入れる。
    for (const setId of ['travel-practice', 'school-practice'] as const) {
      const set = findVocabularySet(setId)!;
      expect(set.pairIds, `${setId} の語数が変わっている`).toHaveLength(30);
      for (const pairId of HOSPITALITY_PAIR_IDS) {
        expect(set.pairIds, `${pairId} が ${setId} に入っている`).not.toContain(pairId);
      }
    }
    // 共通セットには入っている。
    const common = findVocabularySet('common-practice')!;
    for (const pairId of HOSPITALITY_PAIR_IDS) {
      expect(common.pairIds, `${pairId} が共通セットに無い`).toContain(pairId);
    }
  });

  it('旅のセットには、資料確認が終わっていない 8・10 を入れない', () => {
    // 10「くるま / car」は乗り物だが、意味の範囲の確認が終わっていない。
    // 確認前に専用セットへ広げると、確認結果しだいで2か所を直すことになる。
    const ids = new Set(findVocabularySet('travel-practice')!.pairIds);
    for (const pairId of UNVERIFIED_IN_USE) {
      expect(ids.has(pairId), `未確認の ${pairId} が旅のセットに入っている`).toBe(false);
    }
    // 共通セットでは引き続き使用中。ゲームから消えたわけではない。
    const common = new Set(findVocabularySet('common-practice')!.pairIds);
    for (const pairId of UNVERIFIED_IN_USE) {
      expect(common.has(pairId), `${pairId} が共通セットから消えている`).toBe(true);
    }
  });

  it('共通セットは 8・10 を含み、85語になった', () => {
    const set = findVocabularySet('common-practice')!;
    expect(set.pairIds).toHaveLength(85);
    expect(set.pairIds).toContain(8);
    expect(set.pairIds).toContain(10);
  });

  it('旅のセットの30語は、台帳で確認済みの語だけ', () => {
    // 台帳の確認記録そのものは vocabularyChecklist.test.ts が見る。
    // ここでは「未確認のまま使っている2語が入っていない」ことだけを固定する。
    for (const pairId of findVocabularySet('travel-practice')!.pairIds) {
      expect(UNVERIFIED_IN_USE, `${pairId} は未確認のまま旅のセットに入っている`)
        .not.toContain(pairId);
    }
  });

  it('学校のセットの pairIds は、指定の30件と並びまで一致する', () => {
    const set = findVocabularySet('school-practice')!;
    expect(set.pairIds).toEqual(SCHOOL_SET_PAIR_IDS);
    expect(set.pairIds).toHaveLength(30);
    // 核15語と共有15語で、ちょうど30語になる。
    expect([...SCHOOL_PAIR_IDS, ...SCHOOL_SHARED_IDS].sort((a, b) => a - b))
      .toEqual([...SCHOOL_SET_PAIR_IDS].sort((a, b) => a - b));
  });

  it('学校のセットは、学校だけの15語と共有基礎15語をすべて含む', () => {
    const ids = new Set(findVocabularySet('school-practice')!.pairIds);
    for (const pairId of SCHOOL_PAIR_IDS) {
      expect(ids.has(pairId), `学校専用の ${pairId} が入っていない`).toBe(true);
    }
    for (const pairId of SCHOOL_SHARED_IDS) {
      expect(ids.has(pairId), `共有基礎の ${pairId} が入っていない`).toBe(true);
    }
    // 旅行だけの語（46〜60）は学校のセットに入れない。
    for (const pairId of TRAVEL_CORE_IDS) {
      expect(ids.has(pairId), `旅行の ${pairId} が学校のセットに入っている`).toBe(false);
    }
  });

  it('学校のセットには、資料確認が終わっていない 8・10 を入れない', () => {
    const ids = new Set(findVocabularySet('school-practice')!.pairIds);
    for (const pairId of UNVERIFIED_IN_USE) {
      expect(ids.has(pairId), `未確認の ${pairId} が学校のセットに入っている`).toBe(false);
    }
  });

  it('学校のセットの30語は、台帳で確認済みの語だけ', () => {
    for (const pairId of findVocabularySet('school-practice')!.pairIds) {
      expect(UNVERIFIED_IN_USE, `${pairId} は未確認のまま学校のセットに入っている`)
        .not.toContain(pairId);
    }
  });

  it('接客・観光のセットの pairIds は、指定の30件と並びまで一致する', () => {
    const set = findVocabularySet('hospitality-practice')!;
    expect(set.pairIds).toEqual(HOSPITALITY_SET_PAIR_IDS);
    expect(set.pairIds).toHaveLength(30);
    // 前半15件が共有語、後半15件が核15語（76〜90の昇順）。
    expect([...set.pairIds].slice(0, 15)).toEqual(HOSPITALITY_SHARED_IDS);
    expect([...set.pairIds].slice(-15)).toEqual(HOSPITALITY_CORE_IDS);
  });

  it('接客・観光のセットは、核15語をすべて含む', () => {
    const ids = new Set(findVocabularySet('hospitality-practice')!.pairIds);
    for (const pairId of HOSPITALITY_CORE_IDS) {
      expect(ids.has(pairId), `核の ${pairId} が入っていない`).toBe(true);
    }
    // 学校だけの語（61〜75）は入れない。
    for (const pairId of SCHOOL_PAIR_IDS) {
      expect(ids.has(pairId), `学校の ${pairId} が接客のセットに入っている`).toBe(false);
    }
  });

  it('接客・観光のセットには、8・10 と予約欠番を入れない', () => {
    const ids = new Set(findVocabularySet('hospitality-practice')!.pairIds);
    for (const pairId of [...UNVERIFIED_IN_USE, ...RESERVED_PAIR_IDS]) {
      expect(ids.has(pairId), `${pairId} が接客のセットに入っている`).toBe(false);
    }
  });

  it('接客・観光の30語は、すべてゲームに入っている確認済みの語', () => {
    const known = new Set(SAMPLE_PAIRS.map((p) => p.pairId));
    for (const pairId of HOSPITALITY_SET_PAIR_IDS) {
      expect(known.has(pairId), `${pairId} がゲームデータに無い`).toBe(true);
      expect(UNVERIFIED_IN_USE, `${pairId} は未確認のまま入っている`).not.toContain(pairId);
    }
  });

  it('旅のセットと接客・観光のセットは、15語を共有する', () => {
    const travel = new Set(findVocabularySet('travel-practice')!.pairIds);
    const hospitality = new Set(findVocabularySet('hospitality-practice')!.pairIds);
    const shared = [...hospitality].filter((id) => travel.has(id)).sort((a, b) => a - b);
    expect(shared).toEqual(HOSPITALITY_SHARED_IDS);
    expect([...travel].filter((id) => !hospitality.has(id))).toHaveLength(15);
    expect([...hospitality].filter((id) => !travel.has(id))).toHaveLength(15);
    // 和集合45語・Jaccard係数 15/45。
    const union = new Set([...travel, ...hospitality]);
    expect(union.size).toBe(45);
    expect(shared.length / union.size).toBeCloseTo(1 / 3, 5);
  });

  it('どのセットも、20枚に必要な10語以上を持つ', () => {
    for (const set of VOCABULARY_SETS) {
      expect(set.pairIds.length, `${set.id}`).toBeGreaterThanOrEqual(pairCountFor(20));
    }
  });
});

describe('セットから語を解決する', () => {
  it('pairsInSet は共通セットの85語を、セットの並びのまま返す', () => {
    const pairs = pairsInSet('common-practice');
    expect(pairs).toHaveLength(85);
    expect(pairs.map((p) => p.pairId)).toEqual(COMMON_PAIR_IDS);
    // 語彙データの並びとも一致する（盤面の再現性のため）。
    expect(pairs.map((p) => p.pairId)).toEqual(SAMPLE_PAIRS.map((p) => p.pairId));
  });

  it('pairsInSet は旅のセットの30語を、セットの並びのまま返す', () => {
    const pairs = pairsInSet('travel-practice');
    expect(pairs).toHaveLength(30);
    expect(pairs.map((p) => p.pairId)).toEqual(TRAVEL_PAIR_IDS);
    // 語そのものは語彙データと同じ。セットは並べ替えも書き換えもしない。
    for (const pair of pairs) {
      expect(pair).toEqual(findPair(pair.pairId));
    }
  });

  it('pairsInSet は接客・観光のセットの30語を、セットの並びのまま返す', () => {
    const pairs = pairsInSet('hospitality-practice');
    expect(pairs).toHaveLength(30);
    expect(pairs.map((p) => p.pairId)).toEqual(HOSPITALITY_SET_PAIR_IDS);
    for (const pair of pairs) {
      expect(pair).toEqual(findPair(pair.pairId));
    }
  });

  it('pairsInSet は学校のセットの30語を、セットの並びのまま返す', () => {
    const pairs = pairsInSet('school-practice');
    expect(pairs).toHaveLength(30);
    expect(pairs.map((p) => p.pairId)).toEqual(SCHOOL_SET_PAIR_IDS);
    for (const pair of pairs) {
      expect(pair).toEqual(findPair(pair.pairId));
    }
  });

  it('pairsInSet は学校のセットの元データも変えない', () => {
    const beforePairs = SAMPLE_PAIRS.map((p) => p.pairId);
    const beforeIds = [...findVocabularySet('school-practice')!.pairIds];
    pairsInSet('school-practice').reverse();
    expect(SAMPLE_PAIRS.map((p) => p.pairId)).toEqual(beforePairs);
    expect(findVocabularySet('school-practice')!.pairIds).toEqual(beforeIds);
  });

  it('pairsInSet は元の語彙配列も pairIds も変えない', () => {
    const beforePairs = SAMPLE_PAIRS.map((p) => p.pairId);
    const beforeIds = [...findVocabularySet('common-practice')!.pairIds];
    const resolved = pairsInSet('common-practice');
    resolved.reverse();
    expect(SAMPLE_PAIRS.map((p) => p.pairId)).toEqual(beforePairs);
    expect(findVocabularySet('common-practice')!.pairIds).toEqual(beforeIds);
  });

  it('存在しないセットIDは解決できない', () => {
    expect(findVocabularySet('nope')).toBeUndefined();
    expect(findVocabularySet(null)).toBeUndefined();
    expect(findVocabularySet('')).toBeUndefined();
    expect(() => pairsInSet('nope')).toThrow(/定義されていません/);
    expect(() => pairsInSet(null)).toThrow(/定義されていません/);
  });

  it('存在しない pairId を含むセットはエラーになる（黙って語数を減らさない）', () => {
    // 本番データは触らず、壊れたセット定義を関数へ直接渡して確かめる。
    const broken = { id: 'common-practice' as const, pairIds: [1, 2, 999] };
    expect(() => resolveSetPairs(broken)).toThrow(/999/);
    expect(() => resolveSetPairs(broken)).toThrow(/語彙データに無い/);

    // 欠番を指した場合も同じ。
    const reserved = { id: 'common-practice' as const, pairIds: [1, 12] };
    expect(() => resolveSetPairs(reserved)).toThrow(/12/);
  });
});

describe('コースと語彙セットの結びつき', () => {
  it('24コースすべてが語彙セットIDを持つ', () => {
    expect(COURSES).toHaveLength(24);
    for (const course of COURSES) {
      expect(course.vocabularySetId, `${course.id}`).toBeTruthy();
    }
  });

  it('24コースすべてが、実在するセットを指す', () => {
    for (const course of COURSES) {
      expect(
        findVocabularySet(course.vocabularySetId),
        `${course.id} が未定義のセット「${course.vocabularySetId}」を指している`,
      ).toBeDefined();
    }
  });

  it('旅のセットを指すコースは、海外旅行1件だけ', () => {
    const travelCourses = COURSES.filter((c) => c.vocabularySetId === 'travel-practice');
    // 件数だけでなく、どのコースかまで完全一致で固定する。
    // ほかのコースが誤って旅のセットを参照したら、ここで落ちる。
    expect(travelCourses.map((c) => c.id)).toEqual(['biz-travel']);
    expect(findCourse('biz-travel')!.vocabularySetId).toBe('travel-practice');
    expect(findCourse('biz-travel')!.label).toBe('海外旅行');
  });

  it('学校のセットを指すコースは、小学生と中学生の2件だけ', () => {
    const schoolCourses = COURSES.filter((c) => c.vocabularySetId === 'school-practice');
    // 件数だけでなく、どのコースかまで完全一致で固定する。
    expect(schoolCourses.map((c) => c.id)).toEqual(SCHOOL_COURSE_IDS);
    expect(findCourse('grade-elementary')!.label).toBe('小学生');
    expect(findCourse('grade-junior')!.label).toBe('中学生');
  });

  it('接客・観光のセットを指すコースは、接客・観光1件だけ', () => {
    const courses = COURSES.filter((c) => c.vocabularySetId === 'hospitality-practice');
    expect(courses.map((c) => c.id)).toEqual(['biz-hospitality']);
    expect(findCourse('biz-hospitality')!.label).toBe('接客・観光');
    expect(findCourse('biz-hospitality')!.categoryId).toBe('business');
  });

  it('高校生・大学生は共通セットのまま', () => {
    // 学校30語は教室の道具が多く、その学年に合うかを示せるデータがまだ無い。
    // セットは場面で分けたもので、学年別の難易度ではない。
    expect(findCourse('grade-high')!.vocabularySetId).toBe('common-practice');
    expect(findCourse('grade-university')!.vocabularySetId).toBe('common-practice');
  });

  it('テーマ別セット以外の20コースは common-practice のまま', () => {
    const commonCourses = COURSES.filter((c) => c.vocabularySetId === 'common-practice');
    expect(commonCourses).toHaveLength(20);
    expect(commonCourses.map((c) => c.id)).toEqual(COMMON_COURSE_IDS);
    // 分類ごとにも確かめる。名前だけを理由にセットを変えていないこと。
    const grade = COURSES.filter((c) => c.categoryId === 'grade');
    expect(grade.map((c) => c.vocabularySetId)).toEqual([
      'school-practice',  // 小学生
      'school-practice',  // 中学生
      'common-practice',  // 高校生
      'common-practice',  // 大学生
    ]);
    expect(COURSES.filter((c) => c.categoryId === 'exam')
      .every((c) => c.vocabularySetId === 'common-practice')).toBe(true);
    const business = COURSES.filter((c) => c.categoryId === 'business');
    expect(business.filter((c) => c.vocabularySetId === 'travel-practice').map((c) => c.id))
      .toEqual(['biz-travel']);
    expect(business.filter((c) => c.vocabularySetId === 'hospitality-practice').map((c) => c.id))
      .toEqual(['biz-hospitality']);
    expect(business.filter((c) => c.vocabularySetId === 'common-practice')).toHaveLength(4);
  });

  it('日常英会話は、今回も共通セットのまま', () => {
    // 追加語の回帰テストが使うので、共通85語のまま動かさない。
    expect(findCourse('biz-daily')!.vocabularySetId).toBe('common-practice');
  });

  it('コースのID・表示名・分類・グループは変わっていない', () => {
    expect(COURSES.map((c) => c.id)).toEqual([
      'grade-elementary', 'grade-junior', 'grade-high', 'grade-university',
      'eiken-5', 'eiken-4', 'eiken-3', 'eiken-pre2', 'eiken-pre2-plus',
      'eiken-2', 'eiken-pre1', 'eiken-1',
      'toeic-400', 'toeic-500', 'toeic-600', 'toeic-730', 'toeic-860', 'toeic-900',
      'biz-daily', 'biz-travel', 'biz-business', 'biz-hospitality', 'biz-care', 'biz-it',
    ]);
    expect(findCourse('eiken-3')?.label).toBe('ステップ3');
    expect(findCourse('eiken-3')?.group).toBe('ことばチャレンジ');
    expect(findCourse('toeic-400')?.label).toBe('ステップ1');
    expect(findCourse('toeic-400')?.group).toBe('しごとチャレンジ');
    expect(findCourse('grade-elementary')?.label).toBe('小学生');
    expect(findCourse('grade-elementary')?.group).toBeUndefined();
  });
});

describe('選択中のコースから語を引く', () => {
  it('共通セットのコースを指定すると、85語になる', () => {
    for (const courseId of COMMON_COURSE_IDS) {
      const pairs = pairsForCourse(courseId);
      expect(pairs.map((p) => p.pairId), courseId).toEqual(COMMON_PAIR_IDS);
    }
    expect(pairsForCourse('biz-daily')).toHaveLength(85);
  });

  it('海外旅行を指定すると、旅の30語になる', () => {
    const pairs = pairsForCourse('biz-travel');
    expect(pairs.map((p) => p.pairId)).toEqual(TRAVEL_PAIR_IDS);
    expect(pairs).toHaveLength(30);
    for (const pairId of [...UNVERIFIED_IN_USE, ...RESERVED_PAIR_IDS]) {
      expect(pairs.map((p) => p.pairId), `${pairId} が海外旅行の語に入っている`)
        .not.toContain(pairId);
    }
  });

  it('接客・観光を指定すると、接客・観光の30語になる', () => {
    const pairs = pairsForCourse('biz-hospitality');
    expect(pairs.map((p) => p.pairId)).toEqual(HOSPITALITY_SET_PAIR_IDS);
    expect(pairs).toHaveLength(30);
    for (const pairId of [...UNVERIFIED_IN_USE, ...RESERVED_PAIR_IDS]) {
      expect(pairs.map((p) => p.pairId), `${pairId} が接客・観光の語に入っている`)
        .not.toContain(pairId);
    }
  });

  it('小学生・中学生を指定すると、学校の30語になる', () => {
    for (const courseId of SCHOOL_COURSE_IDS) {
      const pairs = pairsForCourse(courseId);
      expect(pairs.map((p) => p.pairId), courseId).toEqual(SCHOOL_SET_PAIR_IDS);
      expect(pairs, courseId).toHaveLength(30);
      for (const pairId of [...UNVERIFIED_IN_USE, ...RESERVED_PAIR_IDS]) {
        expect(pairs.map((p) => p.pairId), `${courseId} に ${pairId} が入っている`)
          .not.toContain(pairId);
      }
    }
  });

  it('コース未選択なら既定のセットを使う', () => {
    expect(pairsForCourse(null).map((p) => p.pairId)).toEqual(COMMON_PAIR_IDS);
    expect(pairsForCourse(undefined).map((p) => p.pairId)).toEqual(COMMON_PAIR_IDS);
    expect(pairsForCourse('').map((p) => p.pairId)).toEqual(COMMON_PAIR_IDS);
  });

  it('保存データに未知のコースIDが残っていても、安全に遊べる', () => {
    // 昔の保存データや、消えたコースのIDが残っていても例外にしない。
    for (const unknown of ['eiken-0', 'legacy-course', '3級']) {
      expect(() => pairsForCourse(unknown), unknown).not.toThrow();
      expect(pairsForCourse(unknown).map((p) => p.pairId), unknown).toEqual(COMMON_PAIR_IDS);
    }
  });
});

describe('経路を入れても、出題は変わっていないこと', () => {
  it('同じseedなら、経路を通す前と同じ盤面になる', () => {
    // 経路を通したあとの語と並びが、語彙データを直接渡した場合と一致する。
    for (const count of COUNTS) {
      for (const seed of [1, 42, 555, 20260921]) {
        const viaCourse = buildDeck(pairsForCourse('biz-daily'), count, seed);
        const direct = buildDeck(SAMPLE_PAIRS, count, seed);
        expect(
          viaCourse.map((c) => `${c.id}:${c.text}`),
          `count=${count} seed=${seed}`,
        ).toEqual(direct.map((c) => `${c.id}:${c.text}`));
      }
    }
  });

  it('同じセットを使うコース同士は、同じseed・同じ枚数なら同じ盤面', () => {
    for (const count of COUNTS) {
      for (const seed of [7, 1234]) {
        const boards = COMMON_COURSE_IDS.map((id) =>
          buildDeck(pairsForCourse(id), count, seed).map((card) => card.id).join(','),
        );
        expect(new Set(boards).size, `count=${count} seed=${seed}`).toBe(1);
      }
    }
  });

  it('セットが違うコース同士は、固定した検査seedで盤面が違う', () => {
    // セットが違えば、同じ seed でも選ばれる語が変わる。
    // 偶然そろう seed を避けるため、食い違う seed を実測して固定してある。
    const board = (courseId: string, count: CardCount, seed: number) =>
      buildDeck(pairsForCourse(courseId), count, seed).map((card) => card.id).join(',');
    for (const count of COUNTS) {
      for (const seed of DIFFERENT_BOARD_SEEDS) {
        const boards = {
          学校: board('grade-elementary', count, seed),
          旅行: board('biz-travel', count, seed),
          接客: board('biz-hospitality', count, seed),
          共通: board('biz-daily', count, seed),
        };
        // 4セットの盤面が、どの2つを比べても一致しない。
        expect(new Set(Object.values(boards)).size, `count=${count} seed=${seed}`).toBe(4);
      }
    }
  });

  it('小学生と中学生は、同じseed・同じ枚数なら同じ盤面', () => {
    // 同じ学校セットを同じ並びで使うので、盤面も一致する。
    for (const count of COUNTS) {
      for (const seed of [1, 7, 42, 1234]) {
        const elementary = buildDeck(pairsForCourse('grade-elementary'), count, seed)
          .map((card) => `${card.id}:${card.text}`);
        const junior = buildDeck(pairsForCourse('grade-junior'), count, seed)
          .map((card) => `${card.id}:${card.text}`);
        expect(junior, `count=${count} seed=${seed}`).toEqual(elementary);
      }
    }
  });

  it('どのセットでも、同じseedなら毎回同じ結果になる', () => {
    for (const courseId of ['biz-travel', 'grade-elementary', 'biz-hospitality', 'biz-daily']) {
      for (const count of COUNTS) {
        const first = buildDeck(pairsForCourse(courseId), count, 4321)
          .map((card) => `${card.id}:${card.text}`);
        const second = buildDeck(pairsForCourse(courseId), count, 4321)
          .map((card) => `${card.id}:${card.text}`);
        expect(second, `${courseId} count=${count}`).toEqual(first);
      }
    }
  });

  it('各コースの盤面は、そのコースのセットの中に収まる', () => {
    const cases: [string, number[]][] = [
      ['biz-travel', TRAVEL_PAIR_IDS],
      ['grade-elementary', SCHOOL_SET_PAIR_IDS],
      ['grade-junior', SCHOOL_SET_PAIR_IDS],
      ['biz-hospitality', HOSPITALITY_SET_PAIR_IDS],
      ['biz-it', COMMON_PAIR_IDS],
    ];
    for (const [courseId, allowed] of cases) {
      for (const count of COUNTS) {
        for (const seed of [1, 99, 2024, 31337]) {
          for (const pairId of buildDeck(pairsForCourse(courseId), count, seed).map((c) => c.pairId)) {
            expect(allowed, `${courseId} にセット外の ${pairId} が出た`).toContain(pairId);
          }
        }
      }
    }
  });

  it('6枚は3語・12枚は6語・20枚は10語のまま（どちらのセットでも）', () => {
    for (const courseId of ['biz-it', 'biz-travel', 'grade-elementary', 'biz-hospitality']) {
      for (const count of COUNTS) {
        const ids = new Set(buildDeck(pairsForCourse(courseId), count, 2024).map((c) => c.pairId));
        expect(ids.size, `${courseId} ${count}枚`).toBe(pairCountFor(count));
      }
    }
  });

  it('確認テストは、盤面に出た語だけを使う', () => {
    for (const count of COUNTS) {
      const deck = buildDeck(pairsForCourse('eiken-5'), count, 99);
      const onBoard = new Set(deck.map((c) => c.pairId));
      const questions = buildWaveQuiz({
        wavePairIds: [...onBoard],
        cardCount: count,
        seed: 99,
        pairs: SAMPLE_PAIRS,
      });
      expect(questions.length).toBeGreaterThan(0);
      for (const q of questions) {
        expect(onBoard.has(q.pairId), `count=${count} pairId=${q.pairId}`).toBe(true);
      }
    }
  });
});

describe('カルタ画面が、語彙プールを直接使っていないこと', () => {
  // 出力が同じでも、画面が語彙データを直接読んでいたら経路を入れた意味がない。
  // 画面のソースそのものを見て、コース経由になっていることを固定する。
  it('カルタ画面は選択中コースから語を引いている', () => {
    expect(kartaSource).toContain('pairsForCourse(ctx.selection.courseId)');
    expect(kartaSource).toContain("from '../data/courses'");
  });

  it('カルタ画面は盤面づくりに語彙プールを読み込まない', () => {
    expect(kartaSource, 'SAMPLE_PAIRS を直接参照している').not.toContain('SAMPLE_PAIRS');
    // 語の読みを出すための1件引きは残ってよい。
    expect(kartaSource).toContain('findPair(pairId)');
  });
});

describe('この工程で変えていないこと', () => {
  it('ゲームの語は85語で、共通セットと同じ並び', () => {
    expect(SAMPLE_PAIRS).toHaveLength(85);
    expect(SAMPLE_PAIRS.map((p) => p.pairId)).toEqual(COMMON_PAIR_IDS);
    // ゲームデータとセットは、順番まで一致していなければならない。
    // ずれると、同じ seed で盤面が変わってしまう。
    expect(SAMPLE_PAIRS.map((p) => p.pairId))
      .toEqual([...findVocabularySet('common-practice')!.pairIds]);
  });

  it('足した15語を findPair で引け、欠番は引けない', () => {
    for (const pairId of SCHOOL_PAIR_IDS) {
      expect(findPair(pairId), `findPair(${pairId})`).toBeDefined();
    }
    for (const reserved of RESERVED_PAIR_IDS) {
      expect(findPair(reserved), `findPair(${reserved})`).toBeUndefined();
    }
  });

  it('保存形式は version 3 のまま', () => {
    expect(RECORD_VERSION).toBe(3);
  });

  it('旧保存データを引き続き読める', () => {
    const legacy = {
      version: 1,
      totalPlays: 3,
      playedDates: ['2026-09-19'],
      selectedCourseId: 'eiken-3',
      history: [
        { date: '2026-09-19', courseId: 'eiken-3', courseLabel: '3級', cardCount: 6, accuracy: 90, elapsedMs: 12000 },
      ],
      masteredPairIds: [1, 2],
      reviewPairIds: [3],
    };
    const record = parseRecord(JSON.stringify(legacy));
    expect(record.version).toBe(RECORD_VERSION);
    expect(record.totalPlays).toBe(3);
    expect(record.selectedCourseId).toBe('eiken-3');
    expect(record.history[0].courseLabel).toBe('3級');
    // 保存済みのコースIDから、いまの語彙セットを引ける。
    expect(pairsForCourse(record.selectedCourseId)).toHaveLength(85);

    const storage = createMemoryStore({ [STORAGE_KEY]: JSON.stringify(legacy) });
    expect(() => new LearningRecordStore(storage)).not.toThrow();
  });

  it('国紹介の状態が変わっていない', () => {
    const japan = COUNTRY_INTROS[0];
    const all = allClaims(japan);
    const count = (v: string) => all.filter((c) => c.verification === v).length;
    expect(japan.publicationStatus).toBe('draft');
    expect(all).toHaveLength(46);
    expect([count('body-checked'), count('unchecked'), count('rejected'), count('withdrawn')])
      .toEqual([15, 1, 2, 28]);
    expect(japan.sources.filter((s) => s.verification === 'body-checked')).toHaveLength(19);
    expect(japan.sources.filter((s) => s.verification === 'url-only')).toHaveLength(9);
    expect(all.find((c) => c.id === 'jp-claim-greeting-hello')?.verification).toBe('unchecked');
    expect(canPublish(japan)).toBe(false);
    expect(showsDetails(japan)).toBe(false);
  });
});
