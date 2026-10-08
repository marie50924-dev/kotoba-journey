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
const INDIVIDUAL_DIVISIONS: readonly string[] = [
  'elementary-m',
  'elementary-f',
  'middle-m',
  'middle-f',
  'high-m',
  'high-f',
  'university-m',
  'university-f',
  'adult-m',
  'adult-f',
];

/** 個別画像を持つ人のID。 */
const INDIVIDUAL_IDS: readonly string[] = INDIVIDUAL_DIVISIONS.flatMap((d) =>
  Array.from({ length: 8 }, (_, i) => `${d}-${String(i + 1).padStart(2, '0')}`),
);

/** まだ共有のままの区分。 */
const SHARED_DIVISIONS: readonly string[] = DIVISIONS.filter(
  (d) => !INDIVIDUAL_DIVISIONS.includes(d),
);

/** いま実際に使われるキーの集合（個別 = 切替済み区分 × 8人 + 共有 = 残りの区分）。 */
const EXPECTED_USED_KEYS: readonly string[] = [...INDIVIDUAL_IDS, ...SHARED_DIVISIONS];

/** 置いてあるべき画像ファイルのキー（基準10区分 + 個別化済みの全員ぶん）。 */
const EXPECTED_KEYS: readonly string[] = [...DIVISIONS, ...INDIVIDUAL_IDS];

/*
 * 名簿のキーに対応しない、差し替え用の配信ファイル。
 *
 * 描き直しを受け取った人は `<imageKey>.webp` とは別名のファイルを読む。
 * そのファイルをここで名指しして認める。
 * ここに無いファイルが public/assets/avatars/ に増えたら、下の検査が落ちる
 * （「余計なファイルが混ざっていない」という保証はそのまま効く）。
 */
const EXTRA_WEBP: readonly string[] = ['elementary-f-03-replacement-v1-light-v1.webp'];

/*
 * 名簿のキーに対応しない、保管だけしている原寸PNG。
 *
 * 差し替え用の配信ファイル（EXTRA_WEBP）の元になったPNG。
 * 配信物には入れたくないので public/ ではなく assets-source/ に置く。
 * 上の EXTRA_WEBP と同じ考え方で、ここに名指ししたものだけを認める。
 * ここに無いファイルが assets-source/avatars/ に増えたら、下の検査が落ちる
 * （「余計なファイルが混ざっていない」という保証はそのまま効く）。
 */
const EXTRA_SOURCE_PNG: readonly string[] = ['elementary-f-03-replacement-v1.png'];

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
  it('基準10枚と個別展開ぶん、それに名指しした保管用だけがあり、余計なファイルが混ざっていない', () => {
    expect(baseNames(SOURCE_PNG)).toEqual(
      [...EXPECTED_KEYS.map((k) => `${k}.png`), ...EXTRA_SOURCE_PNG].sort(),
    );
  });

  it('差し替え用の原寸PNGを、配信物に入れずに保管している', () => {
    for (const name of EXTRA_SOURCE_PNG) {
      // assets-source に在ること（消していない）。
      expect(baseNames(SOURCE_PNG), `${name} が保管されていない`).toContain(name);
      // public に無いこと（配信物へ混ぜない）。
      const 配信名 = name.replace(/\.png$/, '.webp');
      expect(baseNames(PUBLIC_WEBP), `${配信名} は配信用なので public に在ってよい`).toContain(
        'elementary-f-03-replacement-v1-light-v1.webp',
      );
    }
  });

  for (const key of EXPECTED_KEYS) {
    it(`${key}.png が保管されている`, () => {
      expect(baseNames(SOURCE_PNG)).toContain(`${key}.png`);
    });
  }
});

describe('配信用WebP', () => {
  it('基準10枚と個別展開ぶん、それに名指しした差し替え用だけがあり、余計なファイルが混ざっていない', () => {
    expect(baseNames(PUBLIC_WEBP)).toEqual(
      [...EXPECTED_KEYS.map((k) => `${k}.webp`), ...EXTRA_WEBP].sort(),
    );
  });

  for (const key of EXPECTED_KEYS) {
    it(`${key}.webp が配信用に置かれている`, () => {
      expect(baseNames(PUBLIC_WEBP)).toContain(`${key}.webp`);
    });
  }

  it('原寸PNGと配信用WebPが1対1で対応している（差し替え用と保管用は別枠）', () => {
    const webp = baseNames(PUBLIC_WEBP).filter((n) => !EXTRA_WEBP.includes(n));
    const png = baseNames(SOURCE_PNG).filter((n) => !EXTRA_SOURCE_PNG.includes(n));
    expect(png.map((n) => n.replace(/\.png$/, ''))).toEqual(
      webp.map((n) => n.replace(/\.webp$/, '')),
    );
  });

  it('差し替え用のファイルは、実際に対応表から読まれている（置きっぱなしにしない）', () => {
    const used = new Set(
      AVATARS.map((a) => avatarImageUrl(a))
        .filter((u): u is string => u !== null)
        .map((u) => u.slice(u.lastIndexOf('/') + 1)),
    );
    for (const name of EXTRA_WEBP) {
      expect(baseNames(PUBLIC_WEBP), `${name} が置かれていない`).toContain(name);
      expect(used, `${name} がどこからも読まれていない`).toContain(name);
    }
  });
});

describe('名簿と画像の対応', () => {
  it('使われているキーの集合が、個別80＋共有0の80種類と完全一致する', () => {
    const used = new Set(AVATARS.map((a) => a.imageKey));
    expect([...used].sort()).toEqual([...EXPECTED_USED_KEYS].sort());
    expect(used.size).toBe(INDIVIDUAL_DIVISIONS.length * 8 + SHARED_DIVISIONS.length);
    expect(used.size).toBe(80);
  });

  it('80人全員に imageKey が入っている', () => {
    expect(AVATARS).toHaveLength(80);
    expect(AVATARS.filter((a) => a.imageKey === null)).toHaveLength(0);
  });

  it('共有キーのままの区分はもう1つも残っていない', () => {
    expect(SHARED_DIVISIONS).toHaveLength(0);
    expect(INDIVIDUAL_DIVISIONS).toHaveLength(DIVISIONS.length);
    expect([...INDIVIDUAL_DIVISIONS].sort()).toEqual([...DIVISIONS].sort());
  });

  for (const key of DIVISIONS) {
    it(`共有キー ${key} を使う人物は0人`, () => {
      expect(AVATARS.filter((a) => a.imageKey === key)).toHaveLength(0);
    });
  }

  it('80人全員の imageKey が自分のIDと一致する', () => {
    expect(AVATARS).toHaveLength(80);
    for (const avatar of AVATARS) {
      expect(avatar.imageKey, `${avatar.id} のキーが本人IDと違う`).toBe(avatar.id);
    }
    expect(AVATARS.filter((a) => a.imageKey === a.id)).toHaveLength(80);
  });

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

  it('個別キーは、本人以外へ付いていない', () => {
    for (const avatar of AVATARS) {
      if (INDIVIDUAL_IDS.includes(avatar.imageKey as string)) {
        expect(avatar.id).toBe(avatar.imageKey);
        // キーの区分と、その人の区分が一致すること。
        expect(baseImageKey(avatar.ageGroup, avatar.presentation)).toBe(
          (avatar.imageKey as string).slice(0, (avatar.imageKey as string).lastIndexOf('-')),
        );
      }
    }
  });

  for (const division of INDIVIDUAL_DIVISIONS) {
    it(`${division} の8人が共有キーへ戻っていない`, () => {
      const members = AVATARS.filter(
        (a) => baseImageKey(a.ageGroup, a.presentation) === division,
      );
      expect(members).toHaveLength(8);
      expect(members.every((a) => a.imageKey === a.id)).toBe(true);
      expect(members.filter((a) => a.imageKey === division)).toHaveLength(0);
    });
  }

  it('m区分の人へ f 区分の個別キーが付いていない（逆も同じ）', () => {
    for (const avatar of AVATARS) {
      const key = avatar.imageKey as string;
      if (avatar.presentation === 'm') {
        expect(key.includes('-f-'), `${avatar.id} に ${key}`).toBe(false);
      } else {
        expect(key.includes('-m-'), `${avatar.id} に ${key}`).toBe(false);
      }
    }
  });

  it('自分の年代と違う年代の個別キーが付いていない', () => {
    for (const avatar of AVATARS) {
      const key = avatar.imageKey as string;
      if (!INDIVIDUAL_IDS.includes(key)) continue;
      expect(key.startsWith(`${avatar.ageGroup}-`), `${avatar.id} に ${key}`).toBe(true);
    }
  });

  it('中学生以外へ middle-m-* が付いていない', () => {
    for (const avatar of AVATARS) {
      if (avatar.ageGroup === 'middle') continue;
      expect((avatar.imageKey as string).startsWith('middle-m-')).toBe(false);
    }
  });

  it('presentation=f の人へ m 区分の個別キーが付いていない', () => {
    for (const avatar of AVATARS.filter((a) => a.presentation === 'f')) {
      expect((avatar.imageKey as string).includes('-m-')).toBe(false);
    }
  });

  it('中学生mへ小学生の個別キーが付いていない', () => {
    for (const avatar of AVATARS.filter((a) => a.ageGroup === 'middle' && a.presentation === 'm')) {
      expect((avatar.imageKey as string).startsWith('elementary-')).toBe(false);
    }
  });

  it('中学生以外へ middle-f-* が付いていない', () => {
    for (const avatar of AVATARS) {
      if (avatar.ageGroup === 'middle') continue;
      expect((avatar.imageKey as string).startsWith('middle-f-')).toBe(false);
    }
  });

  it("presentation='m' の人へ middle-f-* が付いていない", () => {
    for (const avatar of AVATARS.filter((a) => a.presentation === 'm')) {
      expect((avatar.imageKey as string).startsWith('middle-f-')).toBe(false);
    }
  });

  it('中学生fへ、別の年代・別の区分の個別キーが付いていない', () => {
    for (const avatar of AVATARS.filter((a) => a.ageGroup === 'middle' && a.presentation === 'f')) {
      // 自分の区分の個別キー以外は受け付けない。
      expect((avatar.imageKey as string).startsWith('middle-f-')).toBe(true);
      expect((avatar.imageKey as string).startsWith('elementary-')).toBe(false);
      expect((avatar.imageKey as string).includes('-m-')).toBe(false);
    }
  });

  it('高校生以外へ high-m-* が付いていない', () => {
    for (const avatar of AVATARS) {
      if (avatar.ageGroup === 'high') continue;
      expect((avatar.imageKey as string).startsWith('high-m-')).toBe(false);
    }
  });

  it("presentation='f' の人へ high-m-* が付いていない", () => {
    for (const avatar of AVATARS.filter((a) => a.presentation === 'f')) {
      expect((avatar.imageKey as string).startsWith('high-m-')).toBe(false);
    }
  });

  it('高校生mへ、別の年代・別の区分の個別キーが付いていない', () => {
    for (const avatar of AVATARS.filter((a) => a.ageGroup === 'high' && a.presentation === 'm')) {
      expect((avatar.imageKey as string).startsWith('high-m-')).toBe(true);
      expect((avatar.imageKey as string).startsWith('elementary-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('middle-')).toBe(false);
      expect((avatar.imageKey as string).includes('-f-')).toBe(false);
    }
  });

  it('高校生以外へ high-f-* が付いていない', () => {
    for (const avatar of AVATARS) {
      if (avatar.ageGroup === 'high') continue;
      expect((avatar.imageKey as string).startsWith('high-f-')).toBe(false);
    }
  });

  it("presentation='m' の人へ high-f-* が付いていない", () => {
    for (const avatar of AVATARS.filter((a) => a.presentation === 'm')) {
      expect((avatar.imageKey as string).startsWith('high-f-')).toBe(false);
    }
  });

  it('高校生fへ、別の年代・別の区分の個別キーが付いていない', () => {
    for (const avatar of AVATARS.filter((a) => a.ageGroup === 'high' && a.presentation === 'f')) {
      expect((avatar.imageKey as string).startsWith('high-f-')).toBe(true);
      expect((avatar.imageKey as string).startsWith('elementary-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('middle-')).toBe(false);
      expect((avatar.imageKey as string).includes('-m-')).toBe(false);
    }
  });

  it('大学生以外へ university-m-* が付いていない', () => {
    for (const avatar of AVATARS) {
      if (avatar.ageGroup === 'university') continue;
      expect((avatar.imageKey as string).startsWith('university-m-')).toBe(false);
    }
  });

  it("presentation='f' の人へ university-m-* が付いていない", () => {
    for (const avatar of AVATARS.filter((a) => a.presentation === 'f')) {
      expect((avatar.imageKey as string).startsWith('university-m-')).toBe(false);
    }
  });

  it('大学生mへ、別の年代・別の区分の個別キーが付いていない', () => {
    for (const avatar of AVATARS.filter(
      (a) => a.ageGroup === 'university' && a.presentation === 'm',
    )) {
      expect((avatar.imageKey as string).startsWith('university-m-')).toBe(true);
      expect((avatar.imageKey as string).startsWith('elementary-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('middle-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('high-')).toBe(false);
      expect((avatar.imageKey as string).includes('-f-')).toBe(false);
    }
  });

  it('大学生以外へ university-f-* が付いていない', () => {
    for (const avatar of AVATARS) {
      if (avatar.ageGroup === 'university') continue;
      expect((avatar.imageKey as string).startsWith('university-f-')).toBe(false);
    }
  });

  it("presentation='m' の人へ university-f-* が付いていない", () => {
    for (const avatar of AVATARS.filter((a) => a.presentation === 'm')) {
      expect((avatar.imageKey as string).startsWith('university-f-')).toBe(false);
    }
  });

  it('大学生fへ、別の年代・別の区分の個別キーが付いていない', () => {
    for (const avatar of AVATARS.filter(
      (a) => a.ageGroup === 'university' && a.presentation === 'f',
    )) {
      expect((avatar.imageKey as string).startsWith('university-f-')).toBe(true);
      expect((avatar.imageKey as string).startsWith('elementary-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('middle-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('high-')).toBe(false);
      expect((avatar.imageKey as string).includes('-m-')).toBe(false);
    }
  });

  it('大人以外へ adult-m-* が付いていない', () => {
    for (const avatar of AVATARS) {
      if (avatar.ageGroup === 'adult') continue;
      expect((avatar.imageKey as string).startsWith('adult-m-')).toBe(false);
    }
  });

  it("presentation='f' の人へ adult-m-* が付いていない", () => {
    for (const avatar of AVATARS.filter((a) => a.presentation === 'f')) {
      expect((avatar.imageKey as string).startsWith('adult-m-')).toBe(false);
    }
  });

  it('大人mへ、別の年代・別の区分の個別キーが付いていない', () => {
    for (const avatar of AVATARS.filter(
      (a) => a.ageGroup === 'adult' && a.presentation === 'm',
    )) {
      expect((avatar.imageKey as string).startsWith('adult-m-')).toBe(true);
      expect((avatar.imageKey as string).startsWith('elementary-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('middle-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('high-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('university-')).toBe(false);
      expect((avatar.imageKey as string).includes('-f-')).toBe(false);
    }
  });

  it('大人以外へ adult-f-* が付いていない', () => {
    for (const avatar of AVATARS) {
      if (avatar.ageGroup === 'adult') continue;
      expect((avatar.imageKey as string).startsWith('adult-f-')).toBe(false);
    }
  });

  it("presentation='m' の人へ adult-f-* が付いていない", () => {
    for (const avatar of AVATARS.filter((a) => a.presentation === 'm')) {
      expect((avatar.imageKey as string).startsWith('adult-f-')).toBe(false);
    }
  });

  it('大人fへ、別の年代・別の区分の個別キーが付いていない', () => {
    for (const avatar of AVATARS.filter(
      (a) => a.ageGroup === 'adult' && a.presentation === 'f',
    )) {
      expect((avatar.imageKey as string).startsWith('adult-f-')).toBe(true);
      expect((avatar.imageKey as string).startsWith('elementary-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('middle-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('high-')).toBe(false);
      expect((avatar.imageKey as string).startsWith('university-')).toBe(false);
      expect((avatar.imageKey as string).includes('-m-')).toBe(false);
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

  /*
   * 差し替えを受け取った人だけ、読むファイルが .webp ではなくなる。
   * 対応表はここにも書いて、増えたときに気づけるようにしておく。
   * ここに無い人は、これまでどおり `<imageKey>.webp` のままでなければならない。
   */
  const REPLACED: Readonly<Record<string, string>> = {
    // 百瀬陽菜（ひな）。ChatGPT側の描き直しPNGへ差し替え。旧WebPは残してある。
    'elementary-f-03': 'elementary-f-03-replacement-v1-light-v1.webp',
  };

  it('差し替えのない人は、URL が BASE_URL を通し、キーと拡張子が1回ずつ入る', () => {
    const checked: string[] = [];
    for (const avatar of AVATARS) {
      if (avatar.imageKey !== null && REPLACED[avatar.imageKey] !== undefined) continue;
      const url = avatarImageUrl(avatar) as string;
      expect(url.startsWith(import.meta.env.BASE_URL)).toBe(true);
      expect(url).toBe(`${import.meta.env.BASE_URL}assets/avatars/${avatar.imageKey}.webp`);
      expect(url.match(/\.webp/g)).toHaveLength(1);
      checked.push(avatar.id);
    }
    // 例外が静かに増えていないことを押さえる。
    expect(checked).toHaveLength(AVATARS.length - Object.keys(REPLACED).length);
  });

  it('差し替えた人だけ、指定のファイルを読む', () => {
    const names = baseNames(PUBLIC_WEBP);
    for (const [key, file] of Object.entries(REPLACED)) {
      const avatar = AVATARS.find((a) => a.imageKey === key);
      expect(avatar, `${key} が名簿に無い`).toBeDefined();
      expect(avatarImageUrl(avatar!)).toBe(`${import.meta.env.BASE_URL}assets/avatars/${file}`);
      // 旧WebPは消さずに残す。
      expect(names, `${key}.webp を消してはいけない`).toContain(`${key}.webp`);
    }
  });

  it('差し替えは陽菜だけで、小春には及んでいない', () => {
    // 同じ小学生女性の区分で紛れやすいので、名指しで押さえる。
    const hina = AVATARS.find((a) => a.id === 'elementary-f-03');
    const koharu = AVATARS.find((a) => a.id === 'elementary-f-07');
    expect(hina?.givenName).toBe('陽菜');
    expect(koharu?.givenName).toBe('小春');
    expect(avatarImageUrl(hina!)).toContain('elementary-f-03-replacement-v1-light-v1.webp');
    expect(avatarImageUrl(koharu!)).toBe(
      `${import.meta.env.BASE_URL}assets/avatars/elementary-f-07.webp`,
    );
  });
});

describe('旧基準画像は残すが、もう誰も使わない', () => {
  for (const division of INDIVIDUAL_DIVISIONS) {
    it(`${division}.png と ${division}.webp が残っている`, () => {
      expect(baseNames(SOURCE_PNG)).toContain(`${division}.png`);
      expect(baseNames(PUBLIC_WEBP)).toContain(`${division}.webp`);
    });

    it(`${division} を現在使用する人物は0人`, () => {
      expect(AVATARS.filter((a) => a.imageKey === division)).toHaveLength(0);
    });
  }

  it('基準画像10区分ぶんのファイルは、使われていなくても残す（復帰用）', () => {
    for (const division of DIVISIONS) {
      expect(baseNames(SOURCE_PNG), `${division}.png が無い`).toContain(`${division}.png`);
      expect(baseNames(PUBLIC_WEBP), `${division}.webp が無い`).toContain(`${division}.webp`);
    }
  });
});

describe('個別画像', () => {
  for (const id of INDIVIDUAL_IDS) {
    it(`${id} の原寸PNGと配信用WebPがある`, () => {
      expect(baseNames(SOURCE_PNG)).toContain(`${id}.png`);
      expect(baseNames(PUBLIC_WEBP)).toContain(`${id}.webp`);
    });
  }

  for (const division of INDIVIDUAL_DIVISIONS) {
    it(`${division} の個別画像は8枚ちょうど`, () => {
      const pattern = new RegExp(`^${division}-\\d{2}\\.webp$`);
      expect(baseNames(PUBLIC_WEBP).filter((n) => pattern.test(n))).toHaveLength(8);
    });
  }

  it('個別画像は区分の数 × 8枚', () => {
    const individual = baseNames(PUBLIC_WEBP).filter((n) =>
      INDIVIDUAL_DIVISIONS.some((d) => new RegExp(`^${d}-\\d{2}\\.webp$`).test(n)),
    );
    expect(individual).toHaveLength(INDIVIDUAL_DIVISIONS.length * 8);
  });

  it('個別キーの持ち主の区分が、キーの区分と一致する', () => {
    for (const id of INDIVIDUAL_IDS) {
      const owner = AVATARS.find((a) => a.id === id);
      expect(owner, `${id} が名簿にない`).toBeDefined();
      const division = id.slice(0, id.lastIndexOf('-'));
      expect(baseImageKey(owner!.ageGroup, owner!.presentation)).toBe(division);
    }
    // 個別化していない区分の人が、個別キーを持っていないこと。
    const others = AVATARS.filter(
      (a) => !INDIVIDUAL_DIVISIONS.includes(baseImageKey(a.ageGroup, a.presentation)),
    );
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

  it('中学生のキーもファイルも middle で始まる（junior にしない）', () => {
    const middles = AVATARS.filter((a) => a.ageGroup === 'middle');
    expect(middles).toHaveLength(16);
    // 個別化済みなら自分のID、まだなら区分の共有キー。どちらも middle- で始まる。
    for (const avatar of middles) {
      expect((avatar.imageKey as string).startsWith('middle-')).toBe(true);
      expect((avatar.imageKey as string).startsWith('junior')).toBe(false);
    }
    // 区分の基準画像は、使われていなくても残す。
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

  it('高校生のキーもファイルも high-m / high-f で始まる（区分なしの high と混同しない）', () => {
    const highs = AVATARS.filter((a) => a.ageGroup === 'high');
    expect(highs).toHaveLength(16);
    for (const avatar of highs) {
      expect((avatar.imageKey as string).startsWith('high-')).toBe(true);
      // 区分を書かない 'high' そのものはキーにしない。
      expect(avatar.imageKey).not.toBe('high');
    }
    // 区分の基準画像は、使われていなくても残す。
    for (const key of ['high-m', 'high-f']) {
      expect(baseNames(PUBLIC_WEBP)).toContain(`${key}.webp`);
    }
  });

  it('主人公の画像側に、区分なしの high.webp を作っていない（旅の情景側と別物）', () => {
    // 旅の情景イラストは public/assets/characters/high.webp。
    // 主人公側へ同じ名前を置くと、どちらの絵か分からなくなる。
    expect(baseNames(PUBLIC_WEBP)).not.toContain('high.webp');
    expect(baseNames(CHARACTER_WEBP)).toContain('high.webp');
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

  it('狭い画面（340px以下）での md 50px も変えていない', () => {
    const css = String(avatarCssInline);
    const narrow = css.match(/@media \(max-width:\s*340px\)\s*\{([\s\S]*)\}/);
    expect(narrow, '340px以下の指定が見つからない').not.toBeNull();
    expect((narrow as RegExpMatchArray)[1]).toMatch(
      /\.avatar-thumb--md \.avatar-thumb__face\s*\{[^}]*width:\s*50px/,
    );
  });
});
