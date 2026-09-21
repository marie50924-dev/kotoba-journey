import { describe, expect, it } from 'vitest';
import {
  COURSES,
  COURSE_CATEGORIES,
  coursesInCategory,
  findCourse,
  groupedCourses,
} from '../data/courses';
import { DESTINATIONS } from '../data/destinations';
import { UI } from '../data/strings';

describe('コース定義', () => {
  it('コースIDは重複しない', () => {
    expect(new Set(COURSES.map((c) => c.id)).size).toBe(COURSES.length);
  });

  it('学年別は4コース', () => {
    expect(coursesInCategory('grade').map((c) => c.label)).toEqual([
      '小学生',
      '中学生',
      '高校生',
      '大学生',
    ]);
  });

  it('ステップ別は、ことばチャレンジ8段階としごとチャレンジ6段階に分かれる', () => {
    const groups = groupedCourses('exam');
    expect(groups.map((g) => g.group)).toEqual(['ことばチャレンジ', 'しごとチャレンジ']);
    expect(groups[0].courses.map((c) => c.label)).toEqual([
      'ステップ1',
      'ステップ2',
      'ステップ3',
      'ステップ4',
      'ステップ5',
      'ステップ6',
      'ステップ7',
      'ステップ8',
    ]);
    expect(groups[1].courses.map((c) => c.label)).toEqual([
      'ステップ1',
      'ステップ2',
      'ステップ3',
      'ステップ4',
      'ステップ5',
      'ステップ6',
    ]);
  });

  it('画面に出す名前へ、検定名や試験名を残していない', () => {
    // 語彙はことばトラベルが独自に選ぶので、公式試験に準拠しているとは書かない。
    const shown = [
      ...COURSE_CATEGORIES.map((c) => `${c.label} ${c.description}`),
      ...COURSES.map((c) => `${c.label} ${c.group ?? ''}`),
    ].join(' ');
    for (const word of ['英検', 'TOEIC', '資格', '級', '点']) {
      expect(shown, `「${word}」が画面名に残っている`).not.toContain(word);
    }
  });

  it('ステップ別の案内文は、開発者向けの言葉を含まない', () => {
    const notice = UI.courseList.stepsPreparing;
    expect(notice).toBe('各ステップのことばは準備中です。現在は共通の練習用ことばで遊べます。');
    for (const word of ['仮データ', '未実装', 'ID', 'seed', '語彙セット', 'プール']) {
      expect(notice, `「${word}」が案内に出ている`).not.toContain(word);
    }
  });

  it('内部IDは互換のためそのまま残す', () => {
    // 保存データや画面遷移が参照するので、id は変えない。画面には出ない。
    const ids = COURSES.map((c) => c.id);
    expect(ids).toContain('eiken-5');
    expect(ids).toContain('eiken-1');
    expect(ids).toContain('toeic-400');
    expect(ids).toContain('toeic-900');
    expect(ids).toHaveLength(24);
  });

  it('社会人は6コース', () => {
    expect(coursesInCategory('business').map((c) => c.label)).toEqual([
      '日常英会話',
      '海外旅行',
      'ビジネス',
      '接客・観光',
      '医療・介護',
      'IT・仕事',
    ]);
  });

  it('未知のコースIDは undefined', () => {
    expect(findCourse('存在しない')).toBeUndefined();
    expect(findCourse(null)).toBeUndefined();
    expect(findCourse('eiken-3')?.label).toBe('ステップ3');
  });
});

describe('世界マップ', () => {
  it('日本だけが選択可能で、ロンドンとパリはロック', () => {
    expect(DESTINATIONS.filter((d) => d.unlocked).map((d) => d.id)).toEqual(['japan']);
    expect(DESTINATIONS.filter((d) => !d.unlocked).map((d) => d.label)).toEqual(['ロンドン', 'パリ']);
  });

  it('ピンの位置はマップ枠内に収まる', () => {
    for (const destination of DESTINATIONS) {
      expect(destination.position.x).toBeGreaterThan(0);
      expect(destination.position.x).toBeLessThan(1);
      expect(destination.position.y).toBeGreaterThan(0);
      expect(destination.position.y).toBeLessThan(1);
    }
  });
});
