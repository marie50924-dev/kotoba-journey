import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import {
  AGE_GROUP_LABEL,
  findAvatar,
  fullName,
  fullNameKana,
} from '../data/avatars';
import { avatarThumb } from '../components/avatarThumb';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/**
 * 選んだキャラクターの確認。
 * 確定するまで保存しないので、ここから選び直せる。
 */
export function avatarConfirmScreen(ctx: AppContext): HTMLElement {
  const avatar = findAvatar(ctx.pendingAvatarId ?? ctx.records.get().selectedAvatarId);

  if (!avatar) {
    // 直接来た場合でも行き止まりにしない。
    return screenShell({ title: UI.avatar.confirmHeading }, [
      el('p', { class: 'note', text: UI.avatar.notChosen }),
      el('div', { class: 'screen__footer' }, [
        button(UI.avatar.chooseAgain, () => ctx.navigate({ name: 'avatarSelect' }), {
          class: 'btn btn--primary btn--large',
        }),
      ]),
    ]);
  }

  function decide(): void {
    // 保存の主キーは名前ではなく不変のID。
    ctx.records.update((record) => ({ ...record, selectedAvatarId: avatar!.id }));
    ctx.pendingAvatarId = null;
    ctx.navigate({ name: 'courseEntry' });
  }

  return screenShell(
    { title: UI.avatar.confirmHeading, onBack: () => ctx.back(), variant: 'screen--avatar-confirm' },
    [
      el('div', { class: 'avatar-confirm' }, [
        avatarThumb(avatar, { size: 'lg', label: '' }),
        el('p', { class: 'avatar-confirm__name', text: fullName(avatar) }),
        el('p', { class: 'avatar-confirm__kana', text: fullNameKana(avatar) }),
        el('p', { class: 'avatar-confirm__roman', text: avatar.romanizedName }),
        el('p', { class: 'note', text: `${AGE_GROUP_LABEL[avatar.ageGroup]}・仮表示` }),
      ]),
      el('p', { class: 'avatar-select__note', text: UI.avatar.placeholderNote }),
      el('div', { class: 'screen__footer screen__footer--stack' }, [
        button(UI.avatar.startWith, decide, { class: 'btn btn--primary btn--large' }),
        button(UI.avatar.chooseAgain, () => ctx.navigate({ name: 'avatarSelect' }), { class: 'btn' }),
      ]),
    ],
  );
}
