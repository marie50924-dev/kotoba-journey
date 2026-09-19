/** コース定義。学習データと表示ラベルはここにまとめ、ロジック側へ散在させない。 */

export type CourseCategoryId = 'grade' | 'exam' | 'business';

export interface Course {
  id: string;
  label: string;
  categoryId: CourseCategoryId;
  /** 資格・試験のようにグループ分けが必要な場合の見出し。 */
  group?: string;
}

export interface CourseCategory {
  id: CourseCategoryId;
  label: string;
  description: string;
}

export const COURSE_CATEGORIES: readonly CourseCategory[] = [
  { id: 'grade', label: '学年別', description: '小学生から大学生まで' },
  { id: 'exam', label: '資格・試験', description: '英検・TOEIC目標から選ぶ' },
  { id: 'business', label: '社会人', description: '日常・旅行・仕事の場面から' },
];

export const COURSES: readonly Course[] = [
  { id: 'grade-elementary', label: '小学生', categoryId: 'grade' },
  { id: 'grade-junior', label: '中学生', categoryId: 'grade' },
  { id: 'grade-high', label: '高校生', categoryId: 'grade' },
  { id: 'grade-university', label: '大学生', categoryId: 'grade' },

  { id: 'eiken-5', label: '5級', categoryId: 'exam', group: '英検' },
  { id: 'eiken-4', label: '4級', categoryId: 'exam', group: '英検' },
  { id: 'eiken-3', label: '3級', categoryId: 'exam', group: '英検' },
  { id: 'eiken-pre2', label: '準2級', categoryId: 'exam', group: '英検' },
  { id: 'eiken-pre2-plus', label: '準2級プラス', categoryId: 'exam', group: '英検' },
  { id: 'eiken-2', label: '2級', categoryId: 'exam', group: '英検' },
  { id: 'eiken-pre1', label: '準1級', categoryId: 'exam', group: '英検' },
  { id: 'eiken-1', label: '1級', categoryId: 'exam', group: '英検' },

  { id: 'toeic-400', label: '400点', categoryId: 'exam', group: 'TOEIC目標' },
  { id: 'toeic-500', label: '500点', categoryId: 'exam', group: 'TOEIC目標' },
  { id: 'toeic-600', label: '600点', categoryId: 'exam', group: 'TOEIC目標' },
  { id: 'toeic-730', label: '730点', categoryId: 'exam', group: 'TOEIC目標' },
  { id: 'toeic-860', label: '860点', categoryId: 'exam', group: 'TOEIC目標' },
  { id: 'toeic-900', label: '900点以上', categoryId: 'exam', group: 'TOEIC目標' },

  { id: 'biz-daily', label: '日常英会話', categoryId: 'business' },
  { id: 'biz-travel', label: '海外旅行', categoryId: 'business' },
  { id: 'biz-business', label: 'ビジネス', categoryId: 'business' },
  { id: 'biz-hospitality', label: '接客・観光', categoryId: 'business' },
  { id: 'biz-care', label: '医療・介護', categoryId: 'business' },
  { id: 'biz-it', label: 'IT・仕事', categoryId: 'business' },
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
