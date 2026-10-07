/**
 * 世界マップの行き先。
 * Phase 1 でも操作可能なのは日本のみ。ロンドンとパリはロック表示のまま維持する。
 */

/** 到着までの移動表現。国紹介と同じく、画面コードではなくデータ側で決める。 */
export type TravelMode = 'plane' | 'train' | 'ship';

export interface Destination {
  id: string;
  label: string;
  sublabel: string;
  unlocked: boolean;
  /**
   * 盤面（マップ枠）内の相対位置 0〜1。
   *
   * 正式な地図イラスト（public/assets/world-map/world-map-v2.webp）の上で、
   * 海岸線を手がかりに読み取った推定位置。地図の画素をそのまま割合にしてある。
   *
   * 読み取りの確からしさについて：
   *   ロンドンと東京を基準に経度差で計算したパリの位置と、読み取った位置が
   *   横 1px の差で一致した。ただしこれは経度の目盛りが通っているという確認で、
   *   海岸線の形や都市の位置が地理的に正確であることを確かめたものではない。
   */
  position: { x: number; y: number };
  /**
   * 札（印のボタン）を実際に描く位置の、上の位置からのずれ（px）。
   *
   * ロンドンとパリは地理的に近く、画面上では 7〜10px しか離れない。
   * 一方、札は画面サイズによらず同じ大きさ（ロンドン 64x59、パリ 46x59）なので、
   * 重ならないためには中心どうしが 55px 以上離れている必要がある。
   * そこで札だけをずらし、本当の場所には小さな輪を残して短い引出線でつなぐ。
   *
   * ずれは割合ではなく px。割合にすると画面が大きいほど引出線が長くなり、
   * 「短い引出線」でなくなるため。
   *
   * いまの値は、次の条件をすべて満たすものを 5サイズまとめて探して決めた。
   *   ・札と外側の光が枠に収まる（枠のふちから 11px 以上）
   *     11px は、選択中のいちばん強い光（--glass-glow-on）が届く距離。
   *     ロンドンとパリはいまロック中で選べないが、解放されたときに
   *     光が切れないよう、はじめからこの余裕で置いておく。
   *   ・札どうしのすきまが 16px 以上（光どうしが触れない）
   *   ・輪と引出線が、どの札にも隠れない
   *   ・札の位置関係が地理と同じ（ロンドンがパリより西かつ北）
   *   ・日本の札と光が、北海道・本州・四国・九州の陸にかからない
   *     （光の外にさらに 6px の余裕を取っている）
   *   ・引出線の長さの合計が最小
   */
  displayOffset?: { x: number; y: number };
  /** その経路に合う移動表現。 */
  travelMode: TravelMode;
  /** 出発地の表示名。Phase 1 は日本発着のみを想定した仮の値。 */
  departureLabel: string;
}

export const DESTINATIONS: readonly Destination[] = [
  {
    id: 'japan',
    label: '日本',
    sublabel: 'ことばの出発点',
    unlocked: true,
    position: { x: 0.822, y: 0.476 },
    /*
     * 東京の位置に札を置くと、札が日本列島をまるごと覆ってしまう。
     * 地図を見ながら行き先を選べるよう、札だけを列島の東の海へ移し、
     * 元の位置には輪を残して引出線でつなぐ。
     *
     * 東だけでは枠に収まらない（320x568 では東京の右に 52px しかなく、
     * 札の半分 22px と光 11px を引くと 19px しかずらせない）ため、
     * 足りないぶんを右下の海へ逃がしている。
     */
    displayOffset: { x: 19, y: 51 },
    travelMode: 'plane',
    departureLabel: 'いまいるところ',
  },
  {
    id: 'london',
    label: 'ロンドン',
    sublabel: '準備中',
    unlocked: false,
    position: { x: 0.225, y: 0.323 },
    // パリとの間隔を作るため、右上へずらして描く（元の位置は輪と引出線で示す）。
    displayOffset: { x: 41, y: -23 },
    travelMode: 'plane',
    departureLabel: '日本',
  },
  {
    id: 'paris',
    label: 'パリ',
    sublabel: '準備中',
    unlocked: false,
    position: { x: 0.234, y: 0.356 },
    // ロンドンとの間隔を作るため、右下へずらして描く。
    displayOffset: { x: 39, y: 46 },
    travelMode: 'plane',
    departureLabel: '日本',
  },
];

export function findDestination(id: string | null | undefined): Destination | undefined {
  if (!id) return undefined;
  return DESTINATIONS.find((d) => d.id === id);
}

export const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  plane: 'ひこうき',
  train: 'れっしゃ',
  ship: 'ふね',
};
