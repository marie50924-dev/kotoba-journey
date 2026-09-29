/**
 * 表紙のボタンに添える絵記号。
 *
 * 採用見本のボタンには、飛行機・矢印・パスポート・歯車の記号が入っている。
 * これらは画像素材として受領していないが、単純な図形なので
 * インライン SVG（HTML）で描ける。画像ファイルは増やさない。
 *
 * 記号はすべて飾り。押せる範囲と読み上げはボタン側の文字が持つので、
 * aria-hidden を付けて読み上げから外す。
 */

/** 24x24 の枠に収めた線画を作る。太さと色はボタンの文字色に合わせる。 */
function icon(
  paths: readonly string[],
  options: { fill?: boolean; rotate?: number } = {},
): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 't-icon');
  // 傾けるときは、枠の中心（12,12）を軸にまとめて回す。
  const group = document.createElementNS(NS, 'g');
  if (options.rotate !== undefined) {
    group.setAttribute('transform', `rotate(${options.rotate} 12 12)`);
  }
  for (const d of paths) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    if (options.fill) {
      path.setAttribute('fill', 'currentColor');
    } else {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.8');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    }
    group.append(path);
  }
  svg.append(group);
  return svg;
}

/*
 * 飛行機。主ボタンの左に置く。
 *
 * 完成見本（IMG_5246.jpeg）のボタンを画素で測ると、
 * 機首を右上へ向けた白い飛行機が 24x24 CSSpx で入っている。
 * 以前の紙飛行機のような形から、胴・主翼・尾翼を持つ形へ改めた。
 */
export function planeIcon(): SVGSVGElement {
  return icon(
    [
      'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
    ],
    { fill: true, rotate: 45 },
  );
}

/** 右向きの山形。主ボタンの右に置く。 */
export function chevronIcon(): SVGSVGElement {
  return icon(['M9 5.5 15.5 12 9 18.5']);
}

/** パスポート。手帳に地球の輪。 */
export function passportIcon(): SVGSVGElement {
  return icon([
    'M6 3.2h10.4a1.6 1.6 0 0 1 1.6 1.6v14.4a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6V4.8A1.6 1.6 0 0 1 6 3.2z',
    'M11.2 7.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z',
    'M11.2 7.4c-1.1 1-1.7 2.2-1.7 3.4s.6 2.4 1.7 3.4',
    'M11.2 7.4c1.1 1 1.7 2.2 1.7 3.4s-.6 2.4-1.7 3.4',
    'M8 17.4h6.4',
  ]);
}

/** 歯車。 */
export function gearIcon(): SVGSVGElement {
  return icon([
    'M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z',
    'M19.4 12c0-.6-.1-1.1-.2-1.6l2-1.5-1.9-3.3-2.3 1a7.5 7.5 0 0 0-2.8-1.6L13.9 2h-3.8l-.3 2.9a7.5 7.5 0 0 0-2.8 1.7l-2.3-1L2.8 8.9l2 1.5c-.1.5-.2 1-.2 1.6s.1 1.1.2 1.6l-2 1.5 1.9 3.3 2.3-1a7.5 7.5 0 0 0 2.8 1.7l.3 2.9h3.8l.3-2.9a7.5 7.5 0 0 0 2.8-1.7l2.3 1 1.9-3.3-2-1.5c.1-.5.2-1 .2-1.6z',
  ]);
}
