import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { findCountryIntro } from '../data/countryIntros';
import type { CountryIntro } from '../data/countryIntros';
import { ageGroupFromAvatarAgeGroup, findAgeGroup } from '../data/characters';
import { findAvatar, displayName, AVATARS } from '../data/avatars';
import { castNpcs } from '../domain/npcCasting';
import { characterCard } from '../components/characterCard';
import { avatarThumb } from '../components/avatarThumb';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/**
 * 到着後の国紹介。
 * 1画面へ詰め込まず、短いカードを2〜3枚だけ見せてカルタへ送り出す。
 * 文章と出典はすべて data/countryIntros.ts 側にあり、この画面は組版だけを行う。
 *
 * 到着記念の並びには、自分のキャラクターと同行 NPC を置く場所を用意してある。
 * 本番の透過立ち絵は未納品なので、今は avatarThumb の仮表示が入る。
 * 立ち絵が納品されたら avatarThumb の中だけを差し替えればこの画面も変わる。
 */
export function countryIntroScreen(ctx: AppContext): HTMLElement {
  const intro = findCountryIntro(ctx.selection.destinationId ?? '');
  const record = ctx.records.get();
  const me = findAvatar(record.selectedAvatarId);
  const group = findAgeGroup(ageGroupFromAvatarAgeGroup(me?.ageGroup))!;

  // 同行する NPC。自分は選ばれない（castNpcs が除外する）。
  const companions = me
    ? castNpcs(
        {
          screen: 'arrival',
          selectedAvatarId: me.id,
          recentAvatarIds: record.recentNpcAvatarIds,
          countryId: ctx.selection.destinationId ?? undefined,
          courseId: ctx.selection.courseId ?? undefined,
          seed: ctx.castSeed,
        },
        AVATARS,
      )
    : [];

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
      ]),
      // 到着記念写真のように見せる。
      characterCard(group, {
        variant: 'photo',
        class: 'intro__photo',
        caption: `${intro.nameJa}にとうちゃく`,
        label: `${intro.nameJa}の旅の風景`,
      }),
      // 自分のキャラクターと同行者。将来ここへ正式な立ち絵が並ぶ。
      me
        ? el('div', { class: 'intro__cast' }, [
            el('span', { class: 'intro__cast-me' }, [
              avatarThumb(me, { size: 'md' }),
              el('span', { class: 'intro__cast-name', text: displayName(me) }),
            ]),
            ...companions.map((npc) =>
              el('span', { class: 'intro__cast-npc' }, [
                avatarThumb(npc, { size: 'sm' }),
                el('span', { class: 'intro__cast-name', text: displayName(npc) }),
              ]),
            ),
          ])
        : null,
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
