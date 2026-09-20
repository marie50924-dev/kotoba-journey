import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { avatarThumb } from './avatarThumb';
import { displayName, type AvatarDefinition } from '../data/avatars';
import type { DialogueChoice, DialogueLine, DialogueScript } from '../data/dialogues';
import type { AudioService } from '../services/audioService';

/**
 * 台本式チャットのパネル。
 *
 * 見た目はチャットだが、本文はすべて data/dialogues/ の台本から出る。
 * 自由入力欄は設けない（次工程の文字入力テストを先行実装しない）。
 *
 * - 左が NPC、右が自分のキャラクター
 * - 返答は2〜3個の選択肢
 * - 「あとで」「閉じる」でいつでも抜けられ、進行や記録は失われない
 * - 英語文は AudioService があるときだけ読み上げる。失敗しても進行する
 * - prefers-reduced-motion ではタイピング演出を出さない
 */

export interface ChatPanelOptions {
  script: DialogueScript;
  npc: AvatarDefinition;
  me: AvatarDefinition;
  audio: AudioService;
  /** 閉じたとき（「あとで」「閉じる」どちらも）に呼ばれる。 */
  onClose: () => void;
}

export function chatPanel(options: ChatPanelOptions): HTMLElement {
  const { script, npc, me, audio, onClose } = options;

  const log = el('div', { class: 'chat__log', role: 'log', 'aria-live': 'polite' });
  const choiceArea = el('div', { class: 'chat__choices' });
  let closed = false;

  function resolveText(text: string): string {
    // 名前はハードコードせず、名簿から引いた下の名前で置き換える。
    return text.replace(/\{npc\}/g, displayName(npc)).replace(/\{me\}/g, displayName(me));
  }

  function appendLine(line: DialogueLine): void {
    const speaker = line.role === 'npc' ? npc : me;
    const row = el('div', { class: `chat__row chat__row--${line.role}` }, [
      avatarThumb(speaker, { size: 'sm', label: displayName(speaker) }),
      el('div', { class: 'chat__bubble' }, [
        el('span', { class: 'chat__speaker', text: displayName(speaker) }),
        el('p', { class: 'chat__text', text: resolveText(line.text) }),
        line.english ? englishRow(line.english) : null,
      ]),
    ]);
    log.append(row);
    log.scrollTop = log.scrollHeight;
  }

  function englishRow(english: string): HTMLElement {
    const speak = button(
      UI.chat.listen,
      () => {
        // 音声が使えなくても会話は止めない。失敗は表示で知らせるだけ。
        void audio
          .speakEnglish(english)
          .then((result) => {
            speak.dataset.result = result;
          })
          .catch(() => {
            speak.dataset.result = 'failed';
          });
      },
      { class: 'btn btn--ghost chat__speak', disabled: !audio.isSupported() },
    );
    return el('div', { class: 'chat__english' }, [
      el('span', { class: 'chat__english-text', text: english }),
      speak,
    ]);
  }

  function renderChoices(choices: readonly DialogueChoice[]): void {
    choiceArea.replaceChildren(
      ...choices.map((choice) =>
        button(choice.label, () => pick(choice), { class: 'btn chat__choice' }),
      ),
      button(UI.chat.later, close, { class: 'btn btn--ghost chat__later' }),
    );
    const first = choiceArea.querySelector('button');
    if (first instanceof HTMLElement) first.focus();
  }

  function pick(choice: DialogueChoice): void {
    for (const line of choice.reply) appendLine(line);
    // 台本は1往復で終わる。以降は閉じるだけ。
    choiceArea.replaceChildren(
      button(UI.chat.close, close, { class: 'btn btn--primary chat__close' }),
    );
    const only = choiceArea.querySelector('button');
    if (only instanceof HTMLElement) only.focus();
  }

  function close(): void {
    if (closed) return;
    closed = true;
    audio.stop();
    onClose();
  }

  const root = el(
    'div',
    {
      // karta.css の .overlay とは別物にする（あちらは盤面内の絶対配置）。
      class: 'chat-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': UI.chat.heading,
    },
    [
      el('div', { class: 'chat' }, [
        el('header', { class: 'chat__bar' }, [
          el('span', { class: 'chat__title', text: UI.chat.heading }),
          button(UI.chat.close, close, { class: 'btn btn--ghost chat__x', ariaLabel: UI.chat.close }),
        ]),
        log,
        choiceArea,
        el('p', { class: 'chat__note note', text: UI.chat.scriptedNote }),
      ]),
    ],
  );

  // Esc でも閉じられるようにする。
  root.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape') {
      event.stopPropagation();
      close();
    }
  });

  for (const line of script.opening) appendLine(line);
  renderChoices(script.choices);

  return root;
}
