import { describe, expect, it } from 'vitest';
import {
  DIALOGUE_SCRIPTS,
  findScript,
  pickScript,
  scriptsFor,
  type DialogueTrigger,
} from '../data/dialogues';
import { AVATARS, displayName, findAvatar } from '../data/avatars';

const TRIGGERS: DialogueTrigger[] = ['course', 'arrival', 'wave-end', 'result'];

describe('台本データ', () => {
  it('Phase 1-C1 に必要な4場面をすべて用意している', () => {
    for (const trigger of TRIGGERS) {
      expect(scriptsFor(trigger).length).toBeGreaterThan(0);
    }
  });

  it('台本IDは一意', () => {
    expect(new Set(DIALOGUE_SCRIPTS.map((s) => s.id)).size).toBe(DIALOGUE_SCRIPTS.length);
  });

  it('どの台本も最初の台詞と2〜3個の選択肢を持つ', () => {
    for (const script of DIALOGUE_SCRIPTS) {
      expect(script.opening.length).toBeGreaterThan(0);
      expect(script.choices.length).toBeGreaterThanOrEqual(2);
      expect(script.choices.length).toBeLessThanOrEqual(3);
    }
  });

  it('どの選択肢にも返事がある（会話が行き止まりにならない）', () => {
    for (const script of DIALOGUE_SCRIPTS) {
      for (const choice of script.choices) {
        expect(choice.label.trim().length).toBeGreaterThan(0);
        expect(choice.reply.length).toBeGreaterThan(0);
      }
    }
  });

  it('発話者は npc か me のどちらかだけ', () => {
    for (const script of DIALOGUE_SCRIPTS) {
      for (const line of [...script.opening, ...script.choices.flatMap((c) => c.reply)]) {
        expect(['npc', 'me']).toContain(line.role);
        expect(line.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('NPCの名前をハードコードせず、置換記号だけを使う', () => {
    const roster = AVATARS.map((a) => a.familyName + a.givenName);
    for (const script of DIALOGUE_SCRIPTS) {
      const all = [...script.opening, ...script.choices.flatMap((c) => c.reply)]
        .map((l) => l.text)
        .join('\n');
      for (const name of roster) {
        expect(all).not.toContain(name);
      }
    }
  });

  it('置換記号は {npc} と {me} だけ', () => {
    for (const script of DIALOGUE_SCRIPTS) {
      const all = [...script.opening, ...script.choices.flatMap((c) => c.reply)]
        .map((l) => l.text)
        .join('\n');
      for (const token of all.match(/\{[a-zA-Z]+\}/g) ?? []) {
        expect(['{npc}', '{me}']).toContain(token);
      }
    }
  });

  it('英語文がある台詞は読み上げ用に空でない', () => {
    for (const script of DIALOGUE_SCRIPTS) {
      for (const line of [...script.opening, ...script.choices.flatMap((c) => c.reply)]) {
        if (line.english !== undefined) {
          expect(line.english.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('台本の選択と取得ができる', () => {
    const first = DIALOGUE_SCRIPTS[0];
    expect(findScript(first.id)?.id).toBe(first.id);
    expect(findScript('no-such-script')).toBeUndefined();
  });

  it('同じ seed なら同じ台本が選ばれる', () => {
    for (const trigger of TRIGGERS) {
      expect(pickScript(trigger, 42)?.id).toBe(pickScript(trigger, 42)?.id);
    }
  });

  it('負の seed でも例外にならない', () => {
    expect(() => pickScript('course', -99)).not.toThrow();
    expect(pickScript('course', -99)).toBeDefined();
  });

  it('台本が無い場面では undefined を返す', () => {
    expect(pickScript('passport' as DialogueTrigger, 1)).toBeUndefined();
  });
});

describe('名前の解決', () => {
  /** chatPanel が使う置換と同じ規則。 */
  function resolve(text: string, npcId: string, meId: string): string {
    const npc = findAvatar(npcId)!;
    const me = findAvatar(meId)!;
    return text.replace(/\{npc\}/g, displayName(npc)).replace(/\{me\}/g, displayName(me));
  }

  it('speakerAvatarId から下の名前へ解決できる', () => {
    expect(resolve('{npc}だよ、{me}さん。', 'elementary-m-01', 'adult-f-01'))
      .toBe('陽翔だよ、詩織さん。');
  });

  it('置換記号が無い文はそのまま', () => {
    expect(resolve('こんにちは。', 'elementary-m-01', 'adult-f-01')).toBe('こんにちは。');
  });

  it('どの台本も80人のどの組み合わせでも置換漏れが出ない', () => {
    const npc = AVATARS[0];
    const me = AVATARS[79];
    for (const script of DIALOGUE_SCRIPTS) {
      for (const line of [...script.opening, ...script.choices.flatMap((c) => c.reply)]) {
        expect(resolve(line.text, npc.id, me.id)).not.toMatch(/\{(npc|me)\}/);
      }
    }
  });
});
