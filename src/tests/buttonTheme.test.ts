import { describe, expect, it } from 'vitest';
import baseCssInline from '../styles/base.css?inline';
import titleCssInline from '../styles/title.css?inline';
import screenShellSource from '../components/screenShell.ts?raw';
import titleScreenSource from '../screens/titleScreen.ts?raw';
import npcBarSource from '../components/npcBar.ts?raw';
import chatPanelSource from '../components/chatPanel.ts?raw';
import kartaScreenSource from '../screens/kartaScreen.ts?raw';
import quizPromptSource from '../screens/quizPromptScreen.ts?raw';
import waveQuizSource from '../screens/waveQuizScreen.ts?raw';
import resultSource from '../screens/resultScreen.ts?raw';
import passportSource from '../screens/passportScreen.ts?raw';
import courseSource from '../screens/courseScreens.ts?raw';
import travelSource from '../screens/travelScreen.ts?raw';
import screensCssInline from '../styles/screens.css?inline';
import avatarCssInline from '../styles/avatar.css?inline';
import kartaCssInline from '../styles/karta.css?inline';
import chatCssInline from '../styles/chat.css?inline';
import quizCssInline from '../styles/quiz.css?inline';
import travelCssInline from '../styles/travel.css?inline';

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

/** base.css 以外の全スタイル。ここにボタンの面が残っていないことを見る。 */
const OTHER_CSS: ReadonlyArray<[string, string]> = [
  ['title.css', titleCss],
  ['screens.css', asCss(screensCssInline, 'screens.css')],
  ['avatar.css', asCss(avatarCssInline, 'avatar.css')],
  ['karta.css', asCss(kartaCssInline, 'karta.css')],
  ['chat.css', asCss(chatCssInline, 'chat.css')],
  ['quiz.css', asCss(quizCssInline, 'quiz.css')],
  ['travel.css', asCss(travelCssInline, 'travel.css')],
];

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

/*
 * ボタンの面・縁・光は、base.css の共通の青ガラス1か所で持つ。
 * 唯一の見た目の基準は受領画像 IMG_5490(1).jpeg の「旅をはじめる」ボタン。
 *
 * 以前はここで
 *   .btn--primary … 半透明の濃紺グラデーション＋白文字
 *   .btn--ghost   … 淡い青の半透明＋濃い青の文字
 * を、5種類の背後の色に重ねて 4.5:1 を確かめていた。
 * いまは面が不透明なので、背後の色で見え方が変わらない（背後に依存しない
 * ぶん、以前より強い保証になる）。そのかわり
 *   1. 面がほんとうに不透明であること
 *   2. 文字が乗る高さの段が、白文字に対して 4.5:1 以上であること
 * の2つを見る。
 */
const btn = block(baseCss, '.btn');
const focusVisible = block(baseCss, '.btn:focus-visible');

/** 共通の青ガラスの変数の中身。 */
function glassVar(name: string): string {
  const found = baseCss.match(new RegExp(`--${name}:([\\s\\S]*?);`));
  expect(found, `共通の青ガラスに --${name} が無い`).not.toBeNull();
  return (found as RegExpMatchArray)[1];
}


/*
 * 面の段を読む。
 *
 * 段の位置は「割合」でも「縁からの距離（px）」でも書けるようにしてある。
 * 距離で書かれたときは、基準画像のボタンと同じ高さ（393px幅の画面での
 * 主ボタン＝52px）に当てはめて割合へ直す。基準画像のボタンは高さ180画素で、
 * その 1/3.46 が 52px にあたる。
 */
const REFERENCE_BUTTON_HEIGHT = 52;
function parseStops(gradient: string): Array<{ color: Rgba; at: number }> {
  const out: Array<{ color: Rgba; at: number }> = [];
  const pattern =
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)\s*(calc\([^)]*\)|[\d.]+%|[\d.]+px|0)(?=\s*[,)]|\s*$)/g;
  for (let m = pattern.exec(gradient); m !== null; m = pattern.exec(gradient)) {
    const raw = m[5];
    let at: number;
    if (raw === '0') at = 0;
    else if (raw.endsWith('%')) at = Number(raw.slice(0, -1)) / 100;
    else if (raw.endsWith('px')) at = Number(raw.slice(0, -2)) / REFERENCE_BUTTON_HEIGHT;
    else {
      const px = raw.match(/100%\s*-\s*([\d.]+)px/);
      expect(px, `段の位置が読めない: ${raw}`).not.toBeNull();
      at = 1 - Number((px as RegExpMatchArray)[1]) / REFERENCE_BUTTON_HEIGHT;
    }
    out.push({
      color: { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : Number(m[4]) },
      at,
    });
  }
  return out;
}

/** 面の段（色と位置）。 */
function faceStops(): Array<{ color: Rgba; at: number }> {
  return parseStops(glassVar('glass-face'));
}

describe('共通の青ガラス（基準画像 IMG_5490(1).jpeg のボタン）', () => {
  it('選択・決定・もどるが、ひとつの指定にまとまっている', () => {
    const rule = baseCss.match(/\n\.btn,[\s\S]*?\{[\s\S]*?\}/);
    expect(rule, '共通の青ガラスの指定が見つからない').not.toBeNull();
    const head = (rule as RegExpMatchArray)[0].split('{')[0];
    for (const sel of [
      '.btn',
      '.option-card',
      '.option-chip',
      '.map-pin',
      '.avatar-tab',
      '.avatar-filter__btn',
      '.karta__sound-btn',
    ]) {
      expect(head, `${sel} が共通の青ガラスの対象に入っていない`).toContain(sel);
    }
  });

  it('文字は白で、文字の下に暗い面を敷かない', () => {
    const rule = (baseCss.match(/\n\.btn,[\s\S]*?\{([\s\S]*?)\}/) as RegExpMatchArray)[1];
    expect(rule).toMatch(/color:\s*#fff/);
    expect(rule, '文字の下に暗い影がある').toMatch(/text-shadow:\s*none/);
  });

  it('面は不透明（背後の色で見え方が変わらない）', () => {
    for (const stop of faceStops()) {
      expect(stop.color.a, `段 ${(stop.at * 100).toFixed(0)}% が半透明`).toBe(1);
    }
    expect(glassVar('glass-base'), '地の色が半透明').not.toContain('rgba');
  });

  it('どの段も青系である（オレンジや灰色へ戻っていない）', () => {
    for (const stop of faceStops()) {
      expect(isBlueish(stop.color), `rgb(${stop.color.r},${stop.color.g},${stop.color.b}) が青系でない`).toBe(true);
    }
    // ボタンの面にオレンジのトークンを引いていないこと（トークン自体は残る）。
    expect(glassVar('glass-face')).not.toContain('--c-accent');
    expect(glassVar('glass-base')).not.toContain('--c-accent');
  });

  it('白濁した水色になっていない（赤が弱く、緑が青より十分低い）', () => {
    for (const stop of faceStops()) {
      const { r, g, b } = stop.color;
      expect(r, `rgb(${r},${g},${b}) は赤が強すぎる`).toBeLessThanOrEqual(90);
      expect(b - r, `rgb(${r},${g},${b}) の青みが足りない`).toBeGreaterThanOrEqual(150);
      expect(g, `rgb(${r},${g},${b}) は白っぽい`).toBeLessThan(b - 60);
    }
  });

  it('中央に深みがあり、上下の縁ぎわが明るい', () => {
    const stops = faceStops();
    expect(stops.length, '面の段が少なすぎる').toBeGreaterThanOrEqual(6);
    const deepest = stops.reduce((x, y) => (relativeLuminance(y.color) < relativeLuminance(x.color) ? y : x));
    expect(deepest.at, '深みが中央にない').toBeGreaterThanOrEqual(0.4);
    expect(deepest.at, '深みが中央にない').toBeLessThanOrEqual(0.75);
    expect(relativeLuminance(stops[0].color), '上の縁ぎわが明るくない').toBeGreaterThan(
      relativeLuminance(deepest.color),
    );
    expect(
      relativeLuminance(stops[stops.length - 1].color),
      '下の縁ぎわが明るくない',
    ).toBeGreaterThan(relativeLuminance(deepest.color));
  });

  it('文字が置かれうる範囲（縁から10px内側）では、どこを取っても白文字が 4.5:1 以上', () => {
    /*
     * 段の色だけでなく、段と段のあいだも調べる。
     * 面は段のあいだを直線でつなぐので、2%きざみで色を作って確かめる。
     * （段が band の外にあっても、あいだの色が band に入るため）
     */
    const stops = faceStops();
    expect(stops.length, '面の段が少なすぎる').toBeGreaterThanOrEqual(5);
    const at = (t: number): Rgba => {
      if (t <= stops[0].at) return stops[0].color;
      for (let i = 1; i < stops.length; i += 1) {
        if (t <= stops[i].at) {
          const a = stops[i - 1];
          const b = stops[i];
          const k = b.at === a.at ? 0 : (t - a.at) / (b.at - a.at);
          return {
            r: a.color.r + (b.color.r - a.color.r) * k,
            g: a.color.g + (b.color.g - a.color.g) * k,
            b: a.color.b + (b.color.b - a.color.b) * k,
            a: 1,
          };
        }
      }
      return stops[stops.length - 1].color;
    };
    /*
     * 文字がいちばん縁に寄るのは、余白がいちばん狭いボタン（padding 10px）。
     * そこから内側を、基準の高さ 52px に対する割合として 2%きざみで見る。
     */
    const edge = 10 / REFERENCE_BUTTON_HEIGHT;
    for (let t = edge; t <= 1 - edge + 0.0001; t += 0.02) {
      const c = at(t);
      const value = contrast(c, WHITE);
      expect(
        value,
        `上から ${(t * 100).toFixed(0)}% の色 rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}) が ${value.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  it('どの背後の上でも、白文字のコントラストが変わらない', () => {
    /*
     * 以前は、半透明の面を5種類の背後に重ねて「どれでも 4.5:1 以上」を
     * 確かめていた。面が不透明になったので、背後に重ねても色は変わらない。
     * 実際に合成して、5種類すべてで同じ値になることを確かめる
     *   （「下回らない」ではなく「動かない」という、より強い条件）。
     */
    const stops = faceStops();
    const band = stops.filter((stop) => stop.at >= 0.24 && stop.at <= 0.78);
    const mid = midpoint(band[0].color, band[band.length - 1].color);
    const values = BACKDROPS.map((b) => contrast(composite(mid, b.color), WHITE));
    for (const value of values) {
      expect(value, `背後ごとに ${values.map((v) => v.toFixed(3)).join(' / ')}`).toBeCloseTo(
        values[0],
        6,
      );
      expect(value, `${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
    // 面が rgba（半透明）で書かれていないことも、ここで一緒に押さえる。
    expect(rgbaList(glassVar('glass-face')).every((c) => c.a === 1), '面に半透明の色がある').toBe(true);
  });

  it('いちばん明るい段でも 3:1 を下回らない', () => {
    for (const stop of faceStops()) {
      const value = contrast(stop.color, WHITE);
      expect(value, `上から ${(stop.at * 100).toFixed(0)}% で ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it('縁は細いシアン白の線で、外へ広がる光は青い', () => {
    const glow = glassVar('glass-glow');
    const ring = glow.match(/0 0 0 ([\d.]+)px rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    expect(ring, 'いちばん外の細い輪が無い').not.toBeNull();
    expect(Number(ring![1]), '輪が太すぎて硬い枠に見える').toBeLessThanOrEqual(2);
    const ringR = Number(ring![2]);
    const ringB = Number(ring![4]);
    expect(ringB, `輪 rgb(${ringR},${ring![3]},${ringB}) が水色でない`).toBeGreaterThanOrEqual(240);
    expect(ringB - ringR, `輪 rgb(${ringR},${ring![3]},${ringB}) が白すぎる`).toBeGreaterThanOrEqual(40);
    const blurs = glow.match(/0 0 \d+px(?: \d+px)?/g) ?? [];
    expect(blurs.length, '外へ広がる光が足りない').toBeGreaterThanOrEqual(3);
    // 内側にも光を回す（ガラスの厚み）。
    expect(glow).toContain('inset');
  });

  it('選択中は、縁と光を強めたものを別に持っている', () => {
    const on = glassVar('glass-glow-on');
    const ringOn = on.match(/0 0 0 ([\d.]+)px/);
    const ring = glassVar('glass-glow').match(/0 0 0 ([\d.]+)px/);
    expect(ringOn, '選択中の輪が無い').not.toBeNull();
    expect(Number(ringOn![1]), '選択中の輪が通常より太くない').toBeGreaterThan(Number(ring![1]));
  });

  it('タップ領域は 44px 以上を保っている', () => {
    expect(prop(btn, 'min-height')).toBe('var(--tap-min)');
    expect(baseCss).toContain('--tap-min: 44px');
  });

  it('フォーカスは独立した外輪で、ガラスの光を消していない', () => {
    expect(focusVisible, 'フォーカスの輪が outline でない').toMatch(/outline:\s*3px solid #fff/);
    expect(focusVisible, 'フォーカスの輪が面に重なっている').toMatch(/outline-offset:\s*[1-9]/);
    expect(focusVisible, 'ガラスの光を消している').toContain('var(--glass-glow)');
  });

  it('押せない状態が分かる表示を残している', () => {
    const disabled = block(baseCss, '.btn:disabled');
    expect(disabled).toMatch(/opacity:\s*0\.45/);
    expect(disabled).toMatch(/cursor:\s*default/);
  });

  it('記録を消す操作だけは、進む操作と同じ青にしない', () => {
    const danger = block(baseCss, '.btn--danger');
    expect(danger, '消す操作が青ガラスのまま').toMatch(/background-image:\s*none/);
    expect(danger).toMatch(/background-color:\s*var\(--c-ng\)/);
  });
});

describe('外へ出る光が、親要素の縁で切られない', () => {
  /*
   * 外へ出る光は、祖先に overflow: hidden / auto があると、その箱の縁で
   * 直線に切られる。切られた直線が、丸いボタンの背後に四角い面があるように見える。
   * 実際、.option-grid（overflow-y: auto）の左右はカードの端とぴったり同じ位置で、
   * カードの光がその線で切られていた。
   */
  const screensCss = asCss(screensCssInline, 'screens.css');
  const travelCss = asCss(travelCssInline, 'travel.css');
  const avatarCss = asCss(avatarCssInline, 'avatar.css');
  const kartaCss = asCss(kartaCssInline, 'karta.css');
  const chatCss = asCss(chatCssInline, 'chat.css');
  const quizCss = asCss(quizCssInline, 'quiz.css');

  it('光の広がりは、用意した逃げ場（--glow-room）に収まっている', () => {
    const room = Number(baseCss.match(/--glow-room:\s*(\d+)px/)?.[1]);
    expect(Number.isFinite(room), '--glow-room が無い').toBe(true);
    for (const name of ['glass-glow', 'glass-glow-on']) {
      const body = glassVar(name);
      // inset でない 0 0 <ぼかし> <広がり> の、外へ届く距離
      const reach = [
        ...body.matchAll(/(?:^|,)\s*0 0 ([\d.]+)px(?: ([\d.]+)px)? rgba?\(/g),
      ].map((m) => Number(m[1]) + Number(m[2] ?? 0));
      expect(reach.length, `--${name} に外へ広がる光が無い`).toBeGreaterThan(0);
      expect(
        Math.max(...reach),
        `--${name} の光が ${Math.max(...reach)}px まで届き、逃げ場 ${room}px を越える`,
      ).toBeLessThanOrEqual(room);
    }
  });

  it('画面の本文は、どの画面でも光の逃げ場を持っている', () => {
    /*
     * 画面ごとの指定で本文に overflow を足すことがある。そのたびに
     * 逃げ場を足し忘れると、中のボタンの外周と光がその箱の縁で切られる。
     * 実際、国紹介（.screen--intro .screen__body { overflow-y: auto }）は
     * 逃げ場が無く、下部の「この国でことばを集める」の左右が余裕0pxで
     * 切られていた。
     *
     * そこで逃げ場は基本の .screen__body が持つ。
     * 画面ごとの指定が padding / margin の一括指定でそれを消していないことも見る。
     */
    const base = screensCss.match(/\n\.screen__body \{[^}]*\}/);
    expect(base, '.screen__body の指定が見つからない').not.toBeNull();
    const decls = (base as RegExpMatchArray)[0];
    expect(decls, '本文に光のぶんの余白が無い').toMatch(/padding:[^;]*var\(--glow-room\)/);
    expect(decls, '本文に引き戻しが無い').toMatch(
      /margin-left:\s*calc\(var\(--glow-room\) \* -1\)/,
    );
    expect(decls, '本文に引き戻しが無い').toMatch(
      /margin-right:\s*calc\(var\(--glow-room\) \* -1\)/,
    );

    /*
     * 画面ごとの .screen__body の指定が、padding / margin の一括指定で
     * 逃げ場を消していないこと。消すなら、その指定の中で逃げ場を持ち直すこと。
     */
    const all = [screensCss, travelCss, avatarCss, kartaCss, chatCss, quizCss];
    for (const source of all) {
      const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of clean.matchAll(/([^{}]*\.screen__body)\s*\{([^}]*)\}/g)) {
        const head = m[1].trim().replace(/\s+/g, ' ');
        if (head === '.screen__body') continue;
        const body = m[2];
        for (const prop of ['padding', 'margin']) {
          const shorthand = new RegExp(`(^|;|\\n)\\s*${prop}:\\s*([^;]+);`);
          const hit = body.match(shorthand);
          if (hit === null) continue;
          expect(
            hit[2],
            `「${head}」の ${prop} 一括指定が光の逃げ場を消している: ${hit[2].trim()}`,
          ).toContain('--glow-room');
        }
      }
    }
  });

  it('切る箱には、光のぶんの余白と、同じだけの引き戻しがある', () => {
    /*
     * 内側へ余白を足し、同じ分だけ外へ引き戻す（padding と負の margin）。
     * こうするとボタンの位置と大きさは変わらず、光だけが切られなくなる。
     * アプリ全体の切り取りやスクロールの指定は外さない。
     */
    const blocks: Array<[string, RegExp]> = [
      ['.option-grid', /\.option-grid \{[^}]*\}/],
      // 本文の逃げ場は基本の .screen__body が持つ（上の検査で見ている）。
    ];
    for (const [name, pattern] of blocks) {
      const found = screensCss.match(pattern);
      expect(found, `${name} の指定が見つからない`).not.toBeNull();
      const decls = (found as RegExpMatchArray)[0];
      expect(decls, `${name} が切る箱でなくなっている`).toMatch(/overflow(-y)?:\s*(hidden|auto)/);
      expect(decls, `${name} に光のぶんの余白が無い`).toMatch(/padding[^:]*:\s*[^;]*var\(--glow-room\)/);
      expect(decls, `${name} に引き戻しが無い`).toMatch(
        /margin[^:]*:\s*[^;]*calc\(var\(--glow-room\) \* -1\)/,
      );
    }
  });

  it('隣り合うボタンのあいだに、光が収まる間隔がある', () => {
    const room = Number(baseCss.match(/--glow-room:\s*(\d+)px/)?.[1]);
    const gaps: Array<[string, RegExp]> = [
      ['.option-grid', /\.option-grid \{[^}]*\}/],
      ['.chip-grid', /\.chip-grid \{[^}]*\}/],
      ['.button-row', /\.button-row \{[^}]*\}/],
    ];
    for (const [name, pattern] of gaps) {
      const decls = screensCss.match(pattern)?.[0] ?? '';
      const gap = Number(decls.match(/\n\s*gap:\s*(\d+)px/)?.[1]);
      expect(Number.isFinite(gap), `${name} の間隔が読めない`).toBe(true);
      // 両側から光が出るので、間隔は光の届く距離の2倍を下回らない。
      expect(gap, `${name} の間隔 ${gap}px では両側の光が重なる`).toBeGreaterThanOrEqual(room * 2 - 4);
    }
  });
});

describe('淡い青ガラス（補助の操作）', () => {
  /*
   * 補助の操作だけを少し淡くする。どのボタンに当てるかは、
   * 画面と表示文言を照らし合わせて選んである（docs/kotoba-soft-buttons-v1.txt）。
   * 対象外のボタンまで一括で淡くしない。
   */
  const screenSources: Array<[string, string]> = [
    ['screenShell.ts', screenShellSource],
    ['titleScreen.ts', titleScreenSource],
    ['npcBar.ts', npcBarSource],
    ['chatPanel.ts', chatPanelSource],
    ['kartaScreen.ts', kartaScreenSource],
    ['quizPromptScreen.ts', quizPromptSource],
    ['waveQuizScreen.ts', waveQuizSource],
    ['resultScreen.ts', resultSource],
    ['passportScreen.ts', passportSource],
    ['courseScreens.ts', courseSource],
    ['travelScreen.ts', travelSource],
  ];

  it('面だけが淡く、半透明になっている（文字と絵記号は薄くしない）', () => {
    const rule = baseCss.match(/\.btn--soft,\s*\n\.avatar-filter__btn \{([^}]*)\}/);
    expect(rule, '淡い青ガラスの指定が見つからない').not.toBeNull();
    const body = (rule as RegExpMatchArray)[1];
    expect(body, '面が共通の変数から来ていない').toMatch(/background-image:[^;]*var\(--glass-face-soft\)/);
    // ボタン全体の opacity では調整しない。
    expect(body, 'ボタン全体の opacity で薄くしている').not.toMatch(/\n\s*opacity:/);
    // 文字色を触らない（共通の白のまま）。
    expect(body, '文字色を変えている').not.toMatch(/\n\s*color:/);

    const face = baseCss.match(/--glass-face-soft:([\s\S]*?);/);
    expect(face, '--glass-face-soft が無い').not.toBeNull();
    const stops = [
      ...(face as RegExpMatchArray)[1].matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g),
    ].map((m) => ({ r: +m[1], g: +m[2], b: +m[3], a: Number(m[4]) }));
    expect(stops.length, '淡い面の段が少なすぎる').toBeGreaterThanOrEqual(5);
    for (const c of stops) {
      // 半透明であること（背景が透ける）。
      expect(c.a, `段 rgba(${c.r},${c.g},${c.b},${c.a}) が不透明`).toBeLessThan(1);
      // 青であること。白濁した水色にしない。
      expect(c.b - c.r, `段 rgb(${c.r},${c.g},${c.b}) の青みが足りない`).toBeGreaterThanOrEqual(150);
      expect(c.g, `段 rgb(${c.r},${c.g},${c.b}) が白っぽい`).toBeLessThan(c.b - 60);
    }

    /*
     * いちばん明るい背景（白）に重ねても、白い文字が 4.5:1 を保つこと。
     *
     * 面の見え方は「塗りだけ」では決まらない。
     *   1. backdrop-filter が背後を暗くする（brightness）
     *   2. そのうえに薄い塗りが乗る
     * の順に重なるので、同じ順で計算する。
     * 塗りだけで判定すると、ぼかしで暗くしているぶんを見落とす。
     */
    const backdrop = baseCss.match(/--glass-backdrop-soft:([^;]*);/);
    expect(backdrop, '--glass-backdrop-soft が無い').not.toBeNull();
    const brightness = Number(
      (backdrop as RegExpMatchArray)[1].match(/brightness\(([\d.]+)\)/)?.[1],
    );
    expect(Number.isFinite(brightness), 'backdrop-filter に brightness が無い').toBe(true);
    expect(brightness, '背後を暗くしていない（白い文字が読めなくなる）').toBeLessThan(1);

    const solid = stops.filter((_, i) => i >= 2 && i <= stops.length - 3);
    expect(solid.length, '文字の高さに当たる段が無い').toBeGreaterThan(0);
    const dimmedWhite = 255 * brightness;
    for (const c of solid) {
      const eff = {
        r: c.r * c.a + dimmedWhite * (1 - c.a),
        g: c.g * c.a + dimmedWhite * (1 - c.a),
        b: c.b * c.a + dimmedWhite * (1 - c.a),
        a: 1,
      };
      const value = contrast(eff, WHITE);
      expect(
        value,
        `白い背景に重ねたとき rgb(${Math.round(eff.r)},${Math.round(eff.g)},${Math.round(eff.b)}) で ${value.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  it('ぼかしが効かない環境では、読める濃さの面へ戻す', () => {
    /*
     * 面の青さと暗さは背後のぼかしで作っているので、効かない環境では
     * 薄い塗りだけが残り、明るい画面で白い文字が読めなくなる。
     * その環境だけ、通常の青ガラスの面（不透明）へ戻す。
     */
    const m = baseCss.match(
      /@supports not \(\(backdrop-filter: blur\(2px\)\) or \(-webkit-backdrop-filter: blur\(2px\)\)\)\s*\{([\s\S]*?)\n\}/,
    );
    expect(m, 'ぼかしが効かない環境向けの指定が見つからない').not.toBeNull();
    const body = (m as RegExpMatchArray)[1];
    expect(body, '淡いボタンの備えが無い').toContain('.btn--soft');
    expect(body, '絞り込みの備えが無い').toContain('.avatar-filter__btn');
    // 戻す先は、不透明な通常の青ガラスの面。
    expect(body, '戻す先が通常の面ではない').toMatch(/background-image:[^;]*var\(--glass-face\)/);
  });

  it('淡くするのは、指定された補助の操作だけ', () => {
    /*
     * 同じクラスを持つが指定に無いボタンへ、まとめて当てていないこと。
     *   カルタの「やめる」   … もどると同じ btn--back
     *   移動中の「スキップ」  … 「今回はスキップ」とは別のボタン
     */
    const quit = kartaScreenSource.match(/button\(UI\.karta\.quit[\s\S]{0,200}?\}\)/);
    expect(quit, 'カルタの「やめる」が見つからない').not.toBeNull();
    expect((quit as RegExpMatchArray)[0], 'カルタの「やめる」まで淡くしている').not.toContain(
      'btn--soft',
    );
    const travelSkip = travelSource.match(/button\(UI\.actions\.skip[\s\S]{0,160}?\}\)/);
    expect(travelSkip, '移動中の「スキップ」が見つからない').not.toBeNull();
    expect((travelSkip as RegExpMatchArray)[0], '移動中の「スキップ」まで淡くしている').not.toContain(
      'btn--soft',
    );
    /*
     * CSS 側でも、.btn--back のような広いクラスへ一括で当てていない。
     * 注記（/* ... *\/）の中の文字は数えない。
     */
    const cssOnly = baseCss.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of cssOnly.matchAll(/(^|\})([^{}]*)\{([^}]*)\}/g)) {
      if (!m[3].includes('--glass-face-soft')) continue;
      const head = m[2].trim().replace(/\s+/g, ' ');
      expect(
        head,
        `淡い面を広いクラスへ当てている: ${head}`,
      ).toBe('.btn--soft, .avatar-filter__btn');
    }
  });

  it('指定された補助の操作には、もれなく当たっている', () => {
    const expected: Array<[string, RegExp]> = [
      ['もどる（screenShell）', /UI\.actions\.back[\s\S]{0,160}?btn--soft/],
      ['表紙のマイパスポート', /UI\.actions\.passport[\s\S]{0,200}?t-sub-btn btn--soft/],
      ['表紙の設定', /UI\.actions\.settings[\s\S]{0,200}?t-sub-btn btn--soft/],
      ['はなしかける', /UI\.chat\.open[\s\S]{0,160}?btn--soft/],
      ['カルタ音設定のとじる', /UI\.karta\.soundSettingsClose[\s\S]{0,160}?btn--soft/],
      ['今回はスキップ（案内）', /UI\.actions\.skipQuiz[\s\S]{0,160}?btn--soft/],
      ['今回はスキップ（ウェーブ）', /UI\.actions\.skipQuiz[\s\S]{0,160}?btn--soft/],
      ['旅をつづける', /UI\.actions\.continue[\s\S]{0,200}?btn--soft/],
      ['結果のマイパスポート', /UI\.actions\.passport[\s\S]{0,200}?btn--soft/],
      ['記録の設定', /UI\.actions\.settings[\s\S]{0,200}?btn--soft/],
      ['まず3ペアで試す', /trial-entry__btn btn--soft/],
    ];
    const all = screenSources.map(([, src]) => src).join('\n');
    for (const [name, pattern] of expected) {
      expect(pattern.test(all), `${name} に淡い青ガラスが当たっていない`).toBe(true);
    }
    // 会話の「とじる」は2か所とも当てる。
    const closes = [...chatPanelSource.matchAll(/UI\.chat\.close[\s\S]{0,200}?\}\)/g)];
    expect(closes.length, '会話の「とじる」が見つからない').toBeGreaterThanOrEqual(2);
    for (const m of closes) {
      expect(m[0], '会話の「とじる」に淡い青ガラスが当たっていない').toContain('btn--soft');
    }
  });
});

describe('画面ごとの別の青が残っていない', () => {
  it('表紙・主人公・カルタの各CSSが、ボタンの面を自前で持たない', () => {
    const cases: Array<[string, string, string[]]> = [
      ['title.css', titleCss, ['.t-start', '.t-sub-btn']],
    ];
    for (const [name, source, selectors] of cases) {
      for (const sel of selectors) {
        const found = source.match(new RegExp(`\\${sel}\\s*\\{[^}]*\\}`));
        expect(found, `${name} に ${sel} が無い`).not.toBeNull();
        // 注記（/* ... */）に書いた「以前の値」は数えない。
        const decls = (found as RegExpMatchArray)[0].replace(/\/\*[\s\S]*?\*\//g, '');
        expect(decls, `${name} の ${sel} に面の色が残っている`).not.toMatch(/background/);
        expect(decls, `${name} の ${sel} に縁と光が残っている`).not.toMatch(/box-shadow/);
        expect(decls, `${name} の ${sel} に文字の影が残っている`).not.toMatch(/text-shadow/);
      }
    }
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

  it('押せないボタンには反応させない', () => {
    expect(hoverMedia()).toContain('.btn:not(:disabled):hover');
    expect(hoverMedia()).toContain('.btn--danger:not(:disabled):hover');
  });

  it('hover の指定はメディアクエリの外に置かれていない', () => {
    // 行頭の .btn...:hover は、メディアクエリの中ではインデントされる。
    expect(baseCss).not.toMatch(/^\.btn[^\n{]*:hover\s*\{/m);
  });

  /*
   * 以前は hover で面の色を明るくし、5種類の背後に重ねて
   * 「明るくしてもコントラストが下がらない」ことを確かめていた。
   *
   * いまは面の色を変えず、縁の光だけを強める。
   * 面が変わらないのだから、どの背後でもコントラストは通常状態と同じになる
   *   （「下がらない」より強い保証）。
   * そこで「面の色を変えていないこと」を直接確かめる。
   */
  describe('hover では面の色を変えず、縁の光だけを強める', () => {

    it('面の色を変えていない（コントラストが通常状態から動かない）', () => {
      const media = hoverMedia();
      // メディアクエリの中で、ボタンの面を塗り替えていない。
      expect(media, 'hover で面を塗り替えている').not.toMatch(
        /\n\s*\.(btn|option-card|option-chip|karta__sound-btn)[^{]*\{[^}]*background(-color|-image)?:/,
      );
    });

    it('縁の光を、選択中と同じ強さに上げている', () => {
      expect(hoverMedia(), 'hover で縁の光を強めていない').toContain('var(--glass-glow-on)');
    });

    it('記録を消す操作の hover も、青へ寄せていない', () => {
      const danger = hoverBlock('.btn--danger:not(:disabled):hover');
      expect(danger, '消す操作の hover が青になっている').not.toContain('--glass');
    });
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
  it('ボタンの面は base.css の1か所だけで決めている', () => {
    /*
     * 以前は「.btn--primary が base.css に1つだけ」を見ていた。
     * いまは主要・副・もどるの区別を色で付けないので、.btn--primary に
     * 面の指定そのものが無い。見る対象を「面を決めている場所の数」へ移す。
     */
    const glassRules = baseCss.match(/\n\.btn,[\s\S]*?\{[\s\S]*?\}/g) ?? [];
    expect(glassRules, '共通の青ガラスが1か所でない').toHaveLength(1);
  });

  it('base.css 以外に、ボタンや選択面の色が残っていない', () => {
    /*
     * 「画面ごとに別の青が残らないようにする」ことを、ファイル横断で見る。
     * 対象は押すもののセレクタだけ。情報を載せる面（.npc-bar / .stat-tile /
     * .intro-card / .chara-card / .quiz__card / .avatar-confirm）と
     * カルタの札（.card）は今回の対象外なので数えない。
     */
    /*
     * 人物カード（.avatar-card）はここに入れない。
     * カード全面を濃い青にすると人物と名前の見分けが弱くなるため、
     * 白い半透明の面のままにしてある（決まりは avatarSelectScreen.test.ts）。
     */
    const TARGETS =
      /(\.btn\b|\.option-card\b|\.option-chip\b|\.map-pin\b|\.avatar-tab\b|\.avatar-filter__btn\b|\.karta__sound-btn\b|\.t-start\b|\.t-sub-btn\b|\.npc-bar__btn\b|\.trial-entry__btn\b)/;
    for (const [name, source] of OTHER_CSS) {
      // 注記（/* ... */）に書いた「以前の値」は数えない。
      const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const rule of clean.split('}')) {
        const [head, body] = [rule.split('{')[0] ?? '', rule.split('{')[1] ?? ''];
        /*
         * ボタンそのものを指しているときだけ見る。
         * 「.avatar-card の中の人物画像」のように、ボタンの中身を指す指定は
         * ボタンの面ではないので数えない（セレクタの最後がボタンかで判断する）。
         */
        const last = head
          .split(',')
          .map((one) => one.trim().split(/\s+|>/).filter(Boolean).pop() ?? '')
          .filter((one) => one.length > 0);
        if (last.length === 0 || !last.some((one) => TARGETS.test(one))) continue;
        // 情報面やカードを含むセレクタは対象外。
        if (/\.npc-bar\s|\.stat-tile|\.intro-card|\.chara-card|\.quiz__card|\.avatar-confirm\b/.test(head)) continue;
        // 選択中のチェック印（::before / ::after）は面ではなく印なので数えない。
        if (/::(before|after)/.test(head)) continue;
        expect(
          body,
          `${name} の「${head.trim().replace(/\s+/g, ' ')}」が独自の面を持っている`,
          // 面を「置かない」指定（none / transparent）は、色を足していないので数えない。
        ).not.toMatch(/(^|\s)background(-color|-image)?:\s*(?!none|transparent)/);
        expect(
          body,
          `${name} の「${head.trim().replace(/\s+/g, ' ')}」が独自の backdrop-filter を持っている`,
        ).not.toMatch(/backdrop-filter:/);
        expect(
          body,
          `${name} の「${head.trim().replace(/\s+/g, ' ')}」が文字の下に暗い影を置いている`,
        ).not.toMatch(/text-shadow:\s*0/);
      }
    }
  });

  it('.btn の土台にタップ領域と角丸が入っている', () => {
    expect(prop(btn, 'min-height')).toBe('var(--tap-min)');
    expect(prop(btn, 'border-radius')).toBe('var(--radius)');
  });
});
