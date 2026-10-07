import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { findPair } from '../data/wordPairs';
import { preloadWordIllustrations, trialPairs } from '../data/wordIllustrations';
import { findCourse, pairsForCourse } from '../data/courses';
import { buildDeck } from '../domain/deck';
import { computeBoardLayout } from '../domain/layout';
import { createSeed } from '../domain/random';
import { PlaySession } from '../domain/matching';
import { calculateAccuracy, formatDuration } from '../domain/scoring';
import { applyPlayResult, isNewBestTime } from '../storage/learningRecord';
import { pronunciationPanel } from '../components/pronunciationPanel';
import { chatPanel } from '../components/chatPanel';
import { AVATARS, findAvatar } from '../data/avatars';
import { castNpcs, rememberCast } from '../domain/npcCasting';
import { pickScript } from '../data/dialogues';
import { rememberMetAvatar } from '../storage/learningRecord';
import { FEATURES } from '../app/features';
import type { AppContext } from '../app/state';
import type { Card, CardCount, PlayResult } from '../domain/types';

/** 誤答の赤い縁を戻すまで。 */
const INCORRECT_DISPLAY_MS = 400;
/** 同じ言語同士を重ねたときの短い知らせ。採点はしない。 */
const SAME_LANGUAGE_DISPLAY_MS = 450;
/** 正解の光を見せてから、単語パネルを出すまで。光とパネルを重ねない。 */
/*
 * 正解の光を出しておく長さ(ミリ秒)。
 *
 * 中心から外へ広がって消えるまでが 650ms。光と効果音は同時に始める。
 * 単語パネル（イラスト・日本語・英語）は、光が消えるこの時刻に出す。
 *
 * 効果音は 700ms とわずかに長いので、読み上げだけは
 * 「あと何ミリ秒鳴るか」を見て後ろへずらす（ctx.effects.remainingMs）。
 * 絵と単語の表示は待たせない。
 */
const CORRECT_GLOW_MS = 650;
/** 不正解のときの振動の長さ。非対応・拒否でも進行は止めない。 */
const VIBRATE_MS = 60;
/** これ以上指が動いたら、タップではなくスライドとして扱う。 */
const DRAG_THRESHOLD_PX = 6;

/**
 * 札の文字をこれより小さくはしない下限。
 * ここまで縮めても収まらない語が出たら、文字を隠すのではなく
 * このサイズのまま置く。読めない大きさにしない方を優先する。
 */
const MIN_CARD_FONT_PX = 11;

/**
 * 1枚の札の文字が、札の内側に収まっているか。
 *
 * 札は `overflow: hidden` なので、はみ出した分は切れて見えなくなる。
 * 切れていないことを、次の2つで見る。
 * - 横: 文字の外接幅が、折り返し幅を超えていない
 * - 縦: 文字の外接高さが、札の内側の高さ（枠と余白を除いた高さ）に収まっている
 *
 * 札は傾けてあるので getBoundingClientRect は使わない。
 * 回転前のレイアウト上の大きさで見る。
 */
function cardTextFits(text: HTMLElement, innerHeight: number): boolean {
  return text.scrollWidth <= text.clientWidth && text.offsetHeight <= innerHeight + 0.5;
}

/**
 * 収まらない札だけ、文字を1pxずつ小さくする。
 *
 * まず基準の大きさで置き、収まっていればそのまま返す。
 * 収まる短い札は縮まないので、盤面全体が一律に小さくなることはない。
 * 横と縦の両方が収まった時点で止める。下限は `MIN_CARD_FONT_PX`。
 *
 * 特定の語や pairId を名指しで扱わない。長さと枠の関係だけで決めるので、
 * 日本語の札にも英語の札にも、これから語を足したときにも同じように効く。
 */
function fitCardFontSize(node: HTMLElement, baseFontSize: number, innerHeight: number): number {
  const text = node.querySelector<HTMLElement>('.card__text');
  if (!text) return baseFontSize;
  let size = baseFontSize;
  while (!cardTextFits(text, innerHeight) && size > MIN_CARD_FONT_PX) {
    size = Math.max(MIN_CARD_FONT_PX, size - 1);
    node.style.fontSize = `${size}px`;
  }
  return size;
}

/** 札の枠と余白のぶん、内側で使える高さがどれだけ減るか。 */
function verticalInset(node: HTMLElement): number {
  const style = getComputedStyle(node);
  return (
    (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
  );
}

/**
 * カルタ画面。
 * 盤面は縦スクロールさせず、20枚でも必ず一画面へ収める。
 * カードの配置は衝突しないスロット方式で計算し、傾きだけを小さく変化させる。
 *
 * 回答は3通り。どれでも同じ判定を通る。
 * - スライド：札を対応する札に重ねて指を離す
 * - タップ：1枚えらんで、対応する札をタップ
 * - キーボード：Tab で札へ移動して Enter / Space
 */
export interface KartaScreenOptions {
  /**
   * イラスト付きの体験（ローカル確認版だけの独立した入口）。
   * 固定の3ペア6枚で、学習記録・訪問国・会話の記録を一切書き込まない。
   * 通常のコース・語彙・出題範囲は変えない。
   */
  trial?: boolean;
}

export function kartaScreen(ctx: AppContext, options: KartaScreenOptions = {}): HTMLElement {
  const trial = options.trial === true;
  const cardCount: CardCount = trial ? 6 : (ctx.selection.cardCount ?? 6);
  const seed = createSeed();
  // 出題する語は、選んだコースの語彙セットから決める。
  // 小学生・中学生は学校のことば30語、海外旅行は旅のことば30語、
  // 接客・観光は接客・観光のことば30語、残り20コースは共通の90語。
  // どのセットを使うかはコース定義が持つので、この画面は語の中身を知らない。
  // 体験は固定の3ペア。通常プレイはコースの語彙セットから決める。
  const deckPairs = trial ? trialPairs() : pairsForCourse(ctx.selection.courseId);
  const deck = buildDeck(deckPairs, cardCount, seed);

  /*
   * 出題する語の単語イラストを、ここで先に読み込んでおく。
   *
   * 正解パネルを出してから取りに行くと、通信と展開のぶんだけ絵が出るのが遅れる
   * （実機で数秒の空白になっていた）。盤面を出す時点で取り始めれば、
   * 札を読んでいる間に取り終えられる。待たないので、盤面の表示は遅くならない。
   *
   * これより前（表紙・人物選び）では始めない。
   * そこはまだ人物画像を取っている最中で、先読みが帯域を奪うと
   * 人物の表示が遅くなり、結局イラストも速くならなかった（実測）。
   */
  preloadWordIllustrations(deckPairs.map((pair) => pair.pairId));
  const session = new PlaySession(deck, performance.now());

  // 1つのカルタ盤面を1ウェーブとして扱う。確認テストはこの pairIds からだけ作る。
  ctx.wave = {
    waveId: `${ctx.selection.destinationId ?? 'japan'}-${cardCount}-${seed}`,
    pairIds: Array.from(new Set(deck.map((card) => card.pairId))),
    seed,
  };
  ctx.quiz = null;

  const pairsValue = el('strong', { text: `0 / ${session.totalPairCount}` });
  const mistakesValue = el('strong', { text: '0' });
  const timeValue = el('strong', { text: '0:00' });

  const board = el('div', { class: 'board', role: 'group', 'aria-label': UI.karta.heading });
  const overlayHost = el('div', { class: 'overlay-host' });
  // 正誤を音だけで伝えないための文字の知らせ。読み上げにも届くよう role=status。
  const notice = el('p', { class: 'karta__notice', role: 'status', 'aria-live': 'polite' });

  const cardNodes = new Map<string, HTMLButtonElement>();
  const cardById = new Map(deck.map((card) => [card.id, card]));

  // ---- 音の設定（発音と効果音は別のスイッチ） -----------------------------

  const speechSupported = ctx.audio.isSupported();
  const sfxSupported = ctx.effects.isSupported();

  const speechToggle = el('button', {
    type: 'button',
    class: 'karta__toggle',
    'aria-pressed': String(ctx.records.get().audioEnabled),
    disabled: !speechSupported,
  });
  const sfxToggle = el('button', {
    type: 'button',
    class: 'karta__toggle',
    'aria-pressed': String(ctx.records.get().sfxEnabled),
    disabled: !sfxSupported,
  });

  /*
   * 音の設定は開閉式にする。
   * 帯へ並べたままだと、狭い画面で誤答数と経過時間を押しのけてしまう。
   * 開いている間は盤面の入力を止め、閉じたら元のボタンへ焦点を戻す。
   */
  const soundButton = el('button', {
    type: 'button',
    class: 'karta__sound-btn',
    'aria-expanded': 'false',
    'aria-haspopup': 'dialog',
    text: UI.karta.soundSettingsOpen,
  });
  const soundCloseButton = button(UI.karta.soundSettingsClose, () => closeSound(), {
    class: 'btn btn--primary karta__sound-close btn--soft',
  });
  const soundPanel = el(
    'div',
    {
      class: 'karta__sound-panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': UI.karta.soundSettings,
      hidden: true,
    },
    [
      el('p', { class: 'karta__sound-title', text: UI.karta.soundSettings }),
      el('div', { class: 'karta__sound-row' }, [
        el('span', { class: 'karta__sound-label', text: UI.karta.pronounceLabel }),
        speechToggle,
      ]),
      !speechSupported
        ? el('p', { class: 'karta__sound-note', text: UI.settings.unsupportedAudio })
        : null,
      el('div', { class: 'karta__sound-row' }, [
        el('span', { class: 'karta__sound-label', text: UI.karta.sfxLabel }),
        sfxToggle,
      ]),
      !sfxSupported
        ? el('p', { class: 'karta__sound-note', text: UI.settings.unsupportedSfx })
        : null,
      soundCloseButton,
    ],
  );

  /** 設定を開いている間は盤面を触らせない。 */
  let soundOpen = false;

  function openSound(): void {
    if (soundOpen) return;
    soundOpen = true;
    soundPanel.hidden = false;
    soundButton.setAttribute('aria-expanded', 'true');
    root.classList.add('is-sound-open');
    // 開いたらパネルの中へ焦点を移す。
    const first = speechToggle.disabled ? (sfxToggle.disabled ? soundCloseButton : sfxToggle) : speechToggle;
    first.focus();
  }

  function closeSound(): void {
    if (!soundOpen) return;
    soundOpen = false;
    soundPanel.hidden = true;
    soundButton.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-sound-open');
    // 閉じたら開いたボタンへ焦点を戻す。
    soundButton.focus();
  }

  soundButton.addEventListener('click', () => {
    if (soundOpen) closeSound();
    else openSound();
  });

  /** Esc で閉じる。閉じる・戻るのどちらでも同じ後始末を通す。 */
  function onSoundKeydown(event: KeyboardEvent): void {
    if (!soundOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSound();
    }
  }

  function renderToggles(): void {
    const record = ctx.records.get();
    const speech = speechSupported && record.audioEnabled;
    const sfx = sfxSupported && record.sfxEnabled;
    // ボタンの文字は ON / OFF だけにする。
    // 何のスイッチかは左の見出し（.karta__sound-label）が持っていて、
    // 読み上げには aria-label で「発音 ON」のように渡す。
    const onText = UI.settings.audioOn;
    const offText = UI.settings.audioOff;
    speechToggle.textContent = speech ? onText : offText;
    speechToggle.setAttribute(
      'aria-label',
      `${UI.karta.pronounceLabel} ${speech ? onText : offText}`,
    );
    speechToggle.classList.toggle('is-on', speech);
    speechToggle.setAttribute('aria-pressed', String(record.audioEnabled));
    sfxToggle.textContent = sfx ? onText : offText;
    sfxToggle.setAttribute('aria-label', `${UI.karta.sfxLabel} ${sfx ? onText : offText}`);
    sfxToggle.classList.toggle('is-on', sfx);
    sfxToggle.setAttribute('aria-pressed', String(record.sfxEnabled));
  }

  speechToggle.addEventListener('click', () => {
    const next = !ctx.records.get().audioEnabled;
    ctx.records.update((record) => ({ ...record, audioEnabled: next }));
    ctx.audio.setEnabled(next);
    // OFF へ切り替えたら、読み上げ中の音声はその場で止める。
    if (!next) ctx.audio.stop();
    renderToggles();
  });

  sfxToggle.addEventListener('click', () => {
    const next = !ctx.records.get().sfxEnabled;
    ctx.records.update((record) => ({ ...record, sfxEnabled: next }));
    ctx.effects.setEnabled(next);
    if (!next) ctx.effects.stop();
    else void ctx.effects.prepare();
    renderToggles();
  });
  renderToggles();

  for (const card of deck) {
    const node = createCardNode(card);
    node.addEventListener('click', () => {
      // スライドで動かしたときの click は回答にしない（二重判定を防ぐ）。
      if (swallowNextClick) {
        swallowNextClick = false;
        return;
      }
      onCardTap(card.id);
    });
    node.addEventListener('pointerdown', (event) => onPointerDown(event, card.id));
    cardNodes.set(card.id, node);
    board.append(node);
  }

  /*
   * 帯は2行。
   * 1行目に「やめる」「とったペア」「音設定」、2行目に「まちがい」と「じかん」を置く。
   * 1行へ押し込むと、狭い画面で誤答数と経過時間が音の設定に隠れてしまう。
   * 2行ぶんの高さは CSS で先に確保し、盤面はその残りで計算する。
   */
  /*
   * `karta__stats` は、プレイ中の数字（ペア・まちがい・じかん）が出ている場所を指す印。
   * v1 までは1行の中の入れ物だったが、v2 で帯を2行に分けたので、
   * 2行をまとめているこの要素へ移した。
   * 既存の検査がこの印から「まちがい N」を読み取っているので、名前は変えない。
   */
  const header = el('div', { class: 'karta__head karta__stats' }, [
    el('div', { class: 'karta__bar karta__bar--main' }, [
      button(UI.karta.quit, () => ctx.navigate({ name: trial ? 'courseEntry' : 'worldMap' }), {
        class: 'btn btn--ghost btn--back btn--soft',
      }),
      el('span', { class: 'karta__stat karta__stat--pairs' }, [
        el('span', { class: 'karta__stat-label', text: UI.karta.pairsLabel }),
        pairsValue,
      ]),
      soundButton,
    ]),
    el('div', { class: 'karta__bar karta__bar--sub' }, [
      trial
        ? el('span', { class: 'karta__trial-badge', text: UI.karta.trialBadge })
        : null,
      el('span', { class: 'karta__stat karta__stat--mistakes' }, [
        el('span', { class: 'karta__stat-label', text: UI.karta.mistakesLabel }),
        mistakesValue,
      ]),
      el('span', { class: 'karta__stat karta__stat--time' }, [
        el('span', { class: 'karta__stat-label', text: UI.karta.timeLabel }),
        timeValue,
      ]),
    ]),
  ]);

  const root = el('section', {
    class: `screen screen--fixed screen--karta${trial ? ' screen--karta-trial' : ''}`,
  }, [
    header,
    el('div', { class: 'karta__board-wrap' }, [board, overlayHost, notice, soundPanel]),
    el('p', {
      class: 'karta__hint note',
      text: trial ? UI.karta.trialLead : UI.karta.hint,
    }),
  ]);

  // ---- レイアウト ---------------------------------------------------------

  const layoutSeed = seed ^ 0x9e3779b9;

  function applyLayout(): void {
    const width = board.clientWidth;
    const height = board.clientHeight;
    if (width <= 0 || height <= 0) return;

    // 320x568 のような狭い画面では傾きを抑え、文字とタップ領域を優先する。
    const compact = width < 340 || height < 420;
    const layout = computeBoardLayout(cardCount, width, height, {
      maxTiltDeg: compact ? 4 : cardCount === 20 ? 6 : 8,
      gapPx: compact ? 4 : 8,
      seed: layoutSeed,
    });

    const fontSize = Math.max(MIN_CARD_FONT_PX, Math.min(20, layout.cardHeight * 0.3));
    // まず全部の札を基準の大きさで置く。
    // 置き終える前に測ると、直前の札の大きさで測ってしまう。
    const placed: HTMLButtonElement[] = [];
    deck.forEach((card, index) => {
      const slot = layout.slots[index];
      const node = cardNodes.get(card.id);
      if (!node || !slot) return;
      node.style.left = `${slot.x}px`;
      node.style.top = `${slot.y}px`;
      node.style.width = `${slot.width}px`;
      node.style.height = `${slot.height}px`;
      node.style.setProperty('--tilt', `${slot.rotation.toFixed(2)}deg`);
      node.style.fontSize = `${fontSize}px`;
      placed.push(node);
    });

    // そのうえで、収まらない札だけ小さくする。
    // 「コンピューター」のような長い語が3行になって下が切れるのを防ぐ。
    const first = placed[0];
    if (!first) return;
    const innerHeight = first.clientHeight - verticalInset(first);
    for (const node of placed) {
      fitCardFontSize(node, fontSize, innerHeight);
    }
  }

  const resizeObserver = new ResizeObserver(() => applyLayout());
  resizeObserver.observe(board);
  requestAnimationFrame(applyLayout);

  // ---- 経過時間 -----------------------------------------------------------

  const timer = window.setInterval(() => {
    if (!session.isCleared) timeValue.textContent = formatDuration(session.elapsedMs(performance.now()));
  }, 250);

  /** 画面を離れるときに必ず止めるもの。 */
  const pendingTimers = new Set<number>();
  function later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      pendingTimers.delete(id);
      fn();
    }, ms);
    pendingTimers.add(id);
  }

  function teardown(): void {
    window.clearInterval(timer);
    for (const id of pendingTimers) window.clearTimeout(id);
    pendingTimers.clear();
    resizeObserver.disconnect();
    cancelDrag();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerAbort);
    window.removeEventListener('blur', onPointerAbort);
    window.removeEventListener('keydown', onSoundKeydown);
    ctx.audio.stop();
    ctx.effects.stop();
  }

  window.addEventListener('keydown', onSoundKeydown);

  root.addEventListener('screen:destroy', teardown);

  // ---- 入力 ---------------------------------------------------------------

  /** 判定中・演出中・正解表示中は入力を受けない。 */
  let busy = false;
  /** タップで選んである札。スライドを始めるときに解除する。 */
  let tapSelectedId: string | null = null;
  /** スライドで動かした直後の click を回答にしないための印。 */
  let swallowNextClick = false;

  interface DragState {
    pointerId: number;
    cardId: string;
    node: HTMLButtonElement;
    startX: number;
    startY: number;
    moved: boolean;
  }
  let drag: DragState | null = null;

  function refreshStats(): void {
    pairsValue.textContent = `${session.matchedPairCount} / ${session.totalPairCount}`;
    mistakesValue.textContent = String(session.incorrectSelections);
  }

  function setState(cardId: string, state: 'selected' | 'wrong' | 'matched' | 'none'): void {
    const node = cardNodes.get(cardId);
    if (!node) return;
    node.classList.toggle('is-selected', state === 'selected');
    node.classList.toggle('is-wrong', state === 'wrong');
    if (state === 'matched') {
      node.classList.add('is-matched');
      node.disabled = true;
    }
    node.setAttribute('aria-pressed', state === 'selected' ? 'true' : 'false');
  }

  function showNotice(text: string, ms: number): void {
    notice.textContent = text;
    later(() => {
      if (notice.textContent === text) notice.textContent = '';
    }, ms);
  }

  /** 正解の演出。淡い金色の光と、明るい短い効果音。 */
  function playCorrectFeedback(cardIds: readonly string[]): void {
    for (const id of cardIds) cardNodes.get(id)?.classList.add('is-correct-glow');
    ctx.effects.play('correct');
    later(() => {
      for (const id of cardIds) cardNodes.get(id)?.classList.remove('is-correct-glow');
    }, CORRECT_GLOW_MS);
  }

  /** 不正解の演出。赤い縁・文字の知らせ・控えめな効果音・短い振動。 */
  function playIncorrectFeedback(): void {
    ctx.effects.play('incorrect');
    // 振動は音の設定とは独立。非対応・拒否なら false が返るだけで進行は止めない。
    ctx.effects.vibrate(VIBRATE_MS);
    showNotice(UI.karta.retry, INCORRECT_DISPLAY_MS + 200);
  }

  function onCardTap(cardId: string): void {
    if (busy || soundOpen) return;
    // 最初のユーザー操作で音声コンテキストを用意する（自動再生の制限への備え）。
    void ctx.effects.prepare();
    const outcome = session.selectCard(cardId, performance.now());
    switch (outcome.kind) {
      case 'ignored':
        return;
      case 'selected':
        tapSelectedId = outcome.cardId;
        setState(outcome.cardId, 'selected');
        return;
      case 'deselected':
        tapSelectedId = null;
        setState(outcome.cardId, 'none');
        return;
      case 'rejected-same-language': {
        // 同じ言語同士は不成立。誤答には数えず、短く知らせて選択を解除する。
        busy = true;
        tapSelectedId = null;
        for (const id of outcome.cardIds) cardNodes.get(id)?.classList.add('is-rejected');
        showNotice(UI.karta.sameLanguage, SAME_LANGUAGE_DISPLAY_MS + 200);
        later(() => {
          for (const id of outcome.cardIds) {
            cardNodes.get(id)?.classList.remove('is-rejected');
            setState(id, 'none');
          }
          session.resolve();
          busy = false;
        }, SAME_LANGUAGE_DISPLAY_MS);
        return;
      }
      case 'incorrect': {
        busy = true;
        tapSelectedId = null;
        for (const id of outcome.cardIds) setState(id, 'wrong');
        refreshStats();
        playIncorrectFeedback();
        later(() => {
          for (const id of outcome.cardIds) setState(id, 'none');
          session.resolve();
          busy = false;
        }, INCORRECT_DISPLAY_MS);
        return;
      }
      case 'correct': {
        busy = true;
        tapSelectedId = null;
        for (const id of outcome.cardIds) setState(id, 'selected');
        refreshStats();
        playCorrectFeedback(outcome.cardIds);
        // 光を見せてから単語パネルへ。光とパネルが重ならないようにする。
        later(() => showPronunciation(outcome.pairId, outcome.cardIds), CORRECT_GLOW_MS);
        return;
      }
    }
  }

  // ---- スライド回答 -------------------------------------------------------

  function canDrag(cardId: string): boolean {
    if (busy || soundOpen) return false;
    const node = cardNodes.get(cardId);
    if (!node || node.disabled) return false;
    return true;
  }

  function onPointerDown(event: PointerEvent, cardId: string): void {
    // 前の操作で立てた印は、新しい操作の最初に必ず落とす。
    // pointerup のあと click が来ない経路（別の要素へ離した等）で
    // 印が残り、次のタップを飲んでしまうのを防ぐ。
    swallowNextClick = false;
    if (drag !== null) return;
    if (!canDrag(cardId)) return;
    // 複数指の2本目以降は無視する。1枚ずつだけ動かす。
    if (!event.isPrimary) return;
    const node = cardNodes.get(cardId);
    if (!node) return;

    void ctx.effects.prepare();

    // ここでは選択に手を付けない。
    // 指を置いただけではタップかスライドか決まらないので、
    // 選択の解除は「実際に動き出したとき」（onPointerMove）まで待つ。
    // pointerdown で解除すると、1枚えらんで次の札をタップする回答が
    // 2枚目を押した瞬間に1枚目の選択を失い、成立しなくなる。
    drag = {
      pointerId: event.pointerId,
      cardId,
      node,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    try {
      node.setPointerCapture(event.pointerId);
    } catch {
      // 捕捉できない環境でも、window 側のイベントで追従させる。
    }
  }

  function onPointerMove(event: PointerEvent): void {
    const state = drag;
    if (!state || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!state.moved) {
      state.moved = true;
      // ここでスライドだと確定する。
      // タップで選びかけていた別の札があれば、ここで解除する。
      if (tapSelectedId !== null && tapSelectedId !== state.cardId) {
        session.selectCard(tapSelectedId, performance.now());
        setState(tapSelectedId, 'none');
        tapSelectedId = null;
      }
      state.node.classList.add('is-dragging');
      // ドラッグ中の札は判定対象から外す。重ねる先を正しく拾うため。
      state.node.style.pointerEvents = 'none';
    }
    state.node.style.setProperty('--drag-x', `${dx}px`);
    state.node.style.setProperty('--drag-y', `${dy}px`);
    // 指でのスクロールに取られないようにする。
    if (event.cancelable) event.preventDefault();
  }

  /** ドラッグの見た目と捕捉だけを戻す。採点はしない。 */
  function cancelDrag(): void {
    const state = drag;
    drag = null;
    if (!state) return;
    try {
      if (state.node.hasPointerCapture(state.pointerId)) {
        state.node.releasePointerCapture(state.pointerId);
      }
    } catch {
      /* 解放の失敗は無視する */
    }
    state.node.classList.remove('is-dragging');
    state.node.style.pointerEvents = '';
    state.node.style.removeProperty('--drag-x');
    state.node.style.removeProperty('--drag-y');
  }

  function onPointerAbort(): void {
    // pointercancel・画面離脱。採点せず、札を元の位置へ戻す。
    if (drag?.moved) swallowNextClick = true;
    cancelDrag();
  }

  function onPointerUp(event: PointerEvent): void {
    const state = drag;
    if (!state || event.pointerId !== state.pointerId) return;
    const moved = state.moved;
    const sourceId = state.cardId;
    // 指を離した位置にある札を、見た目を戻す前に拾う。
    const targetId = moved ? cardIdAtPoint(event.clientX, event.clientY) : null;
    cancelDrag();

    if (!moved) {
      // 動かしていないので、ふつうのタップとして click に任せる。
      return;
    }
    // 動かしたので、このあとの click は回答にしない。
    swallowNextClick = true;

    if (targetId === null || targetId === sourceId) {
      // 盤面や背景へ離した。採点しない。
      return;
    }
    const target = cardById.get(targetId);
    const source = cardById.get(sourceId);
    if (!source || !target) return;
    if (session.isMatched(target.pairId) || session.isMatched(source.pairId)) return;
    if (source.lang === target.lang) {
      // 同じ言語へ重ねた。採点せず、短く知らせるだけ。
      flashSameLanguage([sourceId, targetId]);
      return;
    }
    answerPair(sourceId, targetId);
  }

  /**
   * 指を離した位置にある札のID。
   * ドラッグ中の札は pointer-events: none にしてあるので拾われない。
   */
  function cardIdAtPoint(x: number, y: number): string | null {
    const node = document.elementFromPoint(x, y);
    if (!(node instanceof Element)) return null;
    const card = node.closest<HTMLElement>('.card');
    if (!card) return null;
    const id = card.getAttribute('data-card-id');
    return id !== null && cardNodes.has(id) ? id : null;
  }

  /** 同じ言語同士を重ねたときの知らせ。採点も選択も変えない。 */
  function flashSameLanguage(cardIds: readonly string[]): void {
    for (const id of cardIds) cardNodes.get(id)?.classList.add('is-rejected');
    showNotice(UI.karta.sameLanguage, SAME_LANGUAGE_DISPLAY_MS + 200);
    later(() => {
      for (const id of cardIds) cardNodes.get(id)?.classList.remove('is-rejected');
    }, SAME_LANGUAGE_DISPLAY_MS);
  }

  /**
   * 2枚を続けて選び、タップと同じ判定を通す。
   * 判定も演出も記録も、タップのときと同じ経路になる。
   */
  function answerPair(sourceId: string, targetId: string): void {
    if (busy) return;
    const first = session.selectCard(sourceId, performance.now());
    if (first.kind !== 'selected') {
      // 選べなかった（ロック中など）。何も起きていない状態へ戻す。
      if (first.kind === 'deselected') setState(sourceId, 'none');
      return;
    }
    setState(sourceId, 'selected');
    tapSelectedId = sourceId;
    onCardTap(targetId);
  }

  // ドラッグの続きは window で受ける。札の外へ指が出ても追従できる。
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerAbort);
  window.addEventListener('blur', onPointerAbort);

  function showPronunciation(pairId: number, cardIds: readonly string[]): void {
    const pair = findPair(pairId);
    if (!pair) {
      finishCorrect(cardIds);
      return;
    }
    overlayHost.append(
      pronunciationPanel({
        pair,
        audio: ctx.audio,
        // 効果音がまだ残っていれば、その分だけ読み上げを後ろへずらす。
        // 絵と単語の表示はこの待ちと関係なく、すぐ出る。
        speakDelayMs: ctx.effects.remainingMs(),
        onNext: () => {
          ctx.audio.stop();
          overlayHost.replaceChildren();
          finishCorrect(cardIds);
        },
      }),
    );
  }

  function finishCorrect(cardIds: readonly string[]): void {
    for (const id of cardIds) setState(id, 'matched');
    session.resolve();
    busy = false;
    timeValue.textContent = formatDuration(session.elapsedMs(performance.now()));
    if (session.isCleared) finish();
  }

  function finish(): void {
    // 以降は入力も演出も受け付けない。二重保存を防ぐ。
    busy = true;
    teardown();

    /*
     * 体験は学習記録を一切書き込まない。
     * 通常の結果・履歴・ベストタイム・訪問国・出会ったキャラクターのどれも増やさず、
     * 「体験完了」から通常のプレイへ移ってもらう。
     */
    if (trial) {
      showTrialDone();
      return;
    }

    const course = findCourse(ctx.selection.courseId);
    const elapsedMs = session.elapsedMs(performance.now());
    const result: PlayResult = {
      courseId: course?.id ?? '',
      courseLabel: course?.label ?? '',
      cardCount,
      matchedPairs: session.matchedPairCount,
      correctSelections: session.correctSelections,
      incorrectSelections: session.incorrectSelections,
      elapsedMs,
      accuracy: calculateAccuracy(session.correctSelections, session.incorrectSelections),
      pairStats: session.pairStats(),
    };
    ctx.lastResult = result;
    // 自己ベスト判定は記録を更新する前に行う。
    ctx.lastResultWasBest = isNewBestTime(ctx.records.get(), cardCount, elapsedMs);

    const visitedId = ctx.selection.destinationId;
    ctx.records.update((record) => {
      const updated = applyPlayResult(record, result, new Date());
      if (!visitedId || updated.visitedCountryIds.includes(visitedId)) return updated;
      return { ...updated, visitedCountryIds: [...updated.visitedCountryIds, visitedId] };
    });

    // ウェーブ終了。NPC が称賛したあとに確認テストの案内へ進む。
    // 結果画面には覚えたことばが日本語と英語で並ぶため、
    // テストは結果画面より前に置き、答えが見えない状態で受けられるようにする。
    // 会話を閉じても記録はすでに保存済みで、進行は失われない。
    showWaveEndChat(() =>
      ctx.navigate(FEATURES.waveQuiz ? { name: 'quizPrompt' } : { name: 'result' }),
    );
  }

  /**
   * 体験の終わり。
   * 学習記録には何も書かず、通常のプレイへの入口だけを出す。
   */
  function showTrialDone(): void {
    const panel = el('div', { class: 'pronounce trial-done', role: 'dialog', 'aria-modal': 'true' }, [
      el('p', { class: 'trial-done__badge', text: UI.karta.trialBadge }),
      el('p', { class: 'pronounce__ja', text: UI.karta.trialDone }),
      el('p', { class: 'trial-done__lead', text: UI.karta.trialDoneLead }),
      el('div', { class: 'pronounce__actions' }, [
        button(UI.karta.trialToNormal, () => {
          overlayHost.replaceChildren();
          ctx.navigate({ name: 'courseEntry' });
        }, { class: 'btn btn--primary' }),
      ]),
    ]);
    overlayHost.append(el('div', { class: 'overlay' }, [panel]));
    panel.querySelector<HTMLButtonElement>('.btn--primary')?.focus();
  }

  /**
   * ウェーブ終了時の台本式チャット。
   * 自分のキャラクターが未選択、NPC がいない、台本が無い場合は
   * 何も出さずにそのまま次へ進む。
   */
  function showWaveEndChat(next: () => void): void {
    const record = ctx.records.get();
    const me = findAvatar(record.selectedAvatarId);
    if (!me) {
      next();
      return;
    }

    const [npc] = castNpcs(
      {
        screen: 'wave-end',
        selectedAvatarId: me.id,
        recentAvatarIds: record.recentNpcAvatarIds,
        countryId: ctx.selection.destinationId ?? undefined,
        courseId: ctx.selection.courseId ?? undefined,
        seed: ctx.castSeed + session.matchedPairCount,
      },
      AVATARS,
    );
    const script = npc ? pickScript('wave-end', ctx.castSeed + npc.order) : undefined;
    if (!npc || !script) {
      next();
      return;
    }

    ctx.records.update((current) =>
      rememberMetAvatar(
        { ...current, recentNpcAvatarIds: rememberCast(current.recentNpcAvatarIds, [npc.id]) },
        npc.id,
      ),
    );

    overlayHost.append(
      chatPanel({
        script,
        npc,
        me,
        audio: ctx.audio,
        onClose: () => {
          overlayHost.replaceChildren();
          next();
        },
      }),
    );
  }

  refreshStats();
  return root;
}

function createCardNode(card: Card): HTMLButtonElement {
  const node = el('button', {
    type: 'button',
    class: `card card--${card.lang}`,
    'data-card-id': card.id,
    'data-lang': card.lang,
    'aria-pressed': 'false',
    'aria-label': card.text,
  });
  /*
   * 言語の区別は、短いラベル（角の小さな印）と左右の置き場所で示す。
   * ラベルは CSS の content で描く。札の中へ文字要素として足すと、
   * 札の textContent と読み上げ名に混ざって「あきいろ」のように読めてしまう。
   * 絶対配置なので、文字の折り返し幅と高さにも影響しない。
   */
  /*
   * 正解のときに中心から広がる光。中身は空なので、
   * 札の textContent と読み上げ名には混ざらない。
   * 文字より先に置いて、文字の下へ回す。
   */
  node.append(el('span', { class: 'card__glow', 'aria-hidden': 'true' }));
  node.append(el('span', { class: 'card__text', text: card.text }));
  return node;
}
