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

describe('コースと語彙セットの割り当て', () => {
  it('学校2コース・旅行1コース・共通21コースに分かれる', () => {
    expect(COURSES).toHaveLength(24);
    const bySet = (id: string) =>
      COURSES.filter((c) => c.vocabularySetId === id).map((c) => c.id);
    expect(bySet('school-practice')).toEqual(['grade-elementary', 'grade-junior']);
    expect(bySet('travel-practice')).toEqual(['biz-travel']);
    expect(bySet('common-practice')).toHaveLength(21);
  });

  it('海外旅行の画面名・内部ID・分類は変わっていない', () => {
    const course = findCourse('biz-travel')!;
    expect(course.label).toBe('海外旅行');
    expect(course.categoryId).toBe('business');
    expect(course.group).toBeUndefined();
    // 表示順も変えない（社会人の2番目）。
    expect(coursesInCategory('business').map((c) => c.id)[1]).toBe('biz-travel');
  });

  it('学年別は、小学生・中学生だけが学校のことば', () => {
    // 学校という場面との対応で分けたもので、学年別の難易度ではない。
    // 高校生・大学生は、学校30語がその学年に合うかを示せるデータが無いので動かさない。
    expect(coursesInCategory('grade').map((c) => [c.label, c.vocabularySetId])).toEqual([
      ['小学生', 'school-practice'],
      ['中学生', 'school-practice'],
      ['高校生', 'common-practice'],
      ['大学生', 'common-practice'],
    ]);
  });

  it('社会人6コースのうち、海外旅行だけが旅のことば', () => {
    const business = coursesInCategory('business');
    expect(business.map((c) => c.vocabularySetId)).toEqual([
      'common-practice',  // 日常英会話
      'travel-practice',  // 海外旅行
      'common-practice',  // ビジネス
      'common-practice',  // 接客・観光
      'common-practice',  // 医療・介護
      'common-practice',  // IT・仕事
    ]);
  });

  it('ステップ別の案内文と、その14コースの語彙セットが食い違っていない', () => {
    // 案内文は「現在は共通の練習用ことばで遊べます」と言っている。
    // 将来ステップ別を別セットへ変えたとき、文言の更新を忘れたらここで落ちる。
    const notice = UI.courseList.stepsPreparing;
    expect(notice).toContain('共通の練習用ことば');
    const steps = coursesInCategory('exam');
    expect(steps).toHaveLength(14);
    for (const course of steps) {
      expect(course.vocabularySetId, `${course.id} が案内文と食い違っている`)
        .toBe('common-practice');
    }
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
