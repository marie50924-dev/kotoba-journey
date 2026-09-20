import { el } from '../app/dom';
import {
  AGE_GROUP_COLOR,
  AGE_GROUP_LABEL,
  displayName,
  fullName,
  type AvatarDefinition,
} from '../data/avatars';

/**
 * キャラクターの仮サムネイル。
 *
 * ★ここが本番立ち絵への差し替え箇所です★
 *
 * 本番用の個別透過立ち絵は未納品のため、ここでは
 *   年代色 + イニシャル（下の名前の先頭1文字） + 名前
 * だけを描いた、ひと目で仮と分かる表示を出している。
 * コンセプトシートの切り抜きは本番素材として使わない。
 *
 * 立ち絵が納品されたら、AvatarDefinition.imageKey に値を入れ、
 * この関数の中だけを <img> 表示へ差し替えれば全画面に反映される。
 * 呼び出し側は変更しなくてよい。
 */

export interface AvatarThumbOptions {
  size?: 'sm' | 'md' | 'lg';
  /** 名前を添えるか。会話の吹き出し横などでは false にする。 */
  withName?: boolean;
  class?: string;
  /** 読み上げラベル。省略時は姓名。 */
  label?: string;
}

/** 下の名前の先頭1文字。色だけに頼らないための手がかり。 */
export function avatarInitial(avatar: AvatarDefinition): string {
  return [...avatar.givenName][0] ?? '?';
}

export function avatarThumb(
  avatar: AvatarDefinition,
  options: AvatarThumbOptions = {},
): HTMLElement {
  const size = options.size ?? 'md';

  // imageKey が入ったら、ここを <img> に差し替える（現在は未納品のため常に null）。
  const face = el(
    'span',
    {
      class: 'avatar-thumb__face',
      style: `--age-color:${AGE_GROUP_COLOR[avatar.ageGroup]}`,
    },
    [
      el('span', { class: 'avatar-thumb__initial', text: avatarInitial(avatar) }),
      el('span', { class: 'avatar-thumb__age', text: AGE_GROUP_LABEL[avatar.ageGroup] }),
    ],
  );

  return el(
    'span',
    {
      class: ['avatar-thumb', `avatar-thumb--${size}`, options.class].filter(Boolean).join(' '),
      role: 'img',
      // 読み上げにも開発状況（仮表示）は出さない。名前と年代だけを伝える。
      'aria-label': options.label ?? `${fullName(avatar)}（${AGE_GROUP_LABEL[avatar.ageGroup]}）`,
    },
    [
      face,
      options.withName
        ? el('span', { class: 'avatar-thumb__name', text: displayName(avatar) })
        : null,
    ],
  );
}
