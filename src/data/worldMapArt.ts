/**
 * 世界マップの正式イラスト。
 *
 * 受領物の第2版（2026-10-07 採用）をそのまま使う。
 * 原寸は assets-source/world-map/world-map-v2.png に無改変で保管し、
 * public/assets/world-map/ にあるのは同じ画素数のまま WebP へ再エンコードしたもの。
 * 縮小・切り抜き・余白調整・色調補正は一切していない。
 *
 *   原寸   1536 x 1024 PNG  3,708,750 バイト
 *   採用   1536 x 1024 WebP   375,214 バイト（quality 90）
 *
 * 絵の扱い
 * - ボタン・国名・ロック表示・チェック印・輪・引出線は焼き込んでいない。
 *   すべて DOM と CSS で重ねる。
 * - 角丸と枠線も焼き込んでいない。CSS が 18px の角丸で切る。
 * - 縦横比は 3:2。盤面の枠も 3:2 に固定してあるので、伸びも切れも起きない。
 *
 * 行き先の座標は destinations.ts が持つ。この絵から読み取った推定位置であり、
 * 海岸線や都市位置の地理的な正確さを確かめたものではない。
 */

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

/** 盤面に敷く絵。 */
export const WORLD_MAP_IMAGE = assetUrl('assets/world-map/world-map-v2.webp');

/** 絵の原寸（px）。盤面の縦横比もこれに合わせてある。 */
export const WORLD_MAP_SIZE = { width: 1536, height: 1024 } as const;
