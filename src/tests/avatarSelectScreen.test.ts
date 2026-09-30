import { describe, expect, it } from 'vitest';
import avatarCssInline from '../styles/avatar.css?inline';
import baseCssInline from '../styles/base.css?inline';
import selectScreenSource from '../screens/avatarSelectScreen.ts?raw';
import screenShellSource from '../components/screenShell.ts?raw';
import confirmScreenSource from '../screens/avatarConfirmScreen.ts?raw';
import settingsScreenSource from '../screens/settingsScreen.ts?raw';
import { UI } from '../data/strings';
import { AGE_GROUP_IMAGE_BACKGROUND } from '../data/avatars';
import { AVATARS, fullName } from '../data/avatars';
import { AVATAR_HEAD_SHIFT } from '../data/avatarFraming';
import thumbSource from '../components/avatarThumb.ts?raw';

/**
 * 主人公選択画面の検査。
 *
 * 守る約束
 *   1. 見出しは「旅するあなたを選ぼう」。選んだあとの呼び名は「旅するあなた」＋姓名。
 *   2. 選んでいることは「青い色」と「チェック印」の両方で示す（色だけに頼らない）。
 *   3. 表紙の旅の空気を、背景・見出しの帯・一覧の枠の3か所に入れる。
 *   4. 縦にスクロールするのは一覧の枠の中だけ。決定バーはその外に置く。
 *   5. 80人の顔と名前には触らない。共有サムネイルの寸法も変えない。
 *
 * 何 px の位置に描かれ、何人が完全に見えるかは実ブラウザテストで測る。
 * ここでは「CSS と画面コードがその約束の形になっているか」を見る。
 */

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const css = withoutComments(String(avatarCssInline));
const screen = String(selectScreenSource);
const shell = String(screenShellSource);
const confirmSource = String(confirmScreenSource);
const settingsSource = String(settingsScreenSource);

/** セレクタの宣言ブロックを取り出す。 */
function block(selector: string, source = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /*
   * 同じセレクタの指定が複数の場所に分かれていることがある（組み立てと見た目など）。
   * 最初の1つだけを見ると、後ろに書いた指定を見落とす。全部つないで返す。
   */
  const all = [...source.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  expect(all.length, `${selector} の指定が見つからない`).toBeGreaterThan(0);
  return all.map((m) => m[1]).join('\n');
}

/** rgb(...) / #rrggbb を [r,g,b] にする。 */
function toRgb(value: string): [number, number, number] {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const nums = value.match(/[\d.]+/g);
  expect(nums, `色として読めない: ${value}`).not.toBeNull();
  const [r, g, b] = (nums as string[]).map(Number);
  return [r, g, b];
}

describe('主人公選択 文言', () => {
  it('見出しは「旅するあなたを選ぼう」', () => {
    expect(UI.avatar.selectHeading).toBe('旅するあなたを選ぼう');
    expect(screen).toContain('title: UI.avatar.selectHeading');
  });

  it('選んだあとの呼び名は「旅するあなた」', () => {
    expect(UI.avatar.chosen).toBe('旅するあなた');
  });

  it('呼び名には本人の姓名を添える', () => {
    // 呼び名の行と姓名の行が別々に出ていること。
    expect(screen).toContain("class: 'avatar-select__chosen-label', text: UI.avatar.chosen");
    expect(screen).toContain("class: 'avatar-select__chosen-name', text: fullName(avatar)");
  });

  it('姓名は姓と名をつないだもの（80人ぶん作れる）', () => {
    for (const avatar of AVATARS) {
      expect(fullName(avatar)).toBe(`${avatar.familyName}${avatar.givenName}`);
      expect(fullName(avatar).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('画面の文言に「キャラクター」は残っていない（この画面の呼び名は「あなた」）', () => {
    for (const key of ['selectHeading', 'selectLead', 'selectNote', 'empty', 'chosen'] as const) {
      expect(UI.avatar[key], `${key}`).not.toContain('キャラクター');
    }
  });
});

describe('確認画面と設定画面の呼び名', () => {
  it('確認画面の見出しも「旅するあなた」で、問いかけはその下の一文', () => {
    expect(UI.avatar.confirmHeading).toBe('旅するあなた');
    expect(UI.avatar.confirmQuestion).toContain('旅をしますか');
    // 見出しは狭い帯に収まる長さにする（320px の 17px で9文字ほどが上限）。
    expect(UI.avatar.confirmHeading.length).toBeLessThanOrEqual(9);
    expect(confirmSource).toContain('lead: UI.avatar.confirmQuestion');
  });

  it('設定画面の項目名と変更ボタンも「旅するあなた」', () => {
    expect(UI.avatar.current).toBe('旅するあなた');
    expect(UI.avatar.change).toContain('旅するあなた');
    expect(UI.avatar.change).not.toContain('キャラクター');
  });

  it('主人公まわりの文言に「キャラクター」は残っていない', () => {
    for (const [key, value] of Object.entries(UI.avatar)) {
      expect(value, `UI.avatar.${key}`).not.toContain('キャラクター');
    }
  });

  it('確認画面と設定画面の操作は変えていない（文字の差し替えだけ）', () => {
    // 見出し・項目名・ボタンの出し方と、押したときの行き先は以前のまま。
    expect(confirmSource).toContain('title: UI.avatar.confirmHeading');
    expect(confirmSource).toContain('button(UI.avatar.startWith, decide');
    expect(confirmSource).toContain("button(UI.avatar.chooseAgain, () => ctx.navigate({ name: 'avatarSelect' })");
    expect(settingsSource).toContain('el(\'span\', { text: UI.avatar.current })');
    expect(settingsSource).toContain(
      "button(UI.avatar.change, () => ctx.navigate({ name: 'avatarSelect' })",
    );
  });

  it('別機能の「表示キャラクター」は、意味が違うので置き換えていない', () => {
    /*
     * 「表示キャラクター」は年齢層ごとの2人組の情景イラストのことで、
     * 80人から選ぶ主人公とは別物。いまはどの画面にも出していない文言だが、
     * 「旅するあなた」に置き換えると2つの別の物が同じ名前になってしまう。
     */
    expect(UI.settings.character).toBe('表示キャラクター');
    expect(UI.characters.ageSetting).toBe('表示キャラクター');
  });
});

describe('主人公選択 選んでいることの示し方', () => {
  it('選択の縁は青い（橙ではない）', () => {
    const selected = block(".avatar-card[aria-selected='true']");
    const border = selected.match(/border-color:\s*([^;]+);/);
    expect(border, '選択中の縁の色が指定されていない').not.toBeNull();
    const [r, , b] = toRgb((border as RegExpMatchArray)[1]);
    expect(b - r, '選択中の縁が青くない').toBeGreaterThanOrEqual(120);
    // 以前の橙（--c-accent / #e2703a）に戻っていないこと。
    expect(selected).not.toContain('--c-accent');
    expect(selected.toLowerCase()).not.toContain('#e2703a');
  });

  it('色だけに頼らず、チェック印も出す', () => {
    expect(block('.avatar-card__check')).toMatch(/visibility:\s*hidden/);
    expect(block(".avatar-card[aria-selected='true'] .avatar-card__check")).toMatch(
      /visibility:\s*visible/,
    );
    // 画面コードの側にもチェック記号が残っていること。
    expect(screen).toContain("class: 'avatar-card__check', text: '✓'");
  });

  it('チェック印は顔の円より前面に出す', () => {
    // 顔の円は position を持つので、重なり順を書かないと顔に隠れる。
    const check = block('.avatar-card__check');
    expect(check).toMatch(/position:\s*absolute/);
    const z = check.match(/z-index:\s*(\d+)/);
    expect(z, 'チェック印の重なり順が指定されていない').not.toBeNull();
    expect(Number((z as RegExpMatchArray)[1])).toBeGreaterThanOrEqual(1);
  });

  it('チェック印の丸は青、中の記号は白', () => {
    const check = block('.avatar-card__check');
    const bg = check.match(/background:\s*([^;]+);/);
    expect(bg).not.toBeNull();
    const [r, , b] = toRgb((bg as RegExpMatchArray)[1]);
    expect(b - r).toBeGreaterThanOrEqual(120);
    expect(check).toMatch(/color:\s*#fff/);
  });

  it('年代タブと絞り込みも青の系統で示す', () => {
    expect(block(".avatar-tab[aria-selected='true']")).not.toContain('--c-accent');
    expect(block(".avatar-filter__btn[aria-pressed='true']")).not.toContain('--c-accent');
  });
});

describe('主人公選択 表紙の旅の空気', () => {
  it('背景に空の青と石畳の暖かい光を置く', () => {
    const b = block('.screen--avatar-select');
    expect(b).toMatch(/radial-gradient/);
    expect(b).toMatch(/linear-gradient/);
    /*
     * 下に暖色の光、上に空の青。値そのものではなく「暖色と青の光が置かれ、
     * 上下で明るさに差がある」ことを見る。背景の濃淡はガラスが透けて見える
     * ための材料でもあるので、差が小さくなったら気づけるようにしておく。
     */
    const warm = b.match(/rgba\((\d+), (\d+), (\d+), [\d.]+\) 0%, rgba\(\1, \2, \3, 0\)/g);
    expect(warm, '暖色と青の光が2つとも見つからない').not.toBeNull();
    expect((warm as RegExpMatchArray).length).toBeGreaterThanOrEqual(2);
    const stops = [...b.matchAll(/linear-gradient\(180deg, (#[0-9a-f]{6}) 0%[^)]*?(#[0-9a-f]{6}) 100%\)/g)];
    expect(stops.length, '上下の地色が読めない').toBe(1);
    const lum = (hex: string): number => {
      const n = parseInt(hex.slice(1), 16);
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    const top = stops[0][1];
    const bottom = stops[0][2];
    const blueness = (hex: string): number => {
      const n = parseInt(hex.slice(1), 16);
      return (n & 255) - ((n >> 16) & 255);
    };
    // 上は青寄り、下は暖色寄り。透けたときに色の違いが分かるだけの差を持つ。
    expect(blueness(top) - blueness(bottom), '上下の色の差が小さい').toBeGreaterThanOrEqual(30);
    expect(Math.abs(lum(top) - lum(bottom))).toBeGreaterThanOrEqual(0);
  });

  it('見出しは青い帯にする', () => {
    const header = block('.screen--avatar-select .screen__header');
    expect(header).toMatch(/linear-gradient\(180deg,\s*#0f3b64/);
    const title = block('.screen--avatar-select .screen__title');
    expect(title).toMatch(/color:\s*#fff/);
  });

  it('見出しに飛行機の記号を添える', () => {
    expect(screen).toContain("import { planeIcon } from '../components/titleIcons'");
    expect(screen).toContain('titleIcon: planeIcon()');
    // screenShell 側が記号を受け取れること。
    expect(shell).toContain('titleIcon?: Node');
    expect(shell).toContain('options.titleIcon');
  });

  it('記号を渡さない画面の見出しは、これまでどおり文字だけ', () => {
    // 記号があるときだけ span でくるむ。渡さない画面の構造は変えない。
    expect(shell).toMatch(/options\.titleIcon\s*\n?\s*\?\s*\[options\.titleIcon/);
    expect(shell).toMatch(/:\s*\[options\.title\]/);
  });

  it('一覧は水色の芯と青い光をまとった枠に入れる', () => {
    const list = block('.avatar-list');
    expect(list).toMatch(/border:\s*[\d.]+px solid rgba\(26, 99, 166/);
    // 表紙のボタンと同じ、水色の細い芯＋青い柔らかな光。
    expect(list).toContain('rgba(186, 246, 255');
    expect(list).toContain('rgba(26, 99, 166, 0.14)');
    expect(screen).toContain("el('div', { class: 'avatar-list' }, [grid])");
  });
});

describe('選択ボタンのガラス調', () => {
  /*
   * ガラスの作り方は3つの決まりで表す。
   *   1. 面は半透明（rgba のアルファが 1 未満）
   *   2. ぼかしは backdrop-filter で背後だけにかける
   *   3. 要素全体の opacity は使わない（使うと顔の画像と文字まで薄くなる）
   * さらに Safari 用の -webkit- 付きも必ず併記する。
   */
  const GLASS: [string, string][] = [
    ['年代タブ 未選択', '.avatar-tab'],
    ['年代タブ 選択中', ".avatar-tab[aria-selected='true']"],
    ['絞り込み 未押下', '.avatar-filter__btn'],
    ['絞り込み 押している', ".avatar-filter__btn[aria-pressed='true']"],
    ['人物カード 未選択', '.avatar-card'],
    ['人物カード 選択中', ".avatar-card[aria-selected='true']"],
    ['一覧の枠', '.avatar-list'],
    ['確定バー', '.avatar-select__confirm'],
  ];

  /** 宣言の中の rgba(...) のアルファをすべて拾う。 */
  function alphas(decls: string): number[] {
    return [...decls.matchAll(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/g)].map(
      (m) => Number(m[1]),
    );
  }

  /** background の宣言だけを取り出す（box-shadow の色は含めない）。 */
  function fill(decls: string): string {
    const m = decls.match(/\n\s*background:\s*([^;]+);/);
    return m === null ? '' : m[1];
  }

  it.each(GLASS)('%s の面は半透明', (_name, selector) => {
    const decls = block(selector);
    const f = fill(decls);
    expect(f, `${selector} に background の指定がない`).not.toBe('');
    const a = alphas(f);
    expect(a.length, `${selector} の面が rgba で書かれていない`).toBeGreaterThan(0);
    expect(Math.max(...a), `${selector} の面が不透明`).toBeLessThan(1);
  });

  /*
   * ぼかしを掛ける場所。
   *
   * 以前は「ガラスの8か所すべてに backdrop-filter を付ける」ことを求めていたが、
   * これは誤りだった。backdrop-filter を持つ要素は「背後の基準」をそこで
   * 区切ってしまうため、一覧の枠や確定バーに付けると、その中のカードや
   * ボタンの色変換が効かなくなる（実際に青いタブと主ボタンが灰色に寄った）。
   * いまは「中身を入れる器（枠・確定バー）には付けない」「中のボタンには付ける」
   * という形を検査する。前の決まりはこの検査で置き換えている。
   */
  const CONTAINERS = ['.avatar-list', '.avatar-select__confirm'];
  const PANELS = GLASS.filter(([, sel]) => !CONTAINERS.includes(sel));

  it.each(PANELS)('%s のぼかしは背後だけ（Safari 用も併記）', (_name, selector) => {
    const decls = block(selector);
    expect(decls, `${selector} に backdrop-filter がない`).toMatch(/backdrop-filter:\s*blur\(/);
    expect(decls, `${selector} に -webkit-backdrop-filter がない`).toMatch(
      /-webkit-backdrop-filter:\s*blur\(/,
    );
    // filter（要素そのものをぼかす）は使わない。顔と文字までぼける。
    expect(decls).not.toMatch(/\n\s*filter:\s*blur\(/);
  });

  it.each(CONTAINERS)('%s には backdrop-filter を掛けない（中の色変換を止めないため）', (selector) => {
    expect(block(selector), `${selector} に backdrop-filter がある`).not.toMatch(
      /backdrop-filter:/,
    );
  });

  it('要素全体の opacity は使わない（顔と文字を薄くしない）', () => {
    for (const [, selector] of GLASS) {
      expect(block(selector), `${selector} で opacity を使っている`).not.toMatch(
        /\n\s*opacity:\s*0?\.\d/,
      );
    }
  });

  it('白系は白いガラス、青系は青いガラスのまま', () => {
    const rgbOf = (decls: string): [number, number, number] => {
      const m = fill(decls).match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      expect(m, '面の色が読めない').not.toBeNull();
      const [, r, g, b] = m as RegExpMatchArray;
      return [Number(r), Number(g), Number(b)];
    };
    // 未選択・未押下は白系（3原色がどれも高い）
    for (const sel of ['.avatar-tab', '.avatar-filter__btn', '.avatar-card']) {
      const [r, g, b] = rgbOf(block(sel));
      expect(Math.min(r, g, b), `${sel} が白系でない`).toBeGreaterThanOrEqual(200);
    }
    // 選択中・押している は青系（青が赤よりはっきり大きい）
    for (const sel of [
      ".avatar-tab[aria-selected='true']",
      ".avatar-filter__btn[aria-pressed='true']",
      ".avatar-card[aria-selected='true']",
    ]) {
      const [r, , b] = rgbOf(block(sel));
      expect(b - r, `${sel} が青系でない`).toBeGreaterThanOrEqual(50);
    }
  });

  it('ボタンのガラスは主人公の画面だけに限る（共通の .btn は変えない）', () => {
    // avatar.css で .btn を触るときは、必ず主人公の画面のセレクタを前に付ける。
    const scopes = [
      '.screen--avatar-select',
      '.avatar-select__confirm',
      '.screen--avatar-confirm',
      '.setting-row--avatar',
    ];
    const lines = css.split('}');
    for (const chunk of lines) {
      const head = chunk.split('{')[0];
      if (!/\.btn\b/.test(head)) continue;
      const scoped = head
        .split(',')
        .map((one) => one.trim())
        .filter((one) => one.length > 0)
        .every((one) => scopes.some((scope) => one.includes(scope)));
      expect(scoped, `主人公の画面の外まで届くボタンの指定がある: ${head.trim()}`).toBe(true);
    }
  });

  it('共通の .btn / .btn--primary には手を付けていない', () => {
    const base = withoutComments(String(baseCssInline));
    // 基本のボタンは、これまでどおりの不透明に近い面のまま。
    expect(base).toMatch(/\.btn\s*\{[^}]*background:\s*var\(--c-paper-2\)/);
    expect(base).toMatch(
      /\.btn--primary\s*\{[^}]*background:\s*linear-gradient\(180deg,\s*rgba\(42, 126, 205, 0\.88\)/,
    );
  });

  it('確認画面と設定画面のボタンにもガラスを当てている', () => {
    const blue = block('.screen--avatar-confirm .screen__footer .btn--primary');
    expect(blue).toMatch(/backdrop-filter:\s*blur\(/);
    const white = block('.setting-row--avatar .btn');
    expect(white).toMatch(/backdrop-filter:\s*blur\(/);
    expect(Math.max(...alphas(fill(white)))).toBeLessThan(1);
  });

  it('面の塗りは薄い（塗り重ねて板に戻さない）', () => {
    /*
     * 表紙の副ボタンは塗りのアルファが 0.14〜0.2 で、色はほとんど
     * backdrop-filter で作っている。塗りを厚くすると、透過率の数字が
     * 出ていても見た目は板になる。白い面は薄く、白い文字を載せる青い面だけ
     * 読みやすさのぶん厚めを許す。
     */
    // 白い面は薄く。淡い青は少しだけ厚く。白文字を載せる濃い青はそのぶん厚くてよい。
    const MAX: Record<string, number> = {
      ".avatar-tab[aria-selected='true']": 0.6,
      '.avatar-select__confirm .btn--primary': 0.6,
      ".avatar-filter__btn[aria-pressed='true']": 0.45,
      ".avatar-card[aria-selected='true']": 0.45,
    };
    for (const [, selector] of GLASS) {
      const a = alphas(fill(block(selector)));
      const max = MAX[selector] ?? 0.35;
      expect(Math.max(...a), `${selector} の塗りが厚い`).toBeLessThanOrEqual(max);
    }
    // 主ボタンは2つのセレクタをまとめて書いてあるので、その組でも確かめる。
    const primary = block(
      '.avatar-select__confirm .btn--primary,\n.screen--avatar-confirm .screen__footer .btn--primary',
    );
    expect(Math.max(...alphas(fill(primary))), '主ボタンの塗りが厚い').toBeLessThanOrEqual(0.6);
  });

  /*
   * 以前は「顔のうしろの丸い地色を透かす」ことを求めていた。
   * いまは丸い地色も円の切り抜きも置かないので、その決まりをこちらへ置き換えた。
   * 透かすより強い条件（そもそも置かない）になっている。
   */
  it('一覧の中では、顔のうしろに丸い地色も円の切り抜きも置かない', () => {
    const face = block('.avatar-list .avatar-card .avatar-thumb__face.has-image');
    expect(face).toMatch(/background:\s*transparent/);
    expect(face).toMatch(/border-radius:\s*0/);
    expect(face).toMatch(/box-shadow:\s*none/);
    const img = block('.avatar-list .avatar-card .avatar-thumb__face.has-image .avatar-thumb__img');
    expect(img).toMatch(/border-radius:\s*0/);
  });

  it('肩と服を、下だけでなく左右にもなじませる（人物全体は薄くしない）', () => {
    const face = block('.avatar-list .avatar-card .avatar-thumb__face.has-image');
    const img = block('.avatar-list .avatar-card .avatar-thumb__face.has-image .avatar-thumb__img');
    /*
     * なじませは2枚。掛け算にするため、別々の要素に分けてある
     * （1つにまとめると mask-composite が要り、対応していない環境で
     * 「足し算」になって両方とも効かなくなる）。
     *   画像   … 上に中心を置いた楕円。下へ行くほど、そして同じ高さでも
     *            左右の端へ行くほど強く落ちる。肩の左右の切れ口はここで消える。
     *   外側   … 横方向の細い帯。画像の左右の枠に肩が接している人の
     *            まっすぐな切り口を落とす。
     */
    expect(img, '楕円のなじませが無い').toMatch(/mask-image:\s*radial-gradient\(/);
    expect(face, '横のなじませが無い').toMatch(/mask-image:\s*linear-gradient\(\s*90deg/);
    for (const decls of [face, img]) {
      expect(decls, 'Safari 用の -webkit- が無い').toMatch(/-webkit-mask-image:/);
      // 人物そのものを薄くしたりぼかしたりしない。
      expect(decls).not.toMatch(/\n\s*opacity:\s*0?\.\d/);
      expect(decls).not.toMatch(/\n\s*filter:/);
      // 2枚を1つの要素に重ねていない（mask-composite に頼っていない）。
      expect(decls, 'mask-composite に頼っている').not.toMatch(/mask-composite/);
    }

    // 楕円の中心は上寄り。ここが下へ動くと、顔と髪まで落ちてしまう。
    const at = img.match(/mask-image:\s*radial-gradient\(\s*[\d.]+% [\d.]+% at [\d.]+% ([\d.]+)%/);
    expect(at, '楕円の中心が読めない').not.toBeNull();
    expect(Number((at as RegExpMatchArray)[1]), '楕円の中心が下がりすぎ').toBeLessThanOrEqual(30);

    // 横より縦の半径が小さい。これがあるので、下の左右の角がいちばん先に消える。
    const r = img.match(/mask-image:\s*radial-gradient\(\s*([\d.]+)% ([\d.]+)%/);
    expect(r, '楕円の半径が読めない').not.toBeNull();
    const [, rx, ry] = r as RegExpMatchArray;
    expect(Number(ry), '縦横が同じだと角から消えない').toBeLessThan(Number(rx));

    // 顔と髪のある内側は触らない（最初の区切りが 55% 以降）。
    const m = img.match(/mask-image:\s*radial-gradient\([^)]*?#000 0%,\s*#000 (\d+)%/);
    expect(m, 'なじませの始まりが読めない').not.toBeNull();
    expect(Number((m as RegExpMatchArray)[1])).toBeGreaterThanOrEqual(55);

    /*
     * 落ち始めに横線が出ないよう、区切りを細かく刻む。
     * 区切りが少ないと、不透明度の変わり方が急に変わる場所が線に見える。
     */
    // -webkit- 側と2回並ぶので、接頭辞の無いほうだけを取り出して数える。
    const plain = img.match(/(?:^|\n)\s*mask-image:\s*radial-gradient\(([\s\S]*?)\);/);
    expect(plain, 'なじませの区切りが読めない').not.toBeNull();
    const stops = [...(plain as RegExpMatchArray)[1].matchAll(/rgba\(0, 0, 0, ([\d.]+)\) (\d+)%/g)].map(
      (x) => [Number(x[1]), Number(x[2])],
    );
    expect(stops.length, 'なじませの区切りが少なすぎる').toBeGreaterThanOrEqual(5);
    expect(stops[stops.length - 1][0], '端まで透明になっていない').toBe(0);
    expect(stops[stops.length - 1][1], '端まで透明になっていない').toBe(100);
    // 不透明度は単調に下がる。
    for (let i = 1; i < stops.length; i += 1) {
      expect(stops[i][0], 'なじませが途中で濃くなっている').toBeLessThan(stops[i - 1][0]);
      expect(stops[i][1], '区切りの位置が前後している').toBeGreaterThan(stops[i - 1][1]);
    }
  });

  it('内側の縁から白い光がにじむ', () => {
    /*
     * 外へ広げる光だけだと「縁が光っている板」に見える。
     * 内側にも細い芯と、そこから中へ溶ける光を置いて、
     * ガラスの内側に光があると分かるようにする。
     * 白を中まで広げすぎると文字の地が明るくなるので、広がりには上限を置く。
     */
    const INNER: [string, string][] = [
      ['年代タブ 未選択', '.avatar-tab'],
      ['年代タブ 選択中', ".avatar-tab[aria-selected='true']"],
      ['絞り込み 未押下', '.avatar-filter__btn'],
      ['絞り込み 押している', ".avatar-filter__btn[aria-pressed='true']"],
      ['人物カード 未選択', '.avatar-card'],
      ['人物カード 選択中', ".avatar-card[aria-selected='true']"],
      [
        'この人を選ぶ',
        '.avatar-select__confirm .btn--primary,\n.screen--avatar-confirm .screen__footer .btn--primary',
      ],
    ];
    for (const [name, selector] of INNER) {
      const decls = block(selector);
      const shadow = decls.match(/box-shadow:([\s\S]*?);/);
      expect(shadow, `${name} に box-shadow がない`).not.toBeNull();
      const body = (shadow as RegExpMatchArray)[1];
      // 内側の細い芯（広がり 0 の inset）
      expect(body, `${name} に内側の芯がない`).toMatch(
        /inset 0 0 0 [\d.]+px rgba\(\s*\d+,\s*\d+,\s*\d+/,
      );
      // 内側へ溶ける光（ぼけ幅 8px 以上 16px 以下の inset）
      const bleed = [...body.matchAll(/inset 0 0 (\d+)px rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g)];
      expect(bleed.length, `${name} に内側へ溶ける光がない`).toBeGreaterThan(0);
      const chosen = bleed.find((m) => Number(m[1]) >= 8);
      expect(chosen, `${name} の内側の光が狭すぎる`).toBeDefined();
      const [, blur, r, g, b, a] = chosen as RegExpMatchArray;
      expect(Number(blur), `${name} の内側の光が中まで広がりすぎ`).toBeLessThanOrEqual(16);
      // 白い光であること（3原色がどれも高い）
      expect(Math.min(Number(r), Number(g), Number(b)), `${name} の内側の光が白くない`)
        .toBeGreaterThanOrEqual(180);
      expect(Number(a), `${name} の内側の光が強すぎる`).toBeLessThanOrEqual(0.7);
    }
  });

  it('人物をカードいっぱいに置き、切り取らない', () => {
    /*
     * 人物画像は正方形で、左右にほとんど透明の余白が無い（実測：左端の中央値
     * 1.4%、右端の中央値 98.7%）。カード幅より大きくすると多くの人で髪が切れる。
     * そこで「カード幅まで広げる・切り取らない」を指定で固定する。
     */
    const face = block('.avatar-list .avatar-card .avatar-thumb__face.has-image');
    const img = block('.avatar-list .avatar-card .avatar-thumb__face.has-image .avatar-thumb__img');
    expect(face, '人物の枠がカード幅に広がっていない').toMatch(/position:\s*absolute/);
    expect(face, '左右がカードの端まで届いていない').toMatch(/left:\s*0/);
    expect(face, '左右がカードの端まで届いていない').toMatch(/right:\s*0/);
    expect(face, '正方形になっていない').toMatch(/aspect-ratio:\s*1\s*\/\s*1/);
    expect(img, '切り取らない指定になっていない').toMatch(/object-fit:\s*contain/);
    expect(img, '切り取る指定が残っている').not.toMatch(/object-fit:\s*cover/);
    // カードの角からはみ出させない。
    expect(block('.avatar-list .avatar-card')).toMatch(/overflow:\s*hidden/);
  });

  it('カードの寸法は変えない', () => {
    // 高さを決めているのはカードの min-height。ここが変わると人数と列数が動く。
    const card = block('.avatar-card');
    expect(card, 'カードの高さの決め方が変わっている').toMatch(
      /min-height:\s*calc\(clamp\(50px,\s*13\.5vw,\s*58px\)\s*\+\s*28px\)/,
    );
    expect(css, '縦に余裕のある画面のカードの高さが変わっている').toMatch(
      /min-height:\s*calc\(clamp\(50px,\s*18\.6vw,\s*82px\)\s*\+\s*28px\)/,
    );
  });

  it('頭のてっぺんをそろえる値が、画像のある人ぶんだけある', () => {
    /*
     * 値は画像そのものから測ったもの。名前や並び順から作っていないことを、
     * 「画像キーと1対1で対応している」ことで確かめる。
     */
    const keys = AVATARS.filter((a) => a.imageKey !== null).map((a) => a.imageKey as string);
    expect(keys.length).toBe(80);
    const table = Object.keys(AVATAR_HEAD_SHIFT);
    expect(new Set(table).size, '表に重複がある').toBe(table.length);
    for (const k of keys) {
      expect(AVATAR_HEAD_SHIFT[k], `${k} の下げ量が無い`).toBeTypeOf('number');
    }
    for (const k of table) {
      expect(keys, `${k} は一覧に出ない画像キー`).toContain(k);
    }
    // 下げ量は 0〜画像の高さの1割まで。ここを超えると顔が下がりすぎる。
    for (const [k, v] of Object.entries(AVATAR_HEAD_SHIFT)) {
      expect(v, `${k} の下げ量が負`).toBeGreaterThanOrEqual(0);
      expect(v, `${k} の下げ量が大きすぎる`).toBeLessThanOrEqual(10);
    }
    // CSS と画面コードがその値を使っていること。
    expect(thumbSource, '下げ量を要素に渡していない').toMatch(/--avatar-head-shift/);
    expect(block('.avatar-list .avatar-card .avatar-thumb__face.has-image')).toMatch(
      /margin-top:\s*calc\(var\(--avatar-head-shift/,
    );
  });

  it('名前は人物の上に置くが、不透明な帯は敷かない', () => {
    const name = block('.avatar-list .avatar-card .avatar-thumb__name');
    expect(name, '名前が人物より後ろにある').toMatch(/z-index:\s*[2-9]/);
    expect(name, '名前の下に帯を敷いている').not.toMatch(/background/);
    // 名前そのものは薄くしない・ぼかさない。
    expect(name).not.toMatch(/\n\s*opacity:\s*0?\.\d/);
    expect(name).not.toMatch(/\n\s*filter:/);
    // チェック印は名前より前面。
    expect(block('.avatar-card__check')).toMatch(/z-index:\s*3/);
  });

  it('年代タブに合わせて背景を切り替える受け口が5年代ぶんある', () => {
    for (const age of ['elementary', 'middle', 'high', 'university', 'adult']) {
      expect(css, `${age} の背景の受け口が無い`).toContain(
        `.screen--avatar-select[data-age-group='${age}']`,
      );
    }
    // 画面側が年代を印として載せていること。
    expect(screen, '年代の印を載せていない').toMatch(/dataset\.ageGroup\s*=/);
    // 背景の指定が受け口を読んでいること。
    expect(block('.screen--avatar-select'), '背景が受け口を読んでいない').toMatch(
      /var\(--avatar-scene/,
    );
  });

  it('名前にはなじませを掛けない', () => {
    expect(block('.avatar-list .avatar-card .avatar-thumb__name')).not.toMatch(/mask-image:/);
  });

  it('ほかの画面のサムネイルの地色は不透明のまま', () => {
    // 旅の画面・出題画面・結果画面・国紹介はこの値を使う。透かすと絵が変わる。
    for (const value of Object.values(AGE_GROUP_IMAGE_BACKGROUND)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
    // 共通のサムネイルの指定は、これまでどおり不透明な方を使う。
    expect(block('.avatar-thumb__face.has-image')).toMatch(/background:\s*var\(--age-image-bg,/);
  });

  it('backdrop-filter が効かない環境では、青い面を不透明へ戻す', () => {
    /*
     * 青い面の暗さは backdrop-filter の brightness で作っているので、
     * 効かないと面が淡くなり、白文字が 2.20:1 / 1.92:1 まで落ちて読めなくなる
     * （Chromium で backdrop-filter を止めて実測）。効かない環境だけ
     * 元の不透明な青へ戻す。
     */
    const m = css.match(
      /@supports not \(\(backdrop-filter: blur\(2px\)\) or \(-webkit-backdrop-filter: blur\(2px\)\)\)\s*\{([\s\S]*)\}/,
    );
    expect(m, 'backdrop-filter が無い環境向けの指定が見つからない').not.toBeNull();
    const body = (m as RegExpMatchArray)[1];
    expect(body).toContain(".avatar-tab[aria-selected='true']");
    expect(body).toContain('.avatar-select__confirm .btn--primary');
    // 戻す先は、透けない濃い青（アルファ 0.9 以上か、色名そのもの）。
    const fallbackAlphas = alphas(body);
    for (const a of fallbackAlphas) {
      expect(a, '戻す先の青が薄い').toBeGreaterThanOrEqual(0.9);
    }
  });

  it('キーボードで選んでいる場所は、選択中の青とも未選択とも見分けられる', () => {
    const focus = block('.avatar-card:focus-visible,\n.avatar-tab:focus-visible,\n.avatar-filter__btn:focus-visible');
    const m = focus.match(/outline:\s*(\d+(?:\.\d+)?)px solid (#[0-9a-f]{6})/i);
    expect(m, 'フォーカスの輪の指定が読めない').not.toBeNull();
    const [, width, colour] = m as RegExpMatchArray;
    expect(Number(width)).toBeGreaterThanOrEqual(3);
    // 選択中の縁（#1268e0）と同じ色にしない。離して描く。
    expect(colour.toLowerCase()).not.toBe('#1268e0');
    expect(focus).toMatch(/outline-offset:\s*[1-9]/);
  });
});

describe('主人公選択 一覧と決定バー', () => {
  it('縦にスクロールするのは一覧の中だけ', () => {
    expect(block('.avatar-grid')).toMatch(/overflow-y:\s*auto/);
    expect(block('.avatar-list')).not.toMatch(/overflow-y:\s*auto/);
  });

  it('決定バーは一覧の外に置く（選んだ人が見えなくなっても使える）', () => {
    // avatar-list の中身は一覧だけ。決定バーはその兄弟として並ぶ。
    expect(screen).toContain("el('div', { class: 'avatar-list' }, [grid])");
    expect(screen).toMatch(
      /el\('div', \{ class: 'avatar-select__confirm' \}, \[chosenLine, confirmButton\]\)/,
    );
    const listIndex = screen.indexOf("class: 'avatar-list'");
    const barIndex = screen.indexOf("class: 'avatar-select__confirm'");
    expect(listIndex).toBeGreaterThan(-1);
    expect(barIndex).toBeGreaterThan(listIndex);
  });

  it('一覧の顔は 50px を下回らない', () => {
    const face = block('.avatar-list .avatar-card .avatar-thumb__face');
    const m = face.match(/width:\s*clamp\(\s*([\d.]+)px/);
    expect(m, '一覧の顔の大きさが clamp で指定されていない').not.toBeNull();
    expect(Number((m as RegExpMatchArray)[1])).toBeGreaterThanOrEqual(50);
    // 縦に余裕のある画面ぶんも同じ下限。
    const tall = css.match(
      /@media \(min-height: 700px\)\s*\{[\s\S]*?\.avatar-list \.avatar-card \.avatar-thumb__face\s*\{([^}]*)\}/,
    );
    expect(tall, '縦に余裕のある画面の指定が見つからない').not.toBeNull();
    const tallMin = (tall as RegExpMatchArray)[1].match(/width:\s*clamp\(\s*([\d.]+)px/);
    expect(Number((tallMin as RegExpMatchArray)[1])).toBeGreaterThanOrEqual(50);
  });

  it('顔の大きさを変えるのは一覧の中だけ（共有サムネイルは触らない）', () => {
    // .avatar-list を前置してあること。前置を外すと旅の画面などにも及ぶ。
    expect(css).toContain('.avatar-list .avatar-card .avatar-thumb__face');
    expect(css).not.toMatch(/^\.avatar-card \.avatar-thumb__face\s*\{/m);
  });

  it('タップ領域は 44px 以上を保つ', () => {
    expect(block('.avatar-tab')).toContain('min-height: var(--tap-min)');
    expect(block('.avatar-filter__btn')).toContain('min-height: var(--tap-min)');
    expect(block('.avatar-select__confirm .btn')).toContain('min-height: var(--tap-min)');
  });

  it('カードは本物のボタンで、読み上げにも選択が伝わる', () => {
    expect(screen).toContain("'button'");
    expect(screen).toContain("role: 'option'");
    expect(screen).toContain("'aria-selected': String(selected)");
    expect(screen).toContain("role: 'listbox'");
  });

  it('80人の顔と名前は、これまでの部品のまま出す', () => {
    expect(screen).toContain("avatarThumb(avatar, { size: 'md', label: '' })");
    expect(screen).toContain("class: 'avatar-thumb__name', text: displayName(avatar)");
  });
});
