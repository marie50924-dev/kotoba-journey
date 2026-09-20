import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { DESTINATIONS } from '../data/destinations';
import { screenShell } from '../components/screenShell';
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

  const pins = DESTINATIONS.map((destination) => {
    const selected = ctx.selection.destinationId === destination.id;
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
        style: `left:${destination.position.x * 100}%;top:${destination.position.y * 100}%`,
        'aria-pressed': selected,
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
      el('div', { class: 'map' }, [el('div', { class: 'map__ocean' }), ...pins]),
      el('p', { class: 'note', text: UI.worldMap.lockedNote }),
      el('div', { class: 'screen__footer' }, [departButton]),
    ],
  );
}
