import { describe, expect, it } from 'vitest';
import titleCssInline from '../styles/title.css?inline';
import titleScreenSource from '../screens/titleScreen.ts?raw';
import titleIconsSource from '../components/titleIcons.ts?raw';
import {
  TITLE_ASSETS,
  TITLE_BACKGROUNDS,
  TITLE_BACKGROUND_RESTORE,
  TITLE_BACKGROUND_SIZES,
  TITLE_BACKGROUND_V2,
  TITLE_BACKGROUND_VARIANT,
  TITLE_CAST_ART,
  TITLE_REFERENCE_LAYOUT,
  TITLE_TARGET_LAYOUT,
  TITLE_LOGO_ART,
  TITLE_BACKGROUND_LANDMARKS,
  TITLE_BACKGROUND_POSITION_Y,
  TITLE_LAYERS,
  TITLE_LAYER_SIZES,
} from '../data/titleAssets';
import { COUNTRY_ART } from '../data/countryArt';
import { UI } from '../data/strings';

/**
 * 表紙の検査。
 *
 * 表紙は「背景・ロゴ・人物・操作」を別のレイヤーとして重ねる。
 * 守るべき約束は4つ。
 *   1. 背景は cover で画面を覆う（左右の余白を作らない）。
 *   2. 切り取られるのは背景だけで、ロゴ・人物・ボタンには当たらない。
 *   3. 地球儀と富士山を、ロゴや人物で隠さない。
 *   4. 操作は文字を持つ本物の <button>。絵にボタンを描かない。
 *
 * ここでは「データと CSS と画面コードが、その約束の形になっているか」を見る。
 * 実際に何 px の位置へ描かれ、隠れていないかは実ブラウザテストで測る。
 */

function asText(value: unknown, name: string): string {
  const text = String(value);
  expect(text.length, `${name} を文字列として読めていない`).toBeGreaterThan(0);
  return text;
}

/** 検査はコメントではなく指定そのものを見る。コメントを取り除いてから使う。 */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const titleCss = withoutComments(asText(titleCssInline, 'title.css'));
const screenSource = asText(titleScreenSource, 'titleScreen.ts');
const iconSource = asText(titleIconsSource, 'titleIcons.ts');

const LAYER_WEBP = import.meta.glob('../../public/assets/title/layered-v1/*.webp');
const LAYER_SOURCE = import.meta.glob('../../assets-source/title/layered-v1/*');
const TITLE_WEBP = import.meta.glob('../../public/assets/title/*.webp');
const BG2_WEBP = import.meta.glob('../../public/assets/title/background-v2/*.webp');
const BG2_SOURCE = import.meta.glob('../../assets-source/title/background-v2/*');
const RESTORE_WEBP = import.meta.glob('../../public/assets/title/restore-reference/*.webp');
const RESTORE_SOURCE = import.meta.glob('../../assets-source/title/restore-reference/*');

function baseNames(map: Record<string, unknown>): string[] {
  return Object.keys(map)
    .map((p) => p.split('/').pop() as string)
    .sort();
}

describe('表紙の分離素材', () => {
  it('配信用の3点が受領時の名前のまま置いてある', () => {
    expect(baseNames(LAYER_WEBP)).toEqual(['background.webp', 'characters.webp', 'logo.webp']);
  });

  it('原寸と採用見本が無改変で残っている', () => {
    expect(baseNames(LAYER_SOURCE)).toEqual([
      'README.md',
      'approved-preview.png',
      'background.png',
      'characters.png',
      'logo.png',
    ]);
  });

  it('採用見本は配信していない（実装に直接敷かない）', () => {
    // approved-preview は照合の基準であって、画面へ出す素材ではない。
    // 画面コードのコメントで触れるのはよいが、素材として読み込んではいけない。
    expect(baseNames(LAYER_WEBP)).not.toContain('approved-preview.webp');
    expect(Object.values(TITLE_LAYERS).join(' ')).not.toContain('approved-preview');
    expect(screenSource).not.toMatch(/src:\s*[^\n]*approved-preview/);
  });

  it('画像URLが配信先を指していて、3点が別物である', () => {
    // ロゴと人物は最初の受領物のまま。背景は使っている候補を指す。
    for (const key of ['logo', 'characters'] as const) {
      expect(TITLE_LAYERS[key]).toBe(
        `${import.meta.env.BASE_URL}assets/title/layered-v1/${key}.webp`,
      );
    }
    expect(TITLE_LAYERS.background).toBe(TITLE_BACKGROUNDS[TITLE_BACKGROUND_VARIANT]);
    for (const url of Object.values(TITLE_LAYERS)) {
      expect(url.match(/\.webp/g)).toHaveLength(1);
    }
    expect(new Set(Object.values(TITLE_LAYERS)).size).toBe(3);
  });

  it('原寸の画素数を受領物どおり記録してある', () => {
    expect(TITLE_LAYER_SIZES.background).toEqual(
      TITLE_BACKGROUND_SIZES[TITLE_BACKGROUND_VARIANT],
    );
    expect(TITLE_BACKGROUND_SIZES.v1).toEqual({ width: 852, height: 1846 });
    expect(TITLE_BACKGROUND_SIZES.restore).toEqual({ width: 709, height: 1536 });
    expect(TITLE_LAYER_SIZES.logo).toEqual({ width: 1997, height: 788 });
    expect(TITLE_LAYER_SIZES.characters).toEqual({ width: 1024, height: 1536 });
  });

  it('以前の素材を消していない', () => {
    // 案内キャラクターは移動画面でまだ使う。一枚絵と旧素材は戻せるように残す。
    for (const name of [
      'title-adopted-pilot-ca.webp',
      'title-background.webp',
      'title-logo.webp',
      'suitcase-mascot.webp',
    ]) {
      expect(baseNames(TITLE_WEBP)).toContain(name);
    }
  });

  it('表紙の素材を国の絵として使い回していない', () => {
    for (const art of COUNTRY_ART) {
      expect(Object.values(TITLE_LAYERS)).not.toContain(art.image);
      expect(art.image).not.toBe(TITLE_ASSETS.cover);
    }
  });
});

describe('背景の中で隠してはいけないもの', () => {
  it('地球儀と富士山の位置が比率として記録されている', () => {
    for (const [name, box] of Object.entries(TITLE_BACKGROUND_LANDMARKS)) {
      for (const [side, value] of Object.entries(box)) {
        expect(value, `${name}.${side} が 0〜1 の外にある`).toBeGreaterThanOrEqual(0);
        expect(value, `${name}.${side} が 0〜1 の外にある`).toBeLessThanOrEqual(1);
      }
      expect(box.right, `${name} の左右が逆`).toBeGreaterThan(box.left);
      expect(box.bottom, `${name} の上下が逆`).toBeGreaterThan(box.top);
    }
  });

  it('地球儀は上のほう、富士山はその下にある', () => {
    const { globe, fuji } = TITLE_BACKGROUND_LANDMARKS;
    // 測り間違い（上下の取りちがえ）に気付けるだけの関係を固定する。
    expect(globe.top).toBeLessThan(0.3);
    expect(fuji.top).toBeGreaterThanOrEqual(globe.bottom);
    // 富士山は左寄り、地球儀は中央寄り。
    expect(fuji.left).toBeLessThan(globe.left);
  });

  it('背景の縦の見せ方が比率として記録されている', () => {
    expect(TITLE_BACKGROUND_POSITION_Y).toBeGreaterThan(0);
    expect(TITLE_BACKGROUND_POSITION_Y).toBeLessThan(1);
  });
});

describe('表紙の組み立て方', () => {
  it('分離素材を使い、一枚絵を敷いていない', () => {
    expect(screenSource).toContain('TITLE_LAYERS.background');
    expect(screenSource).toContain('TITLE_LAYERS.logo');
    expect(screenSource).toContain('TITLE_LAYERS.characters');
    // 一枚絵にはロゴとボタンが焼き込まれているので、重ねると二重になる。
    expect(screenSource).not.toContain('TITLE_ASSETS.cover');
  });

  it('背景の縦の見せ方は実測値から付けていて、画面コードへ数字を書いていない', () => {
    expect(screenSource).toContain('TITLE_BACKGROUND_POSITION_Y');
    expect(screenSource).not.toMatch(/objectPosition\s*=\s*['"`]center \d/);
  });

  it('操作はすべて文字を持つ本物のボタンである', () => {
    expect(screenSource).toContain('button(UI.actions.start');
    expect(screenSource).toContain('button(UI.actions.passport');
    expect(screenSource).toContain('button(UI.actions.settings');
    expect(UI.actions.start).toBe('旅をはじめる');
    // 絵のボタンに重ねる仕掛けは、もう要らない（絵に描かれていない）。
    expect(screenSource).not.toContain('title__start-label');
  });

  it('人物の絵は読み上げから外し、ロゴは名前を持つ', () => {
    // 人物は装飾。操作には関わらない。ロゴは画面の名前なので読み上げる。
    expect(screenSource).toContain("alt: `${UI.app.titleJa} ${UI.app.titleEn}`");
    expect(screenSource).toContain("'aria-hidden': 'true'");
  });

  it('素材が読み込めないときの道が残っている', () => {
    expect(screenSource).toContain("addEventListener('error'");
    expect(screenSource).toContain('is-logo-missing');
  });

  it('開発用の説明文を表紙へ出していない', () => {
    expect(screenSource).not.toContain('grayboxNote');
    expect(titleCss).not.toContain('.title__note');
  });
});

describe('表紙の CSS', () => {
  it('背景は画面を覆う（左右の余白を作らない）', () => {
    const rule = titleCss.match(/\.t-bg\s*\{[^}]*\}/);
    expect(rule, '.t-bg の指定が無い').not.toBeNull();
    expect(rule![0]).toContain('object-fit: cover');
    expect(rule![0]).toContain('position: absolute');
    expect(rule![0]).toContain('inset: 0');
    // 縦の見せ方は画面コードが実測値から付ける。CSS へ数字を書かない。
    expect(rule![0]).not.toContain('object-position');
  });

  it('ロゴと人物は切り抜かない（背景だけが切れる）', () => {
    const cast = titleCss.match(/\.t-cast\s*\{[^}]*\}/);
    expect(cast, '.t-cast の指定が無い').not.toBeNull();
    // 人物は高さだけを指定し、幅は原寸比に任せる（縦横比が崩れない）。
    expect(cast![0]).toContain('width: auto');
    expect(cast![0]).toMatch(/height:\s*var\(--cast-h\)/);
    expect(cast![0]).not.toContain('object-fit: cover');
    const logo = titleCss.match(/\.t-logo\s*\{[^}]*\}/);
    expect(logo, '.t-logo の指定が無い').not.toBeNull();
    expect(logo![0]).not.toContain('object-fit: cover');
  });

  it('人物の高さと位置が、目標の構図と操作の高さから決まっている', () => {
    const cast = titleCss.match(/\.t-cast\s*\{[^}]*\}/);
    expect(cast, '.t-cast の指定が無い').not.toBeNull();
    // 高さは「画面の高さから決まる値」と「幅の上限」の小さいほう。
    expect(cast![0]).toMatch(/--cast-h:\s*min\(/);
    expect(cast![0]).toContain('dvh');
    expect(cast![0]).toContain('vw');
    // 靴の位置は、操作の高さから決める（ホームバーで操作が上がれば人物も上がる）。
    expect(cast![0]).toContain('--controls-h');
    expect(cast![0]).toContain('--safe-bottom');
    // 素材の透明な余白の値は、データ側の実測値と一致していること。
    expect(cast![0]).toContain(`--art-top: ${TITLE_CAST_ART.top}`);
    expect(cast![0]).toContain(`--art-bottom: ${TITLE_CAST_ART.bottom}`);
  });

  it('操作は安全領域の内側に置く', () => {
    const actions = titleCss.match(/\.t-actions\s*\{[^}]*\}/);
    expect(actions, '.t-actions の指定が無い').not.toBeNull();
    expect(actions![0]).toMatch(/bottom:\s*calc\(var\(--safe-bottom\)/);
  });

  it('主操作は副操作より大きい', () => {
    const start = titleCss.match(/\.t-start\s*\{[^}]*\}/);
    const sub = titleCss.match(/\.t-sub-btn\s*\{[^}]*\}/);
    expect(start, '.t-start の指定が無い').not.toBeNull();
    expect(sub, '.t-sub-btn の指定が無い').not.toBeNull();

    // 高さも文字も、主ボタンのほうが大きいことを数で見る。
    const startFont = Number(start![0].match(/font-size:\s*(\d+)px/)?.[1]);
    const subFont = Number(sub![0].match(/font-size:\s*(\d+)px/)?.[1]);
    expect(Number.isFinite(startFont), '主ボタンの文字の大きさが px で書かれていない').toBe(true);
    expect(Number.isFinite(subFont), '副ボタンの文字の大きさが px で書かれていない').toBe(true);
    expect(startFont).toBeGreaterThan(subFont);

    // 高さは画面の高さに合わせて伸びる。どちらにも下限を置く。
    expect(start![0]).toContain('min-height: var(--primary-h)');
    expect(sub![0]).toContain('min-height: var(--sub-h)');
    const screen = (titleCss.match(/\.screen--title\s*\{[^}]*\}/g) ?? []).join('\n');
    const primaryMin = Number(screen.match(/--primary-h:\s*max\((\d+)px/)?.[1]);
    const subMin = screen.match(/--sub-h:\s*max\(var\(--tap-min\)/);
    // 44px は指の当たる最小。主ボタンはそれ以上で、副ボタンより高い。
    expect(Number.isFinite(primaryMin), '主ボタンの高さの下限が無い').toBe(true);
    expect(primaryMin).toBeGreaterThanOrEqual(44);
    expect(subMin, '副ボタンの高さの下限が --tap-min ではない').not.toBeNull();
    expect(primaryMin).toBeGreaterThan(44);
  });

  it('副操作は採用見本と同じく、白い輪郭の透けたピル型', () => {
    const sub = titleCss.match(/\.t-sub-btn\s*\{[^}]*\}/);
    expect(sub, '.t-sub-btn の指定が無い').not.toBeNull();
    // 中は透けて背景の絵が見える。白い輪郭と白い文字。
    expect(sub![0]).toMatch(/border:\s*[\d.]+px solid rgba\(255, 255, 255/);
    expect(sub![0]).toContain('color: #fff');
    expect(sub![0]).toMatch(/background:\s*rgba\([^)]*0\.\d+\)/);
    // 絵の上でも読めるよう、文字に影を付ける。
    expect(sub![0]).toContain('text-shadow');
  });

  it('ボタンはどれも丸い（ピル型）で、採用見本と同じ形にしている', () => {
    const start = titleCss.match(/\.t-start\s*\{[^}]*\}/);
    const sub = titleCss.match(/\.t-sub-btn\s*\{[^}]*\}/);
    expect(start![0]).toContain('border-radius: 999px');
    expect(sub![0]).toContain('border-radius: 999px');
  });

  it('ボタンの絵記号はインライン SVG で、画像ファイルを増やしていない', () => {
    // 採用見本のボタンには飛行機・矢印・パスポート・歯車の記号がある。
    // 画像として受領していないので、HTML の図形として描く。
    expect(iconSource).toContain('createElementNS');
    expect(iconSource).toContain('http://www.w3.org/2000/svg');
    // 記号は飾り。読み上げからは外す。
    expect(iconSource).toContain("setAttribute('aria-hidden', 'true')");
    // 記号のために画像を読み込まない。
    expect(iconSource).not.toMatch(/\.(png|webp|jpe?g|svg)['"]/);

    for (const name of ['planeIcon', 'chevronIcon', 'passportIcon', 'gearIcon']) {
      expect(iconSource, `${name} が無い`).toContain(`export function ${name}(`);
      expect(screenSource, `${name} を表紙で使っていない`).toContain(`${name}()`);
    }
  });

  it('ロゴの大きさと位置が、目標の構図に合わせてある', () => {
    const logo = titleCss.match(/\.t-logo\s*\{[^}]*\}/);
    expect(logo, '.t-logo の指定が無い').not.toBeNull();

    // 幅は画面幅の比で持つ。目標は絵の幅が画面の 74.7%。
    const widthPct = Number(logo![0].match(/--logo-w:\s*min\(([\d.]+)vw/)?.[1]);
    expect(Number.isFinite(widthPct), 'ロゴの幅が vw で書かれていない').toBe(true);
    const artWidth = (widthPct / 100) * (TITLE_LOGO_ART.right - TITLE_LOGO_ART.left);
    expect(Math.abs(artWidth - TITLE_TARGET_LAYOUT.logo.width)).toBeLessThan(0.03);

    // 幅は原寸比に任せるので、縦横比が崩れない。
    expect(logo![0]).toMatch(/width:\s*var\(--logo-w\)/);
    expect(logo![0]).toContain('height: auto');
    // 上端は、切り欠きがあるときだけその下へ逃がす。
    expect(logo![0]).toMatch(/top:\s*max\(calc\(var\(--safe-top\)/);
    expect(logo![0]).toContain('dvh');

    // 素材の透明な余白の値は、データ側の実測値と一致していること。
    expect(logo![0]).toContain(`--art-top: ${TITLE_LOGO_ART.top}`);
    const span = Number((TITLE_LOGO_ART.bottom - TITLE_LOGO_ART.top).toFixed(4));
    expect(logo![0]).toContain(`--art-span: ${span}`);
  });

  /*
   * 以前は「地球儀の円周をロゴや人物で隠さない」を絶対条件にしていた。
   * 復元用の指示で、その条件は目標の構図（大きな地球儀の手前に人物とロゴが
   * 重なる絵）と矛盾するため取り下げられた。
   * 重なりを 0 にするためにロゴを縮める書き方へ戻っていないことを見る。
   */
  it('重なりを消すためにロゴを縮める書き方へ戻っていない', () => {
    const logo = titleCss.match(/\.t-logo\s*\{[^}]*\}/);
    expect(logo![0]).not.toContain('--band-bottom');
    expect(logo![0]).not.toContain('--logo-h');
    expect(logo![0]).not.toMatch(/max-height/);
  });

  it('ロゴには背景へ溶ける光が付いている', () => {
    const logo = titleCss.match(/\.t-logo\s*\{[^}]*\}/);
    // 採用見本のロゴはまわりへ水色の光が広がっている。影を重ねて作る。
    const glows = logo![0].match(/drop-shadow\(/g) ?? [];
    expect(glows.length, '光の影が足りない').toBeGreaterThanOrEqual(3);
    expect(logo![0]).toMatch(/drop-shadow\(0 0 \d+px rgba\(/);
  });

  it('下の幕は、人物の足元ではなく操作の高さに合わせてある', () => {
    // 画面の割合で一律に暗くすると、背景の光（石畳の足元まで続く）を消してしまう。
    const screen = titleCss.match(/\.screen--title\s*\{[^}]*\}/g) ?? [];
    const joined = screen.join('\n');
    expect(joined).toMatch(/--scrim-strong:\s*calc\(var\(--safe-bottom\)/);
    expect(joined).toMatch(/--scrim-end:\s*calc\(var\(--scrim-strong\)/);

    const scrim = titleCss.match(/\.t-scrim\s*\{[^}]*\}/);
    expect(scrim, '.t-scrim の指定が無い').not.toBeNull();
    expect(scrim![0]).toContain('var(--scrim-strong)');
    expect(scrim![0]).toContain('var(--scrim-end)');
    // 画面の割合で幕を切る書き方へ戻っていないこと。
    expect(scrim![0]).not.toMatch(/\)\s*\d+%/);
  });

  it('ロゴが読めないときの文字だけの代替が用意されている', () => {
    expect(titleCss).toContain('.screen--title.is-logo-missing .t-logo-fallback');
  });
});

/*
 * 候補の背景 v2（地球儀を大きくし、強い光を二人のあいだへ移したもの）。
 *
 * まだ採用は決まっていない。ここでは「受領したものがそのまま置いてあるか」と
 * 「測り直した値が、旧背景の値の流用になっていないか」を見る。
 */
describe('候補の背景 v2', () => {
  it('受領した3点が名前のまま置いてある', () => {
    expect(baseNames(BG2_SOURCE)).toEqual([
      'README.md',
      'background-large-globe-center-light.png',
      'original-light-reference.jpeg',
    ]);
    expect(baseNames(BG2_WEBP)).toEqual(['background-large-globe-center-light.webp']);
  });

  it('配信用の URL がその素材を指している', () => {
    expect(TITLE_BACKGROUNDS.v2).toContain('background-v2/background-large-globe-center-light.webp');
    expect(TITLE_BACKGROUNDS.v1).not.toBe(TITLE_BACKGROUNDS.v2);
  });

  it('v2 は使っていない（復元用の指示で取り下げ）', () => {
    expect(TITLE_BACKGROUND_VARIANT).not.toBe('v2');
  });

  it('v2 の目印は、旧背景の値の流用ではない', () => {
    // v1 の地球儀の枠（いまは画面に出していないので、ここに書いて比べる）。
    const v1 = { left: 0.36, top: 0.205, right: 0.6, bottom: 0.33 };
    const v2 = TITLE_BACKGROUND_V2.landmarks.globe;
    // 地球儀は大きくなり、上へも左右へも広がっている。
    expect(v2.top).toBeLessThan(v1.top);
    expect(v2.left).toBeLessThan(v1.left);
    expect(v2.right).toBeGreaterThan(v1.right);
    expect(v2.bottom).toBeGreaterThan(v1.bottom);
    const v1Height = v1.bottom - v1.top;
    const v2Height = v2.bottom - v2.top;
    expect(v2Height).toBeGreaterThan(v1Height);
  });

  it('v2 の枠と光の位置が 0〜1 に収まり、順序も正しい', () => {
    for (const [name, box] of Object.entries(TITLE_BACKGROUND_V2.landmarks)) {
      for (const [side, value] of Object.entries(box)) {
        expect(value, `${name}.${side}`).toBeGreaterThanOrEqual(0);
        expect(value, `${name}.${side}`).toBeLessThanOrEqual(1);
      }
      expect(box.left, `${name} の左右`).toBeLessThan(box.right);
      expect(box.top, `${name} の上下`).toBeLessThan(box.bottom);
    }
    // 強い光は地球儀から出ているのではなく、その下の街路の中央にある。
    const light = TITLE_BACKGROUND_V2.lightCenter;
    expect(light.y).toBeGreaterThan(TITLE_BACKGROUND_V2.landmarks.globe.bottom);
    expect(Math.abs(light.x - 0.5)).toBeLessThan(0.1);
  });

  it('v2 の画素数は受領時のまま', () => {
    expect(TITLE_BACKGROUND_V2.size).toEqual({ width: 852, height: 1846 });
  });

  /*
   * 基準として示された当初画像では、ロゴの下端（18.0%）より下に
   * 地球儀の上端（19.5%）が来ている。この順序が、ロゴを置ける空を作っている。
   * v2 は地球儀の上端が 10.0% なので、この順序が崩れている。
   */
  it('当初画像ではロゴの下に地球儀が来ており、v2 ではその余地が無い', () => {
    expect(TITLE_REFERENCE_LAYOUT.logo.bottom).toBeLessThan(TITLE_REFERENCE_LAYOUT.globe.top);
    expect(TITLE_BACKGROUND_V2.landmarks.globe.top).toBeLessThan(
      TITLE_REFERENCE_LAYOUT.logo.bottom,
    );
  });
});

/*
 * いま画面に出している背景（復元用の基準・6枚目）と、目標の構図（7枚目）。
 *
 * 「地球儀の円周をロゴや人物で隠さない」という以前の条件は、
 * 目標の構図と矛盾するため取り下げられた。
 * ここでは代わりに、受領物がそのまま置いてあることと、
 * 測り直した値が v1 / v2 の流用でないことを見る。
 * 実際に何が見えているかは実ブラウザテストで測る。
 */
describe('復元用の背景と目標の構図', () => {
  it('受領した5点が名前のまま置いてある', () => {
    expect(baseNames(RESTORE_SOURCE)).toEqual([
      'README.md',
      'background-reference-exact.jpeg',
      'characters-new-faces.png',
      'logo-transparent.png',
      'target-composition-old-faces.jpeg',
    ]);
    expect(baseNames(RESTORE_WEBP)).toEqual(['background-reference-exact.webp']);
  });

  it('いま画面に出しているのは復元用の背景', () => {
    expect(TITLE_BACKGROUND_VARIANT).toBe('restore');
    expect(TITLE_LAYERS.background).toContain(
      'restore-reference/background-reference-exact.webp',
    );
  });

  it('目印は復元用の背景の実測値で、v1 の流用ではない', () => {
    expect(TITLE_BACKGROUND_LANDMARKS).toEqual(TITLE_BACKGROUND_RESTORE.landmarks);
    const v1Globe = { left: 0.36, top: 0.205, right: 0.6, bottom: 0.33 };
    const globe = TITLE_BACKGROUND_RESTORE.landmarks.globe;
    expect(globe).not.toEqual(v1Globe);
    // 地球儀は v1 より大きい。
    expect(globe.bottom - globe.top).toBeGreaterThan(v1Globe.bottom - v1Globe.top);
    expect(globe.right - globe.left).toBeGreaterThan(v1Globe.right - v1Globe.left);
  });

  it('富士山の山頂の位置が、山体の枠の中にある', () => {
    const { fujiSummit, landmarks } = TITLE_BACKGROUND_RESTORE;
    expect(fujiSummit.x).toBeGreaterThan(landmarks.fuji.left);
    expect(fujiSummit.x).toBeLessThan(landmarks.fuji.right);
    expect(fujiSummit.y).toBeGreaterThanOrEqual(landmarks.fuji.top);
    expect(fujiSummit.y).toBeLessThan(landmarks.fuji.bottom);
  });

  it('強い光は地球儀の縁ではなく、その下の街路にある', () => {
    const { lightCenter, landmarks } = TITLE_BACKGROUND_RESTORE;
    expect(lightCenter.y).toBeGreaterThan(landmarks.globe.bottom);
    expect(Math.abs(lightCenter.x - 0.5)).toBeLessThan(0.1);
  });

  it('目標の構図の値が 0〜1 に収まり、順序も正しい', () => {
    const t = TITLE_TARGET_LAYOUT;
    expect(t.logo.top).toBeLessThan(t.logo.bottom);
    expect(t.logo.bottom).toBeLessThan(t.cast.headTop);
    expect(t.cast.headTop).toBeLessThan(t.cast.feetBottom);
    expect(t.cast.feetBottom).toBeLessThan(t.primary.top);
    expect(t.primary.bottom).toBeLessThan(t.sub.top);
    expect(t.sub.bottom).toBeLessThan(1);
    for (const value of [t.logo.width, t.cast.centerX, t.primary.left, t.sub.right]) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('人物の絵の範囲が、素材の中に収まっている', () => {
    for (const value of Object.values(TITLE_CAST_ART)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(TITLE_CAST_ART.left).toBeLessThan(TITLE_CAST_ART.right);
    expect(TITLE_CAST_ART.top).toBeLessThan(TITLE_CAST_ART.bottom);
  });

  it('操作の寸法が、目標の構図の実測値から来ている', () => {
    const screen = (titleCss.match(/\.screen--title\s*\{[^}]*\}/g) ?? []).join('\n');
    const t = TITLE_TARGET_LAYOUT;
    const primaryH = Number(screen.match(/--primary-h:\s*max\(\d+px,\s*([\d.]+)dvh/)?.[1]);
    const subH = Number(screen.match(/--sub-h:\s*max\(var\(--tap-min\),\s*([\d.]+)dvh/)?.[1]);
    expect(Math.abs(primaryH / 100 - (t.primary.bottom - t.primary.top))).toBeLessThan(0.004);
    expect(Math.abs(subH / 100 - (t.sub.bottom - t.sub.top))).toBeLessThan(0.004);
  });
});
