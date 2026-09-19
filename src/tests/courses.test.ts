import { describe, expect, it } from 'vitest';
import { COURSES, coursesInCategory, findCourse, groupedCourses } from '../data/courses';
import { DESTINATIONS } from '../data/destinations';

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

  it('資格・試験は英検8段階とTOEIC6段階に分かれる', () => {
    const groups = groupedCourses('exam');
    expect(groups.map((g) => g.group)).toEqual(['英検', 'TOEIC目標']);
    expect(groups[0].courses.map((c) => c.label)).toEqual([
      '5級',
      '4級',
      '3級',
      '準2級',
      '準2級プラス',
      '2級',
      '準1級',
      '1級',
    ]);
    expect(groups[1].courses.map((c) => c.label)).toEqual([
      '400点',
      '500点',
      '600点',
      '730点',
      '860点',
      '900点以上',
    ]);
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
    expect(findCourse('eiken-3')?.label).toBe('3級');
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
