/**
 * メインキャラクター定義。
 *
 * Phase 1 では外見の採用判断を仰ぐための「ラフ」段階であり、
 * 正式なキャラクターイラストはまだ作成していない。
 * 画面に出るのは components/characterSprite.ts が描く CSS/SVG の仮表示で、
 * 承認後に正式素材へ差し替えられるよう、ここでは ID と役割だけを定義する。
 *
 * 設計上の約束:
 * - 実在人物・既存作品・有名キャラクターに似せない
 * - 高校生くらいの健全な表現にとどめる
 * - 性的な強調や恋愛前提の演出を行わない
 * - 国ごとの民族衣装への安易な着せ替えをしない
 */

export type CharacterId = 'girl' | 'boy';

/** アバター選択の保存値。null は「あとで選ぶ（案内役中心）」。 */
export type SelectedCharacterId = CharacterId | null;

export type CharacterPose = 'stand' | 'walk' | 'happy';

/** 仮表示スプライトの配色。正式イラスト導入時にこのファイルごと差し替える。 */
export interface CharacterVisual {
  skin: string;
  hair: string;
  hairStyle: 'long' | 'short';
  top: string;
  bottom: string;
  accent: string;
}

export interface GameCharacter {
  id: CharacterId;
  /** 表示名。正式な人物名は未確定のため、役割を表す呼称を使う。 */
  label: string;
  /** 一言紹介。 */
  tagline: string;
  /** 旅の中での役割。 */
  role: string;
  visual: CharacterVisual;
}

export const CHARACTERS: readonly GameCharacter[] = [
  {
    id: 'girl',
    label: '女の子の主人公',
    tagline: 'ことばと食べものに興味しんしん',
    role: 'あたらしいことばを見つけて、たべものの話をしてくれる',
    visual: {
      skin: '#f4d3b6',
      hair: '#6b4630',
      hairStyle: 'long',
      top: '#e2703a',
      bottom: '#2f6f9e',
      accent: '#f6e2c8',
    },
  },
  {
    id: 'boy',
    label: '男の子の主人公',
    tagline: '地理と歴史の豆知識がとくい',
    role: 'その国の場所や成り立ちを、みじかく教えてくれる',
    visual: {
      skin: '#eccfae',
      hair: '#2f3b45',
      hairStyle: 'short',
      top: '#2f8f6b',
      bottom: '#3c4a57',
      accent: '#d6e8f5',
    },
  },
];

export function findCharacter(id: SelectedCharacterId): GameCharacter | undefined {
  if (!id) return undefined;
  return CHARACTERS.find((c) => c.id === id);
}

export function isCharacterId(value: unknown): value is CharacterId {
  return value === 'girl' || value === 'boy';
}
