import { findPair } from './wordPairs';
import type { WordPair } from '../domain/types';

/**
 * 単語イラストの紐付け。
 *
 * 語彙そのもの（src/data/wordPairs.ts）・訳・pairId・コースの範囲は
 * このファイルからは一切変えない。pairId から画像ファイルを引くだけの対応表。
 * 紐付けが無い語は、イラストなしで日本語・英語・発音を表示して進める。
 * イラストが無いことをゲームの停止条件にしない。
 *
 * いまここにあるのは、ChatGPT側が制作した**正式素材の候補3点**
 * （りんご・ねこ・いぬ）。採用は未確定で、残り102語は未制作。
 * 全語ぶんの制作はChatGPT側の並行工程で、ここは紐付けだけを持つ。
 */

export interface WordIllustration {
  pairId: number;
  /** public/assets/word-illustrations/ の中のファイル名。 */
  file: string;
  /**
   * この絵がどの段階のものか。資料で区別するために持つ。
   *   confirmation-only … Claude Code が実装確認のために作った簡潔な図形
   *   official-candidate … ChatGPT側が制作した正式素材の候補（採用は未確定）
   *   official           … 正式に採用された素材
   */
  kind: 'confirmation-only' | 'official-candidate' | 'official';
}

/*
 * pairId の昇順。確認用の3点だけ。
 *
 * 読むファイルは、ChatGPT側が用意した配信用の軽量版（512×512 の可逆WebP）。
 * 原本の 1254×1254 PNG は public/assets/word-illustrations/ に残してあり、
 * 必要になればファイル名を戻すだけで切り替えられる。
 * 語・訳・pairId・コースの範囲・kind は変えていない。
 */
export const WORD_ILLUSTRATIONS: readonly WordIllustration[] = [
  { pairId: 1, file: 'apple-light-v1.webp', kind: 'official-candidate' }, // りんご / apple
  { pairId: 2, file: 'cat-light-v1.webp', kind: 'official-candidate' }, //   ねこ / cat
  { pairId: 4, file: 'dog-light-v1.webp', kind: 'official-candidate' }, //   いぬ / dog
];

const BY_PAIR_ID = new Map(WORD_ILLUSTRATIONS.map((item) => [item.pairId, item]));

export function findWordIllustration(pairId: number): WordIllustration | undefined {
  return BY_PAIR_ID.get(pairId);
}

/** イラストのURL。紐付けが無ければ null。 */
export function wordIllustrationUrl(pairId: number): string | null {
  const item = BY_PAIR_ID.get(pairId);
  if (!item) return null;
  return `${import.meta.env.BASE_URL}assets/word-illustrations/${item.file}`;
}

/**
 * イラスト付きの体験で出す3ペア。
 *
 * 確認用イラストがある語だけを、pairId で名指しして使う。
 * 語そのもの（ja / en）は語彙正本 src/data/wordPairs.ts から引くので、
 * ここで訳や綴りを持たない。通常のコース・語彙セット・出題範囲は変えない。
 */
export const TRIAL_PAIR_IDS: readonly number[] = WORD_ILLUSTRATIONS.map((item) => item.pairId);

/**
 * 体験で使う語を語彙正本から取り出す。
 * 正本に無い pairId は落とす（語を足したり作ったりしない）。
 */
export function trialPairs(): WordPair[] {
  const pairs: WordPair[] = [];
  for (const pairId of TRIAL_PAIR_IDS) {
    const pair = findPair(pairId);
    if (pair) pairs.push(pair);
  }
  return pairs;
}

/*
 * 単語イラストの先読み。
 *
 * 正解パネルを出してから画像を取りに行くと、通信と展開のぶんだけ
 * 絵が出るまで待たされる（実機で数秒の空白になっていた）。
 * 出題する語の絵を、遊び始める前に取って展開まで済ませておく。
 *
 * 大事なのは「1枚ずつ順に取る」こと。
 * まとめて同時に取りに行くと、細い回線では互いに帯域を取り合って、
 * 1枚目が出そろうのがかえって遅くなる（同時だと13.6秒、順番なら約3.5秒）。
 * 先に必要になる絵から順に、1枚終わってから次を始める。
 *
 * 取れなかった絵はここで握りつぶす。画面側は絵が無くても
 * 日本語・英語・発音だけで進める作りなので、進行は止まらない。
 */

/** 一度読み込んだ画像。pairId から引く。 */
const PRELOADED = new Map<number, HTMLImageElement>();
/** すでに取りに行った（または取り終えた）pairId。二重に並べないための印。 */
const REQUESTED = new Set<number>();
/** これから順に取る pairId の待ち行列。 */
const QUEUE: number[] = [];
/** いま1枚取っている最中か。 */
let loading = false;

/** 待ち行列の先頭を1枚だけ取る。終わったら次へ進む。 */
function loadNext(): void {
  if (loading) return;
  const pairId = QUEUE.shift();
  if (pairId === undefined) return;
  const url = wordIllustrationUrl(pairId);
  if (url === null) {
    loadNext();
    return;
  }
  loading = true;

  const done = (): void => {
    loading = false;
    loadNext();
  };

  const image = new Image();
  image.decoding = 'async';
  /*
   * 読み込みが終わる前から控えに入れておく。
   * 画面側がこの要素をそのまま使えば、取得は1回で済む。
   * 別に img を作って同じURLを指定すると、取りに行き直しになって
   * 先に始めた意味が消える。
   */
  PRELOADED.set(pairId, image);
  image.addEventListener(
    'load',
    () => {
      // 取れたので、すぐ次の1枚へ進む。
      done();
      /*
       * 展開（decode）はここで促すだけにして、次の1枚を待たせない。
       * 画面に出していない画像の decode は後回しにされることがあり、
       * これを待って次へ進む作りにしていたら、2枚目が始まるまで
       * 6秒以上あいた（実測）。失敗しても表示には影響しない。
       */
      if (typeof image.decode === 'function') void image.decode().catch(() => {});
    },
    { once: true },
  );
  image.addEventListener(
    'error',
    () => {
      // 取れなかった絵は控えから外す。画面側は絵無しで進む。
      PRELOADED.delete(pairId);
      REQUESTED.delete(pairId);
      done();
    },
    { once: true },
  );
  image.src = url;
}

/**
 * 出題する語の絵を、先に必要になるものから順に読み込む。
 * 何度呼んでも同じ語を取り直さない。待たないので呼び出し側を止めない。
 */
export function preloadWordIllustrations(pairIds: readonly number[]): void {
  if (typeof Image !== 'function') return;
  for (const pairId of pairIds) {
    if (REQUESTED.has(pairId)) continue;
    if (wordIllustrationUrl(pairId) === null) continue; // 絵の無い語は何もしない
    REQUESTED.add(pairId);
    QUEUE.push(pairId);
  }
  loadNext();
}

/**
 * 先読みで用意した画像。読み込み中のものも返す。
 *
 * 画面側はこの要素をそのまま置く。読み込みが済んでいれば即座に出るし、
 * まだなら届いた時点で出る。どちらにしても取得は1回だけで、
 * 正解パネルを出してから取りに行き直すことはない。
 * 先読みしていない語は undefined。画面側が普通に src を指定して出す。
 */
export function preloadedWordIllustration(pairId: number): HTMLImageElement | undefined {
  return PRELOADED.get(pairId);
}

/** テスト用。先読みの控えを空にする。 */
export function resetWordIllustrationPreload(): void {
  PRELOADED.clear();
  REQUESTED.clear();
  QUEUE.length = 0;
  loading = false;
}
