import { describe, expect, it } from 'vitest';
import {
  AGE_GROUP_COLOR,
  AGE_GROUP_LABEL,
  AVATARS,
  AVATAR_AGE_GROUPS,
  ROSTER_VERSION,
  avatarsByAgeGroup,
  displayName,
  enabledAvatars,
  findAvatar,
  fullName,
  fullNameKana,
  isValidAvatarId,
  type AvatarAgeGroup,
} from '../data/avatars';

describe('80人の正式名簿', () => {
  it('総数は80人', () => {
    expect(AVATARS).toHaveLength(80);
    expect(enabledAvatars()).toHaveLength(80);
  });

  it('IDは80種類すべて一意', () => {
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(80);
  });

  it('姓名は80種類すべて一意', () => {
    expect(new Set(AVATARS.map(fullName)).size).toBe(80);
  });

  it('年代は5種類で、それぞれ16人', () => {
    expect(AVATAR_AGE_GROUPS).toHaveLength(5);
    for (const age of AVATAR_AGE_GROUPS) {
      expect(avatarsByAgeGroup(age)).toHaveLength(16);
    }
  });

  it('各年代で m が8人、f が8人', () => {
    for (const age of AVATAR_AGE_GROUPS) {
      const group = avatarsByAgeGroup(age);
      expect(group.filter((a) => a.presentation === 'm')).toHaveLength(8);
      expect(group.filter((a) => a.presentation === 'f')).toHaveLength(8);
    }
  });

  it('正式名・かな・ローマ字がすべて空でない', () => {
    for (const a of AVATARS) {
      expect(a.familyName.trim().length).toBeGreaterThan(0);
      expect(a.givenName.trim().length).toBeGreaterThan(0);
      expect(a.familyNameKana.trim().length).toBeGreaterThan(0);
      expect(a.givenNameKana.trim().length).toBeGreaterThan(0);
      expect(a.romanizedName.trim().length).toBeGreaterThan(0);
    }
  });

  it('表示順がコンセプトシートと一致する（各年代・各分類で 1〜8、IDの末尾と同じ）', () => {
    for (const age of AVATAR_AGE_GROUPS) {
      for (const presentation of ['m', 'f'] as const) {
        const group = avatarsByAgeGroup(age)
          .filter((a) => a.presentation === presentation)
          .sort((x, y) => x.order - y.order);
        expect(group.map((a) => a.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        for (const a of group) {
          const parts = a.id.split('-');
          expect(Number(parts[parts.length - 1])).toBe(a.order);
          expect(a.id).toBe(`${age}-${presentation}-${String(a.order).padStart(2, '0')}`);
        }
      }
    }
  });

  it('名簿の並びはシートの読み順（m-01..m-08 のあと f-01..f-08）', () => {
    const expected: string[] = [];
    for (const age of AVATAR_AGE_GROUPS) {
      for (const p of ['m', 'f'] as const) {
        for (let i = 1; i <= 8; i += 1) expected.push(`${age}-${p}-${String(i).padStart(2, '0')}`);
      }
    }
    expect(AVATARS.map((a) => a.id)).toEqual(expected);
  });

  it('本番立ち絵は未納品なので imageKey は全員 null', () => {
    expect(AVATARS.every((a) => a.imageKey === null)).toBe(true);
  });

  it('全員が有効', () => {
    expect(AVATARS.every((a) => a.enabled)).toBe(true);
  });

  it('名簿の版を公開している', () => {
    expect(ROSTER_VERSION).toBe(1);
  });
});

describe('名簿の参照', () => {
  it('IDから引ける', () => {
    const first = AVATARS[0];
    expect(findAvatar(first.id)?.id).toBe(first.id);
    expect(findAvatar('elementary-m-01')?.familyName).toBe('青山');
  });

  it('未知IDは undefined', () => {
    expect(findAvatar('does-not-exist')).toBeUndefined();
    expect(findAvatar(null)).toBeUndefined();
    expect(findAvatar(undefined)).toBeUndefined();
  });

  it('IDの妥当性を判定できる', () => {
    expect(isValidAvatarId('adult-f-08')).toBe(true);
    expect(isValidAvatarId('adult-f-99')).toBe(false);
    expect(isValidAvatarId(42)).toBe(false);
    expect(isValidAvatarId(null)).toBe(false);
  });

  it('会話では下の名前、プロフィールでは姓名を出す', () => {
    const a = findAvatar('elementary-m-01')!;
    expect(displayName(a)).toBe('陽翔');
    expect(fullName(a)).toBe('青山陽翔');
    expect(fullNameKana(a)).toBe('あおやま はると');
  });

  it('年代のラベルと色がすべての年代に用意されている', () => {
    for (const age of AVATAR_AGE_GROUPS) {
      expect(AGE_GROUP_LABEL[age as AvatarAgeGroup].length).toBeGreaterThan(0);
      expect(AGE_GROUP_COLOR[age as AvatarAgeGroup]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
