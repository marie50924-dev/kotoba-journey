import type { AvatarDefinition } from '../data/avatars';
import { shuffle } from './random';

/**
 * NPC の選出。
 *
 * 自分が選んだ1人を除いた79人が、長期的にまんべんなく登場するようにする。
 * DOM には一切触れない純粋関数で、seed を渡せば同じ並びを再現できる。
 */

export type CastScreen =
  | 'course'
  | 'map'
  | 'arrival'
  | 'wave-start'
  | 'wave-end'
  | 'result'
  | 'passport';

export interface CastContext {
  screen: CastScreen;
  /** 自分のキャラクター。絶対に NPC として選ばない。 */
  selectedAvatarId: string;
  /** 直近で出た順（新しい順）。連続登場を抑える。 */
  recentAvatarIds: string[];
  countryId?: string;
  courseId?: string;
  seed: number;
}

/** 画面ごとの登場人数。1画面に全79人は出さない。 */
export const CAST_SIZE_BY_SCREEN: Record<CastScreen, number> = {
  course: 1,
  map: 2,
  arrival: 2,
  'wave-start': 1,
  'wave-end': 1,
  result: 1,
  passport: 3,
};

/** 連続登場を抑える対象とする直近人数。 */
export const RECENT_WINDOW = 12;

export function castSizeFor(screen: CastScreen): number {
  return CAST_SIZE_BY_SCREEN[screen];
}

/**
 * 画面に出す NPC を選ぶ。
 *
 * - 自分のキャラクターは除外する
 * - 直近に出た人は後回しにする（候補が尽きたら使う）
 * - 同じ seed と同じ文脈なら同じ結果になる
 * - 候補が足りなくても例外を投げず、出せるだけ返す
 */
export function castNpcs(
  context: CastContext,
  roster: readonly AvatarDefinition[],
): AvatarDefinition[] {
  const wanted = castSizeFor(context.screen);
  if (wanted <= 0) return [];

  const available = roster.filter((a) => a.enabled && a.id !== context.selectedAvatarId);
  if (available.length === 0) return [];

  const recent = new Set(context.recentAvatarIds.slice(0, RECENT_WINDOW));

  // 画面と文脈ごとに並びを変え、同じ場所で毎回同じ顔にならないようにする。
  const seed = mixSeed(context);
  const fresh = shuffle(
    available.filter((a) => !recent.has(a.id)),
    seed,
  );
  const reused = shuffle(
    available.filter((a) => recent.has(a.id)),
    seed + 1,
  );

  // 直近に出ていない人を優先し、足りない分だけ直近の人から補う。
  return [...fresh, ...reused].slice(0, Math.min(wanted, available.length));
}

/** 直近リストを更新する。先頭が最新で、長さは RECENT_WINDOW に収める。 */
export function rememberCast(
  recentAvatarIds: readonly string[],
  castIds: readonly string[],
): string[] {
  const merged = [...castIds, ...recentAvatarIds.filter((id) => !castIds.includes(id))];
  return merged.slice(0, RECENT_WINDOW);
}

/** 画面・国・コース・seed を1つの整数へ混ぜる。 */
function mixSeed(context: CastContext): number {
  const text = `${context.screen}|${context.countryId ?? ''}|${context.courseId ?? ''}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash ^ Math.trunc(context.seed)) >>> 0;
}
