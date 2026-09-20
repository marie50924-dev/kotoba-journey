import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { findAvatar, fullName } from '../data/avatars';
import { avatarThumb } from '../components/avatarThumb';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/** 設定画面。学習記録の消去と音声ON/OFFだけを置く。 */
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
      el('span', { class: 'setting-row__label', text: UI.actions.clearRecord }),
      clearButton,
    ]),
    status,
    el('p', { class: 'note', text: UI.passport.privacy }),
  ]);
}
