import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { findPair } from '../data/wordPairs';
import { findAvatar, displayName } from '../data/avatars';
import { avatarThumb } from '../components/avatarThumb';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/**
 * 確認テストの結果。
 * 通常カルタの結果とは別物であることが分かる見出しにし、
 * 間違いを責めず前向きな文言にする。
 */
export function waveQuizResultScreen(ctx: AppContext): HTMLElement {
  const quiz = ctx.quiz;
  const outcome = quiz?.outcome;
  const me = findAvatar(ctx.records.get().selectedAvatarId);

  if (!outcome) {
    return screenShell({ title: UI.quiz.resultHeading }, [
      el('p', { class: 'note', text: UI.passport.empty }),
      el('div', { class: 'screen__footer' }, [
        button(UI.actions.next, () => ctx.navigate({ name: 'result' }), {
          class: 'btn btn--primary btn--large',
        }),
      ]),
    ]);
  }

  const mistaken = outcome.incorrectPairIds;

  return screenShell(
    { title: UI.quiz.resultHeading, variant: 'screen--quiz-result' },
    [
      el('div', { class: 'quiz-result__hero' }, [
        me
          ? el('div', { class: 'quiz-result__me' }, [
              avatarThumb(me, { size: 'md' }),
              el('span', { class: 'quiz-result__me-name', text: displayName(me) }),
            ])
          : null,
        el('div', { class: 'stat-tile quiz-result__score' }, [
          el('span', { class: 'stat-tile__label', text: UI.quiz.correctCount }),
          el('strong', {
            class: 'stat-tile__value',
            text: `${outcome.correctCount} / ${outcome.questionCount}`,
          }),
        ]),
      ]),
      el('section', { class: 'result-section' }, [
        el('h2', { class: 'result-section__title', text: UI.quiz.mistaken }),
        mistaken.length === 0
          ? el('p', { class: 'note', text: UI.quiz.allCorrect })
          : el(
              'ul',
              { class: 'word-list' },
              mistaken.map((pairId) => {
                const pair = findPair(pairId);
                return el('li', { class: 'word-list__item' }, [
                  el('span', { class: 'word-list__ja', text: pair?.ja ?? '?' }),
                  el('span', { class: 'word-list__en', text: pair?.en ?? '?' }),
                ]);
              }),
            ),
      ]),
      el('p', { class: 'note', text: UI.quiz.encourage }),
      el('div', { class: 'screen__footer screen__footer--stack' }, [
        // テストのあとに結果・分析へ進む。ここで初めて覚えたことばの一覧が出る。
        button(UI.actions.next, () => ctx.navigate({ name: 'result' }), {
          class: 'btn btn--primary btn--large',
        }),
      ]),
    ],
  );
}
