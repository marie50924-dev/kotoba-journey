import { el } from '../app/dom';
import type { AgeGroupCharacters } from '../data/characters';

/**
 * 年齢層キャラクターのカード画像。
 *
 * 提供素材は背景込みの JPEG で、透過された個別立ち絵ではない。
 * そのため人物だけを切り抜いたように見せる小細工はせず、
 * 写真やイラストのカードとしてそのまま額装して見せる。
 */

export interface CharacterCardOptions {
  /** 見た目の種類。旅の文脈に合わせて額装を変える。 */
  variant?: 'plain' | 'album' | 'boarding' | 'photo';
  class?: string;
  /** 画像に添えるキャプション。 */
  caption?: string;
  /** 読み上げラベル。省略時は年齢層の説明を使う。 */
  label?: string;
}

export function characterCard(
  group: AgeGroupCharacters,
  options: CharacterCardOptions = {},
): HTMLElement {
  const variant = options.variant ?? 'plain';

  const image = el('img', {
    class: 'chara-card__img',
    src: group.image,
    alt: options.label ?? `${group.label}の男の子と女の子`,
    loading: 'lazy',
    decoding: 'async',
  });
  // 画像が出なくてもレイアウトが崩れないよう、枠ごと取り除く。
  image.addEventListener('error', () => figure.classList.add('is-missing'));

  const figure = el('figure', { class: `chara-card chara-card--${variant} ${options.class ?? ''}`.trim() }, [
    el('div', { class: 'chara-card__frame' }, [image]),
    options.caption ? el('figcaption', { class: 'chara-card__caption', text: options.caption }) : null,
  ]);

  return figure;
}
