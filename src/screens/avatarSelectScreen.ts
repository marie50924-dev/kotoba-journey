import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import {
  AGE_GROUP_LABEL,
  AVATAR_AGE_GROUPS,
  avatarsByAgeGroup,
  displayName,
  findAvatar,
  fullName,
  type AvatarAgeGroup,
  type AvatarDefinition,
  type AvatarPresentation,
} from '../data/avatars';
import { avatarThumb } from '../components/avatarThumb';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

type PresentationFilter = 'all' | AvatarPresentation;

/**
 * 旅するキャラクターの選択。
 *
 * 年代タブと表示フィルターは「80人から人をさがす」ための道具であり、
 * 利用者本人の年齢や性別を尋ねるものではない。
 * キャラクターの年代と学習コースは完全に独立している。
 */
export function avatarSelectScreen(ctx: AppContext): HTMLElement {
  let activeAge: AvatarAgeGroup = findAvatar(ctx.records.get().selectedAvatarId)?.ageGroup
    ?? AVATAR_AGE_GROUPS[0];
  let filter: PresentationFilter = 'all';
  let pendingId: string | null = ctx.records.get().selectedAvatarId;

  const grid = el('div', { class: 'avatar-grid', role: 'listbox', 'aria-label': UI.avatar.selectHeading });
  const chosenLine = el('div', { class: 'avatar-select__chosen' });
  // button() は初期 disabled だとクリック処理を付けないため、
  // 有効な状態で作ってから disabled を立てる。
  const confirmButton = button(UI.avatar.confirm, () => confirm(), { class: 'btn btn--primary' });
  confirmButton.disabled = true;

  const tabs = AVATAR_AGE_GROUPS.map((age) => {
    const tab = el('button', {
      type: 'button',
      class: 'avatar-tab',
      role: 'tab',
      'aria-selected': String(age === activeAge),
      'data-age': age,
    });
    tab.textContent = AGE_GROUP_LABEL[age];
    tab.addEventListener('click', () => {
      activeAge = age;
      renderTabs();
      renderGrid();
    });
    return tab;
  });

  const filterButtons = (
    [
      ['all', UI.avatar.filterAll],
      ['m', UI.avatar.filterM],
      ['f', UI.avatar.filterF],
    ] as [PresentationFilter, string][]
  ).map(([value, label]) => {
    const node = el('button', {
      type: 'button',
      class: 'avatar-filter__btn',
      'aria-pressed': String(value === filter),
      'data-filter': value,
    });
    node.textContent = label;
    node.addEventListener('click', () => {
      filter = value;
      renderFilters();
      renderGrid();
    });
    return node;
  });

  function renderTabs(): void {
    for (const tab of tabs) {
      tab.setAttribute('aria-selected', String(tab.dataset.age === activeAge));
    }
  }

  function renderFilters(): void {
    for (const node of filterButtons) {
      node.setAttribute('aria-pressed', String(node.dataset.filter === filter));
    }
  }

  function visibleAvatars(): AvatarDefinition[] {
    const list = avatarsByAgeGroup(activeAge);
    return filter === 'all' ? list : list.filter((a) => a.presentation === filter);
  }

  function renderGrid(): void {
    const list = visibleAvatars();
    if (list.length === 0) {
      grid.replaceChildren(el('p', { class: 'avatar-select__empty', text: UI.avatar.empty }));
      return;
    }
    grid.replaceChildren(
      ...list.map((avatar) => {
        const selected = avatar.id === pendingId;
        const card = el(
          'button',
          {
            type: 'button',
            class: 'avatar-card',
            role: 'option',
            'aria-selected': String(selected),
            'data-avatar-id': avatar.id,
          },
          [
            // 選択中は枠の色だけでなくチェック記号でも示す。
            el('span', { class: 'avatar-card__check', text: '✓', 'aria-hidden': 'true' }),
            avatarThumb(avatar, { size: 'md', label: '' }),
            el('span', { class: 'avatar-thumb__name', text: displayName(avatar) }),
          ],
        );
        card.addEventListener('click', () => {
          pendingId = avatar.id;
          renderGrid();
          renderChosen();
        });
        return card;
      }),
    );
  }

  function renderChosen(): void {
    const avatar = findAvatar(pendingId);
    chosenLine.replaceChildren(
      ...(avatar
        ? [
            avatarThumb(avatar, { size: 'sm', label: '' }),
            el('span', { text: `${UI.avatar.chosen}: ${fullName(avatar)}` }),
          ]
        : [el('span', { class: 'note', text: UI.avatar.notChosen })]),
    );
    confirmButton.disabled = avatar === undefined;
  }

  function confirm(): void {
    if (!pendingId) return;
    ctx.pendingAvatarId = pendingId;
    ctx.navigate({ name: 'avatarConfirm' });
  }

  renderTabs();
  renderFilters();
  renderGrid();
  renderChosen();

  return screenShell(
    {
      title: UI.avatar.selectHeading,
      lead: UI.avatar.selectLead,
      onBack: ctx.canGoBack() ? () => ctx.back() : undefined,
      fixedHeight: true,
      variant: 'screen--avatar-select',
    },
    [
      el('div', { class: 'avatar-tabs', role: 'tablist', 'aria-label': UI.avatar.tabsLabel }, tabs),
      el('div', { class: 'avatar-filter', 'aria-label': UI.avatar.filterLabel }, filterButtons),
      el('p', { class: 'avatar-select__note', text: UI.avatar.filterNote }),
      grid,
      el('p', { class: 'avatar-select__note', text: UI.avatar.placeholderNote }),
      el('div', { class: 'avatar-select__confirm' }, [chosenLine, confirmButton]),
    ],
  );
}
