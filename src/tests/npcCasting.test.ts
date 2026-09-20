import { describe, expect, it } from 'vitest';
import { AVATARS, findAvatar } from '../data/avatars';
import {
  CAST_SIZE_BY_SCREEN,
  RECENT_WINDOW,
  castNpcs,
  castSizeFor,
  rememberCast,
  type CastContext,
  type CastScreen,
} from '../domain/npcCasting';

const ME = 'high-f-01';

function context(overrides: Partial<CastContext> = {}): CastContext {
  return {
    screen: 'course',
    selectedAvatarId: ME,
    recentAvatarIds: [],
    seed: 2024,
    ...overrides,
  };
}

const SCREENS: CastScreen[] = [
  'course',
  'map',
  'arrival',
  'wave-start',
  'wave-end',
  'result',
  'passport',
];

describe('NPC選出', () => {
  it('自分のキャラクターは絶対に選ばれない', () => {
    for (const screen of SCREENS) {
      for (let seed = 0; seed < 60; seed += 1) {
        const cast = castNpcs(context({ screen, seed }), AVATARS);
        expect(cast.some((a) => a.id === ME)).toBe(false);
      }
    }
  });

  it('画面ごとの人数に従い、1画面に全79人を出さない', () => {
    for (const screen of SCREENS) {
      const cast = castNpcs(context({ screen }), AVATARS);
      expect(cast).toHaveLength(CAST_SIZE_BY_SCREEN[screen]);
      expect(castSizeFor(screen)).toBe(CAST_SIZE_BY_SCREEN[screen]);
      expect(cast.length).toBeLessThanOrEqual(3);
    }
  });

  it('同じ人を同じ画面で重複して出さない', () => {
    const cast = castNpcs(context({ screen: 'passport' }), AVATARS);
    expect(new Set(cast.map((a) => a.id)).size).toBe(cast.length);
  });

  it('直近に出た人は後回しになる（連続登場の抑制）', () => {
    const first = castNpcs(context({ screen: 'course', seed: 11 }), AVATARS);
    const recent = first.map((a) => a.id);
    const second = castNpcs(
      context({ screen: 'course', seed: 11, recentAvatarIds: recent }),
      AVATARS,
    );
    expect(second.some((a) => recent.includes(a.id))).toBe(false);
  });

  it('直近リストが長くても、候補が残っていれば新しい人を出す', () => {
    const recent = AVATARS.filter((a) => a.id !== ME)
      .slice(0, RECENT_WINDOW)
      .map((a) => a.id);
    const cast = castNpcs(context({ recentAvatarIds: recent }), AVATARS);
    expect(cast).toHaveLength(1);
    expect(recent).not.toContain(cast[0].id);
  });

  it('候補が全員直近でも例外を投げず、誰かを返す', () => {
    const recent = AVATARS.filter((a) => a.id !== ME).map((a) => a.id);
    const cast = castNpcs(context({ recentAvatarIds: recent }), AVATARS);
    expect(cast).toHaveLength(1);
    expect(cast[0].id).not.toBe(ME);
  });

  it('候補が自分しかいなくても例外を投げず空を返す', () => {
    const onlyMe = AVATARS.filter((a) => a.id === ME);
    expect(castNpcs(context(), onlyMe)).toEqual([]);
  });

  it('名簿が空でも例外を投げない', () => {
    expect(castNpcs(context(), [])).toEqual([]);
  });

  it('同じ seed と同じ文脈なら再現できる', () => {
    const a = castNpcs(context({ screen: 'map', seed: 777 }), AVATARS);
    const b = castNpcs(context({ screen: 'map', seed: 777 }), AVATARS);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it('seed が違えば顔ぶれが変わる', () => {
    const a = castNpcs(context({ screen: 'map', seed: 1 }), AVATARS).map((x) => x.id);
    const b = castNpcs(context({ screen: 'map', seed: 2 }), AVATARS).map((x) => x.id);
    expect(a).not.toEqual(b);
  });

  it('同じ seed でも画面が違えば顔ぶれが変わる', () => {
    const a = castNpcs(context({ screen: 'course', seed: 5 }), AVATARS).map((x) => x.id);
    const b = castNpcs(context({ screen: 'result', seed: 5 }), AVATARS).map((x) => x.id);
    expect(a).not.toEqual(b);
  });

  it('国やコースが違えば顔ぶれが変わる', () => {
    const a = castNpcs(context({ screen: 'arrival', countryId: 'japan' }), AVATARS).map((x) => x.id);
    const b = castNpcs(context({ screen: 'arrival', countryId: 'london' }), AVATARS).map((x) => x.id);
    expect(a).not.toEqual(b);
  });

  it('長く回すと79人のうち多くが登場する（特定の人に偏らない）', () => {
    const seen = new Set<string>();
    let recent: string[] = [];
    for (let i = 0; i < 200; i += 1) {
      const cast = castNpcs(context({ screen: 'course', seed: i, recentAvatarIds: recent }), AVATARS);
      for (const a of cast) seen.add(a.id);
      recent = rememberCast(recent, cast.map((a) => a.id));
    }
    expect(seen.has(ME)).toBe(false);
    expect(seen.size).toBeGreaterThan(40);
  });

  it('年代や性別で登場できる人を制限しない', () => {
    const seen = new Set<string>();
    let recent: string[] = [];
    for (let i = 0; i < 300; i += 1) {
      const cast = castNpcs(context({ screen: 'passport', seed: i, recentAvatarIds: recent }), AVATARS);
      for (const a of cast) seen.add(a.id);
      recent = rememberCast(recent, cast.map((a) => a.id));
    }
    const ages = new Set([...seen].map((id) => findAvatar(id)!.ageGroup));
    const presentations = new Set([...seen].map((id) => findAvatar(id)!.presentation));
    expect(ages.size).toBe(5);
    expect(presentations.size).toBe(2);
  });
});

describe('直近リストの更新', () => {
  it('新しい人が先頭に来る', () => {
    expect(rememberCast(['a', 'b'], ['c'])).toEqual(['c', 'a', 'b']);
  });

  it('同じ人を重複させない', () => {
    expect(rememberCast(['a', 'b'], ['b'])).toEqual(['b', 'a']);
  });

  it('上限を超えない', () => {
    const long = Array.from({ length: 30 }, (_, i) => `id-${i}`);
    expect(rememberCast(long, ['new'])).toHaveLength(RECENT_WINDOW);
    expect(rememberCast(long, ['new'])[0]).toBe('new');
  });
});
