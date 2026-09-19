import type { CardCount } from './types';
import { createRng } from './random';

export interface CardSlot {
  /** 盤面左上を原点とするカード左上座標(px)。 */
  x: number;
  y: number;
  width: number;
  height: number;
  /** カードの傾き(度)。 */
  rotation: number;
}

export interface BoardLayout {
  columns: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  slots: CardSlot[];
}

export interface LayoutOptions {
  /** 傾きの最大値(度)。0 にすると全カードが水平。 */
  maxTiltDeg?: number;
  /** カード間に必ず空けるすき間(px)。 */
  gapPx?: number;
  /** 傾きの再現用 seed。 */
  seed?: number;
  /** カードの縦横比 (width / height)。 */
  aspectRatio?: number;
}

/** 枚数ごとの列×行。スマートフォン縦画面を前提にした固定スロット構成。 */
export const GRID_BY_CARD_COUNT: Record<CardCount, { columns: number; rows: number }> = {
  6: { columns: 2, rows: 3 },
  12: { columns: 3, rows: 4 },
  20: { columns: 4, rows: 5 },
};

const DEG_TO_RAD = Math.PI / 180;

/**
 * 盤面サイズから、重ならないカード配置スロットを計算する純粋関数。
 *
 * 自由配置ではなく列×行のスロット方式にして、
 *  - 各カードは自分のセルの内側に収まる
 *  - 傾けた後の外接矩形もセル内に収まる
 * という条件で大きさを決めるため、カード同士は決して重ならない。
 * 傾きだけを小さな範囲でランダムに変え、カルタを広げたような見た目にする。
 */
export function computeBoardLayout(
  cardCount: CardCount,
  boardWidth: number,
  boardHeight: number,
  options: LayoutOptions = {},
): BoardLayout {
  const { columns, rows } = GRID_BY_CARD_COUNT[cardCount];
  const maxTilt = Math.max(0, options.maxTiltDeg ?? 7);
  const gap = Math.max(0, options.gapPx ?? 6);
  const aspectRatio = options.aspectRatio ?? 1.25;
  const rng = createRng(options.seed ?? 1);

  const width = Math.max(0, boardWidth);
  const height = Math.max(0, boardHeight);

  const cellWidth = width / columns;
  const cellHeight = height / rows;

  // 傾き後の外接矩形がセル（すき間を除いた部分）に収まる最大のカードサイズを求める。
  const available = { w: Math.max(0, cellWidth - gap), h: Math.max(0, cellHeight - gap) };
  const rad = maxTilt * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // w = r * h として、 w*cos + h*sin <= available.w, w*sin + h*cos <= available.h を解く。
  const hByWidth = available.w / (aspectRatio * cos + sin);
  const hByHeight = available.h / (aspectRatio * sin + cos);
  const cardHeight = Math.max(0, Math.min(hByWidth, hByHeight));
  const cardWidth = cardHeight * aspectRatio;

  const slots: CardSlot[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (slots.length >= cardCount) break;
      const centerX = cellWidth * (column + 0.5);
      const centerY = cellHeight * (row + 0.5);
      const rotation = maxTilt === 0 ? 0 : (rng() * 2 - 1) * maxTilt;
      slots.push({
        x: centerX - cardWidth / 2,
        y: centerY - cardHeight / 2,
        width: cardWidth,
        height: cardHeight,
        rotation,
      });
    }
  }

  return { columns, rows, cardWidth, cardHeight, slots };
}

/** 傾きを考慮したカードの外接矩形。テストと衝突検証で使う。 */
export function rotatedBounds(slot: CardSlot): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const rad = Math.abs(slot.rotation) * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const boundsWidth = slot.width * cos + slot.height * sin;
  const boundsHeight = slot.width * sin + slot.height * cos;
  const centerX = slot.x + slot.width / 2;
  const centerY = slot.y + slot.height / 2;
  return {
    left: centerX - boundsWidth / 2,
    top: centerY - boundsHeight / 2,
    right: centerX + boundsWidth / 2,
    bottom: centerY + boundsHeight / 2,
  };
}

export function boundsOverlap(a: CardSlot, b: CardSlot): boolean {
  const ra = rotatedBounds(a);
  const rb = rotatedBounds(b);
  // 浮動小数の誤差で接触を重なり扱いしないよう、わずかな許容差を設ける。
  const epsilon = 0.001;
  return (
    ra.left < rb.right - epsilon &&
    rb.left < ra.right - epsilon &&
    ra.top < rb.bottom - epsilon &&
    rb.top < ra.bottom - epsilon
  );
}
