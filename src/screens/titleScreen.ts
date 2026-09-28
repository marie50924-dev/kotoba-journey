import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import {
  TITLE_BACKGROUND_POSITION_Y,
  TITLE_LAYERS,
  TITLE_LAYER_SIZES,
} from '../data/titleAssets';
import { chevronIcon, gearIcon, passportIcon, planeIcon } from '../components/titleIcons';
import type { AppContext } from '../app/state';

/**
 * 正式表紙。
 *
 * 背景・ロゴ・人物・操作を別のレイヤーとして重ねる。
 * 採用見本（assets-source/title/layered-v1/approved-preview.png）に合わせた配置で、
 * 素材そのものには手を加えていない。
 *
 * レイヤー
 *   0 背景   : object-fit: cover。画面を必ず覆うので左右の余白は常に0。
 *              切り取られるのは背景だけで、ロゴにも人物にもボタンにも当たらない。
 *              縦の見せ方（object-position）は、どの画面でも地球儀が
 *              画面の約26%の高さに来る値を実測で決めてある。
 *   1 明度調整: 下側だけ少し沈めて、ボタンの文字を読めるようにする。
 *   2 ロゴ   : 透過画像。地球儀の上に収まる位置と大きさにする。
 *   3 人物   : 透過画像。パイロット・CA・旅行かばん。
 *              頭が地球儀より下、靴が主ボタンより上に来る高さへ収める。
 *   4 主操作 : 「旅をはじめる」。画面でいちばん目立つ本物の <button>。
 *   5 副操作 : 「マイパスポート」「設定」。主ボタンより小さく下に置く。
 *
 * 絵の中にボタンを描いていないので、飾りのボタンと本物のボタンが
 * 二重に見えることも、一部だけ残ることもない。
 */
export function titleScreen(ctx: AppContext): HTMLElement {
  const root = el('section', { class: 'screen screen--fixed screen--title' });

  const background = el('img', {
    class: 't-bg',
    src: TITLE_LAYERS.background,
    width: TITLE_LAYER_SIZES.background.width,
    height: TITLE_LAYER_SIZES.background.height,
    alt: '',
    'aria-hidden': 'true',
    decoding: 'async',
    fetchpriority: 'high',
  });
  // 縦の見せ方はデータ側の実測値だけを正とし、CSS へ数字を書かない。
  background.style.objectPosition = `center ${(TITLE_BACKGROUND_POSITION_Y * 100).toFixed(2)}%`;
  // 背景が出なくても下地の色で成立させる。
  background.addEventListener('error', () => background.remove());

  const logo = el('img', {
    class: 't-logo',
    src: TITLE_LAYERS.logo,
    width: TITLE_LAYER_SIZES.logo.width,
    height: TITLE_LAYER_SIZES.logo.height,
    alt: `${UI.app.titleJa} ${UI.app.titleEn}`,
    decoding: 'async',
    fetchpriority: 'high',
  });
  // ロゴが出ないときは文字だけの代替へ切り替える。
  logo.addEventListener('error', () => root.classList.add('is-logo-missing'));

  const characters = el('img', {
    class: 't-cast',
    src: TITLE_LAYERS.characters,
    width: TITLE_LAYER_SIZES.characters.width,
    height: TITLE_LAYER_SIZES.characters.height,
    // 旅の案内役の絵。操作には関わらないので読み上げからは外す。
    alt: '',
    'aria-hidden': 'true',
    decoding: 'async',
  });
  characters.addEventListener('error', () => characters.remove());

  // 採用見本と同じ絵記号を添える。記号は飾りで、読み上げと押せる範囲は文字が持つ。
  const startButton = button(UI.actions.start, () => ctx.startJourney(), {
    class: 'btn btn--primary t-start',
  });
  startButton.textContent = '';
  startButton.append(
    planeIcon(),
    el('span', { class: 't-label', text: UI.actions.start }),
    chevronIcon(),
  );

  const passportButton = button(UI.actions.passport, () => ctx.navigate({ name: 'passport' }), {
    class: 'btn btn--ghost t-sub-btn',
  });
  passportButton.textContent = '';
  passportButton.append(passportIcon(), el('span', { class: 't-label', text: UI.actions.passport }));

  const settingsButton = button(UI.actions.settings, () => ctx.navigate({ name: 'settings' }), {
    class: 'btn btn--ghost t-sub-btn',
  });
  settingsButton.textContent = '';
  settingsButton.append(gearIcon(), el('span', { class: 't-label', text: UI.actions.settings }));

  const actions = el('div', { class: 't-actions' }, [
    startButton,
    el('div', { class: 't-sub' }, [passportButton, settingsButton]),
  ]);

  root.append(
    background,
    el('div', { class: 't-scrim' }),
    logo,
    el('div', { class: 't-logo-fallback' }, [
      el('p', { class: 't-logo-ja', text: UI.app.titleJa }),
      el('p', { class: 't-logo-en', text: UI.app.titleEn }),
    ]),
    characters,
    actions,
  );

  return root;
}
