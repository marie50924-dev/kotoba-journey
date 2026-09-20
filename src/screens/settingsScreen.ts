import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { AGE_GROUPS, findAgeGroup } from '../data/characters';
import { findAvatar, fullName } from '../data/avatars';
import { avatarThumb } from '../components/avatarThumb';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/** 設定画面。両ブランチの設定項目をいったん合流させた状態。 */
export function settingsScreen(ctx: AppContext): HTMLElement {
  const status = el('p', { class: 'note', role: 'status' });
  const audioSupported = ctx.audio.isSupported();

  const toggle = el('button', {
    type: 'button',
    class: 'toggle',
    'aria-pressed': String(ctx.records.get().audioEnabled),
    disabled: !audioSupported,
  });

  function renderToggle(): void {
    const enabled = ctx.records.get().audioEnabled;
    toggle.textContent = enabled ? UI.settings.audioOn : UI.settings.audioOff;
    toggle.classList.toggle('is-on', enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
  }

  toggle.addEventListener('click', () => {
    const next = !ctx.records.get().audioEnabled;
    ctx.records.update((record) => ({ ...record, audioEnabled: next }));
    ctx.audio.setEnabled(next);
    renderToggle();
  });
  renderToggle();

  const clearButton = button(
    UI.actions.clearRecord,
    () => {
      // 取り消せない操作なので、必ず確認ダイアログを経由する。
      if (!window.confirm(UI.settings.clearConfirm)) return;
      ctx.records.clear();
      ctx.selection.courseId = null;
      ctx.selection.categoryId = null;
      ctx.lastResult = null;
      status.textContent = UI.settings.cleared;
      renderToggle();
    },
    { class: 'btn btn--danger' },
  );

  // 移動演出を毎回スキップするかどうか。
  const travelToggle = el('button', {
    type: 'button',
    class: 'toggle',
    'aria-pressed': String(ctx.records.get().skipTravelAnimation),
  });

  function renderTravelToggle(): void {
    const skip = ctx.records.get().skipTravelAnimation;
    travelToggle.textContent = skip ? UI.settings.audioOff : UI.settings.audioOn;
    travelToggle.classList.toggle('is-on', !skip);
    travelToggle.setAttribute('aria-pressed', String(skip));
  }

  travelToggle.addEventListener('click', () => {
    const next = !ctx.records.get().skipTravelAnimation;
    ctx.records.update((record) => ({ ...record, skipTravelAnimation: next }));
    renderTravelToggle();
  });
  renderTravelToggle();

  // 英検・TOEIC のように年齢が決まらないコース向けの任意設定。未設定でも進める。
  const ageSelect = el('select', { class: 'setting-select', 'aria-label': UI.characters.ageSetting });
  const autoOption = el('option', { value: '' });
  autoOption.textContent = UI.characters.ageAuto;
  ageSelect.append(autoOption);
  for (const group of AGE_GROUPS) {
    const option = el('option', { value: group.id });
    option.textContent = group.label;
    ageSelect.append(option);
  }
  ageSelect.value = ctx.savedAgeGroup() ?? '';
  ageSelect.addEventListener('change', () => {
    const next = findAgeGroup(ageSelect.value as never)?.id ?? null;
    ctx.records.update((record) => ({ ...record, characterAgeGroup: next }));
  });

  const me = findAvatar(ctx.records.get().selectedAvatarId);

  return screenShell({ title: UI.settings.heading, onBack: () => ctx.back() }, [
    el('div', { class: 'setting-row' }, [
      el('span', { class: 'setting-row__label' }, [
        el('span', { text: UI.avatar.current }),
        me
          ? el('span', { class: 'setting-row__value', text: fullName(me) })
          : el('span', { class: 'setting-row__value', text: UI.avatar.notChosen }),
      ]),
      me ? avatarThumb(me, { size: 'sm', label: '' }) : null,
      button(UI.avatar.change, () => ctx.navigate({ name: 'avatarSelect' }), { class: 'btn' }),
    ]),
    el('div', { class: 'setting-row' }, [
      el('span', { class: 'setting-row__label', text: UI.settings.audio }),
      toggle,
    ]),
    !audioSupported ? el('p', { class: 'note', text: UI.settings.unsupportedAudio }) : null,
    el('div', { class: 'setting-row' }, [
      el('span', { class: 'setting-row__label', text: UI.settings.travelAnimation }),
      travelToggle,
    ]),
    el('div', { class: 'setting-row' }, [
      el('span', { class: 'setting-row__label' }, [
        el('span', { text: UI.characters.ageSetting }),
        el('span', { class: 'setting-row__value', text: UI.settings.characterHint }),
      ]),
      ageSelect,
    ]),
    el('div', { class: 'setting-row' }, [
      el('span', { class: 'setting-row__label', text: UI.actions.clearRecord }),
      clearButton,
    ]),
    status,
    el('p', { class: 'note', text: UI.passport.privacy }),
  ]);
}
