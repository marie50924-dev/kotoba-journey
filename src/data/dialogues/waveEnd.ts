import type { DialogueScript } from './types';

/** ウェーブ（カルタ1盤面）を取り切ったときの称賛。 */
export const waveEndScripts: readonly DialogueScript[] = [
  {
    id: 'wave-end-praise-1',
    trigger: 'wave-end',
    opening: [
      { id: 'o1', role: 'npc', text: 'ぜんぶ取れたね、{me}さん。おつかれさま！' },
    ],
    choices: [
      {
        id: 'c1',
        label: 'ありがとう',
        reply: [
          { id: 'r1', role: 'me', text: 'ありがとう、{npc}。' },
          { id: 'r2', role: 'npc', text: 'この調子でいこう。おぼえたことばは記録に残るよ。' },
        ],
      },
      {
        id: 'c2',
        label: 'むずかしかった',
        reply: [
          { id: 'r1', role: 'me', text: 'ちょっとむずかしかった。' },
          { id: 'r2', role: 'npc', text: 'だいじょうぶ。何回か出会えば、じぶんのことばになるよ。' },
        ],
      },
    ],
  },
  {
    id: 'wave-end-praise-2',
    trigger: 'wave-end',
    opening: [
      { id: 'o1', role: 'npc', text: 'Good job! いまのはよかったよ。', english: 'Good job!' },
    ],
    choices: [
      {
        id: 'c1',
        label: 'もういちどやりたい',
        reply: [
          { id: 'r1', role: 'me', text: 'もういちどやってみたい。' },
          { id: 'r2', role: 'npc', text: 'いいね。同じことばでも、出る場所が変わると新鮮だよ。' },
        ],
      },
      {
        id: 'c2',
        label: 'つぎへ進む',
        reply: [
          { id: 'r1', role: 'me', text: 'つぎへ行こう。' },
          { id: 'r2', role: 'npc', text: 'りょうかい。結果を見にいこう。' },
        ],
      },
    ],
  },
];
