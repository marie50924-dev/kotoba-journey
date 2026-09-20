import type { DialogueScript } from './types';

/** 日本への出発・到着。 */
export const arrivalScripts: readonly DialogueScript[] = [
  {
    id: 'arrival-japan-1',
    trigger: 'arrival',
    opening: [
      { id: 'o1', role: 'npc', text: '{me}さん、さいしょの行き先は日本だよ。' },
      { id: 'o2', role: 'npc', text: '身のまわりのことばから集めていこう。' },
    ],
    choices: [
      {
        id: 'c1',
        label: 'どんなことばが出るの？',
        reply: [
          { id: 'r1', role: 'me', text: 'どんなことばが出るの？' },
          { id: 'r2', role: 'npc', text: 'りんご、ねこ、みず。毎日見かけるものからだよ。' },
        ],
      },
      {
        id: 'c2',
        label: '出発しよう',
        reply: [
          { id: 'r1', role: 'me', text: "Let's go!", english: "Let's go!" },
          { id: 'r2', role: 'npc', text: 'いってらっしゃい。{npc}はここで待ってるね。' },
        ],
      },
      {
        id: 'c3',
        label: 'ほかの国にも行ける？',
        reply: [
          { id: 'r1', role: 'me', text: 'ほかの国にも行けるの？' },
          { id: 'r2', role: 'npc', text: 'まだ準備中なんだ。まずは日本をまわってみよう。' },
        ],
      },
    ],
  },
];
