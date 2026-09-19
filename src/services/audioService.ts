/**
 * 音声の境界。
 * いまは Web Speech API の仮実装だけだが、将来は正式な音声ファイルを再生する
 * 実装へ、この AudioService インターフェースごと差し替えられるようにしておく。
 * ゲーム進行はこの結果に依存しない（失敗しても必ず「つぎへ」へ進める）。
 */

export type SpeakResult = 'played' | 'unsupported' | 'muted' | 'failed';

export interface AudioService {
  /** この端末で英語音声を再生できるか。 */
  isSupported(): boolean;
  /** 英単語を英語音声で読み上げる。失敗しても例外を投げない。 */
  speakEnglish(text: string): Promise<SpeakResult>;
  /** 再生中の音声を止める。 */
  stop(): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

/** 音声を一切扱わない実装。非対応端末とテストで使う。 */
export class NullAudioService implements AudioService {
  private enabled = true;

  isSupported(): boolean {
    return false;
  }

  async speakEnglish(_text: string): Promise<SpeakResult> {
    return this.enabled ? 'unsupported' : 'muted';
  }

  stop(): void {
    /* 何もしない */
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

/** Web Speech API による仮実装。音声ファイルは新規生成していない。 */
export class SpeechSynthesisAudioService implements AudioService {
  private enabled = true;

  constructor(private readonly synth: SpeechSynthesis) {}

  isSupported(): boolean {
    return true;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  stop(): void {
    try {
      this.synth.cancel();
    } catch {
      /* 停止に失敗しても無視する */
    }
  }

  speakEnglish(text: string): Promise<SpeakResult> {
    if (!this.enabled) return Promise.resolve<SpeakResult>('muted');

    return new Promise<SpeakResult>((resolve) => {
      let settled = false;
      const finish = (result: SpeakResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      try {
        this.synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.onend = () => finish('played');
        utterance.onerror = () => finish('failed');
        this.synth.speak(utterance);
        // 自動再生がブロックされて onend/onerror が来ない端末に備えた保険。
        globalThis.setTimeout(() => finish('played'), 4000);
      } catch {
        finish('failed');
      }
    });
  }
}

/** 端末の対応状況に応じて実装を選ぶ。 */
export function createAudioService(): AudioService {
  const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  const hasUtterance = typeof (globalThis as { SpeechSynthesisUtterance?: unknown })
    .SpeechSynthesisUtterance === 'function';
  if (synth && hasUtterance) {
    return new SpeechSynthesisAudioService(synth);
  }
  return new NullAudioService();
}
