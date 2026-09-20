import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { SAMPLE_PAIRS } from '../data/wordPairs';
import { buildWaveQuiz } from '../domain/waveQuiz';
import { appendQuizRecord, toDateKey } from '../storage/learningRecord';
import { findCourse } from '../data/courses';
import { ageGroupForCourse, findAgeGroup } from '../data/characters';
import { characterCard } from '../components/characterCard';
import { TITLE_ASSETS } from '../data/titleAssets';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/**
 * ウェーブ後の「テストを受ける／今回はスキップ」の選択。
 *
 * 受験は任意。スキップしても次のウェーブや報酬で不利にせず、
 * 責めるような文言も出さない。
 */
export function quizPromptScreen(ctx: AppContext): HTMLElement {
  const group = findAgeGroup(
    ageGroupForCourse(findCourse(ctx.selection.courseId), ctx.records.get().characterAgeGroup),
  )!;
  const wave = ctx.wave;
  const cardCount = ctx.selection.cardCount ?? 6;

  function takeQuiz(): void {
    if (!wave) {
      ctx.navigate({ name: 'worldMap' });
      return;
    }
    const questions = buildWaveQuiz({
      wavePairIds: wave.pairIds,
      cardCount,
      seed: wave.seed,
      pairs: SAMPLE_PAIRS,
    });
    ctx.quiz = {
      questions,
      answers: new Map(),
      startedAtMs: performance.now(),
      outcome: null,
      elapsedMs: 0,
    };
    ctx.navigate({ name: 'quiz' });
  }

  function skipQuiz(): void {
    // スキップも記録するが、不正解としては数えない。
    if (wave) {
      ctx.records.update((record) =>
        appendQuizRecord(record, {
          date: toDateKey(new Date()),
          courseId: ctx.selection.courseId ?? '',
          destinationId: ctx.selection.destinationId ?? '',
          waveId: wave.waveId,
          status: 'skipped',
          questionCount: 0,
          correctCount: 0,
          incorrectPairIds: [],
          elapsedMs: 0,
        }),
      );
    }
    ctx.navigate({ name: 'worldMap' });
  }

  return screenShell(
    { title: UI.quiz.promptHeading, variant: 'screen--quiz-prompt' },
    [
      el('div', { class: 'quiz-prompt__cast' }, [
        el('img', {
          class: 'quiz-prompt__guide',
          src: TITLE_ASSETS.mascot,
          alt: UI.characters.guideAlt,
          decoding: 'async',
        }),
        characterCard(group, { variant: 'plain', class: 'quiz-prompt__chara' }),
      ]),
      el('p', { class: 'quiz-prompt__lead', text: UI.quiz.promptLead }),
      el('p', { class: 'note', text: UI.quiz.promptDetail }),
      el('div', { class: 'screen__footer screen__footer--stack' }, [
        button(UI.actions.takeQuiz, takeQuiz, { class: 'btn btn--primary btn--large' }),
        button(UI.actions.skipQuiz, skipQuiz, { class: 'btn' }),
      ]),
    ],
  );
}
