import { describe, expect, it } from 'vitest';
import {
  TRIAL_PAIR_IDS,
  WORD_ILLUSTRATIONS,
  findWordIllustration,
  trialPairs,
  wordIllustrationUrl,
} from '../data/wordIllustrations';
import { SAMPLE_PAIRS, findPair } from '../data/wordPairs';
import { VOCABULARY_SETS } from '../data/vocabularySets';

/*
 * ファイルの列挙は Vite の glob で行う（node:fs は @types/node が無いので使えない）。
 * 配信するのは画面が読む WebP だけ。元のPNGと仮のSVG、説明文は
 * 配信物に入れず assets-source/ に保管する。消してはいない。
 */
const PUBLIC_FILES = import.meta.glob('../../public/assets/word-illustrations/*');
const SOURCE_FILES = import.meta.glob('../../assets-source/word-illustrations/*');

function baseNames(files: Record<string, unknown>): string[] {
  return Object.keys(files)
    .map((path) => path.slice(path.lastIndexOf('/') + 1))
    .sort();
}

/**
 * 単語イラストの紐付けと、イラスト付き体験で使う3ペアの確認。
 *
 * ここで守りたいのは「イラストを足しても語彙が動かない」こと。
 * 語・訳・pairId・コースの語彙セットは、この対応表からは一切変えない。
 */
describe('ことばの絵の置き場所', () => {
  it('配信するのは画面が読む WebP の3枚だけ', () => {
    expect(baseNames(PUBLIC_FILES)).toEqual([
      'apple-light-v1.webp',
      'cat-light-v1.webp',
      'dog-light-v1.webp',
    ]);
  });

  it('配信物に、元のPNG・仮のSVG・説明文を混ぜない', () => {
    for (const name of baseNames(PUBLIC_FILES)) {
      expect(name, `${name} は配信物に入れない`).toMatch(/\.webp$/);
    }
  });

  it('元のPNG・仮のSVG・説明文は、消さずに保管してある', () => {
    for (const name of [
      'apple.png', 'cat.png', 'dog.png',
      'apple.svg', 'cat.svg', 'dog.svg',
      'README.txt',
    ]) {
      expect(baseNames(SOURCE_FILES), `${name} が保管されていない`).toContain(name);
    }
  });

  it('配信している WebP は、対応表が指すファイル名と一致する', () => {
    const 指している = WORD_ILLUSTRATIONS.map((x) => x.file).sort();
    expect(baseNames(PUBLIC_FILES)).toEqual(指している);
  });
});

describe('単語イラストの紐付け', () => {
  it('紐付けは pairId の昇順で、重複が無い', () => {
    const ids = WORD_ILLUSTRATIONS.map((item) => item.pairId);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('紐付けた pairId は、すべて語彙正本に実在する', () => {
    for (const item of WORD_ILLUSTRATIONS) {
      expect(findPair(item.pairId), `pairId ${item.pairId} が語彙正本に無い`).toBeDefined();
    }
  });

  it('いまは正式素材の候補3点だけ（採用は未確定）', () => {
    expect(WORD_ILLUSTRATIONS).toHaveLength(3);
    for (const item of WORD_ILLUSTRATIONS) {
      expect(item.kind).toBe('official-candidate');
    }
  });

  it('URL は BASE_URL を通し、ファイル名が1回だけ入る', () => {
    const url = wordIllustrationUrl(1);
    expect(url).toBe(`${import.meta.env.BASE_URL}assets/word-illustrations/apple-light-v1.webp`);
  });

  it('紐付けの無い語は null を返す（イラスト無しでも進める）', () => {
    const withoutArt = SAMPLE_PAIRS.find((pair) => !findWordIllustration(pair.pairId));
    expect(withoutArt).toBeDefined();
    expect(wordIllustrationUrl(withoutArt!.pairId)).toBeNull();
  });
});

describe('イラスト付き体験の3ペア', () => {
  it('りんご・ねこ・いぬ の3ペアになる', () => {
    expect(TRIAL_PAIR_IDS).toEqual([1, 2, 4]);
    expect(trialPairs().map((pair) => [pair.ja, pair.en])).toEqual([
      ['りんご', 'apple'],
      ['ねこ', 'cat'],
      ['いぬ', 'dog'],
    ]);
  });

  it('体験の語はすべてイラストを持つ', () => {
    for (const pair of trialPairs()) {
      expect(wordIllustrationUrl(pair.pairId), `pairId ${pair.pairId}`).not.toBeNull();
    }
  });

  it('体験の語は語彙正本から取るだけで、新しい語を作らない', () => {
    for (const pair of trialPairs()) {
      expect(SAMPLE_PAIRS).toContainEqual(pair);
    }
  });

  it('体験を足しても、どの語彙セットの中身も変わらない', () => {
    // 体験は語彙セットを経由しない独立した入口。
    // セットの語数と中身が、体験の3ペアに引きずられていないことを押さえる。
    const common = VOCABULARY_SETS.find((set) => set.id === 'common-practice');
    expect(common?.pairIds).toHaveLength(105);
    const travel = VOCABULARY_SETS.find((set) => set.id === 'travel-practice');
    expect(travel?.pairIds).toHaveLength(30);
    // 体験の3ペアのうち 2・4 は旅のセットに入っていない。
    // 体験で使ったことがセットへ混ざっていないことの確認。
    expect(travel?.pairIds).not.toContain(2);
    expect(travel?.pairIds).not.toContain(4);
  });
});
