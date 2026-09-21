/**
 * 年齢層別メインキャラクター。
 *
 * 画像は採用済みの Gemini 作成イラストから作った派生ファイルで、
 * 顔・髪型・体格・年齢感・服装の基本形には一切手を加えていない。
 * 原寸 JPEG は assets-source/characters/ に無改変で保管してある。
 *
 * Phase 1 統合以降、主人公は80人名簿から選ぶ方式に一本化した。
 * ここに残る年齢層は「旅の情景イラスト」を選ぶためだけに使い、
 * コースとは連動させない。プレイヤー本人の性別や個人情報は尋ねない。
 */

import type { Course } from './courses';

export type AgeGroup = 'elementary' | 'junior' | 'high' | 'university' | 'adult';

/** 年齢層が未設定の状態。ステップ別のコースでは大人へフォールバックする。 */
export type SelectedAgeGroup = AgeGroup | null;

/** 年齢設定がないときの既定。 */
export const DEFAULT_AGE_GROUP: AgeGroup = 'adult';

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export interface AgeGroupCharacters {
  id: AgeGroup;
  /** 画面に出す呼称。 */
  label: string;
  /** 男女2人の紹介。 */
  description: string;
  /** 配信用のカード画像。 */
  image: string;
  /** 由来の採用素材。報告と差し替えのために残す。 */
  sourceFile: string;
}

export const AGE_GROUPS: readonly AgeGroupCharacters[] = [
  {
    id: 'elementary',
    label: '小学生',
    description: 'ランドセルの2人と、身のまわりのことばを集めます。',
    image: assetUrl('assets/characters/elementary.webp'),
    sourceFile: 'character-age-groups-reference.jpeg（左上）',
  },
  {
    id: 'junior',
    label: '中学生',
    description: '制服の2人と、学校や毎日のことばを集めます。',
    image: assetUrl('assets/characters/junior.webp'),
    sourceFile: 'character-age-groups-reference.jpeg（右上）',
  },
  {
    id: 'high',
    label: '高校生',
    description: '通学路の2人と、広がっていくことばを集めます。',
    image: assetUrl('assets/characters/high.webp'),
    sourceFile: 'character-highschool-pair.jpeg',
  },
  {
    id: 'university',
    label: '大学生',
    description: 'キャンパスの2人と、専門のことばまで広げます。',
    image: assetUrl('assets/characters/university.webp'),
    sourceFile: 'character-university-pair.jpeg',
  },
  {
    id: 'adult',
    label: '大人',
    description: '街ではたらく2人と、仕事や旅のことばを集めます。',
    image: assetUrl('assets/characters/adult.webp'),
    sourceFile: 'character-age-groups-reference.jpeg（右下）',
  },
];

export function findAgeGroup(id: SelectedAgeGroup): AgeGroupCharacters | undefined {
  if (!id) return undefined;
  return AGE_GROUPS.find((g) => g.id === id);
}

export function isAgeGroup(value: unknown): value is AgeGroup {
  return AGE_GROUPS.some((g) => g.id === value);
}

/** 学年コースIDと年齢層の対応。 */
const AGE_GROUP_BY_COURSE_ID: Record<string, AgeGroup> = {
  'grade-elementary': 'elementary',
  'grade-junior': 'junior',
  'grade-high': 'high',
  'grade-university': 'university',
};

/**
 * コースから表示する年齢層を決める。
 *
 * - 学年別    : その学年の年齢層
 * - 社会人    : 大人
 * - ステップ別: 保存済みの年齢設定があればそれ、無ければ大人へ安全に落とす
 *
 * course が未指定でも例外にせず、既定（大人）を返す。
 */
export function ageGroupForCourse(
  course: Course | undefined,
  savedAgeGroup: SelectedAgeGroup = null,
): AgeGroup {
  if (!course) return savedAgeGroup ?? DEFAULT_AGE_GROUP;

  const byGrade = AGE_GROUP_BY_COURSE_ID[course.id];
  if (byGrade) return byGrade;

  if (course.categoryId === 'business') return 'adult';

  // ステップ別は年齢が決まらないので、任意設定があればそれを使う。
  return savedAgeGroup ?? DEFAULT_AGE_GROUP;
}

/** そのコースで年齢層の任意設定が効くか（ステップ別のみ）。 */
export function usesSavedAgeGroup(course: Course | undefined): boolean {
  if (!course) return true;
  if (AGE_GROUP_BY_COURSE_ID[course.id]) return false;
  return course.categoryId !== 'business';
}

/**
 * 80人方式の年代IDから、旅の情景イラストの年代を引く。
 *
 * Phase 1 統合で主人公は80人から選ぶ方式へ変わったため、
 * 旅の移動画面と国紹介で使う正式イラストは、コースではなく
 * 「選んだキャラクターの年代」に合わせて選ぶ。
 * 名簿側は 'middle'、イラスト側は 'junior' と呼び名が違うのでここで橋渡しする。
 */
const AGE_GROUP_BY_AVATAR_AGE: Record<string, AgeGroup> = {
  elementary: 'elementary',
  middle: 'junior',
  high: 'high',
  university: 'university',
  adult: 'adult',
};

export function ageGroupFromAvatarAgeGroup(avatarAgeGroup: string | undefined): AgeGroup {
  return AGE_GROUP_BY_AVATAR_AGE[avatarAgeGroup ?? ''] ?? DEFAULT_AGE_GROUP;
}
