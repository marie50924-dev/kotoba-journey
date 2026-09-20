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
  /** 盤面（マップ枠）内の相対位置 0〜1。 */
  position: { x: number; y: number };
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
    travelMode: 'plane',
    departureLabel: '日本',
  },
  {
    id: 'paris',
    label: 'パリ',
    sublabel: '準備中',
    unlocked: false,
    position: { x: 0.4, y: 0.46 },
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
