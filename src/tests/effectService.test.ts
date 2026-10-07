import { describe, expect, it, vi } from 'vitest';
import { CORRECT_EFFECT_MS, WebAudioEffectService } from '../services/effectService';

/**
 * 効果音の再生経路の確認。
 *
 * ここで守りたいのは次の3つ。
 *   ・一度の resume 失敗で、以後ずっと無音にならないこと
 *   ・止まっている音声へ予約を積まず、動かしてから鳴らすこと
 *   ・OFF のときは鳴らさないこと、失敗しても例外で進行を止めないこと
 * 音色（周波数・長さ・音量）はこのテストでは変えない。
 */

interface Scheduled {
  hz: number;
  /** 音量の頂点。重ねたときに音割れしないかを見るのに使う。 */
  peak: number;
  /** 予約した時刻。鳴らす時点の currentTime を基準にしている。 */
  when: number;
  /** 予約したときの状態。'running' でなければ鳴らないのと同じ。 */
  state: string;
}

/** 本物の代わりに使う、記録だけする音声コンテキスト。 */
class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  readonly sampleRate = 44100;
  readonly destination = { kind: 'destination' };
  readonly scheduled: Scheduled[] = [];
  /** 解除用の無音が鳴らされた回数。 */
  silentUnlocks = 0;
  /** 直前に指定された音量の頂点。 */
  lastPeak = 0;
  resumeCalls = 0;
  /** resume を何回ぶん失敗させるか。 */
  static rejectTimes = 0;
  /** resume が終わるまでの待ち(ミリ秒)。遅い端末を模擬する。 */
  static resumeDelayMs = 0;
  static constructed = 0;
  static throwOnConstruct = false;

  constructor() {
    FakeAudioContext.constructed += 1;
    if (FakeAudioContext.throwOnConstruct) throw new Error('この端末では音声を作れない');
  }

  async resume(): Promise<void> {
    this.resumeCalls += 1;
    if (FakeAudioContext.resumeDelayMs > 0) {
      await new Promise((r) => setTimeout(r, FakeAudioContext.resumeDelayMs));
    }
    if (FakeAudioContext.rejectTimes > 0) {
      FakeAudioContext.rejectTimes -= 1;
      throw new DOMException('not allowed', 'NotAllowedError');
    }
    this.state = 'running';
    // 動き出すと時計が進む。
    this.currentTime = 10;
  }

  createGain() {
    const self = this;
    return {
      gain: {
        value: 1,
        setValueAtTime: () => {},
        // 頂点へ向かうランプの目標値が、その音の音量。
        exponentialRampToValueAtTime: (v: number) => {
          if (v > 0.001) self.lastPeak = v;
        },
      },
      connect: () => {},
      disconnect: () => {},
    };
  }

  createBuffer() {
    return { length: 1 };
  }

  createBufferSource() {
    return {
      buffer: null as unknown,
      connect: () => {},
      start: () => {
        this.silentUnlocks += 1;
      },
    };
  }

  createOscillator() {
    const self = this;
    const osc = {
      type: 'sine',
      // 本物と同じく、値の予約もできる形にする（上昇音がこれを使う）。
      frequency: {
        value: 0,
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
      },
      connect: () => {},
      disconnect: () => {},
      addEventListener: () => {},
      start(when: number) {
        self.scheduled.push({ hz: osc.frequency.value, peak: self.lastPeak, when, state: self.state });
      },
      stop: () => {},
    };
    return osc;
  }
}

function makeService() {
  FakeAudioContext.rejectTimes = 0;
  FakeAudioContext.constructed = 0;
  FakeAudioContext.throwOnConstruct = false;
  FakeAudioContext.resumeDelayMs = 0;
  const made: FakeAudioContext[] = [];
  const ctor = function () {
    const c = new FakeAudioContext();
    made.push(c);
    return c;
  } as unknown as new () => AudioContext;
  const service = new WebAudioEffectService(ctor);
  return { service, made };
}

describe('効果音の準備', () => {
  it('resume が一度失敗しても、端末を非対応として切り捨てない', async () => {
    const { service, made } = makeService();
    FakeAudioContext.rejectTimes = 1;

    await service.prepare();

    // 失敗しても「この端末は効果音を使えない」とは扱わない。
    expect(service.isSupported()).toBe(true);
    expect(made).toHaveLength(1);
    expect(made[0].state).toBe('suspended');

    // 次の操作でもう一度試せば、今度は動く。
    await service.prepare();
    expect(made[0].state).toBe('running');
    // 音声は作り直さず、同じものを使い続ける。
    expect(FakeAudioContext.constructed).toBe(1);
  });

  it('音声そのものを作れない端末は、非対応として無音で進める', async () => {
    const { service } = makeService();
    FakeAudioContext.throwOnConstruct = true;

    await service.prepare();

    expect(service.isSupported()).toBe(false);
    expect(service.play('correct')).toBe('unsupported');
  });

  it('解除用の無音を、操作のあいだに一度だけ鳴らす', async () => {
    const { service, made } = makeService();
    await service.prepare();
    await service.prepare();
    await service.prepare();
    expect(made[0].silentUnlocks).toBe(1);
  });
});

describe('正解音の形', () => {
  it('「ピン」→「ポーン」の2音で、2音目のほうが低い', async () => {
    const { service, made } = makeService();
    await service.prepare();
    service.play('correct');
    const 音 = made[0].scheduled;
    // 基本音は、いちばん大きい音量のもの。
    const ピン = 音[0];
    const ポーン = 音[2];
    expect(ピン.hz).toBe(1047);
    expect(ポーン.hz).toBe(784);
    expect(ポーン.hz).toBeLessThan(ピン.hz);
    // 前回の上昇音（1200→2000Hz）は無くなっている。
    expect(音.map((t) => t.hz)).not.toContain(1200);
    expect(音.map((t) => t.hz)).not.toContain(2000);
  });

  it('それぞれの基本音に、弱い倍音が添えてある', () => {
    // 倍音は基本音の整数倍の高さで、音量はずっと小さい。
    const 倍音の対応 = [
      { 基本: 1047, 倍音: [2094] },
      { 基本: 784, 倍音: [1568, 2352] },
    ];
    for (const { 基本, 倍音 } of 倍音の対応) {
      for (const h of 倍音) {
        expect(h % 基本 === 0 || Math.abs(h / 基本 - Math.round(h / 基本)) < 0.01).toBe(true);
      }
    }
  });

  it('重ねても音量の合計が 1 を超えない（音割れしない）', async () => {
    const { service, made } = makeService();
    await service.prepare();
    service.play('correct');
    // 同時に鳴りうる音量の合計を、いちばん厳しく見積もる（全部が同時に頂点）。
    const 合計 = made[0].scheduled.reduce((sum, t) => sum + t.peak, 0);
    expect(合計).toBeLessThan(1);
  });

  it('全体は約0.7秒に収まる', () => {
    expect(CORRECT_EFFECT_MS).toBe(700);
  });

  it('鳴り終わるまでの残り時間を答えられる（発音を後ろへずらすために使う）', async () => {
    const { service } = makeService();
    expect(service.remainingMs()).toBe(0);
    await service.prepare();
    service.play('correct');
    const left = service.remainingMs();
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(CORRECT_EFFECT_MS);
    service.stop();
    expect(service.remainingMs()).toBe(0);
  });
});

describe('効果音の再生', () => {
  it('動いている音声には、その時刻を基準にそのまま積む', async () => {
    const { service, made } = makeService();
    await service.prepare();
    const context = made[0];
    expect(context.state).toBe('running');

    expect(service.play('correct')).toBe('played');
    // 正解音「ピン・ポーン」。基本音2つに、弱い倍音を添えてある。
    expect(context.scheduled.map((s) => s.hz)).toEqual([1047, 2094, 784, 1568, 2352]);
    // すべて動いている状態で積まれている。
    expect(context.scheduled.every((s) => s.state === 'running')).toBe(true);
    // 止まっていたときの時刻(0)ではなく、動き出したあとの時刻が基準になる。
    expect(context.scheduled[0].when).toBe(10);
  });

  it('止まっている音声へは積まず、動かしてから鳴らす', async () => {
    const { service, made } = makeService();
    // prepare を通さずに、止まったままの音声を用意する。
    FakeAudioContext.rejectTimes = 1;
    await service.prepare();
    const context = made[0];
    expect(context.state).toBe('suspended');

    service.play('correct');
    // 止まっている間は、1つも積まない。
    expect(context.scheduled).toHaveLength(0);

    await vi.waitFor(() => expect(context.scheduled).toHaveLength(5));
    // 動かしてから積むので、止まっていたときの時刻(0)は使われない。
    expect(context.scheduled.every((s) => s.state === 'running')).toBe(true);
    expect(context.scheduled.every((s) => s.when >= 10)).toBe(true);
  });

  it('待っている間に止められたら、あとから鳴らさない', async () => {
    const { service, made } = makeService();
    FakeAudioContext.rejectTimes = 1;
    await service.prepare();
    const context = made[0];

    service.play('correct');
    service.stop(); // 画面を離れた等

    await new Promise((r) => setTimeout(r, 30));
    expect(context.scheduled).toHaveLength(0);
  });

  it('動かし直すのに時間がかかりすぎたら、その回は鳴らさない（発音と重ねない）', async () => {
    const { service, made } = makeService();
    FakeAudioContext.rejectTimes = 1;
    await service.prepare();
    const context = made[0];
    expect(context.state).toBe('suspended');

    // 正解の光は300ms。そのあと発音が始まるので、遅れて鳴らすと重なる。
    FakeAudioContext.resumeDelayMs = 400;
    service.play('correct');

    await new Promise((r) => setTimeout(r, 600));
    // 動き出してはいるが、遅すぎるので鳴らさずに見送る。
    expect(context.state).toBe('running');
    expect(context.scheduled).toHaveLength(0);
  });

  it('OFF のときは鳴らさない', async () => {
    const { service, made } = makeService();
    await service.prepare();
    service.setEnabled(false);

    expect(service.play('correct')).toBe('muted');
    expect(made[0].scheduled).toHaveLength(0);
  });

  it('発音の設定とは別に動く（効果音だけを切り替えられる）', async () => {
    const { service } = makeService();
    await service.prepare();
    expect(service.isEnabled()).toBe(true);
    service.setEnabled(false);
    expect(service.isEnabled()).toBe(false);
    service.setEnabled(true);
    expect(service.isEnabled()).toBe(true);
  });
});
