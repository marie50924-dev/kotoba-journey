import { describe, expect, it } from 'vitest';
import {
  COURSES,
  UNKNOWN_COURSE_LABEL,
  courseDisplayLabel,
  findCourse,
  resolveCourseLabel,
} from '../data/courses';
import {
  LearningRecordStore,
  RECORD_VERSION,
  STORAGE_KEY,
  createEmptyRecord,
  parseRecord,
} from '../storage/learningRecord';
import { createMemoryStore } from '../storage/safeStorage';

/**
 * 工程V-2B以前に保存された学習記録。
 *
 * 当時のコース表示名（検定名・試験名）が courseLabel にそのまま入っている。
 * ここは「そのころ実際に書き出された形」なので、後から書き換えない。
 * 画面へ出すときに現在の中立名へ読み替えられることを、このファイルで固定する。
 */
const LEGACY_RECORD = {
  version: 1,
  totalPlays: 7,
  playedDates: ['2026-09-17', '2026-09-18', '2026-09-19'],
  totalCorrect: 40,
  totalIncorrect: 8,
  masteredPairIds: [1, 2],
  reviewPairIds: [3],
  bestTimeMs: { 6: 12000 },
  selectedCourseId: 'eiken-3',
  visitedCountryIds: ['japan'],
  history: [
    { date: '2026-09-19', courseId: 'eiken-3', courseLabel: '3級', cardCount: 6, accuracy: 90, elapsedMs: 12000 },
    { date: '2026-09-19', courseId: 'eiken-pre2', courseLabel: '準2級', cardCount: 12, accuracy: 80, elapsedMs: 30000 },
    { date: '2026-09-18', courseId: 'toeic-400', courseLabel: '400点', cardCount: 6, accuracy: 70, elapsedMs: 20000 },
    { date: '2026-09-18', courseId: 'toeic-900', courseLabel: '900点以上', cardCount: 20, accuracy: 60, elapsedMs: 50000 },
    // 内部IDが失われ、当時の表示名だけが残っている記録。
    { date: '2026-09-18', courseId: '', courseLabel: 'TOEIC 600点', cardCount: 6, accuracy: 50, elapsedMs: 18000 },
    // どのコースにも一致しない旧試験名。
    { date: '2026-09-17', courseId: 'unknown-course', courseLabel: '英検2級ジュニア', cardCount: 6, accuracy: 40, elapsedMs: 19000 },
    { date: '2026-09-17', courseId: 'grade-elementary', courseLabel: '小学生', cardCount: 6, accuracy: 100, elapsedMs: 9000 },
  ],
  audioEnabled: true,
};

/** 画面へ出してはいけない語。 */
const FORBIDDEN = ['英検', 'TOEIC', '資格', '級', '点'];

/** パスポートの履歴が実際に出す文字列。passportScreen と同じ解決を通す。 */
function historyLabels(record: { history: { courseId: string; courseLabel: string }[] }): string[] {
  return record.history.map((entry) => resolveCourseLabel(entry.courseId, entry.courseLabel));
}

describe('旧保存データのコース名を画面へ出すとき', () => {
  it('いまの14の内部IDは、すべて中立なステップ名へ解決される', () => {
    const exam = COURSES.filter((c) => c.categoryId === 'exam');
    expect(exam).toHaveLength(14);
    for (const course of exam) {
      const shown = resolveCourseLabel(course.id);
      expect(shown, `${course.id} が解決できない`).toBe(courseDisplayLabel(course));
      for (const word of FORBIDDEN) {
        expect(shown, `${course.id} の表示に「${word}」が出る`).not.toContain(word);
      }
    }
  });

  it('同じ「ステップ1」でも、グループ名で区別できる', () => {
    expect(resolveCourseLabel('eiken-5')).toBe('ことばチャレンジ・ステップ1');
    expect(resolveCourseLabel('toeic-400')).toBe('しごとチャレンジ・ステップ1');
    expect(resolveCourseLabel('eiken-5')).not.toBe(resolveCourseLabel('toeic-400'));
  });

  it('旧「3級」は ことばチャレンジ・ステップ3 になる', () => {
    expect(resolveCourseLabel('eiken-3', '3級')).toBe('ことばチャレンジ・ステップ3');
    // 内部IDが失われていても、当時の表示名から読み替える。
    expect(resolveCourseLabel('', '3級')).toBe('ことばチャレンジ・ステップ3');
    expect(resolveCourseLabel(null, '英検3級')).toBe('ことばチャレンジ・ステップ3');
  });

  it('旧「準2級」は中立表示になる', () => {
    expect(resolveCourseLabel('eiken-pre2', '準2級')).toBe('ことばチャレンジ・ステップ4');
    expect(resolveCourseLabel('', '準2級')).toBe('ことばチャレンジ・ステップ4');
    expect(resolveCourseLabel('', '準2級プラス')).toBe('ことばチャレンジ・ステップ5');
  });

  it('旧「400点」は しごとチャレンジ・ステップ1 になる', () => {
    expect(resolveCourseLabel('toeic-400', '400点')).toBe('しごとチャレンジ・ステップ1');
    expect(resolveCourseLabel('', '400点')).toBe('しごとチャレンジ・ステップ1');
  });

  it('旧「900点以上」は中立表示になる', () => {
    expect(resolveCourseLabel('toeic-900', '900点以上')).toBe('しごとチャレンジ・ステップ6');
    expect(resolveCourseLabel('', '900点以上')).toBe('しごとチャレンジ・ステップ6');
  });

  it('「TOEIC 600点」などの旧表記も中立表示になる', () => {
    for (const legacy of ['600点', 'TOEIC 600点', 'TOEIC600点']) {
      expect(resolveCourseLabel('', legacy), legacy).toBe('しごとチャレンジ・ステップ3');
    }
  });

  it('知らない旧試験名は「以前のコース」になる', () => {
    expect(UNKNOWN_COURSE_LABEL).toBe('以前のコース');
    for (const legacy of ['英検2級ジュニア', 'TOEIC Bridge', '漢検3級', '2級プラス']) {
      expect(resolveCourseLabel('unknown-course', legacy), legacy).toBe(UNKNOWN_COURSE_LABEL);
    }
  });

  it('学年別・社会人の名前はそのまま出る', () => {
    expect(resolveCourseLabel('grade-elementary', '小学生')).toBe('小学生');
    expect(resolveCourseLabel('', '日常英会話')).toBe('日常英会話');
  });

  it('コースの記録が無いときは空文字を返し、画面側が「未選択」を選べる', () => {
    expect(resolveCourseLabel('', '')).toBe('');
    expect(resolveCourseLabel(null, null)).toBe('');
    expect(resolveCourseLabel(undefined, '   ')).toBe('');
  });

  it('未知の値でも例外にならない', () => {
    expect(() => resolveCourseLabel('nope', 'nope')).not.toThrow();
    expect(() => resolveCourseLabel(null, undefined)).not.toThrow();
  });
});

describe('旧保存データを実際に読み込んだとき', () => {
  it('旧バージョンの保存データを読め、version 3 へ移行する', () => {
    const record = parseRecord(JSON.stringify(LEGACY_RECORD));
    expect(record.version).toBe(RECORD_VERSION);
    expect(RECORD_VERSION).toBe(3);
    expect(record.totalPlays).toBe(7);
    expect(record.history).toHaveLength(7);
    expect(record.selectedCourseId).toBe('eiken-3');
  });

  it('保存データの courseLabel の元値は書き換えない', () => {
    const record = parseRecord(JSON.stringify(LEGACY_RECORD));
    expect(record.history.map((h) => h.courseLabel)).toEqual([
      '3級',
      '準2級',
      '400点',
      '900点以上',
      'TOEIC 600点',
      '英検2級ジュニア',
      '小学生',
    ]);
  });

  it('保存し直しても元値が消えない（互換性を壊さない）', () => {
    const storage = createMemoryStore({ [STORAGE_KEY]: JSON.stringify(LEGACY_RECORD) });
    new LearningRecordStore(storage).update((r) => ({ ...r, audioEnabled: false }));
    const reloaded = new LearningRecordStore(storage).get();
    expect(reloaded.history.map((h) => h.courseLabel)).toEqual([
      '3級',
      '準2級',
      '400点',
      '900点以上',
      'TOEIC 600点',
      '英検2級ジュニア',
      '小学生',
    ]);
    expect(reloaded.version).toBe(RECORD_VERSION);
    expect(reloaded.totalPlays).toBe(7);
  });

  it('パスポートの履歴に出る文字列は、すべて中立名になる', () => {
    const record = parseRecord(JSON.stringify(LEGACY_RECORD));
    expect(historyLabels(record)).toEqual([
      'ことばチャレンジ・ステップ3',
      'ことばチャレンジ・ステップ4',
      'しごとチャレンジ・ステップ1',
      'しごとチャレンジ・ステップ6',
      'しごとチャレンジ・ステップ3',
      '以前のコース',
      '小学生',
    ]);
  });

  it('パスポートに出る文字列へ、旧試験名が1つも混ざらない', () => {
    const record = parseRecord(JSON.stringify(LEGACY_RECORD));
    const shown = [...historyLabels(record), resolveCourseLabel(record.selectedCourseId)].join(' ');
    for (const word of FORBIDDEN) {
      expect(shown, `「${word}」が画面へ出る`).not.toContain(word);
    }
  });

  it('選択中コースも、内部IDから現在の名前へ解決される', () => {
    const record = parseRecord(JSON.stringify(LEGACY_RECORD));
    expect(resolveCourseLabel(record.selectedCourseId)).toBe('ことばチャレンジ・ステップ3');
  });

  it('いまの保存データも今までどおり読める', () => {
    const current = { ...createEmptyRecord(), version: RECORD_VERSION, selectedCourseId: 'biz-it' };
    const record = parseRecord(JSON.stringify(current));
    expect(record.version).toBe(RECORD_VERSION);
    expect(record.selectedCourseId).toBe('biz-it');
    expect(resolveCourseLabel(record.selectedCourseId)).toBe('IT・仕事');
    expect(findCourse('biz-it')).toBeDefined();
  });
});
