import type { DialogueScript } from './types';

/** コース入口での挨拶。 */
export const courseScripts: readonly DialogueScript[] = [
  {
    id: 'course-greeting-1',
    trigger: 'course',
    opening: [
      { id: 'o1', role: 'npc', text: 'こんにちは、{me}さん。今日はどのコースにする？' },
      { id: 'o2', role: 'npc', text: 'ぼくは{npc}。いっしょにことばを集めよう。' },
    ],
    choices: [
      {
        id: 'c1',
        label: 'まよっているところ',
        reply: [
          { id: 'r1', role: 'me', text: 'まだまよってるんだ。' },
          { id: 'r2', role: 'npc', text: '気になったところから始めて大丈夫。あとから変えられるよ。' },
        ],
      },
      {
        id: 'c2',
        label: 'もう決めてある',
        reply: [
          { id: 'r1', role: 'me', text: 'もう決めてあるよ。' },
          { id: 'r2', role: 'npc', text: 'いいね。じゃあ出発の準備をしよう。' },
        ],
      },
      {
        id: 'c3',
        label: '英語であいさつしてみる',
        reply: [
          { id: 'r1', role: 'me', text: 'Hello!', english: 'Hello!' },
          { id: 'r2', role: 'npc', text: 'Nice to meet you. またあとでね。', english: 'Nice to meet you.' },
        ],
      },
    ],
  },
  {
    id: 'course-greeting-2',
    trigger: 'course',
    opening: [
      { id: 'o1', role: 'npc', text: '{me}さん、おかえり。今日も少しだけ旅してみる？' },
    ],
    choices: [
      {
        id: 'c1',
        label: 'すこしだけやる',
        reply: [
          { id: 'r1', role: 'me', text: 'すこしだけね。' },
          { id: 'r2', role: 'npc', text: 'それでじゅうぶん。つづけることがいちばん強いよ。' },
        ],
      },
      {
        id: 'c2',
        label: 'たくさんやりたい',
        reply: [
          { id: 'r1', role: 'me', text: 'today たくさんやりたい！', english: 'I want to study a lot today.' },
          { id: 'r2', role: 'npc', text: 'その調子。むりのない範囲でいこう。' },
        ],
      },
    ],
  },
];
