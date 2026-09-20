import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { findCountryIntro } from '../data/countryIntros';
import type { CountryIntro } from '../data/countryIntros';
import { findCharacter } from '../data/characters';
import { characterSprite } from '../components/characterSprite';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/**
 * 到着後の国紹介。
 * 1画面へ詰め込まず、短いカードを2〜3枚だけ見せてカルタへ送り出す。
 * 文章と出典はすべて data/countryIntros.ts 側にあり、この画面は組版だけを行う。
 */
export function countryIntroScreen(ctx: AppContext): HTMLElement {
  const intro = findCountryIntro(ctx.selection.destinationId ?? '');
  const character = findCharacter(ctx.selectedCharacterId());

  const startButton = button(UI.actions.startKaruta, () => ctx.navigate({ name: 'karta' }), {
    class: 'btn btn--primary btn--large',
  });

  if (!intro) {
    // 紹介データが未整備の国でも、ゲーム開始は妨げない。
    return screenShell({ title: '—', onBack: () => ctx.back(), variant: 'screen--intro' }, [
      el('p', { class: 'note', text: UI.passport.empty }),
      el('div', { class: 'screen__footer' }, [startButton]),
    ]);
  }

  return screenShell(
    { title: `${intro.nameJa} / ${intro.nameEn}`, onBack: () => ctx.back(), variant: 'screen--intro' },
    [
      el('div', { class: 'intro__hero' }, [
        flagNode(intro),
        el('div', { class: 'intro__greeting' }, [
          el('span', { class: 'intro__greeting-label', text: UI.countryIntro.greeting }),
          el('strong', { class: 'intro__greeting-ja', text: intro.greeting.ja }),
          el('span', { class: 'intro__greeting-en', text: intro.greeting.en }),
        ]),
        character ? characterSprite(character, { pose: 'happy', class: 'intro__hero-sprite', label: '' }) : null,
      ]),
      el('div', { class: 'intro__cards' }, intro.cards.map(introCard)),
      el('section', { class: 'intro__learning' }, [
        el('h2', { class: 'result-section__title', text: UI.countryIntro.learning }),
        el('p', { text: intro.learning }),
      ]),
      el('div', { class: 'screen__footer' }, [startButton]),
    ],
  );
}

function introCard(card: CountryIntro['cards'][number]): HTMLElement {
  return el('article', { class: 'intro-card' }, [
    el('h3', { class: 'intro-card__heading', text: card.heading }),
    el('p', { class: 'intro-card__body', text: card.body }),
    card.source
      ? el('p', { class: 'intro-card__source', text: `${UI.countryIntro.source}: ${card.source}` })
      : null,
  ]);
}

/** 国旗の簡易表示。正式な旗素材が入るまでは CSS で描く。 */
function flagNode(intro: CountryIntro): HTMLElement {
  const kind = intro.flag.kind;
  return el('div', {
    class: `intro__flag intro__flag--${kind}`,
    role: 'img',
    'aria-label': `${intro.nameJa}の国旗`,
  });
}
