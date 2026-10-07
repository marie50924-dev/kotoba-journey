import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { DESTINATIONS } from '../data/destinations';
import { WORLD_MAP_IMAGE } from '../data/worldMapArt';
import { screenShell } from '../components/screenShell';
import { npcBar } from '../components/npcBar';
import type { AppContext } from '../app/state';

/** 輪の半径（CSS の .map-anchor と合わせる）。線はここから外へ引く。 */
const ANCHOR_RADIUS = 5;

/**
 * 輪から札の縁までを結ぶ線を引く。
 *
 * 線の長さは「輪から札の中心までの距離」から
 *   ・輪の半径
 *   ・札の中心からその向きの縁までの距離
 * を引いたぶん。こうすると、線は札の中に入らず、文字の上を通らない。
 *
 * 札の大きさは文言と文字の大きさで決まるので、置かれたあとに測る。
 */
function layoutLeader(pin: HTMLElement, leader: HTMLElement, offset: { x: number; y: number }): void {
  const span = Math.hypot(offset.x, offset.y);
  const box = pin.getBoundingClientRect();
  if (span === 0 || box.width === 0) {
    leader.style.setProperty('--leader-len', '0px');
    return;
  }
  // 札の中心から輪へ向かう向き
  const ux = -offset.x / span;
  const uy = -offset.y / span;
  const toX = ux === 0 ? Number.POSITIVE_INFINITY : Math.abs(box.width / 2 / ux);
  const toY = uy === 0 ? Number.POSITIVE_INFINITY : Math.abs(box.height / 2 / uy);
  const edge = Math.min(toX, toY);
  const length = Math.max(0, span - edge - ANCHOR_RADIUS);
  leader.style.setProperty('--leader-len', `${length}px`);
  leader.style.setProperty('--leader-angle', `${(Math.atan2(offset.y, offset.x) * 180) / Math.PI}deg`);
  leader.style.setProperty('--leader-gap', `${ANCHOR_RADIUS}px`);
}

/**
 * 世界マップ。今回操作可能なのは日本だけで、ロンドンとパリはロック表示。
 * 盤面は正式な地図イラスト（world-map-v2）。印の座標はその絵から読み取った値。
 */
export function worldMapScreen(ctx: AppContext): HTMLElement {
  if (!ctx.selection.destinationId) ctx.selection.destinationId = 'japan';

  const departButton = button(UI.actions.depart, () => ctx.navigate({ name: 'travel' }), {
    class: 'btn btn--primary btn--large',
  });

  /*
   * 元の場所を示す輪と、そこから印へ引く短い線。
   * 印をずらしたときだけ出す。押せる部品ではないので読み上げからは外す。
   */
  const markers: HTMLElement[] = [];
  /** 置かれたあとに線の長さを測り直すための組。 */
  const leaders: Array<{ id: string; leader: HTMLElement; offset: { x: number; y: number } }> = [];
  for (const destination of DESTINATIONS) {
    const offset = destination.displayOffset;
    if (!offset || (offset.x === 0 && offset.y === 0)) continue;
    const at = `left:${destination.position.x * 100}%;top:${destination.position.y * 100}%`;
    const leader = el('span', {
      class: 'map-leader',
      style: at,
      'aria-hidden': 'true',
      'data-owner': destination.id,
    });
    markers.push(
      el('span', { class: 'map-anchor', style: at, 'aria-hidden': 'true', 'data-owner': destination.id }),
      leader,
    );
    leaders.push({ id: destination.id, leader, offset });
  }

  const pins = DESTINATIONS.map((destination) => {
    const selected = ctx.selection.destinationId === destination.id;
    const offset = destination.displayOffset ?? { x: 0, y: 0 };
    const pin = el(
      'button',
      {
        type: 'button',
        class: [
          'map-pin',
          destination.unlocked ? 'map-pin--open' : 'map-pin--locked',
          selected ? 'is-selected' : '',
        ]
          .filter(Boolean)
          .join(' '),
        /*
         * 位置は割合、ずれは px。割合のぶんは画面に合わせて動き、
         * ずらしぶんはどの画面でも同じ長さになる。
         */
        style:
          `left:${destination.position.x * 100}%;top:${destination.position.y * 100}%;` +
          `--shift-x:${offset.x}px;--shift-y:${offset.y}px`,
        'data-destination': destination.id,
        /*
         * 真偽値のまま渡すと、el() が aria-pressed="" にしてしまい、
         * 読み上げに「選択中」が伝わらない。文字列にして渡す。
         */
        'aria-pressed': String(selected),
        'aria-label': `${destination.label} ${destination.unlocked ? UI.worldMap.selectable : UI.worldMap.locked}`,
        disabled: !destination.unlocked,
      },
      [
        el('span', { class: 'map-pin__dot' }),
        el('span', { class: 'map-pin__label', text: destination.label }),
        !destination.unlocked ? el('span', { class: 'map-pin__lock', text: UI.worldMap.locked }) : null,
      ],
    );

    if (destination.unlocked) {
      pin.addEventListener('click', () => {
        ctx.selection.destinationId = destination.id;
        for (const other of Array.from(pin.parentElement?.children ?? [])) {
          // 輪と引出線は選択状態を持たないので、印だけを見る。
          if (!other.classList.contains('map-pin')) continue;
          other.classList.remove('is-selected');
          other.setAttribute('aria-pressed', 'false');
        }
        pin.classList.add('is-selected');
        pin.setAttribute('aria-pressed', 'true');
      });
    }
    return pin;
  });

  const map = el(
    'div',
    /*
     * 絵の場所は公開パスによって変わるので、ここで渡す。
     * 変数（--map-image）に url() を入れて CSS 側で var() で使うと、
     * Chromium は CSS ファイルの場所を基準に相対パスを解くため
     * assets/assets/... になって読み込めない。
     * background-image を直接この要素に書けば、ページの場所が基準になる。
     */
    { class: 'map', style: `background-image:url('${WORLD_MAP_IMAGE}')` },
    [...markers, ...pins],
  );

  /*
   * 札の大きさは、画面に置かれるまで分からない。
   * 置かれたあと（と、画面の大きさが変わったあと）に測って線を引き直す。
   */
  function relayout(): void {
    for (const { id, leader, offset } of leaders) {
      const pin = map.querySelector<HTMLElement>(`.map-pin[data-destination="${id}"]`);
      if (pin) layoutLeader(pin, leader, offset);
    }
  }

  const shell = screenShell(
    {
      title: UI.worldMap.heading,
      lead: UI.worldMap.lead,
      onBack: () => ctx.back(),
      fixedHeight: true,
      variant: 'screen--map',
    },
    [
      map,
      el('p', { class: 'note', text: UI.worldMap.lockedNote }),
      // 出発前の一言。国が決まっているので countryId を渡す。
      npcBar(ctx, {
        screen: 'arrival',
        trigger: 'arrival',
        countryId: ctx.selection.destinationId ?? 'japan',
        courseId: ctx.selection.courseId ?? undefined,
      }),
      el('div', { class: 'screen__footer' }, [departButton]),
    ],
  );

  if (leaders.length > 0) {
    // 置かれた直後に一度測る。
    requestAnimationFrame(relayout);
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => relayout());
    observer?.observe(map);
    shell.addEventListener('screen:destroy', () => observer?.disconnect());
  }

  return shell;
}
