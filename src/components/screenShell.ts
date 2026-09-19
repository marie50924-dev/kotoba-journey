import { el, button } from '../app/dom';
import { UI } from '../data/strings';

export interface ShellOptions {
  /** 画面上部の見出し。 */
  title?: string;
  lead?: string;
  onBack?: () => void;
  /** カルタ画面のように縦スクロールさせない画面で true。 */
  fixedHeight?: boolean;
  /** 追加のクラス名。 */
  variant?: string;
}

/** 全画面共通の外枠。safe-area とスクロール方針をここで一元管理する。 */
export function screenShell(options: ShellOptions, body: (HTMLElement | null)[]): HTMLElement {
  const classes = ['screen'];
  if (options.fixedHeight) classes.push('screen--fixed');
  if (options.variant) classes.push(options.variant);

  const header = el('header', { class: 'screen__header' }, [
    options.onBack ? button(UI.actions.back, options.onBack, { class: 'btn btn--ghost btn--back' }) : null,
    options.title ? el('h1', { class: 'screen__title', text: options.title }) : null,
    el('span', { class: 'screen__header-spacer' }),
  ]);

  const main = el('main', { class: 'screen__body' }, [
    options.lead ? el('p', { class: 'screen__lead', text: options.lead }) : null,
    ...body,
  ]);

  return el('section', { class: classes.join(' ') }, [header, main]);
}
