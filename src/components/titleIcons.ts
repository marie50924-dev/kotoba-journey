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
  options: {
    fill?: boolean;
    rotate?: number;
    /** 枠。既定は 0 0 24 24。絵が枠いっぱいに出るよう狭めることがある。 */
    viewBox?: string;
    /** 塗りで穴を抜くとき。 */
    evenOdd?: boolean;
    /** 線の太さ。細かい絵は細くする。 */
    strokeWidth?: number;
  } = {},
): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', options.viewBox ?? '0 0 24 24');
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
      if (options.evenOdd) path.setAttribute('fill-rule', 'evenodd');
    } else {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', String(options.strokeWidth ?? 1.8));
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
    // 45度回すと絵が斜めになり、0 0 24 24 の枠では周りに空きができる。
    // 回したあとの外接範囲（x 2.10〜18.72 / y 4.58〜21.19）に枠を合わせて、
    // 見本と同じ 24.4 CSSpx の大きさで出す。
    { fill: true, rotate: 45, viewBox: '1.44 3.91 17.95 17.95' },
  );
}

/**
 * 右向きの山形。主ボタンの右に置く。
 * 見本では 幅 5.5 / 高さ 10.0 CSSpx。枠いっぱいに描いて、小さな枠でも同じ大きさにする。
 */
export function chevronIcon(): SVGSVGElement {
  return icon(['M8.5 3 17 12 8.5 21']);
}

/*
 * パスポート。表紙に大きな地球儀、右に小口（ページの束）。
 *
 * 完成見本（IMG_5246.jpeg）の副ボタンを拡大すると、
 * 表紙のまるい四角の中に「経線・緯線のある地球儀」がはっきり入っている。
 * 以前は地球儀が枠の 3.4/24 しかなく、小さな画面では点にしか見えなかった。
 * 地球儀を 5.2/24 まで大きくし、経線を左右1本ずつ、緯線を2本にして、
 * 17px 程度の小さな枠でも地球儀と分かるようにしている。
 */
export function passportIcon(): SVGSVGElement {
  return icon(
    [
      // 表紙
      'M4.6 1.8h10a2.2 2.2 0 0 1 2.2 2.2v16a2.2 2.2 0 0 1-2.2 2.2h-10a2.2 2.2 0 0 1-2.2-2.2V4a2.2 2.2 0 0 1 2.2-2.2z',
      // 地球儀の輪
      'M9.6 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4z',
      // 経線（左右）
      'M9.6 7.3c-1.5 1.3-2.3 2.9-2.3 4.7s.8 3.4 2.3 4.7',
      'M9.6 7.3c1.5 1.3 2.3 2.9 2.3 4.7s-.8 3.4-2.3 4.7',
      // 緯線
      'M4.9 12h9.4',
      'M5.9 9.1h7.4',
      'M5.9 14.9h7.4',
      // 小口
      'M18.8 4.4v15.2',
    ],
    { strokeWidth: 1.4 },
  );
}

/*
 * 歯車。
 *
 * 完成見本の歯車は線ではなく「塗りつぶし」で、中心に穴がある。
 * 線で描くと、同じ大きさでもパスポートより弱く見える。
 * 8枚歯・外側 11.4/24・中心の穴 3.9/24 で、枠いっぱいに描く。
 */
export function gearIcon(): SVGSVGElement {
  return icon(
    [
      'M23.25 10.13 L23.25 13.87 L20.38 13.94 L19.30 16.55 L21.28 18.63 L18.63 21.28 L16.55 19.30 L13.94 20.38 L13.87 23.25 L10.13 23.25 L10.06 20.38 L7.45 19.30 L5.37 21.28 L2.72 18.63 L4.70 16.55 L3.62 13.94 L0.75 13.87 L0.75 10.13 L3.62 10.06 L4.70 7.45 L2.72 5.37 L5.37 2.72 L7.45 4.70 L10.06 3.62 L10.13 0.75 L13.87 0.75 L13.94 3.62 L16.55 4.70 L18.63 2.72 L21.28 5.37 L19.30 7.45 L20.38 10.06 Z M15.90 12.00 C15.90 9.85 14.15 8.10 12.00 8.10 C9.85 8.10 8.10 9.85 8.10 12.00 C8.10 14.15 9.85 15.90 12.00 15.90 C14.15 15.90 15.90 14.15 15.90 12.00 Z',
    ],
    { fill: true, evenOdd: true },
  );
}
