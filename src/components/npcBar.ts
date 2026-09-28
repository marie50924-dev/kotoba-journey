import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { avatarThumb } from '../components/avatarThumb';
import { chatPanel } from '../components/chatPanel';
import { findAvatar, type AvatarDefinition } from '../data/avatars';
import { castNpcs, rememberCast, type CastScreen } from '../domain/npcCasting';
import { npcBarLine, npcCaptions } from '../domain/npcLabels';
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
 *
 * 顔は 40px と小さく、世界地図・到着・パスポートでは2〜3人並ぶ。
 * 80人の中には 40px だと見分けにくい組（髪型と構図が似ている人など）があるため、
 * 顔だけでは誰か分からない。そこで顔1つずつに名前と年代を並べて添え、
 * どの画像がどの人かを画面上で示す。年代の淡い地色は色の差が小さいので、
 * 色に頼らず文字でも年代が分かるようにしておく。
 *
 * 読み上げについては、顔そのものは装飾として扱い（avatarThumb に label:'' を渡す）、
 * 名前は隣の文字が担う。こうすると画像のロールと文字とで同じ名前を二度読まない。
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

  const captions = npcCaptions(cast);

  const host = el('div', { class: 'npc-host' });
  const bar = el('div', { class: 'npc-bar' }, [
    el(
      'ul',
      { class: 'npc-bar__faces' },
      cast.map((npc, index) =>
        el('li', { class: 'npc-bar__person', 'data-avatar-id': npc.id }, [
          avatarThumb(npc, { size: 'sm', label: '' }),
          el('span', { class: 'npc-bar__name' }, [
            captions[index].name,
            el('span', { class: 'npc-bar__age', text: captions[index].ageLabel }),
          ]),
        ]),
      ),
    ),
    el('p', {
      class: 'npc-bar__text',
      text: npcBarLine(cast.length, UI.chat.npcHereOne, UI.chat.npcHereMany),
    }),
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
