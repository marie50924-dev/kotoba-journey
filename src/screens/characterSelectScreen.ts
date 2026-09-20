import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { CHARACTERS } from '../data/characters';
import type { CharacterId } from '../data/characters';
import { characterSprite } from '../components/characterSprite';
import { TITLE_ASSETS } from '../data/titleAssets';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/**
 * 主人公の選択。
 *
 * ここで聞いているのはアバターの見た目の好みであり、
 * プレイヤー自身の性別ではない。個人情報は一切入力させない。
 * 「あとで選ぶ」を選べば案内役中心で進められる。
 */
export function characterSelectScreen(ctx: AppContext): HTMLElement {
  const current = ctx.selectedCharacterId();

  function choose(id: CharacterId | null): void {
    ctx.records.update((record) => ({ ...record, characterId: id }));
    ctx.navigate({ name: 'courseEntry' });
  }

  const cards = CHARACTERS.map((character) => {
    const selected = current === character.id;
    const card = el(
      'button',
      {
        type: 'button',
        class: `character-card${selected ? ' is-selected' : ''}`,
        'aria-pressed': selected,
      },
      [
        el('div', { class: 'character-card__art' }, [
          characterSprite(character, { pose: 'stand', label: '' }),
        ]),
        el('div', { class: 'character-card__text' }, [
          el('span', { class: 'character-card__label', text: character.label }),
          el('span', { class: 'character-card__tagline', text: character.tagline }),
        ]),
      ],
    );
    card.addEventListener('click', () => choose(character.id));
    return card;
  });

  const guideCard = el('div', { class: 'character-card character-card--guide' }, [
    el('div', { class: 'character-card__art' }, [
      el('img', {
        class: 'character-card__guide-img',
        src: TITLE_ASSETS.mascot,
        alt: UI.characters.guideAlt,
        decoding: 'async',
      }),
    ]),
    el('div', { class: 'character-card__text' }, [
      el('span', { class: 'character-card__label', text: UI.characters.guideLabel }),
      el('span', { class: 'character-card__tagline', text: 'ずっといっしょに案内します' }),
    ]),
  ]);

  return screenShell(
    {
      title: UI.characters.heading,
      lead: UI.characters.lead,
      onBack: () => ctx.back(),
      variant: 'screen--characters',
    },
    [
      el('div', { class: 'character-grid' }, cards),
      guideCard,
      button(`${UI.characters.later}（${UI.characters.laterDetail}）`, () => choose(null), {
        class: 'btn',
      }),
      el('p', { class: 'note', text: UI.characters.roughNote }),
    ],
  );
}
