import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { TITLE_ASSETS, TITLE_ASSET_SIZES } from '../data/titleAssets';
import type { AppContext } from '../app/state';

/**
 * 正式表紙。
 *
 * 背景・ロゴ・キャラクター・ボタンを別レイヤーの DOM として重ねる。
 * 文字は画像へ焼き込まず、ボタンは通常の <button> のまま保つ。
 * 画像の読み込みに失敗しても、ボタン操作が不能にならないようにする。
 */
export function titleScreen(ctx: AppContext): HTMLElement {
  const root = el('section', { class: 'screen screen--fixed screen--title' });

  const background = el('img', {
    class: 'title__bg',
    src: TITLE_ASSETS.background,
    width: TITLE_ASSET_SIZES.background.width,
    height: TITLE_ASSET_SIZES.background.height,
    alt: '',
    'aria-hidden': 'true',
    decoding: 'async',
    fetchpriority: 'high',
  });
  // 背景が出なくても下地のグラデーションで成立させる。
  background.addEventListener('error', () => background.remove());

  const logo = el('img', {
    class: 'title__logo',
    src: TITLE_ASSETS.logo,
    width: TITLE_ASSET_SIZES.logo.width,
    height: TITLE_ASSET_SIZES.logo.height,
    alt: `${UI.app.titleJa} ${UI.app.titleEn}`,
    decoding: 'async',
    fetchpriority: 'high',
  });
  // ロゴが出ない場合は文字だけの代替表示へ切り替える。
  logo.addEventListener('error', () => root.classList.add('is-logo-missing'));

  const mascot = el('img', {
    class: 'title__mascot',
    src: TITLE_ASSETS.mascot,
    width: TITLE_ASSET_SIZES.mascot.width,
    height: TITLE_ASSET_SIZES.mascot.height,
    alt: UI.characters.guideAlt,
    decoding: 'async',
  });
  mascot.addEventListener('error', () => mascot.remove());

  const startButton = button(UI.actions.start, () => ctx.startJourney(), {
    class: 'btn btn--primary btn--large',
  });

  root.append(
    background,
    el('div', { class: 'title__scrim' }),
    el('div', { class: 'title__head' }, [
      logo,
      el('div', { class: 'title__logo-fallback' }, [
        el('p', { class: 'title__ja', text: UI.app.titleJa }),
        el('p', { class: 'title__en', text: UI.app.titleEn }),
      ]),
    ]),
    el('div', { class: 'title__stage' }, [mascot]),
    el('div', { class: 'title__actions' }, [
      startButton,
      el('div', { class: 'title__sub-actions' }, [
        button(UI.actions.passport, () => ctx.navigate({ name: 'passport' }), { class: 'btn btn--ghost' }),
        button(UI.actions.settings, () => ctx.navigate({ name: 'settings' }), { class: 'btn btn--ghost' }),
      ]),
    ]),
    el('p', { class: 'title__note', text: UI.app.grayboxNote }),
  );

  return root;
}
