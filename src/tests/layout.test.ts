import { describe, expect, it } from 'vitest';
import { boundsOverlap, computeBoardLayout, rotatedBounds } from '../domain/layout';
import type { CardCount } from '../domain/types';

/** 検証対象の画面サイズ。盤面はヘッダー等を除いたおおよその高さ。 */
const VIEWPORTS: { name: string; width: number; boardHeight: number }[] = [
  { name: '320x568', width: 320 - 16, boardHeight: 568 - 110 },
  { name: '375x667', width: 375 - 16, boardHeight: 667 - 120 },
  { name: '393x852', width: 393 - 16, boardHeight: 852 - 130 },
  { name: '402x874', width: 402 - 16, boardHeight: 874 - 130 },
  { name: '430x932', width: 430 - 16, boardHeight: 932 - 140 },
];

const COUNTS: CardCount[] = [6, 12, 20];

describe('カード配置スロット', () => {
  it.each(COUNTS)('%i枚ぶんのスロットを返す', (count) => {
    const layout = computeBoardLayout(count, 360, 600, { seed: 1 });
    expect(layout.slots).toHaveLength(count);
  });

  for (const viewport of VIEWPORTS) {
    for (const count of COUNTS) {
      it(`${viewport.name} の${count}枚は互いに重ならない`, () => {
        const layout = computeBoardLayout(count, viewport.width, viewport.boardHeight, { seed: 7 });
        for (let i = 0; i < layout.slots.length; i += 1) {
          for (let j = i + 1; j < layout.slots.length; j += 1) {
            expect(boundsOverlap(layout.slots[i], layout.slots[j])).toBe(false);
          }
        }
      });

      it(`${viewport.name} の${count}枚は四辺が盤面内に収まる`, () => {
        const layout = computeBoardLayout(count, viewport.width, viewport.boardHeight, { seed: 7 });
        for (const slot of layout.slots) {
          const bounds = rotatedBounds(slot);
          expect(bounds.left).toBeGreaterThanOrEqual(-0.001);
          expect(bounds.top).toBeGreaterThanOrEqual(-0.001);
          expect(bounds.right).toBeLessThanOrEqual(viewport.width + 0.001);
          expect(bounds.bottom).toBeLessThanOrEqual(viewport.boardHeight + 0.001);
        }
      });

      it(`${viewport.name} の${count}枚はタップ領域を確保する`, () => {
        const layout = computeBoardLayout(count, viewport.width, viewport.boardHeight, { seed: 7 });
        // 最小構成 320x568 の20枚でも 44px 相当を割らないことを確認する。
        expect(layout.cardWidth).toBeGreaterThanOrEqual(44);
        expect(layout.cardHeight).toBeGreaterThanOrEqual(36);
      });
    }
  }

  it('同じ seed なら同じ傾きを再現する', () => {
    const a = computeBoardLayout(20, 360, 560, { seed: 123 });
    const b = computeBoardLayout(20, 360, 560, { seed: 123 });
    expect(a.slots.map((s) => s.rotation)).toEqual(b.slots.map((s) => s.rotation));
  });

  it('seed が違えば傾きが変わる', () => {
    const a = computeBoardLayout(20, 360, 560, { seed: 1 }).slots.map((s) => s.rotation);
    const b = computeBoardLayout(20, 360, 560, { seed: 2 }).slots.map((s) => s.rotation);
    expect(a).not.toEqual(b);
  });

  it('傾きは指定範囲を超えない', () => {
    const layout = computeBoardLayout(20, 360, 560, { seed: 5, maxTiltDeg: 6 });
    for (const slot of layout.slots) {
      expect(Math.abs(slot.rotation)).toBeLessThanOrEqual(6);
    }
  });

  it('盤面サイズが0でも例外にならない', () => {
    const layout = computeBoardLayout(20, 0, 0, { seed: 1 });
    expect(layout.slots).toHaveLength(20);
    expect(layout.cardWidth).toBe(0);
  });
});
