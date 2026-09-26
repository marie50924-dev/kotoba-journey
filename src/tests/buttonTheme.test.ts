import { describe, expect, it } from 'vitest';
import baseCssInline from '../styles/base.css?inline';
import titleCssInline from '../styles/title.css?inline';

/*
 * CSS を文字列として読む。
 * Vitest は既定で CSS の取り込みを切っており、その状態では ?raw / ?inline が
 * 空文字になる。vitest.config.ts で css: true にしてある前提で、
 * 空でないことを最初に確かめてから使う。
 */
function asCss(value: unknown, name: string): string {
  const text = String(value);
  expect(text.length, `${name} を文字列として読めていない（vitest の css 設定を確認）`).toBeGreaterThan(0);
  return text;
}

const baseCss = asCss(baseCssInline, 'base.css');
const titleCss = asCss(titleCssInline, 'title.css');

/**
 * 主要ボタン・副ボタンの正式配色（透過ブルー）を固定する検査。
 *
 * 見た目の「好み」は検査しない。検査するのは次の3点だけ。
 *   1. 澄んだ青の半透明であること（不透明に戻っていない／オレンジに戻っていない）
 *   2. 文字が背景に埋もれないこと（背後の明るさを変えてもコントラストが足りる）
 *   3. すりガラス調が、未対応端末でも読めなくならない形で書かれていること
 *
 * コントラストは値をベタ書きせず、CSS から読み取った rgba を合成して毎回計算する。
 * こうしておくと、色をあとで薄くしたときに数字を直し忘れても検査が落ちる。
 */

/** 1つのセレクタの宣言ブロックを取り出す。 */
function block(css: string, selector: string): string {
  // 行頭のセレクタだけを拾う。こうすると .btn の検索が .btn--primary を拾わない
  // （.btn の直後に { が来ることを求めるため）。
  const pattern = new RegExp(
    `^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    'm',
  );
  const found = css.match(pattern);
  expect(found, `${selector} の宣言ブロックが見つからない`).not.toBeNull();
  return (found as RegExpMatchArray)[1];
}

/** ブロックから1つのプロパティ値を取り出す。 */
function prop(blockText: string, name: string): string {
  const pattern = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'm');
  const found = blockText.match(pattern);
  expect(found, `${name} の指定が見つからない`).not.toBeNull();
  return (found as RegExpMatchArray)[1].trim().replace(/\s+/g, ' ');
}

type Rgba = { r: number; g: number; b: number; a: number };

/** 文字列中の rgba(...) / rgb(...) をすべて取り出す。 */
function rgbaList(text: string): Rgba[] {
  const out: Rgba[] = [];
  const pattern = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;
  for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
    out.push({
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] === undefined ? 1 : Number(m[4]),
    });
  }
  return out;
}

function hexToRgb(hex: string): Rgba {
  const v = hex.replace('#', '');
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
    a: 1,
  };
}

/** 半透明の色を背後の色の上に重ねた実効色。 */
function composite(front: Rgba, back: Rgba): Rgba {
  return {
    r: front.r * front.a + back.r * (1 - front.a),
    g: front.g * front.a + back.g * (1 - front.a),
    b: front.b * front.a + back.b * (1 - front.a),
    a: 1,
  };
}

/** 縦グラデーションの中央の色。文字は縦中央に来るので、ここが文字の背後になる。 */
function midpoint(top: Rgba, bottom: Rgba): Rgba {
  return {
    r: (top.r + bottom.r) / 2,
    g: (top.g + bottom.g) / 2,
    b: (top.b + bottom.b) / 2,
    a: (top.a + bottom.a) / 2,
  };
}

function relativeLuminance(c: Rgba): number {
  const channel = (value: number): number => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

function contrast(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = hexToRgb('#ffffff');

/** ボタンが置かれる背後の色。半透明はここを透かすので、明暗の両端を試す。 */
const BACKDROPS: ReadonlyArray<{ name: string; color: Rgba }> = [
  { name: '--c-paper #fdf8ee（表紙以外のほぼ全画面）', color: hexToRgb('#fdf8ee') },
  { name: '--c-paper-2 #ffffff（カードの上）', color: hexToRgb('#ffffff') },
  { name: '--c-sky #123a5e（暗い下地）', color: hexToRgb('#123a5e') },
  { name: '表紙の暗い写真 #2a3f52', color: hexToRgb('#2a3f52') },
  { name: '表紙のとくに暗い部分 #0d1b2a', color: hexToRgb('#0d1b2a') },
];

/** 通常文字の目安。 */
const MIN_TEXT_CONTRAST = 4.5;

/** 青と呼べるか。青が最も強く、赤が最も弱いこと。 */
function isBlueish(c: Rgba): boolean {
  return c.b > c.g && c.g > c.r;
}

const primary = block(baseCss, '.btn--primary');
const ghost = block(baseCss, '.btn--ghost');
const btn = block(baseCss, '.btn');
const focusVisible = block(baseCss, '.btn:focus-visible');

/*
 * グラデーションの2色を取り出す。
 *
 * 取り出しは it の中から呼ぶ。describe の本体で取り出して失敗すると、
 * ファイル全体が collection の段階で落ちて「どの決まりを破ったのか」が出ない。
 * var(--c-accent) のような書き方へ戻された場合も、ここで意味の分かる形で落とす。
 */
function gradientStops(blockText: string): [Rgba, Rgba] {
  const background = prop(blockText, 'background');
  const stops = rgbaList(background);
  expect(
    stops.length,
    `グラデーションの色が rgba で2つ書かれていない（var() へ戻されていないか）: ${background}`,
  ).toBe(2);
  return [stops[0], stops[1]];
}

describe('主要ボタン .btn--primary の正式配色', () => {
  const background = prop(primary, 'background');

  it('縦方向のグラデーションで、色は2つ指定されている', () => {
    expect(background).toContain('linear-gradient(180deg');
    expect(gradientStops(primary)).toHaveLength(2);
  });

  it('2色とも青系である（オレンジへ戻っていない）', () => {
    for (const stop of gradientStops(primary)) {
      expect(isBlueish(stop), `rgb(${stop.r},${stop.g},${stop.b}) が青系でない`).toBe(true);
    }
  });

  it('オレンジの指定が残っていない', () => {
    expect(primary).not.toContain('--c-accent');
    expect(primary.toLowerCase()).not.toContain('#e2703a');
    expect(primary.toLowerCase()).not.toContain('#f2a25c');
    // 影も青系へ寄せる。オレンジの影の値が残っていないこと。
    expect(prop(primary, 'box-shadow')).not.toContain('226, 112, 58');
  });

  it('2色とも半透明である（不透明に戻っていない）', () => {
    for (const stop of gradientStops(primary)) {
      expect(stop.a).toBeLessThan(1);
      // 透け感が分かる範囲に収める。1.0 に近づけると半透明の意味がなくなる。
      expect(stop.a).toBeLessThanOrEqual(0.95);
    }
  });

  it('文字は白である', () => {
    expect(prop(primary, 'color')).toBe('#fff');
  });

  it('枠は細い半透明の白である', () => {
    const border = prop(primary, 'border-color');
    const [color] = rgbaList(border);
    expect(color, 'border-color が rgba で書かれていない').toBeDefined();
    expect(color.r).toBe(255);
    expect(color.g).toBe(255);
    expect(color.b).toBe(255);
    expect(color.a).toBeLessThan(1);
  });

  it('影は青系で、柔らかい（ぼかし半径がある）', () => {
    const shadow = prop(primary, 'box-shadow');
    const outer = rgbaList(shadow)[0];
    expect(isBlueish(outer), '外側の影が青系でない').toBe(true);
    // 「柔らかい」= ぼかし半径が十分にあること。3つ目の長さがぼかし半径。
    const lengths = shadow.match(/^\s*(-?\d+(?:px)?)\s+(-?\d+(?:px)?)\s+(\d+)px/);
    expect(lengths, `影の指定からぼかし半径が読めない: ${shadow}`).not.toBeNull();
    expect(Number((lengths as RegExpMatchArray)[3])).toBeGreaterThanOrEqual(12);
  });

  it('すりガラス調は、標準と -webkit- の両方で指定されている', () => {
    expect(prop(primary, 'backdrop-filter')).toContain('blur(');
    expect(prop(primary, '-webkit-backdrop-filter')).toContain('blur(');
  });

  it('すりガラスが効かない端末でも、色と文字色は残る形で書かれている', () => {
    // background / color を backdrop-filter の中へ書いていないこと。
    // 未対応端末では backdrop-filter の行だけが無視され、他はそのまま適用される。
    expect(primary).toMatch(/background\s*:/);
    expect(primary).toMatch(/color\s*:\s*#fff/);
  });

  describe('白文字が背景に埋もれない', () => {
    for (const backdrop of BACKDROPS) {
      it(`背後が ${backdrop.name} でも ${MIN_TEXT_CONTRAST}:1 以上`, () => {
        const [top, bottom] = gradientStops(primary);
        const effective = composite(midpoint(top, bottom), backdrop.color);
        const value = contrast(effective, WHITE);
        expect(
          value,
          `実効色 rgb(${Math.round(effective.r)},${Math.round(effective.g)},${Math.round(effective.b)}) で ${value.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      });
    }

    it('グラデーションの上端・下端だけを見ても 3:1 を下回らない', () => {
      for (const stop of gradientStops(primary)) {
        for (const backdrop of BACKDROPS) {
          const value = contrast(composite(stop, backdrop.color), WHITE);
          expect(value, `${backdrop.name} で ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });
});

describe('副ボタン .btn--ghost の正式配色', () => {
  const background = prop(ghost, 'background');
  const [fill] = rgbaList(background);
  const textColor = prop(ghost, 'color');

  it('淡い青の半透明である（白一色に戻っていない）', () => {
    expect(fill, 'background が rgba で書かれていない').toBeDefined();
    expect(fill.a).toBeLessThan(1);
    expect(isBlueish(fill), `rgb(${fill.r},${fill.g},${fill.b}) が青系でない`).toBe(true);
  });

  it('文字は濃い青で、主要ボタンと役割が競合しない', () => {
    expect(textColor).toBe('var(--c-sky)');
  });

  it('すりガラス調は、標準と -webkit- の両方で指定されている', () => {
    expect(prop(ghost, 'backdrop-filter')).toContain('blur(');
    expect(prop(ghost, '-webkit-backdrop-filter')).toContain('blur(');
  });

  it('タップ領域は 44px 以上を保っている', () => {
    expect(prop(ghost, 'min-height')).toBe('var(--tap-min)');
    expect(baseCss).toContain('--tap-min: 44px');
  });

  describe('濃い青の文字が背景に埋もれない', () => {
    const sky = hexToRgb('#123a5e');

    for (const backdrop of BACKDROPS) {
      it(`背後が ${backdrop.name} でも ${MIN_TEXT_CONTRAST}:1 以上`, () => {
        const effective = composite(fill, backdrop.color);
        const value = contrast(effective, sky);
        expect(value, `${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      });
    }

    it('表紙で文字色が --c-ink へ上書きされても、さらに濃くなる方向にしか動かない', () => {
      expect(titleCss).toContain('color: var(--c-ink)');
      const ink = hexToRgb('#10243a');
      expect(relativeLuminance(ink)).toBeLessThan(relativeLuminance(sky));
    });
  });
});

describe('ポインタを重ねたときの反応（hover）', () => {
  /*
   * hover の指定を囲んでいるメディアクエリの中身。
   *
   * 取り出しは it の中から呼ぶ。describe の本体で取り出して失敗すると、
   * ファイル全体が collection の段階で落ちて、他の検査の結果も出なくなる。
   */
  function hoverMedia(): string {
    const found = baseCss.match(
      /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{([\s\S]*?)\n\}/,
    );
    expect(
      found,
      'hover 用のメディアクエリ @media (hover: hover) and (pointer: fine) が見つからない',
    ).not.toBeNull();
    return (found as RegExpMatchArray)[1];
  }

  /** メディアクエリの中の、あるセレクタの宣言。 */
  function hoverBlock(selector: string): string {
    const pattern = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    );
    const found = hoverMedia().match(pattern);
    expect(
      found,
      `${selector} の指定が hover のメディアクエリの中にない（:not(:disabled) が外されていないか）`,
    ).not.toBeNull();
    return (found as RegExpMatchArray)[1];
  }

  it('hover できる入力だけに当てている（指の端末には当てない）', () => {
    expect(baseCss).toMatch(/@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/);
  });

  it('主要ボタン・副ボタンのどちらも、押せないボタンには反応させない', () => {
    expect(hoverMedia()).toContain('.btn--primary:not(:disabled):hover');
    expect(hoverMedia()).toContain('.btn--ghost:not(:disabled):hover');
  });

  it('hover の指定はメディアクエリの外に置かれていない', () => {
    // 行頭の .btn...:hover は、メディアクエリの中ではインデントされる。
    expect(baseCss).not.toMatch(/^\.btn[^\n{]*:hover\s*\{/m);
  });

  describe('主要ボタンは上端がわずかに明るくなる', () => {
    const hover = () => hoverBlock('.btn--primary:not(:disabled):hover');

    it('縦グラデーションの2色が青系のまま指定されている', () => {
      const stops = rgbaList(prop(hover(), 'background'));
      expect(stops, 'hover の色が rgba で2つ書かれていない').toHaveLength(2);
      for (const stop of stops) {
        expect(isBlueish(stop), `rgb(${stop.r},${stop.g},${stop.b}) が青系でない`).toBe(true);
        expect(stop.a, '不透明になっている').toBeLessThan(1);
      }
    });

    for (const backdrop of BACKDROPS) {
      it(`背後が ${backdrop.name} でも上端が通常状態より明るい`, () => {
        const [normalTop] = gradientStops(primary);
        const [hoverTop] = rgbaList(prop(hover(), 'background'));
        const before = relativeLuminance(composite(normalTop, backdrop.color));
        const after = relativeLuminance(composite(hoverTop, backdrop.color));
        expect(after, `通常 ${before.toFixed(4)} → hover ${after.toFixed(4)}`).toBeGreaterThan(
          before,
        );
      });
    }

    it('明るくしても、白文字のコントラストが通常状態より下がらない', () => {
      const [nTop, nBottom] = gradientStops(primary);
      const hoverStops = rgbaList(prop(hover(), 'background'));
      const normalWorst = Math.min(
        ...BACKDROPS.map((b) =>
          contrast(composite(midpoint(nTop, nBottom), b.color), WHITE),
        ),
      );
      const hoverWorst = Math.min(
        ...BACKDROPS.map((b) =>
          contrast(composite(midpoint(hoverStops[0], hoverStops[1]), b.color), WHITE),
        ),
      );
      expect(
        hoverWorst,
        `通常の最悪 ${normalWorst.toFixed(3)}:1 / hover の最悪 ${hoverWorst.toFixed(3)}:1`,
      ).toBeGreaterThanOrEqual(normalWorst);
    });

    for (const backdrop of BACKDROPS) {
      it(`hover 中も 背後が ${backdrop.name} で ${MIN_TEXT_CONTRAST}:1 以上`, () => {
        const stops = rgbaList(prop(hover(), 'background'));
        const value = contrast(
          composite(midpoint(stops[0], stops[1]), backdrop.color),
          WHITE,
        );
        expect(value, `${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      });
    }
  });

  describe('副ボタンはわずかに変化する', () => {
    const hover = () => hoverBlock('.btn--ghost:not(:disabled):hover');
    const sky = hexToRgb('#123a5e');

    it('通常状態と違う淡い青の半透明である', () => {
      const [hoverFill] = rgbaList(prop(hover(), 'background'));
      const [normalFill] = rgbaList(prop(ghost, 'background'));
      expect(hoverFill, 'hover の色が rgba で書かれていない').toBeDefined();
      expect(isBlueish(hoverFill)).toBe(true);
      expect(hoverFill.a).toBeLessThan(1);
      const changed =
        hoverFill.r !== normalFill.r ||
        hoverFill.g !== normalFill.g ||
        hoverFill.b !== normalFill.b ||
        hoverFill.a !== normalFill.a;
      expect(changed, '通常状態と同じ色で、変化がない').toBe(true);
    });

    for (const backdrop of BACKDROPS) {
      it(`背後が ${backdrop.name} でも文字が ${MIN_TEXT_CONTRAST}:1 以上`, () => {
        const [hoverFill] = rgbaList(prop(hover(), 'background'));
        const value = contrast(composite(hoverFill, backdrop.color), sky);
        expect(value, `${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      });
    }
  });
});

describe('操作状態の指定', () => {
  it('押したときの反応は残っている', () => {
    expect(block(baseCss, '.btn:active')).toContain('scale(0.98)');
  });

  it('使えないボタンの薄い表示は残っている', () => {
    expect(block(baseCss, '.btn:disabled')).toContain('opacity');
  });

  it('キーボード操作の枠は、内側の白と外側の濃い色の二重になっている', () => {
    const outline = prop(focusVisible, 'outline');
    expect(outline).toContain('#fff');
    const ring = prop(focusVisible, 'box-shadow');
    expect(ring).toContain('var(--c-sky)');
  });

  it('指でのタップでは枠を出さない（:focus ではなく :focus-visible）', () => {
    // .btn:focus { ... } を単独で定義していないこと。
    expect(baseCss).not.toMatch(/^\.btn:focus\s*\{/m);
  });
});

describe('共通ボタンで一括して決めている', () => {
  it('.btn--primary は base.css の1か所だけで定義されている', () => {
    const occurrences = baseCss.match(/^\.btn--primary\s*\{/gm) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it('.btn の土台にタップ領域と角丸が入っている', () => {
    expect(prop(btn, 'min-height')).toBe('var(--tap-min)');
    expect(prop(btn, 'border-radius')).toBe('var(--radius)');
  });
});
