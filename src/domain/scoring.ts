import type { MasteryLevel, PairStat } from './types';

/**
 * 正解率(%)。
 *
 *   correctSelections / (correctSelections + incorrectSelections) * 100
 *
 * 分母が 0 の場合（1回も判定が発生していない場合）は 0 を返し、0除算を避ける。
 * 戻り値は小数第1位で丸めた 0〜100 の値。
 */
export function calculateAccuracy(correctSelections: number, incorrectSelections: number): number {
  const total = correctSelections + incorrectSelections;
  if (total <= 0) return 0;
  return Math.round((correctSelections / total) * 1000) / 10;
}

/**
 * 仮の習得判定。
 * 誤答0回=習得 / 誤答1回=練習中 / 誤答2回以上=復習。
 */
export function masteryFor(mistakes: number): MasteryLevel {
  if (mistakes <= 0) return 'mastered';
  if (mistakes === 1) return 'practicing';
  return 'review';
}

export function groupByMastery(stats: readonly PairStat[]): Record<MasteryLevel, number[]> {
  const grouped: Record<MasteryLevel, number[]> = { mastered: [], practicing: [], review: [] };
  for (const stat of stats) {
    grouped[masteryFor(stat.mistakes)].push(stat.pairId);
  }
  return grouped;
}

/** ミリ秒を m:ss 形式にする。 */
export function formatDuration(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
