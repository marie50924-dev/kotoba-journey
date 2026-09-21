/**
 * 実ブラウザテスト用の語彙表。
 *
 * これまで、実ブラウザテストはそれぞれが日本語と英語の対応表を手書きで持っていた。
 * 語を足すたびに3か所を直す必要があり、直し忘れると
 * 「足した語が盤面に出た回だけ、正答を引けずに落ちる」という、
 * 語彙の中身ではなく運で決まるテストになってしまう。
 *
 * 実ブラウザテストは .mjs なので本番の TypeScript を import できない。
 * そこで src/data/wordPairs.ts のソースを読み、行の形から対応表を組み立てる。
 * 本番データが唯一の出どころになるので、語を足しても手書きの更新は要らない。
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE = fileURLToPath(new URL('../../data/wordPairs.ts', import.meta.url));

/**
 * 読み取りに失敗したまま静かに通らないよう、最低限これだけは入っているはず。
 * 語が増えたらこの数も上げる。語数そのものの一致は単体テストが見るので、
 * ここは「読み落としに気づける下限」でよい。
 */
const MINIMUM_PAIRS = 70;

const text = await readFile(SOURCE, 'utf8');
const entries = [...text.matchAll(/\{\s*pairId:\s*(\d+),\s*ja:\s*'([^']+)',\s*en:\s*'([^']+)'\s*\}/g)]
  .map((m) => [Number(m[1]), m[2], m[3]]);

if (entries.length < MINIMUM_PAIRS) {
  throw new Error(
    `語彙データを読み取れていません（${entries.length}語）。` +
      `src/data/wordPairs.ts の書き方が変わっていないか確かめてください。`,
  );
}

/** pairId → [日本語, 英語]。src/data/wordPairs.ts の内容そのもの。 */
export const WORD_PAIRS = new Map(entries.map(([id, ja, en]) => [id, [ja, en]]));

/** ゲームに入っている pairId（データの並びのまま）。 */
export const GAME_PAIR_IDS = entries.map(([id]) => id);

/**
 * 出題文から正答を引く。
 * 日本語で出たら英語、英語で出たら日本語を返す。
 */
export function answerFor(prompt, lang) {
  const text = prompt.trim();
  for (const [ja, en] of WORD_PAIRS.values()) {
    if (text.includes(ja) || text.includes(en)) return lang === 'en' ? en : ja;
  }
  return '';
}
