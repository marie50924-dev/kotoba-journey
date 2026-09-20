import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { findDestination, TRAVEL_MODE_LABEL } from '../data/destinations';
import { findCharacter } from '../data/characters';
import { characterSprite } from '../components/characterSprite';
import { TITLE_ASSETS } from '../data/titleAssets';
import type { AppContext } from '../app/state';

/** 移動演出の長さ。長く見せすぎない。 */
const TRAVEL_DURATION_MS = 4000;
/** 2回目以降や設定でスキップする場合の短縮版。 */
const SHORT_DURATION_MS = 900;

/**
 * 移動中の画面。
 * 主人公と案内役、経路に合う移動表現、出発地と到着地、短い進行アニメを見せる。
 * いつでもスキップでき、一度見た国は設定や既訪問により短縮される。
 */
export function travelScreen(ctx: AppContext): HTMLElement {
  const destination = findDestination(ctx.selection.destinationId);
  const character = findCharacter(ctx.selectedCharacterId());
  const record = ctx.records.get();

  const seen = destination ? record.seenTravelIntros.includes(destination.id) : false;
  const duration = record.skipTravelAnimation || seen ? SHORT_DURATION_MS : TRAVEL_DURATION_MS;

  let finished = false;
  let timer = 0;

  function goNext(): void {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    if (destination) {
      ctx.records.update((r) =>
        r.seenTravelIntros.includes(destination.id)
          ? r
          : { ...r, seenTravelIntros: [...r.seenTravelIntros, destination.id] },
      );
    }
    ctx.navigate({ name: 'countryIntro' });
  }

  const vehicle = el('div', { class: `travel__vehicle travel__vehicle--${destination?.travelMode ?? 'plane'}` });
  vehicle.style.animationDuration = `${duration}ms`;

  const root = el('section', { class: 'screen screen--fixed screen--travel' }, [
    el('header', { class: 'travel__bar' }, [
      el('span', { class: 'travel__heading', text: UI.travel.heading }),
      button(UI.actions.skip, goNext, { class: 'btn btn--ghost btn--back' }),
    ]),
    el('div', { class: 'travel__sky' }, [
      el('div', { class: 'travel__route' }, [
        el('span', { class: 'travel__pin travel__pin--from' }, [
          el('span', { class: 'travel__pin-label', text: UI.travel.departure }),
          el('strong', { text: destination?.departureLabel ?? '—' }),
        ]),
        el('span', { class: 'travel__line' }, [vehicle]),
        el('span', { class: 'travel__pin travel__pin--to' }, [
          el('span', { class: 'travel__pin-label', text: UI.travel.arrival }),
          el('strong', { text: destination?.label ?? '—' }),
        ]),
      ]),
      el('p', {
        class: 'travel__mode',
        text: `${TRAVEL_MODE_LABEL[destination?.travelMode ?? 'plane']}でいどう中`,
      }),
    ]),
    el('div', { class: 'travel__cast' }, [
      character ? characterSprite(character, { pose: 'walk', class: 'travel__hero', label: '' }) : null,
      el('img', {
        class: 'travel__guide',
        src: TITLE_ASSETS.mascot,
        alt: UI.characters.guideAlt,
        decoding: 'async',
      }),
    ]),
    el('p', { class: 'note travel__hint', text: UI.travel.skipHint }),
  ]);

  timer = window.setTimeout(goNext, duration);
  root.addEventListener('screen:destroy', () => window.clearTimeout(timer));

  return root;
}
