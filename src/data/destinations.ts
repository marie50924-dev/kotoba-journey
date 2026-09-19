/** 世界マップの行き先。今回操作可能なのは日本のみ。 */
export interface Destination {
  id: string;
  label: string;
  sublabel: string;
  unlocked: boolean;
  /** 盤面（マップ枠）内の相対位置 0〜1。 */
  position: { x: number; y: number };
}

export const DESTINATIONS: readonly Destination[] = [
  { id: 'japan', label: '日本', sublabel: 'ことばの出発点', unlocked: true, position: { x: 0.78, y: 0.44 } },
  { id: 'london', label: 'ロンドン', sublabel: '準備中', unlocked: false, position: { x: 0.34, y: 0.3 } },
  { id: 'paris', label: 'パリ', sublabel: '準備中', unlocked: false, position: { x: 0.4, y: 0.46 } },
];

export function findDestination(id: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}
