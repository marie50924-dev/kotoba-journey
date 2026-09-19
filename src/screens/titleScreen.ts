import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import type { AppContext } from '../app/state';

/**
 * 表紙。背景は正式な表紙画像が用意できるまで CSS のグラデーションで代用する。
 * 文字は画像へ焼き込まず、すべてテキストとして描画する。
 */
export function titleScreen(ctx: AppContext): HTMLElement {
  return el('section', { class: 'screen screen--fixed screen--title' }, [
    el('div', { class: 'title__sky' }, [
      el('div', { class: 'title__sun' }),
      el('div', { class: 'title__cloud title__cloud--a' }),
      el('div', { class: 'title__cloud title__cloud--b' }),
      el('div', { class: 'title__ground' }),
    ]),
    el('div', { class: 'title__content' }, [
      el('p', { class: 'title__badge', text: UI.app.grayboxBadge }),
      el('h1', { class: 'title__ja', text: UI.app.titleJa }),
      el('p', { class: 'title__en', text: UI.app.titleEn }),
      el('p', { class: 'title__tagline', text: UI.app.tagline }),
      el('div', { class: 'title__actions' }, [
        button(UI.actions.start, () => ctx.navigate({ name: 'courseEntry' }), {
          class: 'btn btn--primary btn--large',
        }),
        el('div', { class: 'title__sub-actions' }, [
          button(UI.actions.passport, () => ctx.navigate({ name: 'passport' }), {
            class: 'btn btn--ghost',
          }),
          button(UI.actions.settings, () => ctx.navigate({ name: 'settings' }), {
            class: 'btn btn--ghost',
          }),
        ]),
      ]),
    ]),
  ]);
}
