import type { DialogueScript, DialogueTrigger } from './types';
import { courseScripts } from './course';
import { arrivalScripts } from './arrival';
import { waveEndScripts } from './waveEnd';
import { resultScripts } from './result';

export * from './types';

/**
 * Phase 1-C1 の台本一覧。
 *
 * 80人分の個別台本はまだ作らず、共通テンプレートを4場面ぶん用意している。
 * 個別台本へ差し替えるときは、この配列へ
 * 「speakerAvatarId ごとの台本」を足して選択側を変えればよい。
 */
export const DIALOGUE_SCRIPTS: readonly DialogueScript[] = [
  ...courseScripts,
  ...arrivalScripts,
  ...waveEndScripts,
  ...resultScripts,
];

export function scriptsFor(trigger: DialogueTrigger): DialogueScript[] {
  return DIALOGUE_SCRIPTS.filter((s) => s.trigger === trigger);
}

export function findScript(id: string): DialogueScript | undefined {
  return DIALOGUE_SCRIPTS.find((s) => s.id === id);
}

/**
 * 場面に応じた台本を1つ選ぶ。seed を渡せば再現できる。
 * 台本が無い場面でも例外を投げず undefined を返す。
 */
export function pickScript(trigger: DialogueTrigger, seed: number): DialogueScript | undefined {
  const candidates = scriptsFor(trigger);
  if (candidates.length === 0) return undefined;
  const index = Math.abs(Math.trunc(seed)) % candidates.length;
  return candidates[index];
}
