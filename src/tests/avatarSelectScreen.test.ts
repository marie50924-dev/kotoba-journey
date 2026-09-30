import { describe, expect, it } from 'vitest';
import avatarCssInline from '../styles/avatar.css?inline';
import selectScreenSource from '../screens/avatarSelectScreen.ts?raw';
import screenShellSource from '../components/screenShell.ts?raw';
import confirmScreenSource from '../screens/avatarConfirmScreen.ts?raw';
import settingsScreenSource from '../screens/settingsScreen.ts?raw';
import { UI } from '../data/strings';
import { AVATARS, fullName } from '../data/avatars';

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
  const m = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(m, `${selector} の指定が見つからない`).not.toBeNull();
  return (m as RegExpMatchArray)[1];
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
    // 表紙の下部と同じ暖色が入っていること。
    expect(b).toContain('244, 206, 150');
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
