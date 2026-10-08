import { describe, expect, it } from 'vitest';
import titleCssInline from '../styles/title.css?inline';
import baseCssInline from '../styles/base.css?inline';
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
  TITLE_LOGO_PLACEMENT,
  TITLE_LOGO_VARIANT,
  TITLE_LOGOS,
  TITLE_WALKWAYS,
  TITLE_CAST_CONTACTS,
  TITLE_BACKGROUND_WALKWAY,
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
const GROUNDING_WEBP = import.meta.glob('../../public/assets/title/grounding-v1/*.webp');
/** 配信している軽量版。絵は受領物のままで、圧縮と（ロゴだけ）縮小をしたもの。 */
const LIGHT_WEBP = import.meta.glob('../../public/assets/title/lightweight-v1/*.webp');
/** 配信する軽量版のフォルダに置いてあるもの全部（WebP 以外が混ざっていないか見る）。 */
const LIGHT_ALL = import.meta.glob('../../public/assets/title/lightweight-v1/*');
/** 軽量版の候補と説明文の保管先。配信物には入れない。 */
const LIGHT_SOURCE = import.meta.glob('../../assets-source/title/lightweight-v1/*');
const GROUNDING_SOURCE = import.meta.glob('../../assets-source/title/grounding-v1/*');

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
    /*
     * 3枚とも軽量版（lightweight-v1）を配信している。
     * 絵は受領物のままで、圧縮と（ロゴだけ）縮小をしただけ。
     * 軽量化する前のファイルは元の場所に残してある（別の検査で確認する）。
     */
    const 配信 = {
      logo: 'lightweight-v1/logo-1400w-q85.webp',
      characters: 'lightweight-v1/characters-q85.webp',
    } as const;
    for (const key of ['logo', 'characters'] as const) {
      expect(TITLE_LAYERS[key]).toBe(`${import.meta.env.BASE_URL}assets/title/${配信[key]}`);
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
    // ロゴだけ、配信する軽量版が縦横比そのままの 1400px 幅。
    expect(TITLE_LAYER_SIZES.logo).toEqual({ width: 1400, height: 552 });
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

  it('軽量版を配信していて、軽量化する前のファイルも残っている', () => {
    // 配信しているのは軽量版の3枚。
    expect(baseNames(LIGHT_WEBP)).toEqual([
      'background-walkway-candidate-q85.webp',
      'characters-q85.webp',
      'logo-1400w-q85.webp',
    ]);
    // 軽量化する前のファイルは、元の場所にそのまま残す（戻せるように）。
    expect(baseNames(GROUNDING_WEBP)).toContain('background-walkway-candidate.webp');
    expect(baseNames(LAYER_WEBP)).toContain('logo.webp');
    expect(baseNames(LAYER_WEBP)).toContain('characters.webp');
    // 表紙が参照しているのは軽量版のほうだけ。
    for (const url of Object.values(TITLE_LAYERS)) {
      expect(url).toContain('lightweight-v1/');
    }
    // 配信するのは画像だけ。説明文は配信物に混ぜず、保管先に残す。
    for (const name of baseNames(LIGHT_ALL)) {
      expect(name, `${name} は配信物に入れない`).toMatch(/\.webp$/);
    }
    expect(baseNames(LIGHT_SOURCE), '説明文が保管されていない').toContain('README.txt');
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
    expect(fuji.top).toBeGreaterThan(globe.top);
    expect(fuji.bottom).toBeGreaterThan(globe.bottom);
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
    const screen = (titleCss.match(/\.screen--title\s*\{[^}]*\}/g) ?? []).join('\n');
    expect(screen).toMatch(/--cast-h:\s*min\(/);
    expect(screen).toContain('dvh');
    expect(screen).toContain('vw');
    // 靴の位置は、操作の高さから決める（ホームバーで操作が上がれば人物も上がる）。
    expect(screen).toContain('--controls-h');
    expect(screen).toContain('--safe-bottom');
    expect(cast![0]).toMatch(/bottom:\s*var\(--cast-bottom\)/);
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
    // 主ボタンは画面幅にも合わせるので min(21px, 5.45vw) のように書いてある。
    // その「上限の px」を取り出して比べる。
    const fontPx = (css: string) => Number(css.match(/font-size:\s*(?:min\(\s*)?([\d.]+)px/)?.[1]);
    const startFont = fontPx(start![0]);
    const subFont = fontPx(sub![0]);
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

  it('副操作もピル型のまま（寸法と並びは変えない）', () => {
    /*
     * 以前は「白い輪郭の透けたピル型（塗りは半透明、文字に影）」を求めていた。
     * いまの指定で、副操作もほかの操作と同じ青ガラスにそろえる。
     * 面・縁・光・文字色は base.css が持つので、ここでは形と寸法だけを見る。
     */
    const sub = titleCss.match(/\.t-sub-btn\s*\{[^}]*\}/);
    expect(sub, '.t-sub-btn の指定が無い').not.toBeNull();
    expect(sub![0], '丸い端でない').toContain('border-radius: 999px');
    expect(sub![0], '高さの下限が無い').toContain('min-height: var(--sub-h)');
    expect(sub![0], '文字が折り返す').toContain('white-space: nowrap');
  });

  /*
   * ボタンの面・縁・光は base.css の共通の青ガラスが持つ。
   * この画面の指定（title.css）は寸法と並びだけを持つ。
   */
  const baseCss = String(baseCssInline);
  /** 共通の青ガラスの、変数の中身をまとめて1つの文字列にする。 */
  const glassVar = (name: string): string => {
    const m = baseCss.match(new RegExp(`--${name}:([\\s\\S]*?);`));
    expect(m, `共通の青ガラスに --${name} が無い`).not.toBeNull();
    return (m as RegExpMatchArray)[1];
  };

  it('表紙のボタンは、画面ごとの別の青を持たない（共通の青ガラスにそろえる）', () => {
    /*
     * 以前は表紙だけが
     *   background-color: rgb(2,96,250) ＋ 5層のグラデーション
     *   box-shadow 11段 / text-shadow 3段
     * を持っていた。指定は base.css の1か所へ移してある。
     */
    for (const sel of ['.t-start', '.t-sub-btn']) {
      const m = titleCss.match(new RegExp(`\\${sel}\\s*\\{[^}]*\\}`));
      expect(m, `${sel} の指定が無い`).not.toBeNull();
      const decls = (m as RegExpMatchArray)[0];
      expect(decls, `${sel} に独自の面が残っている`).not.toMatch(/background(-color|-image)?:/);
      expect(decls, `${sel} に独自の縁と光が残っている`).not.toMatch(/box-shadow:/);
      expect(decls, `${sel} に文字の下の暗い影が残っている`).not.toMatch(/text-shadow:/);
      expect(decls, `${sel} に独自の backdrop-filter が残っている`).not.toMatch(/backdrop-filter:/);
      // 丸い端は保つ（基準画像のボタンは角丸が高さの半分）。
      expect(decls, `${sel} が丸い端でない`).toContain('border-radius: 999px');
    }
  });

  /*
   * 7枚目の完成見本のボタンを画素で測った結果に、CSSの指定を縛る。
   * 見本の実測（393px幅に換算した、縁からの距離ごとの色）
   *   縁の外 -8px rgb(82,98,173) / -4px rgb(20,100,240) / -1px rgb(35,129,225)
   *   縁      rgb(177,255,255)
   *   縁の内 +2px rgb(1,131,251) / +8px rgb(2,106,253)
   *   塗りの横断面 rgb(1〜7, 106〜153, 251〜255)
   * 赤がほとんど無い澄んだ青で、外へ広がるのは白い靄ではなく青い光。
   */
  describe('ボタンの見え方（7枚目の完成見本の実測に合わせる）', () => {
    const start = () => {
      const m = titleCss.match(/\.t-start\s*\{[^}]*\}/);
      expect(m, '.t-start の指定が無い').not.toBeNull();
      return m![0];
    };
    /** 括弧の中のコンマを避けて、いちばん外側のコンマだけで分ける。 */
    const splitTop = (css: string) => {
      const out: string[] = [];
      let depth = 0;
      let cur = '';
      for (const ch of css) {
        if (ch === '(') depth += 1;
        if (ch === ')') depth -= 1;
        if (ch === ',' && depth === 0) {
          out.push(cur.trim());
          cur = '';
        } else cur += ch;
      }
      if (cur.trim()) out.push(cur.trim());
      return out;
    };
    /** rgb() / rgba() を拾って [r,g,b,a] にする。 */
    const colors = (css: string) =>
      [...css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g)].map(
        (m) => [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] as const,
      );

    it('主ボタンの塗りは、赤がほとんど無い澄んだ青である', () => {
      // 塗りは共通の青ガラス（--glass-base と --glass-face）が持つ。
      const bg = `${glassVar('glass-base')};${glassVar('glass-face')}`;
      expect(bg, '主ボタンの塗りの指定が無い').toBeTruthy();
      // 不透明に近い色（a >= 0.5）だけを見る。淡い雲や水色の差し色は対象外。
      // 地の色だけを見る（淡い雲や差し色の半透明は対象外）。
      const solid = colors(bg!).filter((c) => c[3] >= 0.9);
      expect(solid.length, '主ボタンの塗りに色が無い').toBeGreaterThan(0);
      for (const [r, g, b] of solid) {
        expect(b, `主ボタンの塗り rgb(${r},${g},${b}) が青くない`).toBeGreaterThan(200);
        expect(r, `主ボタンの塗り rgb(${r},${g},${b}) は赤が強すぎる`).toBeLessThanOrEqual(80);
        expect(b - r, `主ボタンの塗り rgb(${r},${g},${b}) の青みが足りない`).toBeGreaterThanOrEqual(150);
      }
    });

    it('主ボタンの下端を暗くしていない（見本は下も鮮やかなまま）', () => {
      // 地の色の縦のグラデーション。最後の色が真ん中の色より暗ければ落とす。
      const base = glassVar('glass-face').match(/linear-gradient\(([\s\S]*)\)/)?.[1];
      expect(base, '主ボタンの地のグラデーションが無い').toBeTruthy();
      const stops = colors(base!);
      expect(stops.length, '地の色が少なすぎる').toBeGreaterThanOrEqual(3);
      const lum = ([r, g, b]: readonly number[]) => 0.213 * r + 0.715 * g + 0.072 * b;
      const middle = Math.min(...stops.slice(1, -1).map(lum));
      expect(
        lum(stops[stops.length - 1]),
        `下端 rgb(${stops[stops.length - 1].slice(0, 3)}) が途中より暗い`,
      ).toBeGreaterThan(middle);
    });

    it('主ボタンの縁は硬い白枠ではなく、水色の細い線である', () => {
      const ring = glassVar('glass-glow').match(/0 0 0 ([\d.]+)px (rgba?\([^)]*\))/);
      expect(ring, '主ボタンのいちばん外の輪が無い').not.toBeNull();
      expect(Number(ring![1]), '輪が太すぎて硬い枠に見える').toBeLessThanOrEqual(1.5);
      expect(Number(ring![1]), '輪が細すぎて見えない').toBeGreaterThan(0);
      const [r, g, b] = colors(ring![2])[0];
      // 白 rgb(255,255,255) ではなく、青に寄った水色。
      expect(b, `縁 rgb(${r},${g},${b}) が水色でない`).toBeGreaterThanOrEqual(240);
      expect(b - r, `縁 rgb(${r},${g},${b}) が白すぎる`).toBeGreaterThanOrEqual(40);
    });

    it('主ボタンの外へ広がる光は、白い靄ではなく青い光である', () => {
      const shadow = glassVar('glass-glow');
      // inset を除いた、外へ広がる影のうち、ぼかしが 4px 以上のもの。
      const outer = splitTop(shadow)
        .map((t) => t.replace(/\s+/g, ' ').trim())
        .filter((t) => !t.startsWith('inset') && /^0 0 [\d.]+px/.test(t));
      /*
       * 光の広さは基準画像の実測（縁から 3〜4px が濃く、6px で消える）に
       * 合わせて詰めてあるので、ぼけ幅 3px 以上のものを数える。
       */
      const glows = outer.filter((t) => Number(t.match(/^0 0 ([\d.]+)px/)![1]) >= 3);
      expect(glows.length, '外へ広がる光が無い').toBeGreaterThanOrEqual(3);
      // 広げすぎない（広い光は親要素の縁で直線に切られ、四角く見える）。
      for (const g of glows) {
        expect(Number(g.match(/^0 0 ([\d.]+)px/)![1]), `外の光 ${g} が広すぎる`).toBeLessThanOrEqual(12);
      }
      for (const g of glows) {
        const [r, gg, b] = colors(g)[0];
        expect(b - r, `外の光 rgb(${r},${gg},${b}) が青くない（白い靄になっている）`).toBeGreaterThanOrEqual(
          120,
        );
      }
    });

    /*
     * 以前の指定は .t-start に
     *   0 1px 2px rgba(2,16,52,.85) / 0 0 7px rgba(2,18,60,.62) / 0 0 14px rgba(2,18,60,.38)
     * の3枚を重ね、白い文字の読みやすさをその影で確保していた。
     *
     * 1文字ずつなら輪郭の影でも、「旅をはじめる」のように字画の詰まった
     * 和文が並ぶと、字と字のすきまで3枚が溶け合って一続きの暗い面になる。
     * 影を消した描画との差を画素で測ると（Chromium・デバイス比2）、
     *   393x852  x 133.4〜271.9 / y 682.1〜707.6 CSSpx（＝文字列の箱そのもの）
     *   320x568  x 115.8〜213.3 / y 432.1〜451.6 CSSpx
     * の長方形にぴったり収まり、最大で輝度 57.9〜58.3 ぶん暗かった。
     * これが「文字の背後の黒い四角」。
     *
     * 白い文字の背後はボタン全体の青で支えるので、主ボタンには
     * 暗い文字影を持たせない。地の青が文字の高さで 4.5:1 を満たすことは
     * buttonTheme.test.ts が別に見ている。
     */
    it('主ボタンは文字の下に暗い面を敷かない（読みやすさは青の面で支える）', () => {
      const shadow = start().match(/text-shadow:[\s\S]*?;/)?.[0] ?? '';
      const darkInk = colors(shadow).filter(
        (c) => 0.213 * c[0] + 0.715 * c[1] + 0.072 * c[2] < 110 && c[3] > 0.12,
      );
      expect(darkInk.length, `主ボタンに暗い文字影が残っている: ${shadow}`).toBe(0);
    });

    it('副ボタンも、文字の下に暗い面を敷かない（読みやすさは青の面で支える）', () => {
      /*
       * 以前は「文字の影とボタン直下の暗さで読みやすさを確保する」としていた。
       * その影は、字間で溶け合って文字列の形の黒い四角になっていた
       *   （393x852 実測 x 90.1〜322.6 / y 766.0〜783.5、最大 輝度 79.3）。
       * いまは白い文字を面の青で支える。
       */
      const sub = titleCss.match(/\.t-sub-btn\s*\{[^}]*\}/)![0];
      expect(sub, '副ボタンに文字の影が残っている').not.toMatch(/text-shadow:/);
      const glow = glassVar('glass-glow');
      // 共通の青ガラスには、ボタン直下を締める影がある（縦のずれがあって暗い）。
      const down = splitTop(glow)
        .map((t) => t.replace(/\s+/g, ' ').trim())
        .filter((t) => /^0 [\d.]+px [\d.]+px/.test(t) && !t.startsWith('inset'));
      expect(down.length, 'ボタン直下を締める影が無い').toBeGreaterThan(0);
      const dark = down.some((t) => {
        const c = colors(t)[0];
        return c && 0.213 * c[0] + 0.715 * c[1] + 0.072 * c[2] < 60 && c[3] >= 0.25;
      });
      expect(dark, 'ボタン直下の影が薄すぎる').toBe(true);
    });

    it.skip('副ボタンの読みやすさは、文字の影とボタン直下の暗さで確保している（旧指定・置き換え済み）', () => {
      const sub = titleCss.match(/\.t-sub-btn\s*\{[^}]*\}/)![0];
      expect(sub).toContain('text-shadow');
      // 副ボタンの直下だけを暗くする影（縦のずれがあって、色が暗い）。
      const down = splitTop(
        sub
          .match(/box-shadow:[\s\S]*?;/)![0]
          .replace(/^box-shadow:/, '')
          .replace(/;$/, ''),
      )
        .map((t) => t.replace(/\s+/g, ' ').trim())
        .filter((t) => /^0 [\d.]+px [\d.]+px/.test(t) && !t.startsWith('inset'));
      expect(down.length, '副ボタンの直下を暗くする影が無い').toBeGreaterThan(0);
      const dark = down.some((t) => {
        const c = colors(t)[0];
        return c && 0.213 * c[0] + 0.715 * c[1] + 0.072 * c[2] < 60 && c[3] >= 0.3;
      });
      expect(dark, '副ボタンの直下の影が薄すぎる').toBe(true);
    });

    it('画面ごとの別の青が、title.css に残っていない', () => {
      /*
       * 以前は副ボタンだけが backdrop-filter で背後を青へ振っていた。
       * 面は共通の青ガラス1か所で持つので、ここに色の指定は残らない。
       */
      expect(titleCss, 'title.css にボタンの面の色が残っている').not.toMatch(
        /\.t-(start|sub-btn)\s*\{[^}]*background/,
      );
      expect(titleCss, 'title.css にボタンの backdrop-filter が残っている').not.toMatch(
        /\.t-(start|sub-btn)\s*\{[^}]*backdrop-filter/,
      );
    });

    it.skip('副ボタンは背景を取り込んで青いガラスにする（旧指定・置き換え済み）', () => {
      const sub = titleCss.match(/\.t-sub-btn\s*\{[^}]*\}/)![0];
      expect(sub, 'backdrop-filter が無い').toContain('backdrop-filter:');
      expect(sub, '-webkit- の指定が無い').toContain('-webkit-backdrop-filter:');
      /*
       * 背後の絵がどれだけ通ってくるかは
       *   明るさの倍率 × （1 − いちばん濃い塗りの不透明度）
       * でおおよそ決まる。明るさの値だけを見ると、
       * 「明るいけれど濃い青で塗りつぶす」作りを見逃す。
       * 実際に描かれた画素での透け具合は、実ブラウザ検査が測っている。
       */
      const brightness = Number(sub.match(/brightness\(([\d.]+)\)/)?.[1]);
      expect(Number.isFinite(brightness), 'brightness の指定が無い').toBe(true);
      const bg = sub.match(/background:[\s\S]*?;/)?.[0] ?? '';
      const alphas = [...bg.matchAll(/rgba\([^)]*?,\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
      expect(alphas.length, '副ボタンの塗りの色が読めない').toBeGreaterThan(0);
      const through = brightness * (1 - Math.max(...alphas));
      expect(
        through,
        `背後の絵がほとんど通らない（明るさ ${brightness} × 塗りの残り ${(1 - Math.max(...alphas)).toFixed(2)} = ${through.toFixed(2)}）`,
      ).toBeGreaterThanOrEqual(0.45);
      // 色を変えるだけで、絵そのものを消さない。
      expect(sub, '色を青へ変える指定が無い').toMatch(/hue-rotate\(|rgba\(\s*\d+\s*,\s*\d+\s*,\s*[12]\d\d/);
    });
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

  it('ボタンの文字は、見本に合わせた大きさと太さで指定してある', () => {
    /*
     * 完成見本（target-cover-reference.jpeg / IMG_5246.jpeg）を画素で測ると
     *   主ボタン「旅をはじめる」 1文字の字面 18.3〜21.6 CSSpx
     *   副ボタン カナ 8.9〜11.6 / 漢字 12.2〜12.7 CSSpx
     * 小さく細いまま（以前は主 17px / 副 13px・太さ700）に戻したら落とす。
     */
    const start = titleCss.match(/\.t-start\s*\{[^}]*\}/)![0];
    const sub = titleCss.match(/\.t-sub-btn\s*\{[^}]*\}/)![0];
    const px = (css: string) => Number(css.match(/font-size:\s*(?:min\(\s*)?([\d.]+)px/)?.[1]);
    const weight = (css: string) => Number(css.match(/font-weight:\s*(\d+)/)?.[1]);
    expect(px(start), '主ボタンの文字が小さい').toBeGreaterThanOrEqual(22);
    expect(weight(start), '主ボタンの文字が細い').toBeGreaterThanOrEqual(800);
    /*
     * font-weight だけでは太くならない。この画面で使う和文フォント
     * （Hiragino Sans / Noto Sans JP など）は太さの字形が2種類しかなく、
     * 700・800・900 はどれも同じ字形になる。実測でも 800 と 900 で
     * 描かれた画素が1つも変わらなかった。
     * 主ボタンは輪郭を少し太らせて、見た目の太さを上げている。
     */
    const strokeEm = Number(start.match(/-webkit-text-stroke:\s*([\d.]+)em/)?.[1]);
    expect(Number.isFinite(strokeEm), '主ボタンの文字の輪郭を太らせる指定が無い').toBe(true);
    expect(strokeEm, '主ボタンの文字の輪郭が細い').toBeGreaterThanOrEqual(0.015);
    expect(strokeEm, '主ボタンの文字の輪郭が太すぎて字がつぶれる').toBeLessThanOrEqual(0.03);
    expect(px(sub), '副ボタンの文字が小さい').toBeGreaterThanOrEqual(15);
    expect(weight(sub), '副ボタンの文字が細い').toBeGreaterThanOrEqual(800);
    // 副ボタン2つは同じ大きさ・同じ太さ（片方だけ変えない）。
    const only = titleCss.match(/\.t-sub-btn:(?:first|last)-child\s*\{[^}]*\}/g) ?? [];
    for (const block of only) {
      expect(block, '副ボタンの片方だけ文字の大きさを変えている').not.toMatch(/font-size:/);
      expect(block, '副ボタンの片方だけ文字の太さを変えている').not.toMatch(/font-weight:/);
    }
  });

  it('ボタンの絵記号は、見本に合わせた大きさで指定してある', () => {
    /*
     * 見本の絵記号（393px幅に換算）
     *   飛行機 24.4 / パスポート 16.6x21.6 / 歯車 20.5x20.0 / 山形 5.5x10.0
     * 副ボタンの枠を 17px に戻すと、絵は 12.5〜14.5 までしか出ない。
     */
    const box = (sel: string) => {
      const m = titleCss.match(new RegExp(`${sel}\\s*\\{[^}]*\\}`));
      expect(m, `${sel} の指定が無い`).not.toBeNull();
      return Number(m![0].match(/width:\s*(?:(?:min|clamp)\(\s*)?([\d.]+)px/)?.[1]);
    };
    expect(box('\\.t-start \\.t-icon'), '主ボタンの飛行機の枠が小さい').toBeGreaterThanOrEqual(26);
    expect(box('\\.t-sub-btn \\.t-icon'), '副ボタンの絵記号の枠が小さい').toBeGreaterThanOrEqual(21);
  });

  it('歯車は塗りつぶし、パスポートの地球儀は大きく描いてある', () => {
    /*
     * 見本の歯車は線ではなく塗りつぶし。線で描くと、同じ大きさでも
     * パスポートより弱く見える（副ボタン2つの強さがそろわない）。
     * パスポートの地球儀は、以前は枠24に対して半径3.4しかなく、
     * 小さな画面では点にしか見えなかった。
     */
    const gear = iconSource.match(/export function gearIcon\(\)[\s\S]*?\n}/);
    expect(gear, 'gearIcon が無い').not.toBeNull();
    expect(gear![0], '歯車が塗りつぶしでない').toMatch(/fill:\s*true/);

    const passport = iconSource.match(/export function passportIcon\(\)[\s\S]*?\n}/);
    expect(passport, 'passportIcon が無い').not.toBeNull();
    // 地球儀の輪は a<r> <r> の円弧で描いてある。その半径を見る。
    const radii = [...passport![0].matchAll(/a([\d.]+) \1 0/g)].map((m) => Number(m[1]));
    expect(radii.length, 'パスポートの地球儀の輪が無い').toBeGreaterThan(0);
    expect(Math.max(...radii), 'パスポートの地球儀が小さい').toBeGreaterThanOrEqual(4);
    // 経線と緯線があること（ただの丸にしない）。
    expect(passport![0].split('\n').filter((l) => l.includes("'M")).length, '地球儀の線が足りない')
      .toBeGreaterThanOrEqual(6);
  });

  it('主ボタンの飛行機は、機首を右上へ向けた飛行機の形である', () => {
    /*
     * 完成見本（IMG_5246.jpeg）の主ボタンには、機首を右上へ向けた
     * 白い飛行機が 24.4 x 24.4 CSSpx で入っている。
     * 以前の「紙飛行機のような三角形」に戻ったら落とす。
     */
    const plane = iconSource.match(/export function planeIcon\(\)[\s\S]*?\n}/);
    expect(plane, 'planeIcon が無い').not.toBeNull();
    // 傾けてあること。
    expect(plane![0], '飛行機が傾いていない').toMatch(/rotate:\s*45/);
    // 胴・主翼・尾翼を持つ形。三角形1枚（頂点3つ）ではない。
    const d = plane![0].match(/'(M[^']+)'/)?.[1] ?? '';
    expect(d, '飛行機の形が無い').not.toBe('');
    const segments = d.match(/[a-zA-Z]/g) ?? [];
    expect(segments.length, `飛行機の形が単純すぎる（${segments.length}区切り）`).toBeGreaterThanOrEqual(
      14,
    );
    // 枠のほぼ全体を使う（小さく描いて見本と違う大きさにしない）。
    const nums = (d.match(/-?[\d.]+/g) ?? []).map(Number);
    expect(Math.max(...nums), '飛行機が枠より小さい').toBeGreaterThanOrEqual(20);
  });

  it('ロゴの大きさと位置が、目標の構図に合わせてある', () => {
    const logo = titleCss.match(/\.t-logo\s*\{[^}]*\}/);
    expect(logo, '.t-logo の指定が無い').not.toBeNull();

    // 幅は画面幅の比で持つ。目標は絵の幅が画面の 74.7%。
    const widthPct = Number(logo![0].match(/--logo-art-w:\s*min\(([\d.]+)vw/)?.[1]);
    expect(Number.isFinite(widthPct), 'ロゴの絵の幅が vw で書かれていない').toBe(true);
    // 目標の構図と同じ「絵の幅」を指定している（素材の余白は CSS 側で差し引く）。
    expect(Math.abs(widthPct / 100 - TITLE_LOGO_PLACEMENT.artWidth)).toBeLessThan(0.005);
    expect(Math.abs(TITLE_LOGO_PLACEMENT.artWidth - TITLE_TARGET_LAYOUT.logo.width)).toBeLessThan(
      0.005,
    );
    // 素材の絵の幅は、いま使っている素材の実測値と一致していること。
    const artW = Number((TITLE_LOGO_ART.right - TITLE_LOGO_ART.left).toFixed(4));
    expect(logo![0]).toContain(`--art-w: ${artW}`);

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
    // 地球儀の上端から高さの上限を出す書き方（帯）へは戻さない。
    expect(logo![0]).not.toContain('--band-bottom');
    expect(logo![0]).not.toMatch(/max-height/);
    // 高さは幅と原寸比から決まる。画面の高さで頭打ちにしない。
    expect(logo![0]).toMatch(/--logo-h:\s*calc\(var\(--logo-w\) \/ var\(--logo-ratio\)\)/);
  });

  it('ロゴには背景へ溶ける光が付いている', () => {
    const logo = titleCss.match(/\.t-logo\s*\{[^}]*\}/);
    // 採用見本のロゴはまわりへ水色の光が広がっている。影を重ねて作る。
    const glows = logo![0].match(/drop-shadow\(/g) ?? [];
    expect(glows.length, '光の影が足りない').toBeGreaterThanOrEqual(3);
    expect(logo![0]).toMatch(/drop-shadow\(0 0 \d+px rgba\(/);
  });

  it('下の幕は、画面の下端まで届く帯ではなく、副ボタンの行だけを落とす楕円である', () => {
    /*
     * 以前は画面の下端まで届く帯だったため、石畳と花が灰青色に沈んでいた。
     * 完成見本（IMG_5246.jpeg）を画素で測ると、画面の下のほうは
     *   縦96% 明るさ117 暖かさ(R-B)+78 / 縦99.5% 明るさ124 +60
     * と暖かい光が下端まで残る。背景素材そのものにもこの光はある。
     * 幕は副ボタンの行だけに限り、下端には届かせない。
     */
    const screen = (titleCss.match(/\.screen--title\s*\{[^}]*\}/g) ?? []).join('\n');
    // 中心は副ボタンの高さの真ん中。人物の足元や画面の割合で切らない。
    expect(screen, '幕の中心が副ボタンに結びついていない').toMatch(
      /--scrim-y:\s*calc\(\s*var\(--safe-bottom\)\s*\+\s*var\(--btn-bottom\)\s*\+\s*var\(--sub-h\)\s*\/\s*2\s*\)/,
    );
    // 広がりは副ボタンの高さに縛り、さらに「中心から下端までの距離」でも抑える。
    const r = screen.match(/--scrim-r:\s*min\([^;]*\);/)?.[0] ?? '';
    expect(r, '幕の広がりに上限が無い').not.toBe('');
    const bySub = Number(r.match(/var\(--sub-h\)\s*\*\s*([\d.]+)/)?.[1]);
    expect(Number.isFinite(bySub), '幕の広がりが --sub-h に縛られていない').toBe(true);
    expect(bySub, '幕が広がりすぎる').toBeLessThanOrEqual(2);
    const byBottom = Number(r.match(/var\(--scrim-y\)\s*\*\s*([\d.]+)/)?.[1]);
    expect(Number.isFinite(byBottom), '幕が画面の下端へ届かない保証が無い').toBe(true);
    expect(byBottom, '幕が画面の下端まで届く').toBeLessThan(1);

    const scrim = titleCss.match(/\.t-scrim\s*\{[^}]*\}/);
    expect(scrim, '.t-scrim の指定が無い').not.toBeNull();
    // 楕円で、下からの距離で中心を置く。
    expect(scrim![0], '幕が楕円になっていない').toContain('radial-gradient(');
    expect(scrim![0], '幕の中心が --scrim-y に結びついていない').toContain(
      'calc(100% - var(--scrim-y))',
    );
    expect(scrim![0]).toContain('var(--scrim-r)');
    // 画面の下端まで届く帯へ戻っていないこと。
    expect(scrim![0], '画面全体を覆う帯に戻っている').not.toContain('linear-gradient');

    const colors = [
      ...scrim![0].matchAll(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g),
    ].map((m) => [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] as const);
    expect(colors.length, '幕の色が読めない').toBeGreaterThanOrEqual(2);
    for (const [cr, cg, cb] of colors) {
      // 冷たい紺で落とすと石畳が灰青色になる。暖かい焦げ茶で落とす。
      expect(cr, `幕の色 rgb(${cr},${cg},${cb}) が冷たい（赤より青が強い）`).toBeGreaterThan(cb);
    }
    // いちばん外は透明。端で急に切れないこと。
    expect(Math.min(...colors.map((c) => c[3])), '幕の外側が透明で終わっていない').toBe(0);
    // 濃さの上限。これを超えると風景が沈む。
    expect(Math.max(...colors.map((c) => c[3])), '幕が濃すぎる').toBeLessThanOrEqual(0.45);
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

  it('復元用の背景の測定値は残してある（比較のため）', () => {
    expect(TITLE_BACKGROUNDS.restore).toContain(
      'restore-reference/background-reference-exact.webp',
    );
  });

  it('復元用の背景の目印は、v1 の流用ではない', () => {
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

/*
 * 接地（人物が地面に立って見えるか）の材料。
 *
 * 靴の直下に石畳があるかは実ブラウザテストで測る。
 * ここでは、その判定に使う実測値が筋の通った形になっているかを見る。
 */
describe('接地の材料', () => {
  it('受領した5点が名前のまま置いてある', () => {
    expect(baseNames(GROUNDING_SOURCE)).toEqual([
      'README.md',
      'background-walkway-candidate.png',
      'floating-current-reference.jpeg',
      'logo-glow-candidate.png',
      'target-cover-reference.jpeg',
    ]);
    expect(baseNames(GROUNDING_WEBP)).toEqual([
      'background-walkway-candidate.webp',
      'logo-glow-candidate.webp',
    ]);
  });

  it('いま仮組みしているのは歩道つきの候補', () => {
    expect(TITLE_BACKGROUND_VARIANT).toBe('walkway');
    // 歩道つきの候補を、軽量版で配信している。
    expect(TITLE_LAYERS.background).toContain(
      'lightweight-v1/background-walkway-candidate-q85.webp',
    );
    expect(TITLE_BACKGROUND_LANDMARKS).toEqual(TITLE_BACKGROUND_WALKWAY.landmarks);
  });

  it('ロゴは現行のまま（候補は切り替えで見比べられる）', () => {
    expect(TITLE_LOGO_VARIANT).toBe('v1');
    expect(TITLE_LOGOS.glow).toContain('grounding-v1/logo-glow-candidate.webp');
    expect(TITLE_LOGOS.v1).not.toBe(TITLE_LOGOS.glow);
  });

  it('接地点が靴とかばんの脚をすべて含んでいる', () => {
    expect(TITLE_CAST_CONTACTS.length).toBe(6);
    const names = TITLE_CAST_CONTACTS.map((c) => c.name);
    expect(names.filter((n) => n.includes('男性')).length).toBe(2);
    expect(names.filter((n) => n.includes('CA')).length).toBe(2);
    expect(names.filter((n) => n.includes('かばん')).length).toBe(2);
    for (const c of TITLE_CAST_CONTACTS) {
      // 接地点は素材の下のほうにあり、絵の範囲の中に入っている。
      expect(c.y).toBeGreaterThan(0.85);
      expect(c.y).toBeLessThanOrEqual(TITLE_CAST_ART.bottom);
      expect(c.x).toBeGreaterThan(TITLE_CAST_ART.left);
      expect(c.x).toBeLessThan(TITLE_CAST_ART.right);
    }
  });

  it('歩道の範囲が台形として筋が通っている', () => {
    for (const [name, w] of Object.entries(TITLE_WALKWAYS)) {
      // 奥（far）より手前（near）のほうが下にあり、広い。
      expect(w.near.y, `${name}`).toBeGreaterThan(w.far.y);
      expect(w.far.y, `${name}`).toBeGreaterThan(w.top);
      expect(w.near.left, `${name}`).toBeLessThan(w.far.left);
      expect(w.near.right, `${name}`).toBeGreaterThan(w.far.right);
      expect(w.far.left, `${name}`).toBeLessThan(w.far.right);
    }
    // 候補の歩道は、いまの背景の歩道よりずっと奥から始まる。
    expect(TITLE_WALKWAYS.walkway.top).toBeLessThan(TITLE_WALKWAYS.restore.top);
  });

  it('背景の縦の見せ方が、靴の高さに歩道が来る値になっている', () => {
    /*
     * 靴は画面の 67〜75% に来る。切り取りが起きる画面で、そこへ歩道が
     * 来るだけ背景を下へ寄せる必要がある（必要な下限は実測で 0.39〜0.40）。
     * 大きくしすぎると背景が上へ動き、短い画面で地球儀がロゴの裏へ隠れる。
     */
    expect(TITLE_BACKGROUND_POSITION_Y).toBeGreaterThanOrEqual(0.4);
    expect(TITLE_BACKGROUND_POSITION_Y).toBeLessThanOrEqual(0.55);
  });

  it('接地影は CSS で描いており、画像を足していない', () => {
    const ground = titleCss.match(/\.t-ground\s*\{[^}]*\}/);
    expect(ground, '.t-ground の指定が無い').not.toBeNull();
    // 楕円の影を3つ重ねる。画像は読み込まない。
    expect((ground![0].match(/radial-gradient\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(ground![0]).not.toMatch(/url\(/);
    // 人物と同じ位置・同じ大きさの基準を使う（足元からずれない）。
    expect(ground![0]).toContain('--cast-bottom');
    expect(ground![0]).toContain('--cast-h');
    // 人物より後ろに置く。
    expect(ground![0]).toMatch(/z-index:\s*1/);
    expect(screenSource).toContain("class: 't-ground'");
    // 作っただけでなく、画面へ実際に足していること。
    const appended = screenSource.match(/root\.append\(([\s\S]*?)\n  \);/);
    expect(appended, 'root.append が見つからない').not.toBeNull();
    // 'background' に含まれる ground を拾わないよう、行そのもので見る。
    expect(appended![1]).toMatch(/^\s*ground,$/m);
  });
});
