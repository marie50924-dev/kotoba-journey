import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { avatarThumb } from '../components/avatarThumb';
import { chatPanel } from '../components/chatPanel';
import { displayName, findAvatar, type AvatarDefinition } from '../data/avatars';
import { castNpcs, rememberCast, type CastScreen } from '../domain/npcCasting';
import { AVATARS } from '../data/avatars';
import { pickScript, type DialogueTrigger } from '../data/dialogues';
import { rememberMetAvatar } from '../storage/learningRecord';
import type { AppContext } from '../app/state';

/**
 * 画面の片隅に置く NPC の帯。
 *
 * 既存画面を圧迫しないよう、会話は常時表示ではなく
 * 「はなしかける」で会話パネルを開く方式にしている。
 * 自分のキャラクターが未選択のときは何も表示しない。
 */

export interface NpcBarOptions {
  screen: CastScreen;
  trigger: DialogueTrigger;
  countryId?: string;
  courseId?: string;
}

export function npcBar(ctx: AppContext, options: NpcBarOptions): HTMLElement | null {
  const record = ctx.records.get();
  const me = findAvatar(record.selectedAvatarId);
  if (!me) return null;

  const cast = castNpcs(
    {
      screen: options.screen,
      selectedAvatarId: me.id,
      recentAvatarIds: record.recentNpcAvatarIds,
      countryId: options.countryId,
      courseId: options.courseId,
      seed: ctx.castSeed,
    },
    AVATARS,
  );
  if (cast.length === 0) return null;

  const host = el('div', { class: 'npc-host' });
  const bar = el('div', { class: 'npc-bar' }, [
    el('div', { class: 'npc-bar__faces' }, cast.map((npc) => avatarThumb(npc, { size: 'sm', label: '' }))),
    el('p', { class: 'npc-bar__text', text: npcLine(cast) }),
    button(UI.chat.open, () => openChat(cast[0]), { class: 'btn npc-bar__btn' }),
  ]);

  function openChat(npc: AvatarDefinition): void {
    const script = pickScript(options.trigger, ctx.castSeed + npc.order);
    if (!script || !me) return;

    // 出した相手を覚えて、次回の連続登場を抑える。
    ctx.records.update((current) =>
      rememberMetAvatar(
        { ...current, recentNpcAvatarIds: rememberCast(current.recentNpcAvatarIds, [npc.id]) },
        npc.id,
      ),
    );

    host.append(
      chatPanel({
        script,
        npc,
        me,
        audio: ctx.audio,
        onClose: () => host.replaceChildren(bar),
      }),
    );
  }

  host.append(bar);
  return host;
}

function npcLine(cast: readonly AvatarDefinition[]): string {
  return `${cast.map(displayName).join('、')} ${UI.chat.npcHere}`;
}
