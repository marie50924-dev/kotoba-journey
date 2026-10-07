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
  /** 盤面（マップ枠）内の相対位置 0〜1。だいたいの地理の場所。 */
  position: { x: number; y: number };
  /**
   * 印を実際に描く位置の、上の位置からのずれ（px）。
   *
   * 盤面の高さは画面によって大きく変わる（320x568 で 216px、393x852 で 552px）。
   * 位置は割合、印の箱は固定の px なので、低い画面では縦の間隔だけが詰まり、
   * ロンドンとパリの箱が重なっていた。
   *
   * そこで、横に一定の px だけずらして間隔を作る。割合ではなく px なので、
   * どの画面でも同じ長さだけずれる＝引出線がいつも短いままになる。
   * ずらした場合は、元の位置に小さな輪を出し、短い引出線でつなぐ。
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
    position: { x: 0.78, y: 0.44 },
    travelMode: 'plane',
    departureLabel: 'いまいるところ',
  },
  {
    id: 'london',
    label: 'ロンドン',
    sublabel: '準備中',
    unlocked: false,
    position: { x: 0.34, y: 0.3 },
    // パリとの間隔を作るため、左へ 40px ずらして描く（元の位置は輪と引出線で示す）。
    displayOffset: { x: -40, y: 0 },
    travelMode: 'plane',
    departureLabel: '日本',
  },
  {
    id: 'paris',
    label: 'パリ',
    sublabel: '準備中',
    unlocked: false,
    position: { x: 0.4, y: 0.46 },
    // ロンドンとの間隔を作るため、右へ 32px ずらして描く。
    displayOffset: { x: 32, y: 0 },
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
