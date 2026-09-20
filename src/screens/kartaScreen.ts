import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { SAMPLE_PAIRS, findPair } from '../data/wordPairs';
import { findCourse } from '../data/courses';
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

const INCORRECT_DISPLAY_MS = 800;
const SAME_LANGUAGE_DISPLAY_MS = 450;

/**
 * カルタ画面。
 * 盤面は縦スクロールさせず、20枚でも必ず一画面へ収める。
 * カードの配置は衝突しないスロット方式で計算し、傾きだけを小さく変化させる。
 */
export function kartaScreen(ctx: AppContext): HTMLElement {
  const cardCount: CardCount = ctx.selection.cardCount ?? 6;
  const seed = createSeed();
  const deck = buildDeck(SAMPLE_PAIRS, cardCount, seed);
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

  const cardNodes = new Map<string, HTMLButtonElement>();
  for (const card of deck) {
    const node = createCardNode(card);
    node.addEventListener('click', () => onCardTap(card.id));
    cardNodes.set(card.id, node);
    board.append(node);
  }

  const header = el('header', { class: 'karta__bar' }, [
    button(UI.karta.quit, () => ctx.navigate({ name: 'worldMap' }), { class: 'btn btn--ghost btn--back' }),
    el('div', { class: 'karta__stats' }, [
      el('span', {}, [`${UI.karta.pairsLabel} `, pairsValue]),
      el('span', {}, [`${UI.karta.mistakesLabel} `, mistakesValue]),
      el('span', {}, [`${UI.karta.timeLabel} `, timeValue]),
    ]),
  ]);

  const root = el('section', { class: 'screen screen--fixed screen--karta' }, [
    header,
    el('div', { class: 'karta__board-wrap' }, [board, overlayHost]),
    el('p', { class: 'karta__hint note', text: UI.karta.hint }),
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

    const fontSize = Math.max(11, Math.min(20, layout.cardHeight * 0.3));
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
    });
  }

  const resizeObserver = new ResizeObserver(() => applyLayout());
  resizeObserver.observe(board);
  requestAnimationFrame(applyLayout);

  // ---- 経過時間 -----------------------------------------------------------

  const timer = window.setInterval(() => {
    if (!session.isCleared) timeValue.textContent = formatDuration(session.elapsedMs(performance.now()));
  }, 250);

  function teardown(): void {
    window.clearInterval(timer);
    resizeObserver.disconnect();
    ctx.audio.stop();
  }

  root.addEventListener('screen:destroy', teardown);

  // ---- 入力 ---------------------------------------------------------------

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

  function onCardTap(cardId: string): void {
    const outcome = session.selectCard(cardId, performance.now());
    switch (outcome.kind) {
      case 'ignored':
        return;
      case 'selected':
        setState(outcome.cardId, 'selected');
        return;
      case 'deselected':
        setState(outcome.cardId, 'none');
        return;
      case 'rejected-same-language': {
        // 同じ言語同士は不成立。誤答には数えず、短く知らせて選択を解除する。
        for (const id of outcome.cardIds) cardNodes.get(id)?.classList.add('is-rejected');
        window.setTimeout(() => {
          for (const id of outcome.cardIds) {
            cardNodes.get(id)?.classList.remove('is-rejected');
            setState(id, 'none');
          }
          session.resolve();
        }, SAME_LANGUAGE_DISPLAY_MS);
        return;
      }
      case 'incorrect': {
        for (const id of outcome.cardIds) setState(id, 'wrong');
        refreshStats();
        window.setTimeout(() => {
          for (const id of outcome.cardIds) setState(id, 'none');
          session.resolve();
        }, INCORRECT_DISPLAY_MS);
        return;
      }
      case 'correct': {
        for (const id of outcome.cardIds) setState(id, 'selected');
        refreshStats();
        window.setTimeout(() => showPronunciation(outcome.pairId, outcome.cardIds), 320);
        return;
      }
    }
  }

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
    timeValue.textContent = formatDuration(session.elapsedMs(performance.now()));
    if (session.isCleared) finish();
  }

  function finish(): void {
    teardown();
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
    'aria-pressed': 'false',
    'aria-label': card.text,
  });
  node.append(el('span', { class: 'card__text', text: card.text }));
  return node;
}
