import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { SAMPLE_PAIRS } from '../data/wordPairs';
import { answerLanguageFor, buildWaveQuiz, quizFormatForSeed } from '../domain/waveQuiz';
import { appendQuizRecord, toDateKey } from '../storage/learningRecord';
import { findAvatar, displayName } from '../data/avatars';
import { avatarThumb } from '../components/avatarThumb';
import { TITLE_ASSETS } from '../data/titleAssets';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/**
 * ウェーブ後の「テストを受ける／今回はスキップ」の選択。
 *
 * 受験は任意。スキップしても次のウェーブや報酬で不利にせず、
 * 責めるような文言も出さない。
 *
 * この画面はカルタの直後・結果画面の前に入る。
 * 結果画面には覚えたことばが日本語と英語で並ぶため、
 * そこを通ってからテストを受けると答えが見えてしまう。
 */
export function quizPromptScreen(ctx: AppContext): HTMLElement {
  const wave = ctx.wave;
  const cardCount = ctx.selection.cardCount ?? 6;
  const me = findAvatar(ctx.records.get().selectedAvatarId);

  // どちらの言語で入力するかは出題前に伝える。テスト中に切り替わることはない。
  const answerLanguage = answerLanguageFor(quizFormatForSeed(wave?.seed ?? 0));

  function takeQuiz(): void {
    if (!wave) {
      ctx.navigate({ name: 'result' });
      return;
    }
    const questions = buildWaveQuiz({
      wavePairIds: wave.pairIds,
      cardCount,
      seed: wave.seed,
      pairs: SAMPLE_PAIRS,
    });
    if (questions.length === 0) {
      ctx.navigate({ name: 'result' });
      return;
    }
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
    ctx.quiz = null;
    ctx.navigate({ name: 'result' });
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
        // 自分のキャラクター。立ち絵が納品されたら avatarThumb の中だけが差し替わる。
        me
          ? el('div', { class: 'quiz-prompt__me' }, [
              avatarThumb(me, { size: 'md' }),
              el('span', { class: 'quiz-prompt__me-name', text: displayName(me) }),
            ])
          : null,
      ]),
      el('p', { class: 'quiz-prompt__lead', text: UI.quiz.promptLead }),
      el('p', {
        class: 'quiz-prompt__mode',
        text: answerLanguage === 'en' ? UI.quiz.promptTypeEn : UI.quiz.promptTypeJa,
      }),
      el('p', { class: 'note', text: UI.quiz.promptDetail }),
      el('div', { class: 'screen__footer screen__footer--stack' }, [
        button(UI.actions.takeQuiz, takeQuiz, { class: 'btn btn--primary btn--large' }),
        button(UI.actions.skipQuiz, skipQuiz, { class: 'btn' }),
      ]),
    ],
  );
}
