/**
 * 国紹介カードのデータ。
 *
 * UI から完全に分離してあるので、国を追加しても画面コードを書き換えずに済む。
 * 文章は公的機関で確認できる範囲にとどめ、出典を source に残す。
 * ステレオタイプ、国民性の断定、政治的主張は書かない。
 *
 * Phase 1 では日本のみを本文付きで用意する。
 * ロンドン・パリは構造とロック表示だけを維持し、本番紹介文は追加しない。
 */

export interface IntroCard {
  id: string;
  heading: string;
  body: string;
  /** 出典。画面には小さく添えるか、詳細表示でのみ見せる。 */
  source?: string;
}

export interface CountryIntro {
  destinationId: string;
  nameJa: string;
  nameEn: string;
  /** 国旗の簡易表現。正式な旗画像を入れるまでは CSS で描く。 */
  flag: { kind: 'japan' } | { kind: 'placeholder' };
  /** 世界マップ上のおおよその位置 0〜1。 */
  position: { x: number; y: number };
  /** あいさつ。 */
  greeting: { ja: string; en: string };
  /** 2〜3枚の短いカード。1画面に詰め込みすぎない。 */
  cards: IntroCard[];
  /** 「この国で学ぶこと」の案内。 */
  learning: string;
}

export const COUNTRY_INTROS: readonly CountryIntro[] = [
  {
    destinationId: 'japan',
    nameJa: '日本',
    nameEn: 'Japan',
    flag: { kind: 'japan' },
    position: { x: 0.78, y: 0.44 },
    greeting: { ja: 'こんにちは', en: 'Hello' },
    cards: [
      {
        id: 'japan-where',
        heading: 'どこにあるの？',
        body: 'ユーラシア大陸の東、太平洋にうかぶ島の国です。北から南まで細長くつづいています。',
        source: '外務省「日本の紹介」',
      },
      {
        id: 'japan-shape',
        heading: 'たくさんの島',
        body: '国土地理院が2023年に公表した数えかたでは、日本の島の数は14,125です。数えかたの決まりによって数は変わります。',
        source: '国土地理院（2023年2月公表）',
      },
      {
        id: 'japan-area',
        heading: '47の都道府県',
        body: '日本は47の都道府県に分かれています。地域ごとに気候や食べものにちがいがあります。',
        source: '総務省',
      },
    ],
    learning: '身のまわりのことばを、日本語と英語のカルタで集めます。',
  },
];

export function findCountryIntro(destinationId: string): CountryIntro | undefined {
  return COUNTRY_INTROS.find((c) => c.destinationId === destinationId);
}

export function hasCountryIntro(destinationId: string): boolean {
  return COUNTRY_INTROS.some((c) => c.destinationId === destinationId);
}
