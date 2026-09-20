/**
 * 表紙の正式採用素材。
 *
 * 原寸ファイルは assets-source/title/ に無改変で保管してある。
 * public/assets/title/ にあるのは配信用に可逆な範囲で軽量化した WebP で、
 * 形・色・構図・文字には一切手を加えていない（拡大縮小と再エンコードのみ）。
 *
 *   title-background : 853x1844  原寸のまま WebP 化        2168KB -> 301KB
 *   title-logo       : 1997x787 -> 1200x473  WebP          1790KB -> 107KB
 *   suitcase-mascot  : 1402x1122 -> 760x608  WebP          1603KB ->  99KB
 *
 * 表示に必要な解像度（430px 幅 x DPR3）を上回る分だけ縮小している。
 */

/** Vite の base を反映した URL を作る。GitHub Pages のサブパス公開に対応する。 */
function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export const TITLE_ASSETS = {
  background: assetUrl('assets/title/title-background.webp'),
  logo: assetUrl('assets/title/title-logo.webp'),
  mascot: assetUrl('assets/title/suitcase-mascot.webp'),
} as const;

/** 素材の原寸。レイアウト計算とテストで使う。 */
export const TITLE_ASSET_SIZES = {
  background: { width: 853, height: 1844 },
  logo: { width: 1200, height: 473 },
  mascot: { width: 760, height: 608 },
} as const;
