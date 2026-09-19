import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import type { AudioService, SpeakResult } from '../services/audioService';
import type { WordPair } from '../domain/types';

export interface PronunciationPanelOptions {
  pair: WordPair;
  audio: AudioService;
  onNext: () => void;
}

/**
 * 正解時に中央へ出す発音確認パネル。
 * 音声が非対応でも、失敗しても、「つぎへ」は必ず押せる状態を保つ。
 */
export function pronunciationPanel(options: PronunciationPanelOptions): HTMLElement {
  const { pair, audio, onNext } = options;

  const status = el('p', { class: 'pronounce__status', role: 'status' });
  const supported = audio.isSupported();

  const replayButton = button(UI.actions.listenAgain, () => void play(), {
    class: 'btn btn--ghost btn--audio',
    disabled: !supported,
  });

  const nextButton = button(UI.actions.next, onNext, { class: 'btn btn--primary' });

  function describe(result: SpeakResult): void {
    if (result === 'unsupported') status.textContent = UI.pronunciation.unavailable;
    else if (result === 'muted') status.textContent = UI.pronunciation.muted;
    else if (result === 'failed') status.textContent = UI.pronunciation.failed;
    else status.textContent = '';
  }

  async function play(): Promise<void> {
    try {
      describe(await audio.speakEnglish(pair.en));
    } catch {
      // 音声側の例外でゲームを止めない。
      describe('failed');
    }
  }

  const panel = el('div', { class: 'pronounce', role: 'dialog', 'aria-modal': 'true' }, [
    el('p', { class: 'pronounce__ja', text: pair.ja }),
    el('p', { class: 'pronounce__en', text: pair.en }),
    el('p', { class: 'pronounce__heading', text: UI.pronunciation.heading }),
    status,
    el('div', { class: 'pronounce__actions' }, [replayButton, nextButton]),
  ]);

  // 自動再生はブロックされることがあるので、結果に関わらず再生ボタンを残す。
  void play();
  nextButton.focus();

  return el('div', { class: 'overlay' }, [panel]);
}
