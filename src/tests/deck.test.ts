import { describe, expect, it } from 'vitest';
import {
  arrangeSeed,
  buildCards,
  buildDeck,
  isCardCount,
  pairCountFor,
  selectPairs,
  selectSeed,
} from '../domain/deck';
import { shuffle, createRng } from '../domain/random';
import { SAMPLE_PAIRS, findPair } from '../data/wordPairs';
import { pairsInSet } from '../data/vocabularySets';
import { buildWaveQuiz } from '../domain/waveQuiz';
import type { CardCount } from '../domain/types';

const COUNTS: CardCount[] = [6, 12, 20];

/** ゲームに入っている85語。12・20・22・25・27 は資料確認待ちの欠番。 */
const GAME_PAIR_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 13, 14, 15, 16, 17, 18, 19,
  21, 23, 24, 26, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38,
  39, 40, 41, 42, 43, 44, 45,
  46, 47, 48, 49, 50, 51, 52, 53,
  54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68,
  69, 70, 71, 72, 73, 74, 75,
  76, 77, 78, 79, 80, 81, 82, 83,
  84, 85, 86, 87, 88, 89, 90,
];
/** 台帳にはあるが、まだゲームへ入れていない語。番号は予約したまま。 */
const RESERVED_PAIR_IDS = [12, 20, 22, 25, 27];
/** 工程V-2C-4以降に足した75語。 */
const ADDED_PAIRS: [number, string, string][] = [
  [11, 'うさぎ', 'rabbit'],
  [13, 'ぞう', 'elephant'],
  [14, 'うま', 'horse'],
  [15, 'あか', 'red'],
  [16, 'きいろ', 'yellow'],
  [17, 'みどり', 'green'],
  [18, 'しろ', 'white'],
  [19, 'くろ', 'black'],
  [21, 'たまご', 'egg'],
  [23, 'いちご', 'strawberry'],
  [24, 'やま', 'mountain'],
  [26, 'そら', 'sky'],
  [28, 'たべる', 'eat'],
  [29, 'のむ', 'drink'],
  [30, 'ねる', 'sleep'],
  [31, 'かお', 'face'],
  [32, 'て', 'hand'],
  [33, 'め', 'eye'],
  [34, 'みみ', 'ear'],
  [35, 'くち', 'mouth'],
  [36, 'かさ', 'umbrella'],
  [37, 'つくえ', 'desk'],
  [38, 'いす', 'chair'],
  [39, 'まど', 'window'],
  [40, 'ドア', 'door'],
  [41, 'えんぴつ', 'pencil'],
  [42, 'あるく', 'walk'],
  [43, 'およぐ', 'swim'],
  [44, 'うたう', 'sing'],
  [45, 'わらう', 'laugh'],
  [46, 'でんしゃ', 'train'],
  [47, 'バス', 'bus'],
  [48, 'ひこうき', 'airplane'],
  [49, 'タクシー', 'taxi'],
  [50, 'ホテル', 'hotel'],
  [51, 'きっぷ', 'ticket'],
  [52, 'パスポート', 'passport'],
  [53, 'ちず', 'map'],
  [54, 'くうこう', 'airport'],
  [55, 'えき', 'station'],
  [56, 'スーツケース', 'suitcase'],
  [57, 'かぎ', 'key'],
  [58, 'さいふ', 'wallet'],
  [59, 'カメラ', 'camera'],
  [60, 'レストラン', 'restaurant'],
  [61, 'がっこう', 'school'],
  [62, 'せんせい', 'teacher'],
  [63, 'せいと', 'student'],
  [64, 'きょうしつ', 'classroom'],
  [65, 'こくばん', 'blackboard'],
  [66, 'けしゴム', 'eraser'],
  [67, 'ものさし', 'ruler'],
  [68, 'ペン', 'pen'],
  [69, 'クレヨン', 'crayon'],
  [70, 'きょうかしょ', 'textbook'],
  [71, 'としょかん', 'library'],
  [72, 'じしょ', 'dictionary'],
  [73, 'ロッカー', 'locker'],
  [74, 'コンピューター', 'computer'],
  [75, 'ページ', 'page'],
  [76, 'メニュー', 'menu'],
  [77, 'テーブル', 'table'],
  [78, 'スプーン', 'spoon'],
  [79, 'フォーク', 'fork'],
  [80, 'ナイフ', 'knife'],
  [81, 'おさら', 'plate'],
  [82, 'タオル', 'towel'],
  [83, 'ベッド', 'bed'],
  [84, 'へや', 'room'],
  [85, 'シャワー', 'shower'],
  [86, 'エレベーター', 'elevator'],
  [87, 'まつ', 'wait'],
  [88, 'はこぶ', 'carry'],
  [89, 'あける', 'open'],
  [90, 'しめる', 'close'],
];

describe('デッキ生成', () => {
  it('3/6/10ペアに対応する枚数を返す', () => {
    expect(pairCountFor(6)).toBe(3);
    expect(pairCountFor(12)).toBe(6);
    expect(pairCountFor(20)).toBe(10);
  });

  it.each(COUNTS)('%i枚のデッキは指定枚数ちょうどになる', (count) => {
    expect(buildDeck(SAMPLE_PAIRS, count, 1)).toHaveLength(count);
  });

  it.each(COUNTS)('%i枚は、枚数ぶんの語だけを使う', (count) => {
    // 6枚は3語、12枚は6語、20枚は10語。多くも少なくもならない。
    const ids = new Set(buildDeck(SAMPLE_PAIRS, count, 4242).map((c) => c.pairId));
    expect(ids.size).toBe(pairCountFor(count));
  });

  it('20枚は、85語のプールから10語を選ぶ', () => {
    // 語彙が10語だった頃は、20枚を出すと必ず全語が並んでいた。
    // いまは85語から選ぶので、出る10語は seed で変わる。
    const pool = new Set(SAMPLE_PAIRS.map((p) => p.pairId));
    for (const seed of [1, 777, 20260921]) {
      const ids = [...new Set(buildDeck(SAMPLE_PAIRS, 20, seed).map((c) => c.pairId))];
      expect(ids).toHaveLength(10);
      expect(ids.every((id) => pool.has(id)), `seed=${seed}`).toBe(true);
    }
  });

  it.each(COUNTS)('%i枚のデッキは日本語と英語が同数になる', (count) => {
    const deck = buildDeck(SAMPLE_PAIRS, count, 42);
    const ja = deck.filter((card) => card.lang === 'ja');
    const en = deck.filter((card) => card.lang === 'en');
    expect(ja).toHaveLength(count / 2);
    expect(en).toHaveLength(count / 2);
  });

  it.each(COUNTS)('%i枚のデッキは pairId が日英で1対1に対応する', (count) => {
    const deck = buildDeck(SAMPLE_PAIRS, count, 7);
    const jaIds = deck.filter((c) => c.lang === 'ja').map((c) => c.pairId).sort((a, b) => a - b);
    const enIds = deck.filter((c) => c.lang === 'en').map((c) => c.pairId).sort((a, b) => a - b);
    expect(jaIds).toEqual(enIds);
    expect(new Set(jaIds).size).toBe(pairCountFor(count));
  });

  it('1つの語につき、日本語と英語のカードを両方作る', () => {
    const cards = buildCards(SAMPLE_PAIRS, 6, 31337);
    expect(cards).toHaveLength(6);
    for (const pairId of new Set(cards.map((c) => c.pairId))) {
      const forPair = cards.filter((c) => c.pairId === pairId);
      expect(forPair.map((c) => c.lang).sort()).toEqual(['en', 'ja']);
    }
  });

  it('カードの文字は語彙データのとおりになる', () => {
    for (const card of buildCards(SAMPLE_PAIRS, 20, 5)) {
      const pair = SAMPLE_PAIRS.find((p) => p.pairId === card.pairId)!;
      expect(card.text).toBe(card.lang === 'ja' ? pair.ja : pair.en);
    }
  });

  it('カードIDは盤面内で一意になる', () => {
    const deck = buildDeck(SAMPLE_PAIRS, 20, 3);
    expect(new Set(deck.map((c) => c.id)).size).toBe(20);
  });

  it('ペアが足りない場合はエラーになる', () => {
    expect(() => buildDeck(SAMPLE_PAIRS.slice(0, 2), 20, 1)).toThrow();
    expect(() => selectPairs(SAMPLE_PAIRS.slice(0, 2), 3, 1)).toThrow();
  });

  it('isCardCount は 6/12/20 のみを受け付ける', () => {
    expect(isCardCount(6)).toBe(true);
    expect(isCardCount(20)).toBe(true);
    expect(isCardCount(7)).toBe(false);
    expect(isCardCount('12')).toBe(false);
  });
});

describe('語彙の選出', () => {
  // 以前は配列の先頭から切り出していたため、6枚は毎回「りんご・ねこ・あお」だった。
  // いまは seed で選ぶので、seed が変われば別の語になる。

  const setOf = (pairs: { pairId: number }[]): number[] =>
    pairs.map((p) => p.pairId).sort((a, b) => a - b);

  it('同じseedなら同じ3語を選ぶ', () => {
    expect(setOf(selectPairs(SAMPLE_PAIRS, 3, 2024))).toEqual(
      setOf(selectPairs(SAMPLE_PAIRS, 3, 2024)),
    );
  });

  it('同じseedなら同じ6語を選ぶ', () => {
    expect(setOf(selectPairs(SAMPLE_PAIRS, 6, 99))).toEqual(
      setOf(selectPairs(SAMPLE_PAIRS, 6, 99)),
    );
  });

  it('seedが違えば、3語の組み合わせが変わる', () => {
    const sets = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
      setOf(selectPairs(SAMPLE_PAIRS, 3, seed)).join(','),
    );
    // 少なくとも2種類以上の組み合わせが現れる。
    expect(new Set(sets).size).toBeGreaterThan(1);
  });

  it('85語すべてが、seed しだいで選ばれうる', () => {
    // 少数のseedで全語が出ると決め打ちせず、十分な数のseedを走査して、
    // 70のどの pairId も少なくとも1回は選ばれることを見る。
    const TRIALS = 500;
    const seen = new Set<number>();
    for (let seed = 1; seed <= TRIALS; seed += 1) {
      for (const pair of selectPairs(SAMPLE_PAIRS, 10, seed)) seen.add(pair.pairId);
      if (seen.size === SAMPLE_PAIRS.length) break;
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(GAME_PAIR_IDS);
  });

  it('seedが違えば、20枚に出る10語の組み合わせも変わる', () => {
    // 25語になったので、20枚でも「毎回ぜんぶ出る」状態ではなくなった。
    // seed 2個の比較だと偶然一致しうるので、複数seedから2種類以上出ることを見る。
    const sets = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
      setOf(selectPairs(SAMPLE_PAIRS, 10, seed)).join(','),
    );
    expect(new Set(sets).size).toBeGreaterThan(1);
  });

  it('seedが違えば、6語の組み合わせが変わる', () => {
    const sets = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
      setOf(selectPairs(SAMPLE_PAIRS, 6, seed)).join(','),
    );
    expect(new Set(sets).size).toBeGreaterThan(1);
  });

  it('6枚が「りんご・ねこ・あお」に固定されない', () => {
    // 先頭3語固定の再発を止めるための検査。
    const FIXED = [1, 2, 3].join(',');
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) =>
        setOf(selectPairs(SAMPLE_PAIRS, 3, i + 1)).join(','),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
    expect([...seen].some((s) => s !== FIXED)).toBe(true);
  });

  it('選んだ語に重複が出ない', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      for (const count of [3, 6, 10]) {
        const ids = selectPairs(SAMPLE_PAIRS, count, seed).map((p) => p.pairId);
        expect(new Set(ids).size, `seed=${seed} count=${count}`).toBe(count);
      }
    }
  });

  it('元の語彙配列を並べ替えない', () => {
    const before = SAMPLE_PAIRS.map((p) => p.pairId);
    selectPairs(SAMPLE_PAIRS, 3, 7);
    selectPairs(SAMPLE_PAIRS, 6, 8);
    expect(SAMPLE_PAIRS.map((p) => p.pairId)).toEqual(before);
    expect(before).toEqual(GAME_PAIR_IDS);
  });

  it('選んだ語は、渡した語彙プールの中のものだけ', () => {
    const pool = new Set(SAMPLE_PAIRS.map((p) => p.pairId));
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const pair of selectPairs(SAMPLE_PAIRS, 6, seed)) {
        expect(pool.has(pair.pairId)).toBe(true);
      }
    }
  });

  it('コース別の語彙セットにもそのまま使える', () => {
    // 将来コースごとの配列を渡すときも、同じ関数で選べること。
    const subset = SAMPLE_PAIRS.filter((p) => p.pairId >= 5);
    const picked = selectPairs(subset, 3, 123);
    expect(picked).toHaveLength(3);
    expect(picked.every((p) => p.pairId >= 5)).toBe(true);
  });

  it('語を選ぶseedと、盤面へ置くseedは別になる', () => {
    // 同じ seed をそのまま二度使うと、選出と配置が相関する。
    expect(selectSeed(12345)).not.toBe(arrangeSeed(12345));
    expect(selectSeed(12345)).not.toBe(12345);
    expect(arrangeSeed(12345)).not.toBe(12345);
    // どちらも同じ入力なら同じ値（再現できる）。
    expect(selectSeed(7)).toBe(selectSeed(7));
    expect(arrangeSeed(7)).toBe(arrangeSeed(7));
  });
});

describe('語彙選出が他の仕組みを壊していないこと', () => {
  it('pairId と語の対応は変わっていない', () => {
    // 語を足しても、1〜10 が指す語は同じ。保存データの意味も変わらない。
    expect(SAMPLE_PAIRS.map((p) => [p.pairId, p.ja, p.en])).toEqual([
      [1, 'りんご', 'apple'],
      [2, 'ねこ', 'cat'],
      [3, 'あお', 'blue'],
      [4, 'いぬ', 'dog'],
      [5, 'はな', 'flower'],
      [6, 'ほん', 'book'],
      [7, 'みず', 'water'],
      [8, 'つき', 'moon'],
      [9, 'とり', 'bird'],
      [10, 'くるま', 'car'],
      [11, 'うさぎ', 'rabbit'],
      [13, 'ぞう', 'elephant'],
      [14, 'うま', 'horse'],
      [15, 'あか', 'red'],
      [16, 'きいろ', 'yellow'],
      [17, 'みどり', 'green'],
      [18, 'しろ', 'white'],
      [19, 'くろ', 'black'],
      [21, 'たまご', 'egg'],
      [23, 'いちご', 'strawberry'],
      [24, 'やま', 'mountain'],
      [26, 'そら', 'sky'],
      [28, 'たべる', 'eat'],
      [29, 'のむ', 'drink'],
      [30, 'ねる', 'sleep'],
      [31, 'かお', 'face'],
      [32, 'て', 'hand'],
      [33, 'め', 'eye'],
      [34, 'みみ', 'ear'],
      [35, 'くち', 'mouth'],
      [36, 'かさ', 'umbrella'],
      [37, 'つくえ', 'desk'],
      [38, 'いす', 'chair'],
      [39, 'まど', 'window'],
      [40, 'ドア', 'door'],
      [41, 'えんぴつ', 'pencil'],
      [42, 'あるく', 'walk'],
      [43, 'およぐ', 'swim'],
      [44, 'うたう', 'sing'],
      [45, 'わらう', 'laugh'],
      [46, 'でんしゃ', 'train'],
      [47, 'バス', 'bus'],
      [48, 'ひこうき', 'airplane'],
      [49, 'タクシー', 'taxi'],
      [50, 'ホテル', 'hotel'],
      [51, 'きっぷ', 'ticket'],
      [52, 'パスポート', 'passport'],
      [53, 'ちず', 'map'],
      [54, 'くうこう', 'airport'],
      [55, 'えき', 'station'],
      [56, 'スーツケース', 'suitcase'],
      [57, 'かぎ', 'key'],
      [58, 'さいふ', 'wallet'],
      [59, 'カメラ', 'camera'],
      [60, 'レストラン', 'restaurant'],
      [61, 'がっこう', 'school'],
      [62, 'せんせい', 'teacher'],
      [63, 'せいと', 'student'],
      [64, 'きょうしつ', 'classroom'],
      [65, 'こくばん', 'blackboard'],
      [66, 'けしゴム', 'eraser'],
      [67, 'ものさし', 'ruler'],
      [68, 'ペン', 'pen'],
      [69, 'クレヨン', 'crayon'],
      [70, 'きょうかしょ', 'textbook'],
      [71, 'としょかん', 'library'],
      [72, 'じしょ', 'dictionary'],
      [73, 'ロッカー', 'locker'],
      [74, 'コンピューター', 'computer'],
      [75, 'ページ', 'page'],
      [76, 'メニュー', 'menu'],
      [77, 'テーブル', 'table'],
      [78, 'スプーン', 'spoon'],
      [79, 'フォーク', 'fork'],
      [80, 'ナイフ', 'knife'],
      [81, 'おさら', 'plate'],
      [82, 'タオル', 'towel'],
      [83, 'ベッド', 'bed'],
      [84, 'へや', 'room'],
      [85, 'シャワー', 'shower'],
      [86, 'エレベーター', 'elevator'],
      [87, 'まつ', 'wait'],
      [88, 'はこぶ', 'carry'],
      [89, 'あける', 'open'],
      [90, 'しめる', 'close'],
    ]);
  });

  it('ゲームの語は85語で、欠番を詰めていない', () => {
    expect(SAMPLE_PAIRS).toHaveLength(85);
    expect(SAMPLE_PAIRS.map((p) => p.pairId)).toEqual(GAME_PAIR_IDS);
    // 資料確認が終わっていない5語は、まだゲームへ入れない。
    for (const reserved of RESERVED_PAIR_IDS) {
      expect(
        SAMPLE_PAIRS.some((p) => p.pairId === reserved),
        `欠番 ${reserved} がゲームに入っている`,
      ).toBe(false);
      expect(findPair(reserved), `findPair(${reserved})`).toBeUndefined();
    }
  });

  it('pairId・日本語・英語に重複がない', () => {
    expect(new Set(SAMPLE_PAIRS.map((p) => p.pairId)).size).toBe(85);
    expect(new Set(SAMPLE_PAIRS.map((p) => p.ja)).size).toBe(85);
    expect(new Set(SAMPLE_PAIRS.map((p) => p.en)).size).toBe(85);
    for (const pair of SAMPLE_PAIRS) {
      expect(Number.isInteger(pair.pairId) && pair.pairId > 0, `${pair.pairId}`).toBe(true);
    }
  });

  it('あとから足した60語を findPair で引ける', () => {
    for (const [pairId, ja, en] of ADDED_PAIRS) {
      const pair = findPair(pairId as number);
      expect(pair, `findPair(${pairId})`).toBeDefined();
      expect(pair!.ja).toBe(ja);
      expect(pair!.en).toBe(en);
    }
  });

  it('確認テストは、盤面に出た語だけから出題する', () => {
    for (const seed of [1, 2, 3, 100, 20260921]) {
      for (const count of COUNTS) {
        const deck = buildDeck(SAMPLE_PAIRS, count, seed);
        const onBoard = new Set(deck.map((c) => c.pairId));
        const questions = buildWaveQuiz({
          wavePairIds: [...onBoard],
          cardCount: count,
          seed,
          pairs: SAMPLE_PAIRS,
        });
        expect(questions.length).toBeGreaterThan(0);
        for (const q of questions) {
          expect(onBoard.has(q.pairId), `seed=${seed} count=${count} pairId=${q.pairId}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('盤面に出ていない語は、確認テストにも出ない', () => {
    const deck = buildDeck(SAMPLE_PAIRS, 6, 4242);
    const onBoard = new Set(deck.map((c) => c.pairId));
    const offBoard = SAMPLE_PAIRS.filter((p) => !onBoard.has(p.pairId)).map((p) => p.pairId);
    expect(offBoard).toHaveLength(82);
    const questions = buildWaveQuiz({
      wavePairIds: [...onBoard],
      cardCount: 6,
      seed: 4242,
      pairs: SAMPLE_PAIRS,
    });
    for (const q of questions) expect(offBoard).not.toContain(q.pairId);
  });
});

describe('seed付きシャッフル', () => {
  it('同じseedなら必ず同じ並びになる', () => {
    const a = buildDeck(SAMPLE_PAIRS, 20, 12345);
    const b = buildDeck(SAMPLE_PAIRS, 20, 12345);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('seedが違えば並びが変わる', () => {
    const a = buildDeck(SAMPLE_PAIRS, 20, 1).map((c) => c.id);
    const b = buildDeck(SAMPLE_PAIRS, 20, 2).map((c) => c.id);
    expect(a).not.toEqual(b);
  });

  it('同じseedなら、選ばれる語も盤面順もまるごと同じ', () => {
    for (const count of COUNTS) {
      const a = buildDeck(SAMPLE_PAIRS, count, 555);
      const b = buildDeck(SAMPLE_PAIRS, count, 555);
      expect(a.map((c) => `${c.id}:${c.text}`)).toEqual(b.map((c) => `${c.id}:${c.text}`));
    }
  });

  it('シャッフルは元の配列を壊さず、要素を欠落させない', () => {
    const source = [1, 2, 3, 4, 5];
    const result = shuffle(source, 99);
    expect(source).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort((x, y) => x - y)).toEqual(source);
  });

  it('乱数は 0 以上 1 未満に収まる', () => {
    const rng = createRng(2024);
    for (let i = 0; i < 500; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

/**
 * 旅のことば30語のプール。
 *
 * 85語の検査はそのまま残したうえで、狭いプールでも同じ性質が保たれるかを見る。
 * ここで渡すのはセット定義から解決した本番データそのもの。
 */
describe('旅のことば30語のプール', () => {
  const TRAVEL = pairsInSet('travel-practice');
  const TRAVEL_IDS = TRAVEL.map((p) => p.pairId);
  const RESERVED = [12, 20, 22, 25, 27];
  const PAIR_IDS_NOT_IN_THEME_SET = [8, 10];

  it('30語ある', () => {
    expect(TRAVEL).toHaveLength(30);
  });

  it.each(COUNTS)('%i枚で、枚数ぶんの語を選べる', (count) => {
    const ids = new Set(buildDeck(TRAVEL, count, 2024).map((c) => c.pairId));
    expect(ids.size).toBe(pairCountFor(count));
  });

  it('同じseedなら同じ結果になる', () => {
    for (const count of COUNTS) {
      const a = buildDeck(TRAVEL, count, 555).map((c) => `${c.id}:${c.text}`);
      const b = buildDeck(TRAVEL, count, 555).map((c) => `${c.id}:${c.text}`);
      expect(a, `${count}枚`).toEqual(b);
    }
  });

  it('異なるseedでは、異なる組み合わせになり得る', () => {
    // 「必ず違う」ではなく「違う組み合わせが現れる」ことを見る。
    for (const count of COUNTS) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 30; seed += 1) {
        seen.add(
          [...new Set(buildDeck(TRAVEL, count, seed).map((c) => c.pairId))]
            .sort((a, b) => a - b)
            .join(','),
        );
      }
      expect(seen.size, `${count}枚`).toBeGreaterThan(1);
    }
  });

  it('元の旅行語彙配列を並べ替えない', () => {
    const before = TRAVEL.map((p) => p.pairId);
    buildDeck(TRAVEL, 20, 31337);
    selectPairs(TRAVEL, 10, 31337);
    expect(TRAVEL.map((p) => p.pairId)).toEqual(before);
  });

  it('盤面に出るのは旅の30語だけで、欠番と場面別セットに含めていない 8・10 は出ない', () => {
    for (const count of COUNTS) {
      for (let seed = 1; seed <= 200; seed += 1) {
        for (const card of buildDeck(TRAVEL, count, seed)) {
          expect(TRAVEL_IDS, `count=${count} seed=${seed} の ${card.pairId}`)
            .toContain(card.pairId);
          expect(RESERVED, `欠番 ${card.pairId} が出た`).not.toContain(card.pairId);
          expect(PAIR_IDS_NOT_IN_THEME_SET, `${card.pairId} はこの場面別セットに含めていない`).not.toContain(card.pairId);
        }
      }
    }
  });

  it('30語すべてが、seed しだいで選ばれうる', () => {
    // 少数のseedで出ると決め打ちせず、上限を設けて出そろったら打ち切る。
    const TRIALS = 500;
    for (const count of COUNTS) {
      const seen = new Set<number>();
      for (let seed = 1; seed <= TRIALS; seed += 1) {
        for (const card of buildDeck(TRAVEL, count, seed)) seen.add(card.pairId);
        if (seen.size === TRAVEL.length) break;
      }
      expect([...seen].sort((a, b) => a - b), `${count}枚`).toEqual(
        [...TRAVEL_IDS].sort((a, b) => a - b),
      );
    }
  });
});

/**
 * 学校のことば30語のプール。
 *
 * 85語・旅の30語の検査はそのまま残したうえで、学校のプールでも
 * 同じ性質が保たれるかを見る。渡すのはセット定義から解決した本番データ。
 */
describe('学校のことば30語のプール', () => {
  const SCHOOL = pairsInSet('school-practice');
  const SCHOOL_IDS = SCHOOL.map((p) => p.pairId);
  const RESERVED = [12, 20, 22, 25, 27];
  const PAIR_IDS_NOT_IN_THEME_SET = [8, 10];

  it('30語ある', () => {
    expect(SCHOOL).toHaveLength(30);
  });

  it.each(COUNTS)('%i枚で、枚数ぶんの語を選べる', (count) => {
    const ids = new Set(buildDeck(SCHOOL, count, 2024).map((c) => c.pairId));
    expect(ids.size).toBe(pairCountFor(count));
  });

  it('同じseedなら同じ結果になる', () => {
    for (const count of COUNTS) {
      const a = buildDeck(SCHOOL, count, 555).map((c) => `${c.id}:${c.text}`);
      const b = buildDeck(SCHOOL, count, 555).map((c) => `${c.id}:${c.text}`);
      expect(a, `${count}枚`).toEqual(b);
    }
  });

  it('異なるseedでは、異なる組み合わせになり得る', () => {
    for (const count of COUNTS) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 30; seed += 1) {
        seen.add(
          [...new Set(buildDeck(SCHOOL, count, seed).map((c) => c.pairId))]
            .sort((a, b) => a - b)
            .join(','),
        );
      }
      expect(seen.size, `${count}枚`).toBeGreaterThan(1);
    }
  });

  it('元の学校語彙配列を並べ替えない', () => {
    const before = SCHOOL.map((p) => p.pairId);
    buildDeck(SCHOOL, 20, 31337);
    selectPairs(SCHOOL, 10, 31337);
    expect(SCHOOL.map((p) => p.pairId)).toEqual(before);
  });

  it('盤面に出るのは学校の30語だけで、欠番と場面別セットに含めていない 8・10 は出ない', () => {
    for (const count of COUNTS) {
      for (let seed = 1; seed <= 200; seed += 1) {
        for (const card of buildDeck(SCHOOL, count, seed)) {
          expect(SCHOOL_IDS, `count=${count} seed=${seed} の ${card.pairId}`)
            .toContain(card.pairId);
          expect(RESERVED, `欠番 ${card.pairId} が出た`).not.toContain(card.pairId);
          expect(PAIR_IDS_NOT_IN_THEME_SET, `${card.pairId} はこの場面別セットに含めていない`).not.toContain(card.pairId);
        }
      }
    }
  });

  it('30語すべてが、seed しだいで選ばれうる', () => {
    const TRIALS = 500;
    for (const count of COUNTS) {
      const seen = new Set<number>();
      for (let seed = 1; seed <= TRIALS; seed += 1) {
        for (const card of buildDeck(SCHOOL, count, seed)) seen.add(card.pairId);
        if (seen.size === SCHOOL.length) break;
      }
      expect([...seen].sort((a, b) => a - b), `${count}枚`).toEqual(
        [...SCHOOL_IDS].sort((a, b) => a - b),
      );
    }
  });
});

/**
 * 接客・観光のことば30語のプール。
 *
 * 85語・旅の30語・学校の30語の検査はそのまま残したうえで、
 * 接客・観光のプールでも同じ性質が保たれるかを見る。
 */
describe('接客・観光のことば30語のプール', () => {
  const HOSPITALITY = pairsInSet('hospitality-practice');
  const HOSPITALITY_IDS = HOSPITALITY.map((p) => p.pairId);
  const RESERVED = [12, 20, 22, 25, 27];
  const PAIR_IDS_NOT_IN_THEME_SET = [8, 10];

  it('30語ある', () => {
    expect(HOSPITALITY).toHaveLength(30);
  });

  it.each(COUNTS)('%i枚で、枚数ぶんの語を選べる', (count) => {
    const ids = new Set(buildDeck(HOSPITALITY, count, 2024).map((c) => c.pairId));
    expect(ids.size).toBe(pairCountFor(count));
  });

  it('同じseedなら同じ結果になる', () => {
    for (const count of COUNTS) {
      const a = buildDeck(HOSPITALITY, count, 555).map((c) => `${c.id}:${c.text}`);
      const b = buildDeck(HOSPITALITY, count, 555).map((c) => `${c.id}:${c.text}`);
      expect(a, `${count}枚`).toEqual(b);
    }
  });

  it('異なるseedでは、異なる組み合わせになり得る', () => {
    for (const count of COUNTS) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 30; seed += 1) {
        seen.add(
          [...new Set(buildDeck(HOSPITALITY, count, seed).map((c) => c.pairId))]
            .sort((a, b) => a - b)
            .join(','),
        );
      }
      expect(seen.size, `${count}枚`).toBeGreaterThan(1);
    }
  });

  it('元の接客・観光語彙配列を並べ替えない', () => {
    const before = HOSPITALITY.map((p) => p.pairId);
    buildDeck(HOSPITALITY, 20, 31337);
    selectPairs(HOSPITALITY, 10, 31337);
    expect(HOSPITALITY.map((p) => p.pairId)).toEqual(before);
  });

  it('盤面に出るのは接客・観光の30語だけで、欠番と場面別セットに含めていない 8・10 は出ない', () => {
    for (const count of COUNTS) {
      for (let seed = 1; seed <= 200; seed += 1) {
        for (const card of buildDeck(HOSPITALITY, count, seed)) {
          expect(HOSPITALITY_IDS, `count=${count} seed=${seed} の ${card.pairId}`)
            .toContain(card.pairId);
          expect(RESERVED, `欠番 ${card.pairId} が出た`).not.toContain(card.pairId);
          expect(PAIR_IDS_NOT_IN_THEME_SET, `${card.pairId} はこの場面別セットに含めていない`).not.toContain(card.pairId);
        }
      }
    }
  });

  it('30語すべてが、seed しだいで選ばれうる', () => {
    const TRIALS = 500;
    for (const count of COUNTS) {
      const seen = new Set<number>();
      for (let seed = 1; seed <= TRIALS; seed += 1) {
        for (const card of buildDeck(HOSPITALITY, count, seed)) seen.add(card.pairId);
        if (seen.size === HOSPITALITY.length) break;
      }
      expect([...seen].sort((a, b) => a - b), `${count}枚`).toEqual(
        [...HOSPITALITY_IDS].sort((a, b) => a - b),
      );
    }
  });

  it('4つのセットは、固定した検査seedで盤面が分かれる', () => {
    // 偶然そろう seed を避けるため、4つとも食い違う seed を実測して固定してある。
    const POOLS = {
      共通: pairsInSet('common-practice'),
      旅行: pairsInSet('travel-practice'),
      学校: pairsInSet('school-practice'),
      接客: HOSPITALITY,
    };
    for (const count of COUNTS) {
      for (const seed of [1, 2, 3]) {
        const boards = Object.values(POOLS).map((pool) =>
          buildDeck(pool, count, seed).map((c) => c.id).join(','),
        );
        expect(new Set(boards).size, `count=${count} seed=${seed}`).toBe(4);
      }
    }
  });
});
