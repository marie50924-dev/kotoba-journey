import type { DialogueScript } from './types';

/** 結果画面での次回案内。 */
export const resultScripts: readonly DialogueScript[] = [
  {
    id: 'result-next-1',
    trigger: 'result',
    opening: [
      { id: 'o1', role: 'npc', text: '{me}さん、きょうの記録はマイパスポートに残ったよ。' },
    ],
    choices: [
      {
        id: 'c1',
        label: '記録を見てみる',
        reply: [
          { id: 'r1', role: 'me', text: '記録を見てみようかな。' },
          { id: 'r2', role: 'npc', text: 'おぼえたことばと、復習したいことばが分かれて出るよ。' },
        ],
      },
      {
        id: 'c2',
        label: 'つぎはいつ来ればいい？',
        reply: [
          { id: 'r1', role: 'me', text: 'つぎはいつ来ればいい？' },
          { id: 'r2', role: 'npc', text: 'すこし間をあけて、また会いにきて。See you!', english: 'See you!' },
        ],
      },
      {
        id: 'c3',
        label: 'また明日',
        reply: [
          { id: 'r1', role: 'me', text: 'また明日ね。', english: 'See you tomorrow.' },
          { id: 'r2', role: 'npc', text: 'うん、待ってるよ。' },
        ],
      },
    ],
  },
];
