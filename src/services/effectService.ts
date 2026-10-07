/**
 * 効果音と振動の境界。
 *
 * 効果音は Web Audio で作る短い合成音だけを使う。
 * 外部の音源ファイル・SDK・CDN・新しい依存は追加していない。
 * 発音（英語の読み上げ）は AudioService の担当で、この設定とは独立している。
 *
 * ゲーム進行はこの結果に依存しない。音が鳴らない端末でも、
 * 自動再生が拒否された場合でも、無音のまま必ず先へ進める。
 */

export type EffectKind = 'correct' | 'incorrect';
export type EffectResult = 'played' | 'muted' | 'unsupported' | 'failed';

export interface EffectService {
  /** この端末で効果音を鳴らせるか。 */
  isSupported(): boolean;
  /**
   * 音声コンテキストを使える状態にする。
   * 自動再生の制限があるので、最初のユーザー操作から呼ぶ。
   * 失敗しても例外は投げない。
   */
  prepare(): Promise<void>;
  /** 短い効果音を鳴らす。失敗しても例外を投げない。 */
  play(kind: EffectKind): EffectResult;
  /**
   * いま鳴っている効果音が、あと何ミリ秒で終わるか。
   * 鳴っていなければ 0。発音をこの後ろへずらして、音を重ねないために使う。
   */
  remainingMs(): number;
  /** 鳴っている音を止める。 */
  stop(): void;
  /** 端末を短く振動させる。非対応・拒否なら false を返すだけで進行は止めない。 */
  vibrate(durationMs: number): boolean;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

/** 効果音を扱わない実装。非対応端末とテストで使う。 */
export class NullEffectService implements EffectService {
  private enabled = true;

  isSupported(): boolean {
    return false;
  }

  async prepare(): Promise<void> {
    /* 何もしない */
  }

  play(_kind: EffectKind): EffectResult {
    return this.enabled ? 'unsupported' : 'muted';
  }

  remainingMs(): number {
    return 0;
  }

  stop(): void {
    /* 何もしない */
  }

  vibrate(_durationMs: number): boolean {
    return false;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

type AudioContextCtor = new () => AudioContext;

/**
 * 1音ぶんの指定。
 * 正解は上がる2音、不正解は下がる1音にして、音だけでなく
 * 画面の光や文字でも正誤が分かるようにしてある（音は補助）。
 */
interface Tone {
  /** 周波数(Hz)。 */
  hz: number;
  /**
   * 立ち上がりの長さ(秒)。省略すると 0.012。
   * チャイムらしく柔らかく始めたい音は、ここを長めにする。
   */
  attackSec?: number;
  /** 鳴り始めるまでの待ち(秒)。 */
  delaySec: number;
  /** 鳴っている長さ(秒)。 */
  durationSec: number;
  /** 音量の頂点。小さめにして耳に刺さらないようにする。 */
  peak: number;
  type: OscillatorType;
}

const TONES: Record<EffectKind, readonly Tone[]> = {
  /*
   * 正解音「ピン・ポーン」。全体で 0.70 秒。
   *
   *   ピン   … 1047Hz(C6)。0.00秒から 0.22秒。
   *   ポーン … 784Hz(G5)。0.24秒から 0.46秒。余韻を長く残す。
   *
   * それぞれの基本音に、弱い倍音（2倍・3倍の高さ）を小さな音量で重ねている。
   * 基本音だけだと短い電子音に聞こえるが、倍音が乗ると鐘やチャイムに近くなる。
   * 倍音は基本音より先に消えるので、残るのは柔らかい基本音の余韻になる。
   *
   * すべて sine（丸い音）。重なった瞬間の音量の合計は 0.16 ほどで、
   * 1.0 までは余裕があるので音割れしない。
   * 立ち上がりは 0.02 秒かけて、ぷつっと始まらないようにしてある。
   */
  correct: [
    // ピン（1音目）
    { hz: 1047, delaySec: 0, durationSec: 0.22, peak: 0.13, type: 'sine', attackSec: 0.02 },
    { hz: 2094, delaySec: 0, durationSec: 0.18, peak: 0.03, type: 'sine', attackSec: 0.02 },
    // ポーン（2音目）
    { hz: 784, delaySec: 0.24, durationSec: 0.46, peak: 0.12, type: 'sine', attackSec: 0.024 },
    { hz: 1568, delaySec: 0.24, durationSec: 0.34, peak: 0.028, type: 'sine', attackSec: 0.024 },
    { hz: 2352, delaySec: 0.24, durationSec: 0.2, peak: 0.012, type: 'sine', attackSec: 0.024 },
  ],
  // 控えめな短い音。1音だけ低く落ちる。強い不快音にしない。
  incorrect: [{ hz: 233, delaySec: 0, durationSec: 0.16, peak: 0.12, type: 'triangle' }],
};

/** その効果音が鳴り終わるまでの長さ(ミリ秒)。TONES から求めるので、音を変えれば自動で追従する。 */
function toneLengthMs(kind: EffectKind): number {
  let end = 0;
  for (const tone of TONES[kind]) end = Math.max(end, tone.delaySec + tone.durationSec);
  return Math.round(end * 1000);
}

/** 正解音が鳴り終わるまでの長さ(ミリ秒)。正解の光の長さと、発音を始める時刻をこれに合わせる。 */
export const CORRECT_EFFECT_MS = toneLengthMs('correct');

/**
 * 止まっていた音声を動かし直してから鳴らすとき、どこまでの遅れを許すか(ミリ秒)。
 *
 * 正解の演出は「光＋効果音」→ 300ms後に「イラスト＋発音」の順。
 * 効果音は長いほうで約225msなので、75msより遅れて鳴らし始めると
 * 発音と重なってしまう。それより遅れたときは、その回は鳴らさずに見送る。
 * 見送っても光とイラストは出るので、進行は止まらない。
 */
const LATE_START_LIMIT_MS = 75;

/** 経過時間の計測。performance が無い環境でも落とさない。 */
function nowMs(): number {
  const perf = globalThis.performance as Performance | undefined;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
}

/** Web Audio による実装。短い合成音だけを鳴らす。 */
export class WebAudioEffectService implements EffectService {
  private enabled = true;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private live: OscillatorNode[] = [];
  private broken = false;
  private unlocked = false;
  /** いま鳴っている音が終わる時刻（performance.now 基準）。 */
  private endsAtMs = 0;
  /** stop() と play() の世代。待っている間に止められた再生を捨てるために使う。 */
  private token = 0;

  constructor(private readonly ctor: AudioContextCtor) {}

  isSupported(): boolean {
    return !this.broken;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  async prepare(): Promise<void> {
    if (this.broken) return;

    if (!this.context) {
      try {
        const context = new this.ctor();
        const master = context.createGain();
        master.gain.value = 1;
        master.connect(context.destination);
        this.context = context;
        this.master = master;
      } catch {
        // 音声そのものを作れない端末。以後ずっと無音で進める。
        this.broken = true;
        this.context = null;
        this.master = null;
        return;
      }
    }

    const context = this.context;

    /*
     * 解除用の無音は、await より前（＝ユーザー操作の最中）に出す。
     * 端末によっては、操作の中で一度でも音を流さないと解除されない。
     * 長さ1サンプルの無音なので、聞こえる音は出さない。
     */
    this.unlock(context);

    if (context.state !== 'running') {
      try {
        await context.resume();
      } catch {
        /*
         * この回の解除に失敗しただけで、端末が非対応とは限らない。
         * ここで broken にすると、以後ずっと無音になってしまう。
         * context は残して、次の操作でまた試せるようにする。
         */
      }
    }
  }

  /**
   * 音声を解除するための、聞こえない1サンプルの再生。
   * 解除は端末ごとに一度でよいので、成功したら繰り返さない。
   */
  private unlock(context: AudioContext): void {
    if (this.unlocked) return;
    try {
      const buffer = context.createBuffer(1, 1, context.sampleRate);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0);
      this.unlocked = true;
    } catch {
      // 解除できなくても進行は止めない。次の操作でまた試す。
    }
  }

  play(kind: EffectKind): EffectResult {
    if (!this.enabled) return 'muted';
    if (this.broken) return 'unsupported';
    const context = this.context;
    const master = this.master;
    if (!context || !master) return 'unsupported';

    // 1音でも前の音が残っていると重なるので、鳴らす前に必ず止める。
    this.stop();
    const my = this.token;

    if (context.state === 'running') return this.schedule(context, master, kind);

    /*
     * 止まっている context に予約を積んではいけない。
     * 止まっている間は currentTime が進まないので、currentTime を基準に
     * 積むと、あとで動き出したときには予約時刻がすべて過ぎていて、
     * 一度も鳴らないまま終わる。先に動かしてから積み直す。
     */
    const startedAt = nowMs();
    context
      .resume()
      .then(() => {
        if (this.token !== my) return; // 待っている間に止められた
        if (!this.enabled || this.broken) return; // 待っている間にOFFになった
        if (this.context !== context || this.master !== master) return; // 作り直された
        if (context.state !== 'running') return;
        /*
         * 遅れて鳴らすのは LATE_START_LIMIT_MS までにする。
         * これより遅れると、正解の光のあとに始まる発音と重なってしまう。
         * 鳴らさずに見送っても、光とイラストは出るので進行は止まらない。
         */
        if (nowMs() - startedAt > LATE_START_LIMIT_MS) return;
        this.schedule(context, master, kind);
      })
      .catch(() => {
        // 鳴らせなくても進行は止めない。
      });
    return 'played';
  }

  remainingMs(): number {
    return Math.max(0, this.endsAtMs - nowMs());
  }

  /** 実際に音を積む。context が動いていることを確かめてから呼ぶ。 */
  private schedule(context: AudioContext, master: GainNode, kind: EffectKind): EffectResult {
    try {
      // 鳴らし始める時点から数えて、いつ鳴り終わるかを覚えておく。
      this.endsAtMs = nowMs() + toneLengthMs(kind);
      const now = context.currentTime;
      for (const tone of TONES[kind]) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = tone.type;
        osc.frequency.value = tone.hz;
        const start = now + tone.delaySec;
        const end = start + tone.durationSec;
        // 立ち上がりと減衰を付けて、プツッという音を出さない。
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(tone.peak, start + (tone.attackSec ?? 0.012));
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(end + 0.02);
        osc.addEventListener('ended', () => {
          this.live = this.live.filter((node) => node !== osc);
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            /* 切断の失敗は無視する */
          }
        });
        this.live.push(osc);
      }
      return 'played';
    } catch {
      return 'failed';
    }
  }

  stop(): void {
    // 待ちに入っている再生を捨てるために世代を進める。
    this.token += 1;
    this.endsAtMs = 0;
    const nodes = this.live;
    this.live = [];
    for (const osc of nodes) {
      try {
        osc.stop();
      } catch {
        /* すでに止まっている場合は無視する */
      }
      try {
        osc.disconnect();
      } catch {
        /* 切断の失敗は無視する */
      }
    }
  }

  vibrate(durationMs: number): boolean {
    return vibrateDevice(durationMs);
  }
}

/**
 * 端末を短く振動させる。
 * 非対応・ユーザーが拒否・権限なしのいずれでも例外を投げず false を返す。
 * 振動は効果音の設定とは独立で、音がOFFでも鳴らす対象ではない。
 */
export function vibrateDevice(durationMs: number): boolean {
  const nav = globalThis.navigator as (Navigator & { vibrate?: (p: number | number[]) => boolean }) | undefined;
  if (!nav || typeof nav.vibrate !== 'function') return false;
  try {
    return nav.vibrate(durationMs) === true;
  } catch {
    return false;
  }
}

/** 端末の対応状況に応じて実装を選ぶ。 */
export function createEffectService(): EffectService {
  const scope = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (typeof ctor === 'function') return new WebAudioEffectService(ctor);
  return new NullEffectService();
}
