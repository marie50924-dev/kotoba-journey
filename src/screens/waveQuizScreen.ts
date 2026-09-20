import { el, button } from '../app/dom';
import { UI } from '../data/strings';
import { scoreQuiz } from '../domain/waveQuiz';
import type { QuizQuestion } from '../domain/waveQuiz';
import { appendQuizRecord, toDateKey } from '../storage/learningRecord';
import { screenShell } from '../components/screenShell';
import type { AppContext } from '../app/state';

/** 正誤を見せる時間。 */
const FEEDBACK_MS = 700;

/**
 * 確認テスト本体。
 * 出題はそのウェーブの単語だけ。日→英と英→日の2形式を出す。
 * 音声形式は Phase 1 では出さない（AudioService で安全に実現できる場合のみ後続で追加）。
 */
export function waveQuizScreen(ctx: AppContext): HTMLElement {
  const active = ctx.quiz;
  if (!active || active.questions.length === 0) {
    return screenShell({ title: UI.quiz.heading, onBack: () => ctx.back() }, [
      el('p', { class: 'note', text: UI.passport.empty }),
      el('div', { class: 'screen__footer' }, [
        button(UI.actions.next, () => ctx.navigate({ name: 'worldMap' }), { class: 'btn btn--primary' }),
      ]),
    ]);
  }
  // 以降は必ず有効なテストがある状態で扱う。
  const quiz = active;

  let index = 0;
  let locked = false;

  const progress = el('p', { class: 'quiz__progress' });
  const formatLabel = el('p', { class: 'quiz__format' });
  const prompt = el('p', { class: 'quiz__prompt' });
  const choiceList = el('div', { class: 'quiz__choices' });

  const root = screenShell({ title: UI.quiz.heading, variant: 'screen--quiz' }, [
    progress,
    el('div', { class: 'quiz__card' }, [formatLabel, prompt]),
    choiceList,
  ]);

  function finish(): void {
    const outcome = scoreQuiz(quiz.questions, quiz.answers);
    const elapsedMs = Math.round(Math.max(0, performance.now() - quiz.startedAtMs));
    quiz.outcome = outcome;
    quiz.elapsedMs = elapsedMs;

    const wave = ctx.wave;
    if (wave) {
      // テスト結果は通常カルタの集計とは別フィールドへ保存する。
      ctx.records.update((record) =>
        appendQuizRecord(record, {
          date: toDateKey(new Date()),
          courseId: ctx.selection.courseId ?? '',
          destinationId: ctx.selection.destinationId ?? '',
          waveId: wave.waveId,
          status: 'completed',
          questionCount: outcome.questionCount,
          correctCount: outcome.correctCount,
          incorrectPairIds: outcome.incorrectPairIds,
          elapsedMs,
        }),
      );
    }
    ctx.navigate({ name: 'quizResult' });
  }

  function render(): void {
    const question: QuizQuestion = quiz.questions[index];
    locked = false;
    progress.textContent = `${index + 1} / ${quiz.questions.length} ${UI.quiz.questionOf}`;
    formatLabel.textContent =
      question.format === 'ja-to-en' ? UI.quiz.jaToEn : UI.quiz.enToJa;
    prompt.textContent = question.prompt;

    choiceList.replaceChildren(
      ...question.choices.map((choice) => {
        const node = el('button', {
          type: 'button',
          class: 'quiz-choice',
          'data-pair-id': choice.pairId,
        });
        node.textContent = choice.text;
        node.addEventListener('click', () => answer(question, choice.pairId, node));
        return node;
      }),
    );
  }

  function answer(question: QuizQuestion, chosenPairId: number, node: HTMLButtonElement): void {
    if (locked) return;
    locked = true;
    quiz.answers.set(question.id, chosenPairId);

    const correct = chosenPairId === question.pairId;
    node.classList.add(correct ? 'is-correct' : 'is-wrong');
    if (!correct) {
      const answerNode = choiceList.querySelector(`[data-pair-id="${question.pairId}"]`);
      answerNode?.classList.add('is-answer');
    }
    for (const b of choiceList.querySelectorAll('button')) b.disabled = true;

    window.setTimeout(() => {
      index += 1;
      if (index >= quiz.questions.length) finish();
      else render();
    }, FEEDBACK_MS);
  }

  render();
  return root;
}
