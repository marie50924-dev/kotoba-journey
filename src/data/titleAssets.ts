/**
 * 表紙の正式採用素材。
 *
 * 原寸ファイルは assets-source/title/ に無改変で保管してある。
 * public/assets/title/ にあるのは配信用の WebP で、
 * 形・色・構図・文字には一切手を加えていない。
 *
 * 一枚絵の表紙（2026-09-28 採用）
 *   title-adopted-pilot-ca : 852x1846 原寸のまま WebP 化  2626KB -> 412KB
 *   ロゴ・パイロット・CA・旅行かばん・開始ボタンの絵が1枚に描かれている。
 *   縮小も切り抜きもしていない。再エンコードだけを行った。
 *
 * 旧・分離レイヤー素材（表紙では使っていない。案内キャラクターだけ移動画面で使う）
 *   title-background : 853x1844  原寸のまま WebP 化        2168KB -> 301KB
 *   title-logo       : 1997x787 -> 1200x473  WebP          1790KB -> 107KB
 *   suitcase-mascot  : 1402x1122 -> 760x608  WebP          1603KB ->  99KB
 */

/** Vite の base を反映した URL を作る。GitHub Pages のサブパス公開に対応する。 */
function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export const TITLE_ASSETS = {
  /** 一枚絵の表紙。ロゴ・人物・開始ボタンの絵をすべて含む。 */
  cover: assetUrl('assets/title/title-adopted-pilot-ca.webp'),
  background: assetUrl('assets/title/title-background.webp'),
  logo: assetUrl('assets/title/title-logo.webp'),
  mascot: assetUrl('assets/title/suitcase-mascot.webp'),
} as const;

/** 素材の原寸。レイアウト計算とテストで使う。 */
export const TITLE_ASSET_SIZES = {
  cover: { width: 852, height: 1846 },
  background: { width: 853, height: 1844 },
  logo: { width: 1200, height: 473 },
  mascot: { width: 760, height: 608 },
} as const;

/**
 * 表紙の絵に描かれている「旅をはじめる」ボタンの位置。
 *
 * 原寸 852x1846 の画素を測って求めた比率で、絵の左上を 0、右下を 1 とする。
 * 青く光る枠の外周が L=165px / T=1549px / R=679px / B=1678px にあたる。
 *
 * この値は CSS の配置とテストの両方から参照する。
 * 絵を差し替えるときは測り直すこと。絵を切り抜いて合わせてはいけない。
 */
export const TITLE_COVER_BUTTON = {
  left: 165 / 852,
  top: 1549 / 1846,
  right: 679 / 852,
  bottom: 1678 / 1846,
} as const;

/** 描かれたボタンの中心と大きさ（比率）。CSS の配置に使う。 */
export const TITLE_COVER_BUTTON_BOX = {
  left: TITLE_COVER_BUTTON.left,
  width: TITLE_COVER_BUTTON.right - TITLE_COVER_BUTTON.left,
  centerY: (TITLE_COVER_BUTTON.top + TITLE_COVER_BUTTON.bottom) / 2,
  height: TITLE_COVER_BUTTON.bottom - TITLE_COVER_BUTTON.top,
} as const;

/**
 * 表紙の分離素材（layered-v1）。
 *
 * 採用見本 approved-preview.png に合わせて個別に制作された3点。
 * 原寸は assets-source/title/layered-v1/ に無改変で保管し、
 * public/ にあるのは同じ画素数のまま WebP へ再エンコードしたもの。
 *
 *   background  : 852x1846  ロゴ・人物・かばん・ボタンを含まない全面背景
 *   logo        : 1997x788  透過。文字は「ことばトラベル」「KOTOBA JOURNEY」
 *   characters  : 1024x1536 透過。パイロット・CA・手荷物・旅行かばん
 *
 * ボタンは画像に描かれていない。操作はすべて本物の <button> で出す。
 */
export const TITLE_LAYERS = {
  background: assetUrl('assets/title/layered-v1/background.webp'),
  logo: assetUrl('assets/title/layered-v1/logo.webp'),
  characters: assetUrl('assets/title/layered-v1/characters.webp'),
} as const;

export const TITLE_LAYER_SIZES = {
  background: { width: 852, height: 1846 },
  logo: { width: 1997, height: 788 },
  characters: { width: 1024, height: 1536 },
} as const;

/**
 * 背景の中で、ロゴや人物で隠してはいけないもの。
 * 背景画像の左上を 0、右下を 1 とする比率で、目盛りを重ねて実測した。
 */
export const TITLE_BACKGROUND_LANDMARKS = {
  /** 光る地球儀。円周を隠さない。 */
  globe: { left: 0.36, top: 0.21, right: 0.58, bottom: 0.33 },
  /** 富士山。山頂と山体を見せる。 */
  fuji: { left: 0.05, top: 0.33, right: 0.30, bottom: 0.41 },
} as const;

/**
 * 背景を cover で敷くときの縦の見せ方（object-position の Y）。
 *
 * 0.27 にすると、対応する全画面サイズで地球儀の中心が
 * 画面の高さの約26%へ来る。画面ごとに切り取り量が変わっても、
 * 地球儀とロゴ・人物の位置関係が保たれる。
 */
export const TITLE_BACKGROUND_POSITION_Y = 0.27;
