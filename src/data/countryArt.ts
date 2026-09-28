/**
 * 国別の正式イラスト。
 *
 * 受領物 kotoba-country-montage-v2 の採用画像をそのまま使う。
 * 原寸は assets-source/countries/ に無改変で保管し、
 * public/assets/countries/ にあるのは同じ画素数のまま WebP へ再エンコードしたもの。
 * 縮小・切り抜き・余白調整・色調補正は一切していない。
 *
 * 絵の扱い（受領物 README の表現ルールに従う）：
 * - どの絵も、複数の場所にある名所を1枚に集めて描いた想像の風景。
 *   「ここから全部が見える」と読める説明を付けない。
 * - 絵に特定の登場人物を焼き込まない。旅をする本人は利用者が選んだキャラクターで、
 *   この絵とは別のレイヤー（avatarThumb）に出す。
 *   表紙のパイロットと CA は表紙の絵の中だけの存在で、本人でも固定の同行者でもない。
 * - 桜は日本の絵だけ。ロンドンとパリの絵には桜を使っていない。
 *
 * 解放状態とは無関係のデータである。
 * ロンドンとパリの絵を登録してあるが、行き先の解放は destinations.ts が決める。
 * 現在この2国はロック中で、行き先として選べない。
 */

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export interface CountryArt {
  countryId: string;
  /** 配信用 WebP の URL。 */
  image: string;
  /** 原寸＝配信用の画素数（同じ）。レイアウト計算とテストに使う。 */
  width: number;
  height: number;
  /**
   * 読み上げ用の説明。
   * 絵に描かれているものだけを述べ、事実の主張や案内文は入れない。
   */
  alt: string;
  /** 絵に添える短い一言。合成画であることが伝わる言い方にする。 */
  caption: string;
  /**
   * 横長の枠へ収めるときに、絵のどの高さを中心に見せるか（0=上端、1=下端）。
   *
   * 国の絵はどれも縦長で、画面では横長の窓に収める。そのとき何も指定しないと
   * 中央（0.5）が出るが、名所は絵の上のほうに集まっているので中央では写らない。
   * 実際に窓へ収めた絵を並べて見比べ、その国の名所がいちばん入る値を選んだ。
   *
   * 切り出しているのは画面上の見せ方だけで、画像ファイルには手を加えていない。
   */
  focusY: number;
  /** 由来の受領ファイル名。差し替えと報告のために残す。 */
  sourceFile: string;
}

export const COUNTRY_ART: readonly CountryArt[] = [
  {
    countryId: 'japan',
    image: assetUrl('assets/countries/japan-adopted.webp'),
    width: 709,
    height: 1536,
    alt: '日本の絵。桜、山、五重の塔、川にかかる橋、石だたみの道がならぶ。',
    caption: '日本の名所を集めてえがいた絵',
    // 富士山・五重の塔・鳥居・川がそろう高さ。
    focusY: 0.3,
    sourceFile: 'japan-adopted.jpeg',
  },
  {
    countryId: 'london',
    image: assetUrl('assets/countries/london-adopted.webp'),
    width: 852,
    height: 1847,
    alt: 'ロンドンの絵。時計塔、はね橋、大きな観覧車、赤い二階建てバス、赤い電話ボックスがならぶ。',
    caption: 'ロンドンの名所を集めてえがいた絵',
    // はね橋・時計塔・観覧車がそろう高さ。
    focusY: 0.2,
    sourceFile: 'london-adopted.png',
  },
  {
    countryId: 'paris',
    image: assetUrl('assets/countries/paris-adopted.webp'),
    width: 852,
    height: 1846,
    alt: 'パリの絵。鉄の塔、石の門、ガラスのピラミッド、川にかかる橋、通りのカフェがならぶ。',
    caption: 'パリの名所を集めてえがいた絵',
    // 鉄の塔・石の門・ガラスのピラミッドがそろう高さ。
    focusY: 0.2,
    sourceFile: 'paris-adopted.png',
  },
];

export function findCountryArt(countryId: string | null | undefined): CountryArt | undefined {
  if (!countryId) return undefined;
  return COUNTRY_ART.find((art) => art.countryId === countryId);
}
