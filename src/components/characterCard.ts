import { el } from '../app/dom';
import type { AgeGroupCharacters } from '../data/characters';

/**
 * 額装した一枚絵のカード。
 *
 * 提供素材はどれも背景込みの一枚絵で、透過された立ち絵ではない。
 * そのため人物だけを切り抜いたように見せる小細工はせず、
 * 写真やイラストのカードとしてそのまま額装して見せる。
 *
 * 絵の出どころは2種類ある。
 * - 国別の正式イラスト（countryArt.ts）: 行き先の風景。人物は焼き込まれていない。
 * - 年齢層キャラクター（characters.ts）: 男女2人組の情景イラスト。
 *
 * 年齢層キャラクターは「本人」ではなく、年代ごとに固定された2人組なので、
 * 旅をする本人と取りちがえられる場所では使わない。
 * 本人は必ず avatarThumb と名前の組で別に出す。
 */

export interface SceneImage {
  src: string;
  /** 読み上げ用の説明。 */
  alt: string;
  /** 原寸。読み込み前の場所取りに使い、レイアウトのずれを防ぐ。 */
  width?: number;
  height?: number;
  /**
   * 横長の枠へ収めるときに見せる高さの中心（0=上端、1=下端）。
   * 指定が無ければ CSS の既定（中央）に任せる。
   */
  focusY?: number;
}

export interface CharacterCardOptions {
  /** 見た目の種類。旅の文脈に合わせて額装を変える。 */
  variant?: 'plain' | 'album' | 'boarding' | 'photo';
  class?: string;
  /** 画像に添えるキャプション。 */
  caption?: string;
  /** 読み上げラベル。省略時は年齢層の説明を使う。 */
  label?: string;
}

/** 一枚絵を額装する。画像が出なくても枠ごと消えるだけで、周囲は崩れない。 */
export function sceneCard(image: SceneImage, options: CharacterCardOptions = {}): HTMLElement {
  const variant = options.variant ?? 'plain';

  const img = el('img', {
    class: 'chara-card__img',
    src: image.src,
    alt: image.alt,
    width: image.width,
    height: image.height,
    loading: 'lazy',
    decoding: 'async',
  });
  if (image.focusY !== undefined) {
    // 枠に収めたときに、どの高さを見せるか。
    img.style.objectPosition = `center ${(image.focusY * 100).toFixed(1)}%`;
  }
  // 画像が出なくてもレイアウトが崩れないよう、枠ごと取り除く。
  img.addEventListener('error', () => figure.classList.add('is-missing'));

  const figure = el(
    'figure',
    { class: `chara-card chara-card--${variant} ${options.class ?? ''}`.trim() },
    [
      el('div', { class: 'chara-card__frame' }, [img]),
      options.caption
        ? el('figcaption', { class: 'chara-card__caption', text: options.caption })
        : null,
    ],
  );

  return figure;
}

/** 年齢層キャラクターのカード画像。 */
export function characterCard(
  group: AgeGroupCharacters,
  options: CharacterCardOptions = {},
): HTMLElement {
  return sceneCard(
    { src: group.image, alt: options.label ?? `${group.label}の男の子と女の子` },
    options,
  );
}
