import { AGE_GROUP_LABEL, displayName, fullName, type AvatarDefinition } from '../data/avatars';

/**
 * NPC の帯に添える見出しを組み立てる。
 *
 * 40px の顔は、2〜3人並ぶと誰が誰か分からなくなる。
 * そこで顔の1つずつに名前と年代を添えて、画像と名前の対応を画面上で示す。
 * ここは DOM を触らない純粋な組み立てだけを持ち、描画は npcBar が行う。
 */

export interface NpcCaption {
  /** どの顔の説明かを結び付けるための本人ID。並び順には依存しない。 */
  id: string;
  /** 顔の下に出す短い名前（会話と同じ下の名前）。 */
  name: string;
  /** 年代。淡色の地色だけに頼らず、文字でも年代が分かるようにする。 */
  ageLabel: string;
  /** 読み上げ・検査用の姓名。画面には出さない。 */
  fullName: string;
}

export function npcCaptions(cast: readonly AvatarDefinition[]): NpcCaption[] {
  return cast.map((npc) => ({
    id: npc.id,
    name: displayName(npc),
    ageLabel: AGE_GROUP_LABEL[npc.ageGroup],
    fullName: fullName(npc),
  }));
}

/**
 * 帯の一文。
 *
 * 名前は顔ごとに出すようになったので、この一文では名前を繰り返さない。
 * 繰り返すと画面が横に伸びるうえ、読み上げでも同じ名前を二度言うことになる。
 */
export function npcBarLine(count: number, one: string, many: string): string {
  return count <= 1 ? one : many;
}
