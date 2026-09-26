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

/** 年代×見た目区分の10区分。基準画像のファイルはこの10種類ぶん必ず残す。 */
const DIVISIONS: readonly string[] = AVATAR_AGE_GROUPS.flatMap((age) =>
  PRESENTATIONS.map((p) => `${age}-${p}`),
);

/** 個別画像へ切り替え済みの区分。ここが増えるたびに更新する。 */
const INDIVIDUAL_DIVISIONS: readonly string[] = ['elementary-m'];

/** 個別画像を持つ人のID。 */
const INDIVIDUAL_IDS: readonly string[] = INDIVIDUAL_DIVISIONS.flatMap((d) =>
  Array.from({ length: 8 }, (_, i) => `${d}-${String(i + 1).padStart(2, '0')}`),
);

/** まだ共有のままの区分。 */
const SHARED_DIVISIONS: readonly string[] = DIVISIONS.filter(
  (d) => !INDIVIDUAL_DIVISIONS.includes(d),
);

/** いま実際に使われるキーの集合（個別8 + 共有9 = 17）。 */
const EXPECTED_USED_KEYS: readonly string[] = [...INDIVIDUAL_IDS, ...SHARED_DIVISIONS];

/** 置いてあるべき画像ファイルのキー（基準10 + 個別8 = 18）。 */
const EXPECTED_KEYS: readonly string[] = [...DIVISIONS, ...INDIVIDUAL_IDS];

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
  it('基準10枚＋個別8枚の18枚があり、余計なファイルが混ざっていない', () => {
    expect(baseNames(SOURCE_PNG)).toEqual(EXPECTED_KEYS.map((k) => `${k}.png`).sort());
  });

  for (const key of EXPECTED_KEYS) {
    it(`${key}.png が保管されている`, () => {
      expect(baseNames(SOURCE_PNG)).toContain(`${key}.png`);
    });
  }
});

describe('配信用WebP', () => {
  it('基準10枚＋個別8枚の18枚があり、余計なファイルが混ざっていない', () => {
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
  it('使われているキーの集合が、個別8＋共有9の17種類と完全一致する', () => {
    const used = new Set(AVATARS.map((a) => a.imageKey));
    expect([...used].sort()).toEqual([...EXPECTED_USED_KEYS].sort());
    expect(used.size).toBe(17);
  });

  it('80人全員に imageKey が入っている', () => {
    expect(AVATARS).toHaveLength(80);
    expect(AVATARS.filter((a) => a.imageKey === null)).toHaveLength(0);
  });

  for (const key of SHARED_DIVISIONS) {
    it(`共有キー ${key} を使うのはちょうど8人`, () => {
      expect(AVATARS.filter((a) => a.imageKey === key)).toHaveLength(8);
    });
  }

  for (const id of INDIVIDUAL_IDS) {
    it(`個別キー ${id} を使うのはちょうど1人で、本人だけ`, () => {
      const users = AVATARS.filter((a) => a.imageKey === id);
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe(id);
    });
  }

  it('年代×見た目区分とキーの対応が正しい', () => {
    for (const avatar of AVATARS) {
      const division = baseImageKey(avatar.ageGroup, avatar.presentation);
      if (INDIVIDUAL_DIVISIONS.includes(division)) {
        // 個別画像がある区分は、自分のIDと同じキー。
        expect(avatar.imageKey).toBe(avatar.id);
        expect(avatar.imageKey?.startsWith(`${division}-`)).toBe(true);
      } else {
        expect(avatar.imageKey).toBe(division);
      }
    }
  });

  it('個別キーは、その区分の人以外へ付いていない', () => {
    for (const avatar of AVATARS) {
      if (INDIVIDUAL_IDS.includes(avatar.imageKey as string)) {
        expect(avatar.id).toBe(avatar.imageKey);
        expect(avatar.ageGroup).toBe('elementary');
        expect(avatar.presentation).toBe('m');
      }
    }
  });

  it('小学生mの8人が共有キーへ戻っていない', () => {
    const em = AVATARS.filter((a) => a.ageGroup === 'elementary' && a.presentation === 'm');
    expect(em).toHaveLength(8);
    expect(em.every((a) => a.imageKey === a.id)).toBe(true);
    expect(em.filter((a) => a.imageKey === 'elementary-m')).toHaveLength(0);
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

describe('旧基準画像は残すが、もう誰も使わない', () => {
  it('elementary-m.png と elementary-m.webp が残っている', () => {
    expect(baseNames(SOURCE_PNG)).toContain('elementary-m.png');
    expect(baseNames(PUBLIC_WEBP)).toContain('elementary-m.webp');
  });

  it('elementary-m を現在使用する人物は0人', () => {
    expect(AVATARS.filter((a) => a.imageKey === 'elementary-m')).toHaveLength(0);
  });

  it('基準画像10区分ぶんのファイルは、使われていなくても残す（復帰用）', () => {
    for (const division of DIVISIONS) {
      expect(baseNames(SOURCE_PNG), `${division}.png が無い`).toContain(`${division}.png`);
      expect(baseNames(PUBLIC_WEBP), `${division}.webp が無い`).toContain(`${division}.webp`);
    }
  });
});

describe('個別画像（小学生m）', () => {
  for (const id of INDIVIDUAL_IDS) {
    it(`${id} の原寸PNGと配信用WebPがある`, () => {
      expect(baseNames(SOURCE_PNG)).toContain(`${id}.png`);
      expect(baseNames(PUBLIC_WEBP)).toContain(`${id}.webp`);
    });
  }

  it('個別画像は8枚ちょうど', () => {
    const individual = baseNames(PUBLIC_WEBP).filter((n) => /^elementary-m-\d{2}\.webp$/.test(n));
    expect(individual).toHaveLength(8);
  });

  it('個別キーが他の年代・区分へ混ざっていない', () => {
    for (const id of INDIVIDUAL_IDS) {
      const owner = AVATARS.find((a) => a.id === id);
      expect(owner, `${id} が名簿にない`).toBeDefined();
      expect(owner?.ageGroup).toBe('elementary');
      expect(owner?.presentation).toBe('m');
    }
    // middle など他区分の人が個別キーを持っていないこと。
    const others = AVATARS.filter((a) => !(a.ageGroup === 'elementary' && a.presentation === 'm'));
    for (const a of others) {
      expect(INDIVIDUAL_IDS).not.toContain(a.imageKey as string);
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
