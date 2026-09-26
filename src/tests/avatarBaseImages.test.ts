import { describe, expect, it } from 'vitest';
import avatarCssInline from '../styles/avatar.css?inline';
import thumbSource from '../components/avatarThumb.ts?raw';
import {
  AGE_GROUP_IMAGE_BACKGROUND,
  AVATARS,
  AVATAR_AGE_GROUPS,
  avatarImageUrl,
  baseImageKey,
  isSafeImageKey,
  type AvatarAgeGroup,
  type AvatarPresentation,
} from '../data/avatars';

/**
 * 基準画像10枚の投入を検査する。
 *
 * 画像そのものの中身（顔・絵柄）は検査しない。中身のハッシュを固定すると、
 * あとで同じ絵を書き出し直しただけで落ちてしまう。ここで見るのは
 *   - 必要なファイルが、必要な形式・寸法で、必要な場所にあること
 *   - 名簿の10区分と画像の対応が取れていること
 *   - 名簿の既存の内容（氏名・ID・順番など）が変わっていないこと
 * の3点だけにする。
 */

const PRESENTATIONS: readonly AvatarPresentation[] = ['m', 'f'];

/** 年代×見た目区分の10キー。これが正本。 */
const EXPECTED_KEYS: readonly string[] = AVATAR_AGE_GROUPS.flatMap((age) =>
  PRESENTATIONS.map((p) => `${age}-${p}`),
);

/*
 * ファイルの列挙は Vite の glob で行う。
 * node:fs は、このプロジェクトに @types/node が入っていないため使えない
 * （新しい依存は足さない方針）。
 * 画像の実寸・透過・描画は、実ブラウザテストで naturalWidth などから確かめる。
 */
const SOURCE_PNG = import.meta.glob('../../assets-source/avatars/*.png');
const PUBLIC_WEBP = import.meta.glob('../../public/assets/avatars/*.webp');
const CHARACTER_WEBP = import.meta.glob('../../public/assets/characters/*.webp');

function baseNames(files: Record<string, unknown>): string[] {
  return Object.keys(files)
    .map((path) => path.slice(path.lastIndexOf('/') + 1))
    .sort();
}

describe('原寸PNGの保管', () => {
  it('10枚ちょうどあり、余計なファイルが混ざっていない', () => {
    expect(baseNames(SOURCE_PNG)).toEqual(EXPECTED_KEYS.map((k) => `${k}.png`).sort());
  });

  for (const key of EXPECTED_KEYS) {
    it(`${key}.png が保管されている`, () => {
      expect(baseNames(SOURCE_PNG)).toContain(`${key}.png`);
    });
  }
});

describe('配信用WebP', () => {
  it('10枚ちょうどあり、余計なファイルが混ざっていない', () => {
    expect(baseNames(PUBLIC_WEBP)).toEqual(EXPECTED_KEYS.map((k) => `${k}.webp`).sort());
  });

  for (const key of EXPECTED_KEYS) {
    it(`${key}.webp が配信用に置かれている`, () => {
      expect(baseNames(PUBLIC_WEBP)).toContain(`${key}.webp`);
    });
  }

  it('原寸PNGと配信用WebPが1対1で対応している', () => {
    expect(baseNames(SOURCE_PNG).map((n) => n.replace(/\.png$/, ''))).toEqual(
      baseNames(PUBLIC_WEBP).map((n) => n.replace(/\.webp$/, '')),
    );
  });
});

describe('名簿と画像の対応', () => {
  it('使われているキーの集合が、年代×見た目区分の10種類と完全一致する', () => {
    const used = new Set(AVATARS.map((a) => a.imageKey));
    expect([...used].sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('80人全員に imageKey が入っている', () => {
    expect(AVATARS).toHaveLength(80);
    expect(AVATARS.filter((a) => a.imageKey === null)).toHaveLength(0);
  });

  for (const key of EXPECTED_KEYS) {
    it(`${key} を使うのはちょうど8人`, () => {
      expect(AVATARS.filter((a) => a.imageKey === key)).toHaveLength(8);
    });
  }

  it('年代×見た目区分とキーの対応が正しい', () => {
    for (const avatar of AVATARS) {
      expect(avatar.imageKey).toBe(`${avatar.ageGroup}-${avatar.presentation}`);
      expect(avatar.imageKey).toBe(baseImageKey(avatar.ageGroup, avatar.presentation));
    }
  });

  it('キーはすべて安全な形式', () => {
    for (const avatar of AVATARS) {
      expect(isSafeImageKey(avatar.imageKey), `${avatar.id}: ${avatar.imageKey}`).toBe(true);
    }
  });

  it('imageKey に対応する WebP が必ず存在する', () => {
    const names = baseNames(PUBLIC_WEBP);
    for (const key of new Set(AVATARS.map((a) => a.imageKey))) {
      expect(names, `${key}.webp が無い`).toContain(`${key}.webp`);
    }
  });

  it('URL は BASE_URL を通し、キーと拡張子が1回ずつ入る', () => {
    for (const avatar of AVATARS) {
      const url = avatarImageUrl(avatar) as string;
      expect(url.startsWith(import.meta.env.BASE_URL)).toBe(true);
      expect(url).toBe(`${import.meta.env.BASE_URL}assets/avatars/${avatar.imageKey}.webp`);
      expect(url.match(/\.webp/g)).toHaveLength(1);
    }
  });
});

describe('中学生は middle で、junior と混同しない', () => {
  it('名簿の年代IDに junior が無い', () => {
    expect(AVATAR_AGE_GROUPS).toContain('middle');
    expect(AVATAR_AGE_GROUPS as readonly string[]).not.toContain('junior');
  });

  it('中学生のキーとファイルは middle-m / middle-f', () => {
    const middles = AVATARS.filter((a) => a.ageGroup === 'middle');
    expect(middles).toHaveLength(16);
    expect(new Set(middles.map((a) => a.imageKey))).toEqual(new Set(['middle-m', 'middle-f']));
    for (const key of ['middle-m', 'middle-f']) {
      expect(baseNames(PUBLIC_WEBP)).toContain(`${key}.webp`);
    }
  });

  it('主人公の画像に junior という名前のファイルを作っていない', () => {
    expect(baseNames(PUBLIC_WEBP).filter((n) => n.startsWith('junior'))).toHaveLength(0);
  });

  it('旅の情景イラスト側の junior.webp は残っている（別系統なので消さない）', () => {
    expect(baseNames(CHARACTER_WEBP)).toContain('junior.webp');
  });
});

describe('年代別の淡色背景', () => {
  const EXPECTED_BACKGROUND: Record<AvatarAgeGroup, string> = {
    elementary: '#f8d2b8',
    middle: '#bfe5d6',
    high: '#c7ddec',
    university: '#dfd0ef',
    adult: '#e7c8c0',
  };

  it('5年代ぶん、指定どおりの色が定義されている', () => {
    expect(AGE_GROUP_IMAGE_BACKGROUND).toEqual(EXPECTED_BACKGROUND);
  });

  it('5色ともすべて違う色', () => {
    expect(new Set(Object.values(AGE_GROUP_IMAGE_BACKGROUND)).size).toBe(5);
  });

  it('仮サムネイルの年代色とは別の色で、そちらは変更していない', () => {
    const fallbackColors = {
      elementary: '#e2703a',
      middle: '#2f8f6b',
      high: '#2f6f9e',
      university: '#8a5cc0',
      adult: '#b3543f',
    };
    for (const age of AVATAR_AGE_GROUPS) {
      expect(AGE_GROUP_IMAGE_BACKGROUND[age]).not.toBe(fallbackColors[age]);
    }
  });

  it('色は年代から決まり、名前や並び順には依存しない', () => {
    // 受け取るのは年代だけ。名前・ID・順番を読んでいないこと。
    expect(thumbSource).toContain('AGE_GROUP_IMAGE_BACKGROUND[avatar.ageGroup]');
  });

  it('画面ごとに色を書かず、データ側の1か所だけで定義している', () => {
    for (const hex of Object.values(EXPECTED_BACKGROUND)) {
      const inCss = avatarCssInline ? String(avatarCssInline).includes(hex) : false;
      expect(inCss, `${hex} が CSS に直書きされている`).toBe(false);
      expect(thumbSource.includes(hex), `${hex} が画面側に直書きされている`).toBe(false);
    }
  });

  it('成功時の円の地色として、その色が使われている', () => {
    const css = String(avatarCssInline);
    expect(css).toMatch(
      /\.avatar-thumb__face\.has-image\s*\{[^}]*background\s*:\s*var\(--age-image-bg/,
    );
    expect(thumbSource).toContain('--age-image-bg:');
  });
});

describe('既存の名簿が変わっていない', () => {
  it('人数・ID・氏名・年代・見た目区分・順番はそのまま', () => {
    expect(AVATARS).toHaveLength(80);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(80);
    for (const avatar of AVATARS) {
      expect(avatar.id).toBe(`${avatar.ageGroup}-${avatar.presentation}-${String(avatar.order).padStart(2, '0')}`);
      expect(avatar.familyName.length).toBeGreaterThan(0);
      expect(avatar.givenName.length).toBeGreaterThan(0);
      expect(avatar.order).toBeGreaterThanOrEqual(1);
      expect(avatar.order).toBeLessThanOrEqual(8);
    }
  });

  it('全員が有効のまま', () => {
    expect(AVATARS.filter((a) => !a.enabled)).toHaveLength(0);
  });

  it('各年代16人ずつ、各区分8人ずつ', () => {
    for (const age of AVATAR_AGE_GROUPS) {
      expect(AVATARS.filter((a) => a.ageGroup === age)).toHaveLength(16);
      for (const p of PRESENTATIONS) {
        expect(AVATARS.filter((a) => a.ageGroup === age && a.presentation === p)).toHaveLength(8);
      }
    }
  });
});

describe('未設定・失敗時の仕組みを壊していない', () => {
  it('imageKey が null なら URL を作らない（仮サムネイルへ落ちる）', () => {
    expect(avatarImageUrl({ imageKey: null })).toBeNull();
  });

  it('安全でないキーなら URL を作らない', () => {
    for (const key of ['elementary-m.webp', '../x', 'a/b', 'A']) {
      expect(avatarImageUrl({ imageKey: key })).toBeNull();
    }
  });

  it('成功・失敗の切り替えが残っている', () => {
    expect(thumbSource).toContain("face.classList.add('has-image')");
    expect(thumbSource).toContain("face.classList.add('image-failed')");
  });

  it('失敗時は画像だけを消し、枠は残す', () => {
    const css = String(avatarCssInline);
    expect(css).toMatch(
      /\.avatar-thumb__face\.image-failed\s+\.avatar-thumb__img\s*\{[^}]*display\s*:\s*none/,
    );
    expect(css).not.toMatch(/^\.avatar-thumb__face\.image-failed\s*\{[^}]*display\s*:\s*none/m);
  });

  it('破線は、画像が無いときだけ出る', () => {
    const css = String(avatarCssInline);
    expect(css).toMatch(/\.avatar-thumb__face\s*\{[^}]*border\s*:[^;]*dashed/);
    expect(css).toMatch(/\.avatar-thumb__face\.has-image\s*\{[^}]*border-style\s*:\s*none/);
  });

  it('96 / 58 / 40px の寸法は変えていない', () => {
    const css = String(avatarCssInline);
    for (const [cls, px] of [['lg', '96px'], ['md', '58px'], ['sm', '40px']] as const) {
      expect(css).toMatch(
        new RegExp(`\\.avatar-thumb--${cls} \\.avatar-thumb__face\\s*\\{[^}]*width:\\s*${px}`),
      );
    }
  });
});
