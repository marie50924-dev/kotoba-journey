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
 * 工程V-2D-1で入れた「コース → 語彙セット → 語」の経路の検査。
 *
 * いまセットは1つだけで、24コースとも同じ語で遊ぶ。
 * ここで固定したいのは、経路が通っていることと、
 * 経路を入れても出題される語と並びが前と変わっていないこと。
 */

/** 共通セットが持つ40語。src/data/wordPairs.ts と同じ並び。 */
const COMMON_PAIR_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 13, 14, 15, 16, 17, 18, 19,
  21, 23, 24, 26, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38,
  39, 40, 41, 42, 43, 44, 45,
];
/** 工程V-2D-3でセットへ足した15語。 */
const DAILY_PAIR_IDS = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45];
/** 資料確認待ちで、まだどのセットにも入れていない語。 */
const RESERVED_PAIR_IDS = [12, 20, 22, 25, 27];
const COUNTS: CardCount[] = [6, 12, 20];

describe('語彙セットの定義', () => {
  it('セットIDは重複しない', () => {
    expect(new Set(VOCABULARY_SETS.map((s) => s.id)).size).toBe(VOCABULARY_SETS.length);
  });

  it('いまは common-practice が1件だけある', () => {
    expect(VOCABULARY_SETS).toHaveLength(1);
    expect(VOCABULARY_SETS[0].id).toBe('common-practice');
    expect(VOCABULARY_SETS[0].label).toBe('共通の練習用ことば');
    expect(DEFAULT_VOCABULARY_SET_ID).toBe('common-practice');
  });

  it('共通セットの pairIds は、指定の40件と完全に一致する', () => {
    const set = findVocabularySet('common-practice')!;
    expect(set.pairIds).toEqual(COMMON_PAIR_IDS);
    expect(set.pairIds).toHaveLength(40);
    // 足した15語は末尾に、同じ順番で入っている。
    expect(set.pairIds.slice(-15)).toEqual(DAILY_PAIR_IDS);
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

  it('資料確認待ちの欠番を含まない', () => {
    for (const set of VOCABULARY_SETS) {
      for (const reserved of RESERVED_PAIR_IDS) {
        expect(set.pairIds, `${set.id} に ${reserved} が入っている`).not.toContain(reserved);
      }
    }
  });

  it('どのセットも、20枚に必要な10語以上を持つ', () => {
    for (const set of VOCABULARY_SETS) {
      expect(set.pairIds.length, `${set.id}`).toBeGreaterThanOrEqual(pairCountFor(20));
    }
  });
});

describe('セットから語を解決する', () => {
  it('pairsInSet は40語を、セットの並びのまま返す', () => {
    const pairs = pairsInSet('common-practice');
    expect(pairs).toHaveLength(40);
    expect(pairs.map((p) => p.pairId)).toEqual(COMMON_PAIR_IDS);
    // 語彙データの並びとも一致する（盤面の再現性のため）。
    expect(pairs.map((p) => p.pairId)).toEqual(SAMPLE_PAIRS.map((p) => p.pairId));
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

  it('いまは24コースとも common-practice を指す', () => {
    for (const course of COURSES) {
      expect(course.vocabularySetId, `${course.id}`).toBe('common-practice');
    }
    expect(new Set(COURSES.map((c) => c.vocabularySetId)).size).toBe(1);
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
  it('コースを指定すると、そのセットの40語になる', () => {
    for (const course of COURSES) {
      const pairs = pairsForCourse(course.id);
      expect(pairs.map((p) => p.pairId), `${course.id}`).toEqual(COMMON_PAIR_IDS);
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
        const viaCourse = buildDeck(pairsForCourse('grade-elementary'), count, seed);
        const direct = buildDeck(SAMPLE_PAIRS, count, seed);
        expect(
          viaCourse.map((c) => `${c.id}:${c.text}`),
          `count=${count} seed=${seed}`,
        ).toEqual(direct.map((c) => `${c.id}:${c.text}`));
      }
    }
  });

  it('どのコースを選んでも、同じseedなら同じ盤面になる', () => {
    for (const seed of [7, 1234]) {
      const boards = COURSES.map((c) =>
        buildDeck(pairsForCourse(c.id), 12, seed).map((card) => card.id).join(','),
      );
      expect(new Set(boards).size, 'コースによって盤面が変わっている').toBe(1);
    }
  });

  it('6枚は3語・12枚は6語・20枚は10語のまま', () => {
    for (const count of COUNTS) {
      const ids = new Set(buildDeck(pairsForCourse('biz-it'), count, 2024).map((c) => c.pairId));
      expect(ids.size, `${count}枚`).toBe(pairCountFor(count));
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
  it('ゲームの語は40語で、共通セットと同じ並び', () => {
    expect(SAMPLE_PAIRS).toHaveLength(40);
    expect(SAMPLE_PAIRS.map((p) => p.pairId)).toEqual(COMMON_PAIR_IDS);
    // ゲームデータとセットは、順番まで一致していなければならない。
    // ずれると、同じ seed で盤面が変わってしまう。
    expect(SAMPLE_PAIRS.map((p) => p.pairId))
      .toEqual([...findVocabularySet('common-practice')!.pairIds]);
  });

  it('足した15語を findPair で引け、欠番は引けない', () => {
    for (const pairId of DAILY_PAIR_IDS) {
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
    expect(pairsForCourse(record.selectedCourseId)).toHaveLength(40);

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
