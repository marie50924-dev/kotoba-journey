import { describe, expect, it } from 'vitest';
import npcBarCss from '../styles/chat.css?raw';
import { AVATARS, AGE_GROUP_LABEL, displayName, fullName } from '../data/avatars';
import { castNpcs, CAST_SIZE_BY_SCREEN, type CastScreen } from '../domain/npcCasting';
import { npcBarLine, npcCaptions } from '../domain/npcLabels';
import { UI } from '../data/strings';

/**
 * NPCの帯に添える名前の検査。
 *
 * 40pxの顔は2〜3人並ぶと見分けにくい組があるため、顔ごとに名前と年代を出す。
 * ここでは DOM を持たないので、
 *   - 添える文字が名簿どおりか（純粋な組み立て）
 *   - 実際に出うる抽選結果すべてで名前がそろうか
 *   - 名前を置く場所が CSS に用意されているか
 * を見る。実際の描画と読み上げ用の属性は実ブラウザテストで確かめる。
 */

const SCREENS = Object.keys(CAST_SIZE_BY_SCREEN) as CastScreen[];

describe('NPCの顔に添える名前', () => {
  it('顔の数と名前の数が必ず一致する', () => {
    for (const screen of SCREENS) {
      for (const me of AVATARS) {
        const cast = castNpcs(
          { screen, selectedAvatarId: me.id, recentAvatarIds: [], seed: me.order },
          AVATARS,
        );
        expect(npcCaptions(cast)).toHaveLength(cast.length);
      }
    }
  });

  it('名前・年代・姓名が名簿と一致し、本人IDで結び付く', () => {
    const cast = AVATARS.slice(0, 3);
    const captions = npcCaptions(cast);
    for (const [index, caption] of captions.entries()) {
      const avatar = cast[index];
      expect(caption.id).toBe(avatar.id);
      expect(caption.name).toBe(displayName(avatar));
      expect(caption.ageLabel).toBe(AGE_GROUP_LABEL[avatar.ageGroup]);
      expect(caption.fullName).toBe(fullName(avatar));
    }
  });

  it('並び順ではなくIDで対応が決まる（順番を入れ替えても本人の名前が付く）', () => {
    const cast = [AVATARS[40], AVATARS[7], AVATARS[73]];
    for (const caption of npcCaptions(cast)) {
      const avatar = AVATARS.find((a) => a.id === caption.id);
      expect(avatar, `${caption.id} が名簿にない`).toBeDefined();
      expect(caption.name).toBe(displayName(avatar!));
      expect(caption.ageLabel).toBe(AGE_GROUP_LABEL[avatar!.ageGroup]);
    }
  });

  it('80人の誰が出ても、名前と年代が空にならない', () => {
    for (const caption of npcCaptions(AVATARS)) {
      expect(caption.name.length).toBeGreaterThan(0);
      expect(caption.ageLabel.length).toBeGreaterThan(0);
      expect(caption.fullName.length).toBeGreaterThan(0);
    }
  });

  it('2人以上出る画面では、同じ人が二度出ない（名前の重複で誰か分からなくならない）', () => {
    for (const screen of SCREENS) {
      if (CAST_SIZE_BY_SCREEN[screen] < 2) continue;
      for (const me of AVATARS) {
        for (let seed = 0; seed < 8; seed += 1) {
          const cast = castNpcs(
            { screen, selectedAvatarId: me.id, recentAvatarIds: [], seed },
            AVATARS,
          );
          const ids = npcCaptions(cast).map((c) => c.id);
          expect(new Set(ids).size, `${screen} seed=${seed} で同じ人が並んだ`).toBe(ids.length);
        }
      }
    }
  });
});

describe('NPCの帯の一文', () => {
  it('名前を含まない（顔ごとの名前と二重にならない）', () => {
    const names = AVATARS.map(displayName);
    for (const count of [1, 2, 3]) {
      const line = npcBarLine(count, UI.chat.npcHereOne, UI.chat.npcHereMany);
      for (const name of names) {
        expect(line.includes(name), `一文に「${name}」が入っている`).toBe(false);
      }
    }
  });

  it('1人と2人以上で言い方を変える', () => {
    expect(npcBarLine(1, UI.chat.npcHereOne, UI.chat.npcHereMany)).toBe(UI.chat.npcHereOne);
    expect(npcBarLine(2, UI.chat.npcHereOne, UI.chat.npcHereMany)).toBe(UI.chat.npcHereMany);
    expect(npcBarLine(3, UI.chat.npcHereOne, UI.chat.npcHereMany)).toBe(UI.chat.npcHereMany);
  });

  it('文言は空でなく、英字の専門用語を出さない', () => {
    for (const line of [UI.chat.npcHereOne, UI.chat.npcHereMany]) {
      expect(line.length).toBeGreaterThan(0);
      expect(/[A-Za-z]/.test(line)).toBe(false);
    }
  });
});

describe('名前を置く場所の CSS', () => {
  it('顔と名前を縦に並べる組の指定がある', () => {
    expect(npcBarCss).toContain('.npc-bar__person');
    expect(npcBarCss).toContain('.npc-bar__name');
    expect(npcBarCss).toContain('.npc-bar__age');
  });

  it('狭い画面で折り返せる（横スクロールを出さない）', () => {
    const bar = npcBarCss.slice(npcBarCss.indexOf('.npc-bar {'));
    expect(bar.slice(0, bar.indexOf('}'))).toContain('flex-wrap: wrap');
  });

  it('名前を省略記号で消さない（誰か分からなくなるため）', () => {
    const block = npcBarCss.slice(
      npcBarCss.indexOf('.npc-bar__name {'),
      npcBarCss.indexOf('.npc-bar__age {'),
    );
    expect(block).not.toContain('text-overflow: ellipsis');
    expect(block).toContain('overflow-wrap: anywhere');
  });

  it('顔を重ねない（負の間隔を残さない）', () => {
    const block = npcBarCss.slice(
      npcBarCss.indexOf('.npc-bar__faces {'),
      npcBarCss.indexOf('.npc-bar__person {'),
    );
    expect(/gap:\s*-/.test(block)).toBe(false);
  });
});
