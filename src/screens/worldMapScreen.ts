import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { DESTINATIONS } from '../data/destinations';
import { screenShell } from '../components/screenShell';
import { npcBar } from '../components/npcBar';
import type { AppContext } from '../app/state';

/**
 * 世界マップ。今回操作可能なのは日本だけで、ロンドンとパリはロック表示。
 * 正式な地図イラストは後工程で差し替えるため、CSS の簡易表示にとどめる。
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
  for (const destination of DESTINATIONS) {
    const offset = destination.displayOffset;
    if (!offset || (offset.x === 0 && offset.y === 0)) continue;
    const at = `left:${destination.position.x * 100}%;top:${destination.position.y * 100}%`;
    markers.push(
      el('span', { class: 'map-anchor', style: at, 'aria-hidden': 'true', 'data-owner': destination.id }),
      el('span', {
        class: ['map-leader', offset.x < 0 ? 'map-leader--left' : 'map-leader--right'].join(' '),
        style: `${at};--leader-len:${Math.abs(offset.x)}px`,
        'aria-hidden': 'true',
        'data-owner': destination.id,
      }),
    );
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

  return screenShell(
    {
      title: UI.worldMap.heading,
      lead: UI.worldMap.lead,
      onBack: () => ctx.back(),
      fixedHeight: true,
      variant: 'screen--map',
    },
    [
      el('div', { class: 'map' }, [el('div', { class: 'map__ocean' }), ...markers, ...pins]),
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
}
