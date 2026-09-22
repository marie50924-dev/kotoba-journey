import type { WordPair } from '../domain/types';

/**
 * いまのカルタが使う語彙（70語）。
 *
 * 語彙セットは、この70語の中から「どの語を使うか」を選ぶ入れ物で、
 * src/data/vocabularySets.ts にある。いまは共通セットが70語ぜんぶを、
 * 旅のセットが30語を指していて、コースがどちらかを参照する。
 * どのセットに入っているかは、語の確認状態とは別の軸。
 *
 * pairId は台帳（docs/reports/VOCABULARY_CHECKLIST.md）と保存データを
 * 結ぶ固定の識別子で、詰め直さない。
 * 台帳で確認済みになった語を、台帳と同じ番号のまま足していく。
 * 12・20・22・25・27 が欠けているのは、その番号の語がまだ資料確認待ちだから。
 * 空いた番号へ別の語を入れると、その番号で保存された過去の学習記録が
 * 別の語を指してしまうので、欠番は欠番のまま残す。
 *
 * 8 つき / moon と 10 くるま / car は、Phase 0 から使い続けている語だが
 * 台帳ではまだ資料確認が終わっていない。確認の結果しだいで表記が変わりうる。
 */
export const SAMPLE_PAIRS: readonly WordPair[] = [
  { pairId: 1, ja: 'りんご', en: 'apple' },
  { pairId: 2, ja: 'ねこ', en: 'cat' },
  { pairId: 3, ja: 'あお', en: 'blue' },
  { pairId: 4, ja: 'いぬ', en: 'dog' },
  { pairId: 5, ja: 'はな', en: 'flower' },
  { pairId: 6, ja: 'ほん', en: 'book' },
  { pairId: 7, ja: 'みず', en: 'water' },
  { pairId: 8, ja: 'つき', en: 'moon' },
  { pairId: 9, ja: 'とり', en: 'bird' },
  { pairId: 10, ja: 'くるま', en: 'car' },

  // ここから下は、台帳で確認済みになってから足した語。
  // 12（さかな）は資料確認待ちのため欠番。
  { pairId: 11, ja: 'うさぎ', en: 'rabbit' },
  { pairId: 13, ja: 'ぞう', en: 'elephant' },
  { pairId: 14, ja: 'うま', en: 'horse' },
  { pairId: 15, ja: 'あか', en: 'red' },
  { pairId: 16, ja: 'きいろ', en: 'yellow' },
  { pairId: 17, ja: 'みどり', en: 'green' },
  { pairId: 18, ja: 'しろ', en: 'white' },
  { pairId: 19, ja: 'くろ', en: 'black' },
  // 20（パン）は資料確認待ちのため欠番。
  { pairId: 21, ja: 'たまご', en: 'egg' },
  // 22（ぎゅうにゅう）は資料確認待ちのため欠番。
  { pairId: 23, ja: 'いちご', en: 'strawberry' },
  { pairId: 24, ja: 'やま', en: 'mountain' },
  // 25（うみ）は資料確認待ちのため欠番。
  { pairId: 26, ja: 'そら', en: 'sky' },
  // 27（いえ）は資料確認待ちのため欠番。
  { pairId: 28, ja: 'たべる', en: 'eat' },
  { pairId: 29, ja: 'のむ', en: 'drink' },
  { pairId: 30, ja: 'ねる', en: 'sleep' },

  // 工程V-2D-2で台帳の確認を終え、工程V-2D-3で足した日常の語。
  // 体の部分・身の回りの物・動きを、台帳と同じ番号のまま入れている。
  { pairId: 31, ja: 'かお', en: 'face' },
  { pairId: 32, ja: 'て', en: 'hand' },
  { pairId: 33, ja: 'め', en: 'eye' },
  { pairId: 34, ja: 'みみ', en: 'ear' },
  { pairId: 35, ja: 'くち', en: 'mouth' },
  { pairId: 36, ja: 'かさ', en: 'umbrella' },
  { pairId: 37, ja: 'つくえ', en: 'desk' },
  { pairId: 38, ja: 'いす', en: 'chair' },
  { pairId: 39, ja: 'まど', en: 'window' },
  { pairId: 40, ja: 'ドア', en: 'door' },
  { pairId: 41, ja: 'えんぴつ', en: 'pencil' },
  { pairId: 42, ja: 'あるく', en: 'walk' },
  { pairId: 43, ja: 'およぐ', en: 'swim' },
  { pairId: 44, ja: 'うたう', en: 'sing' },
  { pairId: 45, ja: 'わらう', en: 'laugh' },

  // 工程V-2D-4で台帳の確認を終え、工程V-2D-5で足した旅行の語。
  // 乗り物・場所・持ち物を、台帳と同じ番号のまま入れている。
  { pairId: 46, ja: 'でんしゃ', en: 'train' },
  { pairId: 47, ja: 'バス', en: 'bus' },
  { pairId: 48, ja: 'ひこうき', en: 'airplane' },
  { pairId: 49, ja: 'タクシー', en: 'taxi' },
  { pairId: 50, ja: 'ホテル', en: 'hotel' },
  { pairId: 51, ja: 'きっぷ', en: 'ticket' },
  { pairId: 52, ja: 'パスポート', en: 'passport' },
  { pairId: 53, ja: 'ちず', en: 'map' },
  { pairId: 54, ja: 'くうこう', en: 'airport' },
  { pairId: 55, ja: 'えき', en: 'station' },
  { pairId: 56, ja: 'スーツケース', en: 'suitcase' },
  { pairId: 57, ja: 'かぎ', en: 'key' },
  { pairId: 58, ja: 'さいふ', en: 'wallet' },
  { pairId: 59, ja: 'カメラ', en: 'camera' },
  { pairId: 60, ja: 'レストラン', en: 'restaurant' },

  // 工程V-2D-6で台帳の確認を終え、工程V-2D-7で足した学校の語。
  // 場所・人・道具・本を、台帳と同じ番号のまま入れている。
  { pairId: 61, ja: 'がっこう', en: 'school' },
  { pairId: 62, ja: 'せんせい', en: 'teacher' },
  { pairId: 63, ja: 'せいと', en: 'student' },
  { pairId: 64, ja: 'きょうしつ', en: 'classroom' },
  { pairId: 65, ja: 'こくばん', en: 'blackboard' },
  { pairId: 66, ja: 'けしゴム', en: 'eraser' },
  { pairId: 67, ja: 'ものさし', en: 'ruler' },
  { pairId: 68, ja: 'ペン', en: 'pen' },
  { pairId: 69, ja: 'クレヨン', en: 'crayon' },
  { pairId: 70, ja: 'きょうかしょ', en: 'textbook' },
  { pairId: 71, ja: 'としょかん', en: 'library' },
  { pairId: 72, ja: 'じしょ', en: 'dictionary' },
  { pairId: 73, ja: 'ロッカー', en: 'locker' },
  { pairId: 74, ja: 'コンピューター', en: 'computer' },
  { pairId: 75, ja: 'ページ', en: 'page' },
];

export function findPair(pairId: number): WordPair | undefined {
  return SAMPLE_PAIRS.find((pair) => pair.pairId === pairId);
}
