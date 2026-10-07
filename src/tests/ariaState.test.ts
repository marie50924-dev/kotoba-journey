import { describe, expect, it } from 'vitest';
import { el } from '../app/dom';

/*
 * 選択状態を読み上げへ伝える属性（aria-pressed / aria-selected など）が、
 * 最初の表示から正しい値で出ているかを見る。
 *
 * きっかけ：
 *   世界マップの印が、最初の表示だけ aria-pressed="" になっていた。
 *   見た目は選択中（チェックと強い光）なのに、読み上げには伝わらない。
 *   同じ書き方がコース選択・枚数選択にも残っていた。
 *
 * この画面は node 環境で組み立てられないため（DOM が無い）、
 *   ・el() が真偽値をどう書き出すか
 *   ・画面のコードが aria-* に何を渡しているか
 * の2つに分けて確かめる。実際に描かれた属性値は、
 * 実ブラウザ（Chromium）の確認で別途測っている。
 */

describe('選択状態を伝える属性', () => {
  it('el() は真偽値を属性の値として使えない（だから文字列で渡す）', () => {
    /*
     * ここは el() の仕様を変えずに、仕様を書き留めておくための確認。
     * true は空文字になり、false は属性ごと消える。
     * disabled や hidden はそれで正しいが、aria-pressed では困る。
     */
    const dom = globalThis as unknown as { document?: Document };
    if (!dom.document) {
      // node 環境では DOM が無いので、ここは飛ばす（下の文字列の検査は走る）。
      expect(typeof el).toBe('function');
      return;
    }
    const on = el('button', { 'aria-pressed': true });
    const off = el('button', { 'aria-pressed': false });
    expect(on.getAttribute('aria-pressed')).toBe('');
    expect(off.hasAttribute('aria-pressed')).toBe(false);
  });

  /*
   * 画面のコードが「状態の属性」へ渡している値を、ソースのまま読む。
   *
   * ここで見るのは "true" / "false" しか取らない属性だけ。
   * 文言（aria-label）や相手の id（aria-controls）は対象にしない。
   */
  const STATE_ATTRS = ['aria-pressed', 'aria-selected', 'aria-checked', 'aria-expanded', 'aria-hidden'];

  const sources = import.meta.glob('../{screens,components}/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  it('画面のコードを読めている', () => {
    expect(Object.keys(sources).length, '画面のコードが1つも読めていない').toBeGreaterThan(10);
  });

  it('状態の属性に、真偽値をそのまま渡していない', () => {
    const bad: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      // 注記の中は数えない。
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      for (const m of code.matchAll(/'(aria-[a-z-]+)':\s*([^,\n}]+)/g)) {
        const name = m[1];
        if (!STATE_ATTRS.includes(name)) continue;
        const value = m[2].trim();
        const ok =
          /^'(true|false)'$/.test(value) || // 'true' / 'false'
          /^String\(/.test(value) || // String(...) で文字列にしている
          /\?[^:]*'(true|false)'/.test(value); // 条件で 'true' を選んでいる
        if (!ok) bad.push(`${path} の ${name}: ${value}`);
      }
    }
    expect(bad, `真偽値をそのまま渡している箇所:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  it('選択状態の属性は、選択中の見た目と同じ条件から作っている', () => {
    /*
     * 見た目（is-selected）と読み上げ（aria-pressed）が別々の条件になると、
     * 片方だけ合っている状態が生まれる。同じ式から作っていることを見る。
     */
    const cases: Array<[string, string, RegExp]> = [
      [
        'コース選択',
        '../screens/courseScreens.ts',
        /option-chip\$\{course\.id === selectedId[\s\S]{0,400}?'aria-pressed': String\(course\.id === selectedId\)/,
      ],
      [
        '枚数選択',
        '../screens/courseScreens.ts',
        /option-card--count\$\{ctx\.selection\.cardCount === count[\s\S]{0,400}?'aria-pressed': String\(ctx\.selection\.cardCount === count\)/,
      ],
      [
        '世界マップの印',
        '../screens/worldMapScreen.ts',
        /selected \? 'is-selected'[\s\S]{0,700}?'aria-pressed': String\(selected\)/,
      ],
    ];
    for (const [name, path, pattern] of cases) {
      const source = sources[path];
      expect(source, `${path} が読めない`).toBeTruthy();
      expect(pattern.test(source), `${name} の選択状態が、見た目と同じ条件から作られていない`).toBe(
        true,
      );
    }
  });

  it('押したあとも、属性を実際の選択状態に合わせ直している（世界マップ）', () => {
    /*
     * 世界マップだけは、画面を作り直さずにその場で選択が変わる。
     * そのため、押したときに属性も書き換えていることを見る。
     */
    const source = sources['../screens/worldMapScreen.ts'];
    expect(source, 'worldMapScreen.ts が読めない').toBeTruthy();
    expect(source, '押されなかった印を false に戻していない').toContain(
      "other.setAttribute('aria-pressed', 'false')",
    );
    expect(source, '押された印を true にしていない').toContain(
      "pin.setAttribute('aria-pressed', 'true')",
    );
  });
});
