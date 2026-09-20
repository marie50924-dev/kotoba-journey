import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { buildDetailSections, findCountryIntro, showsDetails } from '../data/countryIntros';
import type {
  CountryIntro,
  DetailSection,
  FactClaim,
  InfoSource,
  NamedItem,
} from '../data/countryIntros';
import { ageGroupFromAvatarAgeGroup, findAgeGroup } from '../data/characters';
import { findAvatar, displayName, AVATARS } from '../data/avatars';
import { castNpcs } from '../domain/npcCasting';
import { characterCard } from '../components/characterCard';
import { avatarThumb } from '../components/avatarThumb';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/**
 * 到着後の国紹介。
 *
 * 事実の本文確認が終わっていない国（publicationStatus が 'draft'）では、
 * あいさつ・首都・都市・自然・気候・名所・食・歴史・文化の文章を一切出さず、
 * 「準備中」とだけ短く案内する。「もっと知る」も出さない。
 * 準備中でも出すのは、行き先を見分けるための国名と国旗だけ。
 * カルタへは変わらず進めるので、ゲームの進行は妨げない。
 * 確認が終わって 'verified' になれば、下の二段階表示がそのまま出る。
 *
 * 二段階に分けてある。
 * 最初は「国名・国旗・あいさつ・首都・有名なもの1件・短い紹介文」だけを出し、
 * すぐカルタへ進めるようにする。長い説明は「もっと知る」の中へ入れる。
 *
 * 「もっと知る」は任意で、開かなくても開いたあと閉じても、
 * 旅とカルタの進行は失われない（この画面の中で開閉するだけで、遷移しない）。
 *
 * 文章・見出し・出典はすべて data/countryIntros.ts 側にあり、
 * この画面は組版だけを行う。国を足しても、この画面は変更しない。
 *
 * 到着記念の並びには、自分のキャラクターと同行 NPC を置く場所を用意してある。
 * 本番の透過立ち絵は未納品なので、今は avatarThumb の仮表示が入る。
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

  const startButton = button(UI.countryIntro.collectWords, () => ctx.navigate({ name: 'karta' }), {
    class: 'btn btn--primary btn--large intro__start',
  });

  if (!intro) {
    // 紹介データが未整備の国でも、ゲーム開始は妨げない。
    return screenShell({ title: '—', onBack: () => ctx.back(), variant: 'screen--intro' }, [
      el('p', { class: 'note', text: UI.passport.empty }),
      el('div', { class: 'screen__footer' }, [startButton]),
    ]);
  }

  const showDetails = showsDetails(intro);

  return screenShell(
    {
      title: `${intro.countryNameJa} / ${intro.countryNameEn}`,
      onBack: () => ctx.back(),
      variant: 'screen--intro',
    },
    [
      // ---- 最初に見せる分 ----
      // 国名と国旗は行き先の目じるしなので、準備中でも出す。
      el('div', { class: 'intro__hero' }, [
        // 国旗は行き先を見分けるための目じるしなので、準備中でも出す。
        flagNode(intro),
        // あいさつは「この国ではこう言う」という学習情報なので、
        // 本文確認が終わるまで出さない。不採用にして項目ごと外した国と、
        // rejected のまま残っている場合のどちらでも描かない。
        showDetails && intro.greeting !== undefined && isShown(intro.greeting.claim)
          ? el('div', { class: 'intro__greeting' }, [
              el('span', { class: 'intro__greeting-label', text: UI.countryIntro.greeting }),
              el('strong', { class: 'intro__greeting-ja', text: intro.greeting.ja }),
              el('span', { class: 'intro__greeting-en', text: intro.greeting.en }),
            ])
          : null,
      ]),
      // 準備中のあいだは、確認の終わっていない事実を1つも出さない。
      showDetails
        ? el('div', { class: 'intro__facts' }, [
            // 不採用にした文章は、公開中の国でも念のためここで落とす。
            isShown(intro.capital.claim)
              ? factRow(UI.countryIntro.capital, intro.capital.name)
              : null,
            isShown(intro.highlight.claim)
              ? factRow(UI.countryIntro.famous, intro.highlight.name, intro.highlight.note)
              : null,
          ])
        : null,
      showDetails && isShown(intro.summary)
        ? el('p', { class: 'intro__summary', text: intro.summary.text })
        : showDetails
          ? null
          : el('p', { class: 'intro__preparing', text: UI.countryIntro.preparing }),

      // 到着記念写真のように見せる。
      characterCard(group, {
        variant: 'photo',
        class: 'intro__photo',
        caption: `${intro.countryNameJa}にとうちゃく`,
        label: `${intro.countryNameJa}の旅の風景`,
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

      // ---- もっと知る（任意） ----
      // 準備中の国では公開導線へ出さない。
      showDetails ? moreSection(intro) : null,

      el('div', { class: 'screen__footer' }, [startButton]),
    ],
  );
}

/** 不採用にした文章は画面へ出さない。 */
function isShown(claim: FactClaim | undefined): boolean {
  return claim === undefined || claim.verification !== 'rejected';
}

/** 「しゅと: 東京」のような1行。 */
function factRow(label: string, value: string, note?: string): HTMLElement {
  return el('div', { class: 'intro__fact' }, [
    el('span', { class: 'intro__fact-label', text: label }),
    el('div', { class: 'intro__fact-value' }, [
      el('strong', { text: value }),
      note ? el('span', { class: 'intro__fact-note', text: note }) : null,
    ]),
  ]);
}

/**
 * 「もっと知る」の開閉。
 *
 * 通常のボタンとパネルで作るので、キーボードでもそのまま操作できる。
 * 開閉してもフォーカスはボタンに残り、画面遷移も起きないため進行は失われない。
 */
function moreSection(intro: CountryIntro): HTMLElement {
  const panelId = `intro-more-${intro.countryId}`;
  const sections = buildDetailSections(intro);

  const panel = el('div', { class: 'intro__more', id: panelId }, [
    el('p', { class: 'note intro__more-lead', text: UI.countryIntro.moreLead }),
    ...sections.map(detailCard),
    sourcesBlock(intro),
  ]);
  panel.hidden = true;

  const toggle = el('button', {
    type: 'button',
    class: 'btn intro__more-toggle',
    'aria-expanded': 'false',
    'aria-controls': panelId,
  });
  toggle.textContent = UI.countryIntro.more;

  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? UI.countryIntro.moreClose : UI.countryIntro.more;
    // フォーカスは動かさない。開いた直後もボタンの位置から続けて操作できる。
  });

  return el('section', { class: 'intro__more-section' }, [toggle, panel]);
}

/** 詳細カード1枚。見出しと本文と並びはデータ側で決まっている。 */
function detailCard(section: DetailSection): HTMLElement {
  return el(
    'article',
    { class: 'intro-card', 'data-section': section.id },
    [
      el('h3', { class: 'intro-card__heading', text: section.heading }),
      ...section.lines.map((line) => el('p', { class: 'intro-card__body', text: line })),
      section.items.length > 0
        ? el('ul', { class: 'intro-card__list' }, section.items.map(itemRow))
        : null,
      ...section.sources.map((source) =>
        el('p', {
          class: 'intro-card__source',
          text: `${UI.countryIntro.source}: ${source.sourceLabel}`,
        }),
      ),
      // 外部資料を引かないカードでは、何が正本なのかを示す。
      section.sourceNote
        ? el('p', { class: 'intro-card__source', text: section.sourceNote })
        : null,
    ],
  );
}

function itemRow(item: NamedItem): HTMLElement {
  return el('li', { class: 'intro-card__item' }, [
    el('span', { class: 'intro-card__item-name', text: item.name }),
    item.note ? el('span', { class: 'intro-card__item-note', text: item.note }) : null,
  ]);
}

/** 情報源。URLと確認日をまとめて開けるようにする。 */
function sourcesBlock(intro: CountryIntro): HTMLElement {
  const panelId = `intro-sources-${intro.countryId}`;

  const list = el(
    'ul',
    { class: 'intro-sources__list', id: panelId },
    intro.sources.map(sourceRow),
  );
  list.hidden = true;

  const toggle = el('button', {
    type: 'button',
    class: 'btn btn--ghost intro-sources__toggle',
    'aria-expanded': 'false',
    'aria-controls': panelId,
  });
  toggle.textContent = UI.countryIntro.sourcesOpen;

  toggle.addEventListener('click', () => {
    const open = list.hidden;
    list.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? UI.countryIntro.moreClose : UI.countryIntro.sourcesOpen;
  });

  return el('section', { class: 'intro-sources' }, [
    el('h3', { class: 'intro-card__heading', text: UI.countryIntro.sources }),
    toggle,
    list,
  ]);
}

function sourceRow(source: InfoSource): HTMLElement {
  const link = el('a', {
    class: 'intro-sources__link',
    href: source.sourceUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
  });
  link.textContent = source.sourceLabel;

  return el('li', { class: 'intro-sources__item' }, [
    link,
    // 所在を確かめた日が無い資料もある。その場合は日付欄を出さない。
    source.checkedAt
      ? el('span', {
          class: 'intro-sources__checked',
          text: `${UI.countryIntro.checkedAt}: ${source.checkedAt}`,
        })
      : null,
  ]);
}

/** 国旗の簡易表示。正式な旗素材が入るまでは CSS で描く。 */
function flagNode(intro: CountryIntro): HTMLElement {
  const kind = intro.flag.kind;
  return el('div', {
    class: `intro__flag intro__flag--${kind}`,
    role: 'img',
    'aria-label': `${intro.countryNameJa}の国旗`,
  });
}
