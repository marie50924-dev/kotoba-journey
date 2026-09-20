import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { findPair } from '../data/wordPairs';
import { formatDuration, groupByMastery } from '../domain/scoring';
import { screenShell } from '../components/screenShell';
import { npcBar } from '../components/npcBar';
import { FEATURES } from '../app/features';
import type { AppContext } from '../app/state';
import type { MasteryLevel } from '../domain/types';

/** 結果・分析画面。プレイ結果はカルタ画面ですでに学習記録へ反映済み。 */
export function resultScreen(ctx: AppContext): HTMLElement {
  const result = ctx.lastResult;
  if (!result) {
    return screenShell({ title: UI.result.heading, onBack: () => ctx.navigate({ name: 'title' }) }, [
      el('p', { class: 'note', text: UI.passport.empty }),
    ]);
  }

  const record = ctx.records.get();
  const bestTime = record.bestTimeMs[result.cardCount];
  const grouped = groupByMastery(result.pairStats);

  const stats = el('div', { class: 'stat-grid' }, [
    statTile(UI.result.accuracy, `${result.accuracy}${UI.units.percent}`),
    statTile(UI.result.clearTime, formatDuration(result.elapsedMs)),
    statTile(
      UI.result.bestTime,
      bestTime === undefined ? '—' : formatDuration(bestTime),
      ctx.lastResultWasBest ? UI.result.newBest : undefined,
    ),
    statTile(UI.result.learnedWords, `${grouped.mastered.length}${UI.units.words}`),
  ]);

  const levels: MasteryLevel[] = ['mastered', 'practicing', 'review'];
  const masteryLists = levels.map((level) =>
    el('div', { class: `mastery mastery--${level}` }, [
      el('h2', { class: 'mastery__title', text: UI.mastery[level] }),
      el(
        'ul',
        { class: 'word-list' },
        grouped[level].length === 0
          ? [el('li', { class: 'word-list__empty', text: '—' })]
          : grouped[level].map((pairId) => wordItem(pairId)),
      ),
    ]),
  );

  const mistakenPairIds = result.pairStats.filter((s) => s.mistakes > 0).map((s) => s.pairId);
  const mistakenSection = el('section', { class: 'result-section' }, [
    el('h2', { class: 'result-section__title', text: UI.result.mistakenWords }),
    mistakenPairIds.length === 0
      ? el('p', { class: 'note', text: UI.result.noMistakes })
      : el('ul', { class: 'word-list' }, mistakenPairIds.map((pairId) => wordItem(pairId))),
  ]);

  return screenShell(
    { title: UI.result.heading, variant: 'screen--result' },
    [
      stats,
      el('section', { class: 'result-section' }, [
        el('h2', { class: 'result-section__title', text: UI.result.learnedWords }),
        el('div', { class: 'mastery-grid' }, masteryLists),
      ]),
      mistakenSection,
      // 結果画面では次回の案内をする。
      npcBar(ctx, {
        screen: 'result',
        trigger: 'result',
        courseId: ctx.selection.courseId ?? undefined,
      }),
      el('div', { class: 'screen__footer screen__footer--stack' }, [
        // 確認テストは最終仕様（直接入力式）と異なるため、
        // FEATURES.waveQuiz = false の間は結果画面から呼び出さない。
        // Phase 1-C2 で直接入力テストへ差し替える。
        FEATURES.waveQuiz
          ? button(UI.actions.next, () => ctx.navigate({ name: 'quizPrompt' }), {
              class: 'btn btn--primary btn--large',
            })
          : button(UI.actions.retry, () => ctx.navigate({ name: 'karta' }), {
              class: 'btn btn--primary btn--large',
            }),
        el('div', { class: 'button-row' }, [
          button(UI.actions.continue, () => ctx.navigate({ name: 'worldMap' }), { class: 'btn' }),
          button(UI.actions.passport, () => ctx.navigate({ name: 'passport' }), { class: 'btn' }),
        ]),
      ]),
    ],
  );
}

function statTile(label: string, value: string, badge?: string): HTMLElement {
  return el('div', { class: 'stat-tile' }, [
    el('span', { class: 'stat-tile__label', text: label }),
    el('strong', { class: 'stat-tile__value', text: value }),
    badge ? el('span', { class: 'stat-tile__badge', text: badge }) : null,
  ]);
}

function wordItem(pairId: number): HTMLElement {
  const pair = findPair(pairId);
  return el('li', { class: 'word-list__item' }, [
    el('span', { class: 'word-list__ja', text: pair?.ja ?? '?' }),
    el('span', { class: 'word-list__en', text: pair?.en ?? '?' }),
  ]);
}
