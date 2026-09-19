import { describe, expect, it, vi } from 'vitest';
import { NullAudioService, SpeechSynthesisAudioService } from '../services/audioService';
import type { AudioService } from '../services/audioService';
import { FreeTierEntitlementService } from '../services/entitlementService';
import { PlaySession } from '../domain/matching';
import { buildDeck } from '../domain/deck';
import { SAMPLE_PAIRS } from '../data/wordPairs';

/**
 * 音声非対応でもゲームを進められることを、ブラウザ機能に依存せずに確認する。
 * AudioService はインターフェースなので、テストでは差し替えられる。
 */
describe('音声サービス', () => {
  it('非対応実装は unsupported を返すが例外を投げない', async () => {
    const audio: AudioService = new NullAudioService();
    expect(audio.isSupported()).toBe(false);
    await expect(audio.speakEnglish('apple')).resolves.toBe('unsupported');
    expect(() => audio.stop()).not.toThrow();
  });

  it('音声OFFなら muted を返す', async () => {
    const audio = new NullAudioService();
    audio.setEnabled(false);
    expect(audio.isEnabled()).toBe(false);
    await expect(audio.speakEnglish('apple')).resolves.toBe('muted');
  });

  it('音声が非対応でも全ペアを取得してクリアできる', async () => {
    const audio: AudioService = new NullAudioService();
    const session = new PlaySession(buildDeck(SAMPLE_PAIRS, 6, 11), 0);

    for (const pairId of [1, 2, 3]) {
      const ja = session.cards.find((c) => c.pairId === pairId && c.lang === 'ja')!;
      const en = session.cards.find((c) => c.pairId === pairId && c.lang === 'en')!;
      session.selectCard(ja.id);
      const outcome = session.selectCard(en.id);
      expect(outcome.kind).toBe('correct');
      // 正解時の発音再生が失敗しても、必ず次へ進める。
      await expect(audio.speakEnglish(en.text)).resolves.toBe('unsupported');
      session.resolve();
    }

    expect(session.isCleared).toBe(true);
  });

  it('SpeechSynthesis 実装は speak の例外を failed として扱う', async () => {
    const synth = {
      cancel: vi.fn(),
      speak: () => {
        throw new Error('再生できません');
      },
    } as unknown as SpeechSynthesis;
    const audio = new SpeechSynthesisAudioService(synth);
    await expect(audio.speakEnglish('apple')).resolves.toBe('failed');
  });

  it('SpeechSynthesis 実装は OFF のとき再生しない', async () => {
    const speak = vi.fn();
    const synth = { cancel: vi.fn(), speak } as unknown as SpeechSynthesis;
    const audio = new SpeechSynthesisAudioService(synth);
    audio.setEnabled(false);
    await expect(audio.speakEnglish('apple')).resolves.toBe('muted');
    expect(speak).not.toHaveBeenCalled();
  });
});

describe('課金の境界', () => {
  it('Web試作では常に無料状態を返す', async () => {
    const service = new FreeTierEntitlementService();
    expect(service.isPremium()).toBe(false);
    await expect(service.restorePurchases()).resolves.toBe(false);
  });

  it('購読すると現在の状態が通知され、解除できる', () => {
    const service = new FreeTierEntitlementService();
    const listener = vi.fn();
    const unsubscribe = service.observeEntitlementChanges(listener);
    expect(listener).toHaveBeenCalledWith(false);
    expect(() => unsubscribe()).not.toThrow();
  });
});
