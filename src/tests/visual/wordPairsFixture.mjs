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
const MINIMUM_PAIRS = 105;
/**
 * 欠番の pairId。台帳で見送りにした候補の番号で、ゲームには入らない。
 * **語数105と最大 pairId 106 は別の数**なので、番号の連続で語数を数えない。
 */
const MISSING_BY_DESIGN = [99];
/** 番号の上限。欠番を含むので、語数（MINIMUM_PAIRS）とは別の数。 */
const MAX_PAIR_ID = 106;

const text = await readFile(SOURCE, 'utf8');
const entries = [...text.matchAll(/\{\s*pairId:\s*(\d+),\s*ja:\s*'([^']+)',\s*en:\s*'([^']+)'\s*\}/g)]
  .map((m) => [Number(m[1]), m[2], m[3]]);

if (entries.length < MINIMUM_PAIRS) {
  throw new Error(
    `語彙データを読み取れていません（${entries.length}語）。` +
      `src/data/wordPairs.ts の書き方が変わっていないか確かめてください。`,
  );
}

// 件数だけでは、途中の番号を読み落としていても気づけない。
// pairId 1〜MAX_PAIR_ID のうち、意図した欠番を除いた番号がそろっているかを見る。
const readIds = new Set(entries.map(([id]) => id));
const missing = [];
for (let id = 1; id <= MAX_PAIR_ID; id += 1) {
  if (MISSING_BY_DESIGN.includes(id)) continue;
  if (!readIds.has(id)) missing.push(id);
}
// 見送りにした番号が、うっかりゲームへ入っていないことも見る。
const revived = MISSING_BY_DESIGN.filter((id) => readIds.has(id));
if (revived.length > 0) {
  throw new Error(
    `見送りにした pairId ${revived.join(', ')} がゲームデータに入っています。`,
  );
}
if (missing.length > 0) {
  throw new Error(
    `語彙データの pairId ${missing.join(', ')} を読み取れていません。` +
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
 *
 * 語が増えると、ある語が別の語を丸ごと含むようになる。
 * 「blackboard」は「black」を、「しめる」は「め」を含む。
 * 先に見つかった方を返すと、pairId の小さい語に引きずられて
 * 65 こくばん の正答が「くろ」になってしまう。
 *
 * そこで、まず出題文そのものと一致する語を探す。
 * 一致が無いときだけ、含まれる語のうち**いちばん長いもの**を採る。
 * 短い語が長い語を追い越さないので、語が増えても取り違えない。
 */
export function answerFor(prompt, lang) {
  const text = prompt.trim();
  for (const [ja, en] of WORD_PAIRS.values()) {
    if (text === ja || text === en) return lang === 'en' ? en : ja;
  }
  let best = null;
  for (const [ja, en] of WORD_PAIRS.values()) {
    for (const word of [ja, en]) {
      if (!text.includes(word)) continue;
      if (best === null || word.length > best.length) best = { length: word.length, ja, en };
    }
  }
  return best === null ? '' : lang === 'en' ? best.en : best.ja;
}
