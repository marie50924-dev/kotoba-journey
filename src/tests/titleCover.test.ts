import { describe, expect, it } from 'vitest';
import titleCssInline from '../styles/title.css?inline';
import titleScreenSource from '../screens/titleScreen.ts?raw';
import {
  TITLE_ASSETS,
  TITLE_ASSET_SIZES,
  TITLE_COVER_BUTTON,
  TITLE_COVER_BUTTON_BOX,
} from '../data/titleAssets';
import { COUNTRY_ART } from '../data/countryArt';
import { UI } from '../data/strings';

/**
 * 一枚絵の表紙の検査。
 *
 * 採用した表紙には、ロゴ・人物・「旅をはじめる」ボタンの絵が焼き込まれている。
 * そのため守るべき約束が3つある。
 *   1. 絵の中のロゴ・人物を、DOM の画像で二重に重ねない。
 *   2. 押せるのは本物の <button> で、絵の中のボタンと同じ場所に置く。
 *   3. 絵を切り抜かない（ロゴ・顔・ボタンが切れない）。
 *
 * ここでは「データと CSS と画面コードが、その約束の形になっているか」を見る。
 * 実際に何 px の位置へ描かれ、切れていないかは実ブラウザテストで測る。
 */

function asCss(value: unknown, name: string): string {
  const text = String(value);
  expect(text.length, `${name} を文字列として読めていない`).toBeGreaterThan(0);
  return text;
}

const titleCss = asCss(titleCssInline, 'title.css');
const screenSource = asCss(titleScreenSource, 'titleScreen.ts');

const COVER_WEBP = import.meta.glob('../../public/assets/title/*.webp');
const COVER_SOURCE = import.meta.glob('../../assets-source/title/*');

function baseNames(map: Record<string, unknown>): string[] {
  return Object.keys(map)
    .map((p) => p.split('/').pop() as string)
    .sort();
}

describe('表紙の素材', () => {
  it('配信用の一枚絵が、受領時のファイル名のまま置いてある', () => {
    expect(baseNames(COVER_WEBP)).toContain('title-adopted-pilot-ca.webp');
    expect(TITLE_ASSETS.cover).toBe(
      `${import.meta.env.BASE_URL}assets/title/title-adopted-pilot-ca.webp`,
    );
  });

  it('原寸が無改変で残っている', () => {
    expect(baseNames(COVER_SOURCE)).toContain('title-adopted-pilot-ca.png');
  });

  it('以前の分離レイヤー素材を消していない', () => {
    // 案内キャラクターは移動画面でまだ使う。
    // 背景とロゴは表紙では使わなくなったが、戻せるように残す。
    for (const name of ['title-background.webp', 'title-logo.webp', 'suitcase-mascot.webp']) {
      expect(baseNames(COVER_WEBP)).toContain(name);
    }
  });

  it('一枚絵の画素数を記録してあり、縦長のまま保っている', () => {
    expect(TITLE_ASSET_SIZES.cover).toEqual({ width: 852, height: 1846 });
    expect(TITLE_ASSET_SIZES.cover.height).toBeGreaterThan(TITLE_ASSET_SIZES.cover.width);
  });

  it('表紙の絵を国の絵として使い回していない', () => {
    for (const art of COUNTRY_ART) {
      expect(art.image).not.toBe(TITLE_ASSETS.cover);
    }
  });
});

describe('絵に描かれたボタンの位置', () => {
  it('絵の内側の比率として記録されている', () => {
    for (const [name, value] of Object.entries(TITLE_COVER_BUTTON)) {
      expect(value, `${name} が 0〜1 の外にある`).toBeGreaterThan(0);
      expect(value, `${name} が 0〜1 の外にある`).toBeLessThan(1);
    }
    expect(TITLE_COVER_BUTTON.right).toBeGreaterThan(TITLE_COVER_BUTTON.left);
    expect(TITLE_COVER_BUTTON.bottom).toBeGreaterThan(TITLE_COVER_BUTTON.top);
  });

  it('画面へ渡す値が、記録した比率から計算されている', () => {
    expect(TITLE_COVER_BUTTON_BOX.left).toBe(TITLE_COVER_BUTTON.left);
    expect(TITLE_COVER_BUTTON_BOX.width).toBeCloseTo(
      TITLE_COVER_BUTTON.right - TITLE_COVER_BUTTON.left,
      10,
    );
    expect(TITLE_COVER_BUTTON_BOX.height).toBeCloseTo(
      TITLE_COVER_BUTTON.bottom - TITLE_COVER_BUTTON.top,
      10,
    );
    expect(TITLE_COVER_BUTTON_BOX.centerY).toBeCloseTo(
      (TITLE_COVER_BUTTON.top + TITLE_COVER_BUTTON.bottom) / 2,
      10,
    );
  });

  it('絵の下のほうにある横長のボタンとして測れている', () => {
    // 測り間違い（上下が逆、桁違い）に気付けるだけの幅を持たせる。
    expect(TITLE_COVER_BUTTON_BOX.width).toBeGreaterThan(0.3);
    expect(TITLE_COVER_BUTTON_BOX.width).toBeLessThan(0.9);
    expect(TITLE_COVER_BUTTON_BOX.height).toBeGreaterThan(0.02);
    expect(TITLE_COVER_BUTTON_BOX.height).toBeLessThan(0.2);
    expect(TITLE_COVER_BUTTON_BOX.centerY).toBeGreaterThan(0.7);
    // 横はほぼ中央にある。
    const centerX = TITLE_COVER_BUTTON_BOX.left + TITLE_COVER_BUTTON_BOX.width / 2;
    expect(Math.abs(centerX - 0.5)).toBeLessThan(0.05);
  });
});

describe('表紙の組み立て方', () => {
  it('ロゴとキャラクターの画像を絵の上へ重ねていない', () => {
    // 重ねると、絵の中のロゴ・人物と二重になる。
    expect(screenSource).not.toContain('TITLE_ASSETS.logo');
    expect(screenSource).not.toContain('TITLE_ASSETS.mascot');
    expect(screenSource).not.toContain('TITLE_ASSETS.background');
    expect(screenSource).toContain('TITLE_ASSETS.cover');
  });

  it('ボタンの位置は実測値から付けていて、画面コードへ数字を書いていない', () => {
    expect(screenSource).toContain('TITLE_COVER_BUTTON_BOX');
    // 比率の数字を画面コードへ直接書くと、絵を替えたときに食い違う。
    expect(screenSource).not.toMatch(/left\s*=\s*['"`]\d/);
  });

  it('押すのは本物のボタンで、読み上げ用の文字を持っている', () => {
    expect(screenSource).toContain("button(UI.actions.start");
    expect(screenSource).toContain('title__start-label');
    expect(UI.actions.start).toBe('旅をはじめる');
  });

  it('絵が出ないときに、通常の青いボタンへ切り替える道が残っている', () => {
    expect(screenSource).toContain("addEventListener('error'");
    expect(screenSource).toContain('is-cover-missing');
    expect(screenSource).toContain("btn--primary");
    // 絵に合わせた位置指定を外さないと、代替表示で位置がずれる。
    expect(screenSource).toContain("removeAttribute('style')");
  });
});

describe('表紙の CSS', () => {
  it('絵と同じ縦横比の箱に収めている（比率がデータと一致する）', () => {
    const match = titleCss.match(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/);
    expect(match, 'aspect-ratio の指定が無い').not.toBeNull();
    expect(Number(match![1])).toBe(TITLE_ASSET_SIZES.cover.width);
    expect(Number(match![2])).toBe(TITLE_ASSET_SIZES.cover.height);
  });

  it('絵を切り抜いていない（cover ではなく contain）', () => {
    // object-fit: cover にすると、画面の縦横比によってロゴかボタンが切れる。
    expect(titleCss).toContain('object-fit: contain');
    expect(titleCss).not.toContain('object-fit: cover');
  });

  it('ボタンは絵の上に重ね、触れる範囲を 44x44 以上に保っている', () => {
    const rule = titleCss.match(/\.title__start\s*\{[^}]*\}/);
    expect(rule, '.title__start の指定が無い').not.toBeNull();
    expect(rule![0]).toContain('position: absolute');
    expect(rule![0]).toContain('min-height: var(--tap-min)');
    expect(rule![0]).toContain('min-width: var(--tap-min)');
  });

  it('読み上げ用の文字を、表示からだけ隠している（display:none にしていない）', () => {
    const rule = titleCss.match(/\.title__start-label\s*\{[^}]*\}/);
    expect(rule, '.title__start-label の指定が無い').not.toBeNull();
    // display: none や visibility: hidden にすると読み上げからも消える。
    expect(rule![0]).not.toContain('display: none');
    expect(rule![0]).not.toContain('visibility: hidden');
    expect(rule![0]).toContain('clip-path');
  });

  it('絵が出ないときの文字ロゴと、通常ボタンの見た目が用意されている', () => {
    expect(titleCss).toContain('.screen--title.is-cover-missing .title__fallback');
    expect(titleCss).toContain('.screen--title.is-cover-missing .title__start');
  });
});
