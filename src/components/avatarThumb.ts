import { el } from '../app/dom';
import {
  AGE_GROUP_COLOR,
  AGE_GROUP_IMAGE_BACKGROUND,
  AGE_GROUP_LABEL,
  avatarImageUrl,
  displayName,
  fullName,
  type AvatarDefinition,
} from '../data/avatars';

/**
 * キャラクターのサムネイル。
 *
 * imageKey が入っていれば実画像を出し、無ければ仮サムネイルを出す。
 * 切り替えの判断はここ1か所に閉じてあり、呼び出し側（11か所）は変更しなくてよい。
 *
 * 仮サムネイル（imageKey が null のとき）
 *   年代色 + イニシャル（下の名前の先頭1文字） + 年代名 + 名前。
 *   ひと目で仮と分かるよう、白い破線の縁取りを付ける。
 *
 * 実画像（imageKey があるとき）
 *   public/assets/avatars/<imageKey>.webp を読む。円形・object-fit: cover。
 *   仮サムネイルは常に土台として先に描いておき、画像の読み込みが
 *   「成功したときだけ」前面へ出して仮表示を隠す。こうすると
 *     - 読み込み中は仮サムネイルが見えるので、空白にならない
 *     - 失敗したら仮サムネイルがそのまま残るので、名前も年代も消えない
 *     - 要素の大きさは最初から決まっているので、レイアウトが跳ねない
 *   の3つが同時に成り立つ。画像の有無で寸法（96/58/40px）は変わらない。
 *
 * 読み込み失敗は例外にしない。画面の進行を止めないため、error を受けたら
 * 画像を隠すだけにして、こちらから throw もログ出力もしない。
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
  const ageLabel = AGE_GROUP_LABEL[avatar.ageGroup];
  const imageUrl = avatarImageUrl(avatar);

  // 仮サムネイルは、実画像があるかどうかに関わらず必ず土台として描く。
  const fallback = el('span', { class: 'avatar-thumb__fallback' }, [
    el('span', { class: 'avatar-thumb__initial', text: avatarInitial(avatar) }),
    el('span', { class: 'avatar-thumb__age', text: ageLabel }),
  ]);

  const face = el(
    'span',
    {
      class: 'avatar-thumb__face',
      // --age-color は仮サムネイルの地色、--age-image-bg は実画像の透過部分から
      // 見える淡色。どちらも年代（avatar.ageGroup）だけで決まり、名前や並び順には
      // 依存しない。色の値はデータ側の1か所で定義している。
      style:
        `--age-color:${AGE_GROUP_COLOR[avatar.ageGroup]};` +
        `--age-image-bg:${AGE_GROUP_IMAGE_BACKGROUND[avatar.ageGroup]}`,
    },
    [fallback],
  );

  if (imageUrl !== null) {
    const image = el('img', {
      class: 'avatar-thumb__img',
      src: imageUrl,
      // 読み上げは外側の role="img" と aria-label が担うが、
      // 画像単体として扱われた場合にも氏名と年代が伝わるようにしておく。
      alt: `${fullName(avatar)}（${ageLabel}）`,
      decoding: 'async',
      loading: 'lazy',
    });

    // 成功したときだけ前面へ出す。失敗したら画像だけを消す。
    const succeed = (): void => face.classList.add('has-image');
    const fail = (): void => face.classList.add('image-failed');

    image.addEventListener('load', succeed);
    image.addEventListener('error', fail);
    // キャッシュ済みで、listener を付ける前に終わっていた場合を拾う。
    // complete でも naturalWidth が 0 なら読めていない。
    if (image.complete) {
      if (image.naturalWidth > 0) succeed();
      else fail();
    }

    face.append(image);
  }

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
