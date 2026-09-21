import { describe, expect, it } from 'vitest';
import {
  AGE_GROUPS,
  DEFAULT_AGE_GROUP,
  ageGroupForCourse,
  findAgeGroup,
  isAgeGroup,
  usesSavedAgeGroup,
} from '../data/characters';
import type { AgeGroup } from '../data/characters';
import { COURSES, coursesInCategory, findCourse } from '../data/courses';
import { COUNTRY_INTROS, findCountryIntro, hasCountryIntro } from '../data/countryIntros';
import { DESTINATIONS, findDestination, TRAVEL_MODE_LABEL } from '../data/destinations';
import { TITLE_ASSET_SIZES } from '../data/titleAssets';

const course = (id: string) => findCourse(id);

describe('年齢層キャラクター', () => {
  it('小学生から大人まで5段階を定義している', () => {
    expect(AGE_GROUPS.map((g) => g.id)).toEqual([
      'elementary',
      'junior',
      'high',
      'university',
      'adult',
    ]);
    expect(AGE_GROUPS.map((g) => g.label)).toEqual(['小学生', '中学生', '高校生', '大学生', '大人']);
  });

  it('各年齢層がカード画像と由来素材を持つ', () => {
    for (const group of AGE_GROUPS) {
      expect(group.image).toMatch(/assets\/characters\/.+\.webp$/);
      expect(group.sourceFile.length).toBeGreaterThan(0);
      expect(group.description.length).toBeGreaterThan(0);
    }
  });

  it('画像ファイル名は重複しない', () => {
    expect(new Set(AGE_GROUPS.map((g) => g.image)).size).toBe(AGE_GROUPS.length);
  });

  it('年齢層IDの判定が既定値を守る', () => {
    expect(isAgeGroup('elementary')).toBe(true);
    expect(isAgeGroup('adult')).toBe(true);
    expect(isAgeGroup('senior')).toBe(false);
    expect(isAgeGroup(null)).toBe(false);
    expect(findAgeGroup(null)).toBeUndefined();
    expect(findAgeGroup('high')?.label).toBe('高校生');
  });
});

describe('コースと年齢層の対応', () => {
  it('学年別コースはその学年の年齢層になる', () => {
    expect(ageGroupForCourse(course('grade-elementary'))).toBe('elementary');
    expect(ageGroupForCourse(course('grade-junior'))).toBe('junior');
    expect(ageGroupForCourse(course('grade-high'))).toBe('high');
    expect(ageGroupForCourse(course('grade-university'))).toBe('university');
  });

  it('社会人6コースはすべて大人になる', () => {
    const business = coursesInCategory('business');
    expect(business).toHaveLength(6);
    for (const c of business) {
      expect(ageGroupForCourse(c)).toBe('adult');
    }
  });

  it('ステップ別は年齢層未設定なら大人へ安全に落とす', () => {
    const exams = COURSES.filter((c) => c.categoryId === 'exam');
    expect(exams.length).toBeGreaterThan(0);
    for (const c of exams) {
      expect(ageGroupForCourse(c, null)).toBe('adult');
      expect(ageGroupForCourse(c)).toBe(DEFAULT_AGE_GROUP);
    }
  });

  it('ステップ別は年齢層が保存済みならそれを使う', () => {
    expect(ageGroupForCourse(course('eiken-5'), 'elementary')).toBe('elementary');
    expect(ageGroupForCourse(course('toeic-730'), 'university')).toBe('university');
  });

  it('学年別と社会人では保存済みの年齢設定より、コースの学年を優先する', () => {
    expect(ageGroupForCourse(course('grade-elementary'), 'adult')).toBe('elementary');
    expect(ageGroupForCourse(course('biz-business'), 'elementary')).toBe('adult');
  });

  it('コース未選択でも例外にならず既定へ落ちる', () => {
    expect(ageGroupForCourse(undefined)).toBe('adult');
    expect(ageGroupForCourse(undefined, 'junior')).toBe('junior');
  });

  it('全コースが必ず定義済みの年齢層へ対応する', () => {
    const ids: AgeGroup[] = AGE_GROUPS.map((g) => g.id);
    // 学年4 + ことばチャレンジ8 + しごとチャレンジ6 + 社会人6 = 24
    expect(COURSES).toHaveLength(24);
    expect(coursesInCategory('grade')).toHaveLength(4);
    expect(COURSES.filter((c) => c.categoryId === 'exam')).toHaveLength(14);
    expect(coursesInCategory('business')).toHaveLength(6);
    for (const c of COURSES) {
      expect(ids).toContain(ageGroupForCourse(c));
      expect(findAgeGroup(ageGroupForCourse(c))).toBeDefined();
    }
  });

  it('年齢設定が効くのはステップ別だけ', () => {
    expect(usesSavedAgeGroup(course('eiken-3'))).toBe(true);
    expect(usesSavedAgeGroup(course('toeic-600'))).toBe(true);
    expect(usesSavedAgeGroup(course('grade-high'))).toBe(false);
    expect(usesSavedAgeGroup(course('biz-travel'))).toBe(false);
  });
});

describe('国紹介データ', () => {
  it('本文を持つのは確認済みの国だけ（今は日本のみ）', () => {
    expect(COUNTRY_INTROS.map((c) => c.countryId)).toEqual(['japan']);
    expect(hasCountryIntro('japan')).toBe(true);
    expect(hasCountryIntro('london')).toBe(false);
    expect(hasCountryIntro('paris')).toBe(false);
  });

  it('国名・あいさつ・学ぶことを持つ', () => {
    const japan = findCountryIntro('japan')!;
    expect(japan.countryNameJa).toBe('日本');
    expect(japan.countryNameEn).toBe('Japan');
    // あいさつは任意項目だが、日本は持っている。
    expect(japan.greeting).toBeDefined();
    expect(japan.greeting?.ja).toBe('こんにちは');
    expect(japan.greeting?.en).toBe('Hello');
    expect(japan.learning.length).toBeGreaterThan(0);
  });

  it('未整備の国は undefined を返し、画面側で開始を妨げない', () => {
    expect(findCountryIntro('london')).toBeUndefined();
  });
});

describe('行き先', () => {
  it('日本だけ選択可能で、ロンドンとパリはロックのまま', () => {
    expect(DESTINATIONS.filter((d) => d.unlocked).map((d) => d.id)).toEqual(['japan']);
    expect(DESTINATIONS.filter((d) => !d.unlocked).map((d) => d.label)).toEqual(['ロンドン', 'パリ']);
  });

  it('移動表現と出発地の表示名を持つ', () => {
    for (const destination of DESTINATIONS) {
      expect(TRAVEL_MODE_LABEL[destination.travelMode]).toBeTruthy();
      expect(destination.departureLabel.length).toBeGreaterThan(0);
    }
  });

  it('未知のIDでは undefined を返す', () => {
    expect(findDestination('mars')).toBeUndefined();
    expect(findDestination(null)).toBeUndefined();
    expect(findDestination('japan')?.label).toBe('日本');
  });
});

describe('表紙素材', () => {
  it('縦横比を保った配信サイズを記録している', () => {
    expect(TITLE_ASSET_SIZES.background.width / TITLE_ASSET_SIZES.background.height)
      .toBeCloseTo(853 / 1844, 3);
    expect(TITLE_ASSET_SIZES.logo.width / TITLE_ASSET_SIZES.logo.height)
      .toBeCloseTo(1997 / 787, 2);
    expect(TITLE_ASSET_SIZES.mascot.width / TITLE_ASSET_SIZES.mascot.height)
      .toBeCloseTo(1402 / 1122, 2);
  });
});
