/**
 * 一覧で人物の頭のてっぺんをそろえるための下げ量。
 *
 * 80枚の人物画像は、頭のてっぺんの位置が画像の上から 0.0% 〜 8.05% まで
 * ばらついている（assets-source/avatars/*.png のアルファ値を実測）。
 * そのままカードの上端へ置くと、頭の高さが人によって最大 8% ずれる。
 *
 * ここに置くのは「いちばん頭が低い人（8.05%）に合わせるための下げ量」で、
 *   下げ量 = 8.05 - その画像の頭のてっぺん（%）
 * になっている。単位はカードの幅に対する % で、CSS 側では
 * margin-top のパーセント（＝包含ブロックの幅が基準）として使う。
 * こうすると画面の大きさが変わっても、そろい方は変わらない。
 *
 * 値は画像そのものから測った実測値で、名前や並び順から推測したものではない。
 * 画像を差し替えたら測り直すこと。測り方は
 *   α>127 の画素が最初に現れる行 ÷ 画像の高さ
 * とした（髪の毛の先まで含める）。
 *
 * 画像が無い人（仮サムネイル）には使わない。
 */
export const AVATAR_HEAD_SHIFT: Readonly<Record<string, number>> = {
  'adult-f-01': 7.5,
  'adult-f-02': 7.34,
  'adult-f-03': 6.46,
  'adult-f-04': 7.18,
  'adult-f-05': 7.81,
  'adult-f-06': 7.58,
  'adult-f-07': 7.89,
  'adult-f-08': 7.42,
  'adult-m-01': 7.89,
  'adult-m-02': 7.26,
  'adult-m-03': 7.5,
  'adult-m-04': 7.66,
  'adult-m-05': 7.34,
  'adult-m-06': 6.22,
  'adult-m-07': 7.42,
  'adult-m-08': 7.1,
  'elementary-f-01': 2.47,
  'elementary-f-02': 3.35,
  /*
   * 陽菜は描き直しPNGへ差し替えたので測り直した。
   *   新しい画像の頭のてっぺん = 3.19%（旧画像は 2.79%）
   * さらに、この人だけ表示を 1.15 倍にしている（AVATAR_DISPLAY_SCALE）。
   * 拡大は画像の上端を基準に掛かるので、頭のてっぺんも 1.15 倍の位置へ下がる。
   * そのぶんを引いて、ほかの79人と同じ 8.05% の高さに頭がそろうようにする。
   *   8.05 - 3.19 × 1.15 = 4.38
   */
  'elementary-f-03': 4.38,
  'elementary-f-04': 6.54,
  'elementary-f-05': 5.34,
  'elementary-f-06': 8.05,
  'elementary-f-07': 6.14,
  'elementary-f-08': 7.89,
  'elementary-m-01': 6.06,
  'elementary-m-02': 6.3,
  'elementary-m-03': 7.18,
  'elementary-m-04': 4.15,
  'elementary-m-05': 5.66,
  'elementary-m-06': 7.42,
  'elementary-m-07': 7.66,
  'elementary-m-08': 5.58,
  'high-f-01': 4.55,
  'high-f-02': 3.19,
  'high-f-03': 7.66,
  'high-f-04': 6.46,
  'high-f-05': 4.55,
  'high-f-06': 6.54,
  'high-f-07': 6.62,
  'high-f-08': 6.06,
  'high-m-01': 6.86,
  'high-m-02': 6.14,
  'high-m-03': 7.66,
  'high-m-04': 6.94,
  'high-m-05': 7.1,
  'high-m-06': 7.81,
  'high-m-07': 7.66,
  'high-m-08': 7.42,
  'middle-f-01': 3.91,
  'middle-f-02': 2.07,
  'middle-f-03': 3.11,
  'middle-f-04': 6.38,
  'middle-f-05': 3.51,
  'middle-f-06': 7.02,
  'middle-f-07': 7.1,
  'middle-f-08': 7.34,
  'middle-m-01': 6.38,
  'middle-m-02': 5.66,
  'middle-m-03': 3.75,
  'middle-m-04': 5.58,
  'middle-m-05': 5.9,
  'middle-m-06': 5.18,
  'middle-m-07': 3.99,
  'middle-m-08': 4.78,
  'university-f-01': 0.0,
  'university-f-02': 3.83,
  'university-f-03': 3.51,
  'university-f-04': 4.15,
  'university-f-05': 5.66,
  'university-f-06': 1.67,
  'university-f-07': 3.99,
  'university-f-08': 4.47,
  'university-m-01': 3.35,
  'university-m-02': 5.18,
  'university-m-03': 4.23,
  'university-m-04': 6.22,
  'university-m-05': 5.02,
  'university-m-06': 5.1,
  'university-m-07': 5.42,
  'university-m-08': 4.94,
};

/**
 * 一覧でだけ掛ける、人物ごとの表示倍率。
 *
 * 画像の中で人物が占める割合は1枚ずつ違う。同じ枠に並べると、
 * 引きで描かれている人は顔が小さく見える。その差を表示側で埋める。
 *
 * 原本のPNGは変更しない。ここで指定するのは見せ方だけで、
 * 拡大は「上中央を基準」に掛かる（頭のてっぺんの位置は
 * AVATAR_HEAD_SHIFT 側で引き算して、ほかの人とそろえてある）。
 *
 * 表に無い人は 1（＝等倍）。いまの指定は陽菜1人だけで、
 * ほかの79人の見え方は変わらない。
 *
 * elementary-f-03（百瀬陽菜／ひな）
 *   差し替え後の画像は人物が小さめに写っており、並べると顔が小さく見える。
 *   ChatGPT側のデザイン指定により 1.15 倍で表示する。
 */
export const AVATAR_DISPLAY_SCALE: Readonly<Record<string, number>> = {
  'elementary-f-03': 1.15,
};

/** 画像キーに対する表示倍率。表に無ければ 1（＝等倍）。 */
export function avatarDisplayScale(imageKey: string | null): number {
  if (imageKey === null) return 1;
  return AVATAR_DISPLAY_SCALE[imageKey] ?? 1;
}

/** 画像キーに対する下げ量。表に無ければ 0（＝下げない）。 */
export function avatarHeadShift(imageKey: string | null): number {
  if (imageKey === null) return 0;
  return AVATAR_HEAD_SHIFT[imageKey] ?? 0;
}
