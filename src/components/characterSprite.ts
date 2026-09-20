import type { CharacterPose, CharacterVisual, GameCharacter } from '../data/characters';

/**
 * 主人公の仮表示スプライト（ラフ）。
 *
 * 正式なキャラクターイラストは未承認のため作成していない。
 * ここでは輪郭だけの簡素な SVG を描き、姿勢と表情の差分が成立するかを確認する。
 * 承認後は、この関数の中身を正式素材の <img> へ差し替えるだけで済む構造にしてある。
 *
 * 描画順は「後ろ髪 → 脚 → 胴と腕 → 頭 → 前髪 → 顔」。
 * 髪が顔を覆わないよう、頭より後ろと前を分けて描く。
 */

const VIEW_BOX = '0 0 120 210';

/** 姿勢ごとの手足の角度。歩行は前後に開き、喜びは腕を上げる。 */
const POSE = {
  stand: { legFront: 0, legBack: 0, armL: 8, armR: -8, lift: 0 },
  walk: { legFront: 18, legBack: -16, armL: -24, armR: 26, lift: -2 },
  happy: { legFront: -5, legBack: 5, armL: -132, armR: 132, lift: -5 },
} as const satisfies Record<CharacterPose, Record<string, number>>;

/** 後ろ髪。長い髪のときだけ頭の後ろから肩まで描く。 */
function backHair(style: CharacterVisual['hairStyle']): string {
  if (style !== 'long') return '';
  return '<path d="M35 45a25 25 0 0 1 50 0v40c0 8-4 12-10 13l-2-32H47l-2 32c-6-1-10-5-10-13z" />';
}

/** 前髪。顔を覆わないよう、頭の上側だけを縁取る。 */
function frontHair(style: CharacterVisual['hairStyle']): string {
  return style === 'long'
    ? '<path d="M35 46a25 25 0 0 1 50 0c0 3-1 6-2 8-3-10-12-16-23-16s-20 6-23 16c-1-2-2-5-2-8z" />'
    : '<path d="M35 46a25 25 0 0 1 50 0c0 2 0 4-1 6-5-7-13-11-24-11s-19 4-24 11c-1-2-1-4-1-6z" />';
}

/** 口。喜びのときだけ大きく開いた笑顔にする。 */
function mouth(pose: CharacterPose): string {
  return pose === 'happy'
    ? '<path d="M51 57a9 9 0 0 0 18 0z" fill="#c8564f" />'
    : '<path d="M53 58q7 5 14 0" fill="none" stroke="#a5624c" stroke-width="2.4" stroke-linecap="round" />';
}

export interface SpriteOptions {
  pose?: CharacterPose;
  /** 追加のクラス名。 */
  class?: string;
  /** 読み上げ用のラベル。空文字なら装飾として扱う。 */
  label?: string;
}

export function characterSprite(
  character: GameCharacter,
  options: SpriteOptions = {},
): HTMLElement {
  const pose = options.pose ?? 'stand';
  const p = POSE[pose];
  const v = character.visual;
  const decorative = options.label === '';

  const host = document.createElement('div');
  host.className = ['sprite', `sprite--${pose}`, options.class].filter(Boolean).join(' ');
  if (decorative) {
    host.setAttribute('aria-hidden', 'true');
  } else {
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', options.label ?? character.label);
  }

  // 静的なテンプレートのみを使う（ユーザー入力は含めない）。
  host.innerHTML = `
<svg viewBox="${VIEW_BOX}" class="sprite__svg" focusable="false" aria-hidden="true">
  <ellipse cx="60" cy="202" rx="24" ry="5" fill="rgba(20,40,60,0.16)" />
  <g transform="translate(0 ${p.lift})">
    <g fill="${v.hair}">${backHair(v.hairStyle)}</g>
    <g stroke="${v.bottom}" stroke-width="13" stroke-linecap="round">
      <line x1="54" y1="128" x2="54" y2="192" transform="rotate(${p.legBack} 54 128)" />
      <line x1="66" y1="128" x2="66" y2="192" transform="rotate(${p.legFront} 66 128)" />
    </g>
    <rect x="40" y="74" width="40" height="58" rx="15" fill="${v.top}" />
    <path d="M45 82h30l-4 13H49z" fill="${v.accent}" opacity="0.8" />
    <g stroke="${v.top}" stroke-width="11" stroke-linecap="round">
      <line x1="45" y1="87" x2="45" y2="116" transform="rotate(${p.armL} 45 87)" />
      <line x1="75" y1="87" x2="75" y2="116" transform="rotate(${p.armR} 75 87)" />
    </g>
    <circle cx="60" cy="47" r="25" fill="${v.skin}" />
    <g fill="${v.hair}">${frontHair(v.hairStyle)}</g>
    <g fill="#33312f">
      <ellipse cx="51" cy="48" rx="3" ry="4.2" />
      <ellipse cx="69" cy="48" rx="3" ry="4.2" />
    </g>
    ${mouth(pose)}
    <ellipse cx="44" cy="55" rx="4" ry="2.6" fill="#f0a08e" opacity="0.65" />
    <ellipse cx="76" cy="55" rx="4" ry="2.6" fill="#f0a08e" opacity="0.65" />
  </g>
</svg>`.trim();

  return host;
}
