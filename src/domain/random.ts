/**
 * テストから再現性を検証できるように、乱数は必ずこのモジュール経由で使う。
 * 同じ seed を渡せば必ず同じ並びになる純粋関数として提供する。
 */

export type Rng = () => number;

/** mulberry32。seed から 0 以上 1 未満の値を返す決定的な擬似乱数生成器を作る。 */
export function createRng(seed: number): Rng {
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 現在時刻から seed を作る。ゲーム開始時は毎回異なる並びになる。 */
export function createSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/**
 * Fisher-Yates シャッフル。引数の配列は変更せず、新しい配列を返す純粋関数。
 * seed を指定すれば再現可能。
 */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const rng = createRng(seed);
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}
