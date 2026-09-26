import type { WordPair } from '../domain/types';

/**
 * いまのカルタが使う語彙（105語）。
 *
 * 語彙セットは、この105語の中から「どの語を使うか」を選ぶ入れ物で、
 * src/data/vocabularySets.ts にある。いまは共通セットが105語ぜんぶを、
 * 旅・学校・接客観光・医療介護のセットがそれぞれ30語を指していて、コースがどれかを参照する。
 * 同じ語が複数のセットへ入ることもある。
 * どのセットに入っているかは、語の確認状態とも学年の難易度とも別の軸。
 *
 * pairId は台帳（docs/reports/VOCABULARY_CHECKLIST.md）と保存データを
 * 結ぶ固定の識別子で、詰め直さない。
 * 台帳で確認済みになった語を、台帳と同じ番号のまま足していく。
 * 工程V-2O-1で 91〜98・100〜106 を足したので、いまは105語。
 * **pairId 99 は欠番**（台帳で見送りにした「あし / foot」の番号）。
 * したがって **語数105と最大 pairId 106 は別の数**で、同一視してはいけない。
 * 空いた番号へ別の語を入れると、その番号で保存された過去の学習記録が
 * 別の語を指してしまうので、欠番は詰め直さない。
 *
 * 配列は pairId の昇順。並びを変えると、同じ seed でも盤面が変わる。
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
  // 12（さかな）は工程V-2I-1で確認し、工程V-2I-2でここへ入れた。
  { pairId: 11, ja: 'うさぎ', en: 'rabbit' },
  { pairId: 12, ja: 'さかな', en: 'fish' },
  { pairId: 13, ja: 'ぞう', en: 'elephant' },
  { pairId: 14, ja: 'うま', en: 'horse' },
  { pairId: 15, ja: 'あか', en: 'red' },
  { pairId: 16, ja: 'きいろ', en: 'yellow' },
  { pairId: 17, ja: 'みどり', en: 'green' },
  { pairId: 18, ja: 'しろ', en: 'white' },
  { pairId: 19, ja: 'くろ', en: 'black' },
  // 20・22・25・27 も、工程V-2I-1で確認して工程V-2I-2でここへ入れた。
  { pairId: 20, ja: 'パン', en: 'bread' },
  { pairId: 21, ja: 'たまご', en: 'egg' },
  { pairId: 22, ja: 'ぎゅうにゅう', en: 'milk' },
  { pairId: 23, ja: 'いちご', en: 'strawberry' },
  { pairId: 24, ja: 'やま', en: 'mountain' },
  { pairId: 25, ja: 'うみ', en: 'sea' },
  { pairId: 26, ja: 'そら', en: 'sky' },
  { pairId: 27, ja: 'いえ', en: 'house' },
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

  // 工程V-2F-1で台帳の確認を終え、工程V-2F-2で足した接客・飲食・宿泊の語。
  // 飲食の物・宿泊や建物の物・接客の場面で見える動作を、台帳と同じ番号のまま入れている。
  { pairId: 76, ja: 'メニュー', en: 'menu' },
  { pairId: 77, ja: 'テーブル', en: 'table' },
  { pairId: 78, ja: 'スプーン', en: 'spoon' },
  { pairId: 79, ja: 'フォーク', en: 'fork' },
  { pairId: 80, ja: 'ナイフ', en: 'knife' },
  { pairId: 81, ja: 'おさら', en: 'plate' },
  { pairId: 82, ja: 'タオル', en: 'towel' },
  { pairId: 83, ja: 'ベッド', en: 'bed' },
  { pairId: 84, ja: 'へや', en: 'room' },
  { pairId: 85, ja: 'シャワー', en: 'shower' },
  { pairId: 86, ja: 'エレベーター', en: 'elevator' },
  { pairId: 87, ja: 'まつ', en: 'wait' },
  { pairId: 88, ja: 'はこぶ', en: 'carry' },
  { pairId: 89, ja: 'あける', en: 'open' },
  { pairId: 90, ja: 'しめる', en: 'close' },

  // 工程V-2N-1・V-2N-2で台帳の確認を終え、工程V-2O-1で足した医療・介護の語。
  // 場所・人・物・体の部分・動作を、台帳と同じ番号のまま入れている。
  //
  // pairId 99 は欠番。台帳で「あし / foot」の候補として使ったが、
  // 日本語の「あし」が足先と脚全体の両方を指し、英語が foot と leg に分かれるため
  // 工程V-2N-1で見送った。番号は見送りの履歴として空けたままにし、
  // 別の語へ割り当て直さない（台帳 第5-1節）。代わりの札は 106「ひざ / knee」。
  { pairId: 91, ja: 'びょういん', en: 'hospital' },
  { pairId: 92, ja: 'いしゃ', en: 'doctor' },
  { pairId: 93, ja: 'かんごし', en: 'nurse' },
  { pairId: 94, ja: 'くすり', en: 'medicine' },
  { pairId: 95, ja: 'くるまいす', en: 'wheelchair' },
  { pairId: 96, ja: 'つえ', en: 'cane' },
  { pairId: 97, ja: 'マスク', en: 'mask' },
  { pairId: 98, ja: 'あたま', en: 'head' },
  { pairId: 100, ja: 'おなか', en: 'stomach' },
  { pairId: 101, ja: 'ゆび', en: 'finger' },
  { pairId: 102, ja: 'たすける', en: 'help' },
  { pairId: 103, ja: 'すわる', en: 'sit' },
  { pairId: 104, ja: 'たつ', en: 'stand' },
  { pairId: 105, ja: 'あらう', en: 'wash' },
  { pairId: 106, ja: 'ひざ', en: 'knee' },
];

export function findPair(pairId: number): WordPair | undefined {
  return SAMPLE_PAIRS.find((pair) => pair.pairId === pairId);
}
