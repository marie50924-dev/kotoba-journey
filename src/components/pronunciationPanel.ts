import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { preloadedWordIllustration, wordIllustrationUrl } from '../data/wordIllustrations';
import type { AudioService, SpeakResult } from '../services/audioService';
import type { WordPair } from '../domain/types';

export interface PronunciationPanelOptions {
  pair: WordPair;
  audio: AudioService;
  onNext: () => void;
  /**
   * 読み上げを始めるまでの待ち(ミリ秒)。
   * 正解の効果音が鳴り終わってから発音を始め、音を重ねないために使う。
   * イラスト・日本語・英語の表示はこの待ちと無関係で、すぐ出る。
   */
  speakDelayMs?: number;
}

/**
 * 正解時に中央へ出す発音確認パネル。
 *
 * 単語イラスト（紐付けがある語だけ）・日本語・英語をこの順で並べ、
 * 発音がONなら英語を1回読む。
 * 音声が非対応でも、失敗しても、発音がOFFでも、
 * イラスト・日本語・英語は表示し、「つぎへ」は必ず押せる状態を保つ。
 */
export function pronunciationPanel(options: PronunciationPanelOptions): HTMLElement {
  const { pair, audio, onNext, speakDelayMs = 0 } = options;

  const status = el('p', { class: 'pronounce__status', role: 'status' });
  const supported = audio.isSupported();
  // 発音OFFのときは手動再生もできないので、ボタンを押せないままにする。
  // イラスト・単語・正解の光は、この設定とは関係なく表示する。
  const speakable = supported && audio.isEnabled();

  // 効果音が鳴り終わるのを待っている最中の、読み上げの予約。
  let speakTimer: number | undefined;
  function cancelPendingSpeak(): void {
    if (speakTimer === undefined) return;
    window.clearTimeout(speakTimer);
    speakTimer = undefined;
  }

  const replayButton = button(
    UI.actions.listenAgain,
    () => {
      // 手で押したときは、待っている自動再生より手の操作を優先する。
      cancelPendingSpeak();
      void play(true);
    },
    /*
     * 「もういちど聞く」は、先へ進まずに音をもう一度鳴らすだけの補助の操作。
     * 隣の「つぎへ」が進む操作なので、こちらだけ淡い青ガラスにして役割を分ける。
     */
    { class: 'btn btn--ghost btn--audio btn--soft', disabled: !speakable },
  );

  const nextButton = button(
    UI.actions.next,
    () => {
      // パネルを閉じたあとに読み上げが始まらないようにする。
      cancelPendingSpeak();
      onNext();
    },
    { class: 'btn btn--primary' },
  );

  function describe(result: SpeakResult): void {
    if (result === 'unsupported') status.textContent = UI.pronunciation.unavailable;
    else if (result === 'muted') status.textContent = UI.pronunciation.muted;
    else if (result === 'failed') status.textContent = UI.pronunciation.failed;
    else status.textContent = '';
  }

  /**
   * @param manual 手で「もういちど聞く」を押したか。
   *
   * 自動再生は端末の方針でことわられることがある。それは利用者の操作の失敗ではないので、
   * パネルを開いた直後に赤い失敗文言を出さず、手で聞ける場所を案内する。
   * 手で押したときは、実際に起きたことをそのまま出す。
   * どちらの場合も、鳴らなかったことを鳴ったことには**しない**。
   */
  async function play(manual: boolean): Promise<void> {
    let result: SpeakResult;
    try {
      result = await audio.speakEnglish(pair.en);
    } catch {
      // 音声側の例外でゲームを止めない。
      result = 'failed';
    }
    if (!manual && result === 'failed') {
      status.textContent = UI.pronunciation.tapToPlay;
      return;
    }
    describe(result);
  }

  /*
   * イラストは紐付けがある語だけ。無い語は単語と発音だけで進める。
   *
   * 先読みできていれば、その画像をそのまま使う。
   * ここで初めて取りに行くと、通信と展開のぶんだけ絵が出るのが遅れる。
   * 先読みが間に合っていなければ、これまでどおり src を指定して出す。
   * そのときも日本語・英語・「つぎへ」は先に出ているので、進行は止まらない。
   */
  const illustrationUrl = wordIllustrationUrl(pair.pairId);
  let illustration: HTMLElement | null = null;
  if (illustrationUrl !== null) {
    const ready = preloadedWordIllustration(pair.pairId);
    // 先読みした要素があれば、複製せずそのまま置く。
    // 複製すると取得がやり直しになり、先に始めた意味が消える。
    const img =
      ready ?? (el('img', { src: illustrationUrl, decoding: 'async' }) as HTMLImageElement);
    img.className = 'pronounce__art-img';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    const box = el('div', { class: 'pronounce__art' }, [img]);
    // 取得に失敗したときは、壊れた画像の枠を残さず単語だけで見せる。
    img.addEventListener('error', () => box.remove(), { once: true });
    illustration = box;
  }

  const panel = el('div', { class: 'pronounce', role: 'dialog', 'aria-modal': 'true' }, [
    illustration,
    el('p', { class: 'pronounce__ja', text: pair.ja }),
    el('p', { class: 'pronounce__en', text: pair.en }),
    el('p', { class: 'pronounce__heading', text: UI.pronunciation.heading }),
    status,
    el('div', { class: 'pronounce__actions' }, [replayButton, nextButton]),
  ]);

  /*
   * 自動再生はブロックされることがあるので、結果に関わらず再生ボタンを残す。
   * 発音OFFのときは読み上げを始めない（OFFの表示だけ出す）。
   *
   * 効果音がまだ鳴っているなら、その残りだけ待ってから読み上げる。
   * 待つのは音だけで、イラスト・日本語・英語はもう出ている。
   */
  if (speakable) {
    if (speakDelayMs > 0) {
      speakTimer = window.setTimeout(() => {
        speakTimer = undefined;
        void play(false);
      }, speakDelayMs);
    } else {
      void play(false);
    }
  } else if (!supported) describe('unsupported');
  else describe('muted');
  nextButton.focus();

  return el('div', { class: 'overlay' }, [panel]);
}
