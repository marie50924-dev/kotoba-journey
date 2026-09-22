/** コース定義。学習データと表示ラベルはここにまとめ、ロジック側へ散在させない。 */
import type { WordPair } from '../domain/types';
import {
  DEFAULT_VOCABULARY_SET_ID,
  pairsInSet,
  type VocabularySetId,
} from './vocabularySets';

export type CourseCategoryId = 'grade' | 'exam' | 'business';

export interface Course {
  id: string;
  label: string;
  categoryId: CourseCategoryId;
  /** 資格・試験のようにグループ分けが必要な場合の見出し。 */
  group?: string;
  /**
   * このコースが出題に使う語彙セット。
   *
   * いまは小学生・中学生が 'school-practice'、海外旅行が 'travel-practice'、
   * 接客・観光が 'hospitality-practice'、残り20コースが 'common-practice'。
   * 語彙と場面の対応がはっきりしているコースから、少しずつ分けていく。
   *
   * セットは場面で分けたものであって、学年別の難易度でも、
   * 仕事で必要な力でもない。それを決められるデータは、まだ持っていない。
   */
  vocabularySetId: VocabularySetId;
}

export interface CourseCategory {
  id: CourseCategoryId;
  label: string;
  description: string;
}

export const COURSE_CATEGORIES: readonly CourseCategory[] = [
  { id: 'grade', label: '学年別', description: '小学生から大学生まで' },
  { id: 'exam', label: 'ステップ別', description: 'やさしい順にステップで進む' },
  { id: 'business', label: '社会人', description: '日常・旅行・仕事の場面から' },
];

export const COURSES: readonly Course[] = [
  // 小学生・中学生は、学校という場面との対応が分かりやすいので学校のことばを使う。
  // 高校生・大学生は共通セットのまま。学校30語は教室の道具が多く、
  // その学年に合うかどうかを示せるデータをまだ持っていないため。
  { id: 'grade-elementary', label: '小学生', categoryId: 'grade', vocabularySetId: 'school-practice' },
  { id: 'grade-junior', label: '中学生', categoryId: 'grade', vocabularySetId: 'school-practice' },
  { id: 'grade-high', label: '高校生', categoryId: 'grade', vocabularySetId: 'common-practice' },
  { id: 'grade-university', label: '大学生', categoryId: 'grade', vocabularySetId: 'common-practice' },

  // id の eiken- / toeic- は、保存データや画面遷移との互換のために残しているだけの
  // 内部IDで、画面には出ない。語彙はことばトラベルが独自に選ぶので、
  // 表示はどの試験にも結びつかない中立なステップ名にしてある。
  { id: 'eiken-5', label: 'ステップ1', categoryId: 'exam', group: 'ことばチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'eiken-4', label: 'ステップ2', categoryId: 'exam', group: 'ことばチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'eiken-3', label: 'ステップ3', categoryId: 'exam', group: 'ことばチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'eiken-pre2', label: 'ステップ4', categoryId: 'exam', group: 'ことばチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'eiken-pre2-plus', label: 'ステップ5', categoryId: 'exam', group: 'ことばチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'eiken-2', label: 'ステップ6', categoryId: 'exam', group: 'ことばチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'eiken-pre1', label: 'ステップ7', categoryId: 'exam', group: 'ことばチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'eiken-1', label: 'ステップ8', categoryId: 'exam', group: 'ことばチャレンジ', vocabularySetId: 'common-practice' },

  { id: 'toeic-400', label: 'ステップ1', categoryId: 'exam', group: 'しごとチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'toeic-500', label: 'ステップ2', categoryId: 'exam', group: 'しごとチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'toeic-600', label: 'ステップ3', categoryId: 'exam', group: 'しごとチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'toeic-730', label: 'ステップ4', categoryId: 'exam', group: 'しごとチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'toeic-860', label: 'ステップ5', categoryId: 'exam', group: 'しごとチャレンジ', vocabularySetId: 'common-practice' },
  { id: 'toeic-900', label: 'ステップ6', categoryId: 'exam', group: 'しごとチャレンジ', vocabularySetId: 'common-practice' },

  { id: 'biz-daily', label: '日常英会話', categoryId: 'business', vocabularySetId: 'common-practice' },
  // 海外旅行だけ、旅の場面の30語を使う。
  // ほかのコースは、語彙と場面の対応が決まるまで共通セットのまま。
  { id: 'biz-travel', label: '海外旅行', categoryId: 'business', vocabularySetId: 'travel-practice' },
  { id: 'biz-business', label: 'ビジネス', categoryId: 'business', vocabularySetId: 'common-practice' },
  // 接客・観光は、接客・飲食・宿泊・観光の場面のことばを使う。
  // 場面で分けたセットで、接客の技能や職業の基準を確かめたものではない。
  { id: 'biz-hospitality', label: '接客・観光', categoryId: 'business', vocabularySetId: 'hospitality-practice' },
  { id: 'biz-care', label: '医療・介護', categoryId: 'business', vocabularySetId: 'common-practice' },
  { id: 'biz-it', label: 'IT・仕事', categoryId: 'business', vocabularySetId: 'common-practice' },
];

export function coursesInCategory(categoryId: CourseCategoryId): Course[] {
  return COURSES.filter((course) => course.categoryId === categoryId);
}

export function findCourse(courseId: string | null | undefined): Course | undefined {
  if (!courseId) return undefined;
  return COURSES.find((course) => course.id === courseId);
}

export function categoryLabel(categoryId: CourseCategoryId): string {
  return COURSE_CATEGORIES.find((c) => c.id === categoryId)?.label ?? '';
}

/** カテゴリ内をグループ見出しごとにまとめる。グループ未指定は1つの塊にする。 */
export function groupedCourses(categoryId: CourseCategoryId): { group: string | null; courses: Course[] }[] {
  const result: { group: string | null; courses: Course[] }[] = [];
  for (const course of coursesInCategory(categoryId)) {
    const group = course.group ?? null;
    const last = result[result.length - 1];
    if (last && last.group === group) {
      last.courses.push(course);
    } else {
      result.push({ group, courses: [course] });
    }
  }
  return result;
}

/**
 * 履歴などに並べても取り違えないコース名。
 *
 * ステップ別は「ことばチャレンジ・ステップ1」と「しごとチャレンジ・ステップ1」が
 * 同じ「ステップ1」になるため、グループ名を前に付けて区別する。
 * コース一覧の画面はグループ見出しの下にボタンを並べるので、
 * そちらでは短い label をそのまま使う。
 */
export function courseDisplayLabel(course: Course): string {
  return course.group ? `${course.group}・${course.label}` : course.label;
}

/**
 * 旧保存データに残っている「当時の表示名」→ いまの内部ID。
 *
 * Phase 0 から工程V-2Bまで、ステップ別のコースは検定名・試験名で表示していた。
 * その頃に保存された履歴には当時の表示名の文字列がそのまま入っているため、
 * 画面へ出す前にここで現在の中立名へ読み替える。
 * 保存データそのものは書き換えない（読み出し時に解決するだけ）。
 *
 * 表記ゆれ（「TOEIC 600点」「英検3級」など）も、確実に判別できるものだけ拾う。
 */
const LEGACY_COURSE_LABEL_IDS: Readonly<Record<string, string>> = {
  // 旧・英検表記
  '5級': 'eiken-5',
  '英検5級': 'eiken-5',
  '4級': 'eiken-4',
  '英検4級': 'eiken-4',
  '3級': 'eiken-3',
  '英検3級': 'eiken-3',
  '準2級': 'eiken-pre2',
  '英検準2級': 'eiken-pre2',
  '準2級プラス': 'eiken-pre2-plus',
  '英検準2級プラス': 'eiken-pre2-plus',
  '2級': 'eiken-2',
  '英検2級': 'eiken-2',
  '準1級': 'eiken-pre1',
  '英検準1級': 'eiken-pre1',
  '1級': 'eiken-1',
  '英検1級': 'eiken-1',

  // 旧・TOEIC表記
  '400点': 'toeic-400',
  'TOEIC 400点': 'toeic-400',
  'TOEIC400点': 'toeic-400',
  '500点': 'toeic-500',
  'TOEIC 500点': 'toeic-500',
  'TOEIC500点': 'toeic-500',
  '600点': 'toeic-600',
  'TOEIC 600点': 'toeic-600',
  'TOEIC600点': 'toeic-600',
  '730点': 'toeic-730',
  'TOEIC 730点': 'toeic-730',
  'TOEIC730点': 'toeic-730',
  '860点': 'toeic-860',
  'TOEIC 860点': 'toeic-860',
  'TOEIC860点': 'toeic-860',
  '900点以上': 'toeic-900',
  '900点': 'toeic-900',
  'TOEIC 900点以上': 'toeic-900',
  'TOEIC900点以上': 'toeic-900',
};

/**
 * 内部IDからも旧表示名からも現在のコースを特定できなかったときの表示。
 * 記録があったことは伝えつつ、当時の検定名は画面へ出さない。
 */
export const UNKNOWN_COURSE_LABEL = '以前のコース';

/**
 * 保存データから読んだコースを、いま画面へ出してよい名前へ解決する。
 *
 * コース名を画面へ出すところは、必ずこの関数を通す（解決処理の正本）。
 * 優先順は、内部ID → 旧表示名の読み替え → 現在の表示名との一致 →「以前のコース」。
 * 保存された文字列をそのまま画面へ出すことはしない。
 *
 * 空文字を返すのは、コースが記録されていないときだけ。
 * 呼び出し側が「未選択」などの文言を選べるようにしてある。
 */
export function resolveCourseLabel(
  courseId: string | null | undefined,
  savedLabel?: string | null,
): string {
  const byId = findCourse(courseId);
  if (byId) return courseDisplayLabel(byId);

  const label = (savedLabel ?? '').trim();
  if (label === '') return '';

  const legacy = findCourse(LEGACY_COURSE_LABEL_IDS[label]);
  if (legacy) return courseDisplayLabel(legacy);

  // ステップ別の label は「ステップ1」が2つあって一意に決まらないので、
  // 名前からの照合は学年別・社会人だけにする。
  const current = COURSES.find(
    (course) => course.categoryId !== 'exam' && course.label === label,
  );
  if (current) return courseDisplayLabel(current);

  return UNKNOWN_COURSE_LABEL;
}

/**
 * コースが使う語を返す。コース名から語を引くのはここだけ。
 *
 * 選択中のコースが無い、または保存データに古い・未知のコースIDが残っている場合は、
 * 既定のセットで遊べるようにする。ここで例外を投げると、
 * 過去の保存データを持っている人がカルタを始められなくなる。
 *
 * 定義済みコースが存在しない語彙セットを指していた場合は別で、
 * それは設定ミスなので既定セットへ黙って戻さず、pairsInSet がその場で止める。
 */
export function pairsForCourse(courseId: string | null | undefined): WordPair[] {
  const course = findCourse(courseId);
  return pairsInSet(course ? course.vocabularySetId : DEFAULT_VOCABULARY_SET_ID);
}
