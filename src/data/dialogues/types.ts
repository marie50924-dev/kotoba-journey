/**
 * 台本式チャットの型。
 *
 * 見た目はチャットだが、内容はすべてここに書かれた台本から出る。
 * 自由文の AI チャットでも、利用者同士のチャットでもない。
 *
 * NPC の名前はハードコードせず、speakerAvatarId から名簿を引いて解決する。
 * 本文中の {npc} と {me} は表示時に下の名前へ置き換える。
 */

export type DialogueTrigger = 'course' | 'arrival' | 'wave-end' | 'result';

/** 発話者。'npc' は選出された NPC、'me' は自分のキャラクター。 */
export type SpeakerRole = 'npc' | 'me';

export interface DialogueLine {
  id: string;
  role: SpeakerRole;
  /** 日本語の本文。{npc} {me} を名前へ置換する。 */
  text: string;
  /** 読み上げ対象の英語文。AudioService が使えるときだけ再生する。 */
  english?: string;
}

export interface DialogueChoice {
  id: string;
  /** 選択肢のラベル。 */
  label: string;
  /** 選んだあとに続く返事。 */
  reply: DialogueLine[];
}

export interface DialogueScript {
  id: string;
  trigger: DialogueTrigger;
  /** 最初に流れる台詞。 */
  opening: DialogueLine[];
  /** 2〜3個の返答。 */
  choices: DialogueChoice[];
}
