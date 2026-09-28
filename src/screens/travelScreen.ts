import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { findDestination, TRAVEL_MODE_LABEL } from '../data/destinations';
import { findAvatar, displayName } from '../data/avatars';
import { findCountryArt } from '../data/countryArt';
import { sceneCard } from '../components/characterCard';
import { avatarThumb } from '../components/avatarThumb';
import { TITLE_ASSETS } from '../data/titleAssets';
import type { AppContext } from '../app/state';

/** 移動演出の長さ。長く見せすぎない。 */
const TRAVEL_DURATION_MS = 4000;
/** 2回目以降や設定でスキップする場合の短縮版。 */
const SHORT_DURATION_MS = 900;

/**
 * 移動中の画面。
 * 自分のキャラクターと案内役、経路に合う移動表現、出発地と到着地、
 * 短い進行アニメを見せる。
 * いつでもスキップでき、一度見た国は設定や既訪問により短縮される。
 *
 * 搭乗券の絵は行き先の国の正式イラスト。人物は焼き込まれていないので、
 * 旅をする本人は avatarThumb と名前の組で別に出す。
 * 年代別の2人組イラストは「本人」と取りちがえられるため、ここでは使わない。
 */
export function travelScreen(ctx: AppContext): HTMLElement {
  const destination = findDestination(ctx.selection.destinationId);
  const record = ctx.records.get();
  const me = findAvatar(record.selectedAvatarId);

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
      // 提供素材は背景込みなので、切り抜いた風に見せず搭乗券カードとして額装する。
      ticketCard(destination?.id, destination?.label ?? ''),
      // 自分のキャラクター。立ち絵が納品されたら avatarThumb の中だけが差し替わる。
      me
        ? el('div', { class: 'travel__me' }, [
            // 名前はすぐ右に出す。画像側にも名前を持たせると、読み上げで二度言うことになる。
            avatarThumb(me, { size: 'md', label: '' }),
            el('span', { class: 'travel__me-name', text: displayName(me) }),
          ])
        : null,
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

/**
 * 搭乗券風のカード。行き先の国の正式イラストを額装する。
 *
 * 絵は複数の場所にある名所を1枚に集めた想像の風景で、人物は入っていない。
 * 絵が用意されていない行き先では、何も出さずに移動演出だけを通す。
 */
function ticketCard(countryId: string | undefined, label: string): HTMLElement | null {
  const art = findCountryArt(countryId);
  if (!art) return null;
  return sceneCard(
    { src: art.image, alt: art.alt, width: art.width, height: art.height, focusY: art.focusY },
    { variant: 'boarding', class: 'travel__ticket', caption: `${label}ゆき` },
  );
}
